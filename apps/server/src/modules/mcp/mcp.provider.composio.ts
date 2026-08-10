import { AuthScheme } from "@composio/core";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { McpConnectionStatus } from "../../../prisma/generated/prisma/client.js";
import { composioClient } from "../../lib/composio.js";
import type { McpProviderAdapter } from "./mcp.provider.js";

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

/**
 * Fetches a toolkit and resolves which auth scheme to connect it with.
 * Composio-managed schemes (zero setup, e.g. most OAuth toolkits) are
 * preferred; otherwise the toolkit's first (and for this catalog, only)
 * custom scheme is used — API_KEY/BASIC-shaped schemes collect fields from
 * the connecting org, OAuth-shaped custom schemes (Twitter, PayPal) need a
 * real provider-issued OAuth app that can't be auto-provisioned and are
 * kept out of the catalog (status stays "coming-soon") until one exists.
 */
const resolveAuthScheme = async (toolkitSlug: string) => {
  const toolkit = await composioClient.toolkits.get(toolkitSlug);
  const managedSchemes = toolkit.composioManagedAuthSchemes ?? [];
  if (managedSchemes.length > 0) {
    return { toolkit, isManaged: true as const, mode: managedSchemes[0]! };
  }
  const custom = toolkit.authConfigDetails?.[0];
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
   * (matches what callTool's `toolName` argument must be).
   */
  async listTools({ toolkitSlug }) {
    const tools = await composioClient.tools.getRawComposioTools({ toolkits: [toolkitSlug] });
    return tools.map((tool) => ({
      name: tool.slug,
      description: tool.description,
      inputSchema: tool.inputParameters,
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
