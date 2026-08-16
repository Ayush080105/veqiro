import { AuthScheme } from "@composio/core";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { McpConnectionStatus } from "../../../prisma/generated/prisma/client.js";
import { composioClient } from "../../lib/composio.js";
import type { McpProviderAdapter } from "./mcp.provider.js";

// Composio tags each tool with a real, verified-live vocabulary (confirmed by
// direct API probe against the Slack toolkit — see mcp.provider.composio.ts
// git history / session notes): readOnlyHint plus separate createHint/
// updateHint/deleteHint/destructiveHint mutation markers, alongside unrelated
// topical tags (search, chat, files, ...) that carry no read/write signal.
// Any of the mutation tags means write; readOnlyHint alone means read.
// Falls back to a verb heuristic when neither is present. Fail-closed: an
// unrecognized/ambiguous tool name is treated as a write.
const WRITE_TAGS = ["destructiveHint", "createHint", "updateHint", "deleteHint"];
const READ_VERB = /^(GET|LIST|FETCH|FIND|SEARCH|QUERY|READ|RETRIEVE|SHOW|VIEW|LOOKUP|DESCRIBE|EXPORT|COUNT)/i;

const classifyWrite = (tool: { slug: string; tags?: string[] }, toolkitSlug: string): boolean => {
  const tags = tool.tags ?? [];
  if (WRITE_TAGS.some((t) => tags.includes(t))) return true;
  if (tags.includes("readOnlyHint")) return false;
  const afterPrefix = tool.slug.replace(new RegExp(`^${toolkitSlug}_`, "i"), "");
  return !READ_VERB.test(afterPrefix);
};

const mapConnectionStatus = (state: string | undefined): McpConnectionStatus => {
  switch (state) {
    case "ACTIVE":
      return McpConnectionStatus.CONNECTED;
    case "INITIALIZING":
    case "INITIATED":
      return McpConnectionStatus.AUTH_REQUIRED;
    case "FAILED":
    case "EXPIRED":
    case "REVOKED":
      return McpConnectionStatus.ERROR;
    case "INACTIVE":
      return McpConnectionStatus.DISCONNECTED;
    default:
      return McpConnectionStatus.PENDING;
  }
};

// OAuth-family schemes need a real provider-issued OAuth app manually
// registered (Twitter, PayPal — kept "coming-soon" in the catalog for this
// reason) and can't be self-served by an end user, unlike credential-shaped
// schemes (API_KEY, BASIC, BEARER_TOKEN, ...) which just collect a value the
// org already has. A toolkit can list more than one custom scheme — verified
// live: Razorpay offers both `razorpay_oauth` (BYO app, OAuth2) and
// `razorpay_api_key` (self-serve) — so blindly taking the first entry can
// pick an unusable one even though a usable one exists alongside it.
const BYO_OAUTH_MODES = new Set(["OAUTH2", "OAUTH1", "S2S_OAUTH2", "DCR_OAUTH"]);

/**
 * Fetches a toolkit and resolves which auth scheme to connect it with.
 * Composio-managed schemes (zero setup, e.g. most OAuth toolkits) are
 * preferred; otherwise the first self-serve (non-BYO-OAuth) custom scheme is
 * used, falling back to whatever's available if every custom scheme needs a
 * manually-registered app.
 */
const resolveAuthScheme = async (toolkitSlug: string) => {
  const toolkit = await composioClient.toolkits.get(toolkitSlug);
  const managedSchemes = toolkit.composioManagedAuthSchemes ?? [];
  if (managedSchemes.length > 0) {
    return { toolkit, isManaged: true as const, mode: managedSchemes[0]! };
  }
  const customSchemes = toolkit.authConfigDetails ?? [];
  const custom = customSchemes.find((c) => !BYO_OAUTH_MODES.has(c.mode)) ?? customSchemes[0];
  if (!custom) {
    throw new BadRequestError(`"${toolkit.name}" has no available auth method on Composio.`);
  }
  return { toolkit, isManaged: false as const, mode: custom.mode, fields: custom.fields.connectedAccountInitiation };
};

/**
 * Gets this toolkit's auth config, creating it once if it doesn't exist yet.
 * Composio-managed configs need no credentials (Composio's own OAuth app).
 * Custom configs are created with empty credentials — each connecting org
 * supplies its own values (API key, etc.) at connect time via `initiate()`.
 */
const getOrCreateAuthConfig = async (
  toolkitName: string,
  toolkitSlug: string,
  mode: string,
  isManaged: boolean
): Promise<string> => {
  const existing = await composioClient.authConfigs.list({ toolkit: toolkitSlug, isComposioManaged: isManaged });
  const match = existing.items.find((a) => a.authScheme === mode);
  if (match) return match.id;

  const created = isManaged
    ? await composioClient.authConfigs.create(toolkitSlug, {
        type: "use_composio_managed_auth",
        name: `${toolkitName} Auth Config`,
      })
    : await composioClient.authConfigs.create(toolkitSlug, {
        type: "use_custom_auth",
        // `mode` comes from the toolkit's own authConfigDetails[].mode, so
        // it's always one of Composio's real AuthSchemeEnum values — the SDK
        // validates it against that enum before sending.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        authScheme: mode as any,
        name: `${toolkitName} Auth Config`,
        credentials: {},
      });
  return created.id;
};

export const composioAdapter: McpProviderAdapter = {
  async getConfigSchema(entry) {
    const resolved = await resolveAuthScheme(entry.composio!.toolkitSlug);
    if (resolved.isManaged || !resolved.fields) return {};

    const properties: Record<string, { type: string; description?: string }> = {};
    const required: string[] = [];
    for (const field of [...resolved.fields.required, ...resolved.fields.optional]) {
      properties[field.name] = { type: "string", description: field.description || field.displayName };
      if (field.required) required.push(field.name);
    }
    return { type: "object", properties, required };
  },

  async connect({ entry, organizationId, configValues }) {
    const toolkitSlug = entry.composio!.toolkitSlug;
    const resolved = await resolveAuthScheme(toolkitSlug);
    const authConfigId = await getOrCreateAuthConfig(resolved.toolkit.name, toolkitSlug, resolved.mode, resolved.isManaged);

    const request = resolved.isManaged
      ? await composioClient.connectedAccounts.link(organizationId, authConfigId, { allowMultiple: true })
      : await composioClient.connectedAccounts.initiate(organizationId, authConfigId, {
          config:
            resolved.mode === "BASIC"
              ? AuthScheme.Basic(configValues as { username: string; password: string })
              : AuthScheme.APIKey((configValues ?? {}) as Record<string, string>),
        });

    const connectionId = request.id;
    const dbStatus = mapConnectionStatus(request.status);

    if (dbStatus === McpConnectionStatus.AUTH_REQUIRED) {
      return {
        connectionId,
        dbStatus,
        apiStatus: request.status === "INITIALIZING" ? "input_required" : "auth_required",
        setupUrl: request.redirectUrl ?? undefined,
      };
    }
    if (dbStatus === McpConnectionStatus.ERROR) {
      return { connectionId, dbStatus, apiStatus: "error", message: "Connection failed" };
    }
    return { connectionId, dbStatus, apiStatus: "connected" };
  },

  async refreshStatus(connectionId) {
    const connection = await composioClient.connectedAccounts.get(connectionId);
    const dbStatus = mapConnectionStatus(connection.status);
    return {
      dbStatus,
      lastError: dbStatus === McpConnectionStatus.ERROR ? (connection.statusReason ?? "Connection failed") : null,
    };
  },

  async disconnect(connectionId) {
    await composioClient.connectedAccounts.delete(connectionId);
  },

  /**
   * Composio's raw tool shape uses {slug, name, description, inputParameters}
   * (slug is the callable identifier); remapped to the {name, description,
   * inputSchema} shape apps/ai expects, where `name` is the callable slug
   * (matches what callTool's `toolName` argument must be). `isWrite` gates
   * whether apps/ai executes the tool immediately or stages it for user
   * confirmation — see classifyWrite() above.
   */
  async listTools({ toolkitSlug }) {
    // No `limit` here silently applies Composio's server-side `important: true`
    // filter (and a small default page size), truncating most toolkits down to
    // a handful of "curated" actions — verified live: Discord 4, Slack 20,
    // missing real actions like SLACK_SEND_MESSAGE entirely. An explicit limit
    // disables both, surfacing each toolkit's real catalog (largest seen: 167).
    const tools = await composioClient.tools.getRawComposioTools({
      toolkits: [toolkitSlug],
      limit: 200,
    });
    return tools.map((tool) => ({
      name: tool.slug,
      description: tool.description,
      inputSchema: tool.inputParameters,
      isWrite: classifyWrite(tool, toolkitSlug),
      // Composio's own "commonly used" curation signal — reused by apps/ai to
      // prioritize which tools survive when a connection's full catalog is
      // too large to fit in one LLM call (providers cap total tool count,
      // e.g. OpenAI at 128) rather than truncating arbitrarily.
      important: (tool.tags ?? []).includes("important"),
    }));
  },

  // No per-toolkit version pinning today —
  // dangerouslySkipVersionCheck accepts Composio's "latest"
  // default rather than requiring every one of the catalog's toolkits to
  // carry a maintained pinned version.
  async callTool({ organizationId, connectionId, toolName, args }) {
    return composioClient.tools.execute(toolName, {
      userId: organizationId,
      connectedAccountId: connectionId,
      arguments: args,
      dangerouslySkipVersionCheck: true,
    });
  },
};
