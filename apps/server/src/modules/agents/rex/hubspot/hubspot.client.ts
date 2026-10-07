/**
 * A small, careful HubSpot HTTP client.
 *
 * Only ever talks to api.hubapi.com (the path is checked, so no customer-supplied URL can reach
 * `fetch`). It spaces its own calls to stay inside HubSpot's per-second limits, retries what is
 * worth retrying (429 per-second, 5xx, network), and turns everything else into typed errors the
 * sync can react to. The token is never put into a message.
 */

const BASE_URL = "https://api.hubapi.com";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 4;

export class HubSpotAuthError extends Error {}
export class HubSpotScopeError extends Error {
  constructor(message: string, public scope?: string) {
    super(message);
  }
}
export class HubSpotRateLimitError extends Error {
  constructor(message: string, public daily: boolean, public retryAfterMs: number) {
    super(message);
  }
}
export class HubSpotTransientError extends Error {}
export class HubSpotRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface TokenProvider {
  get(): Promise<string>;
  /** Called once after a 401. Return a new token to retry with, or null to give up. */
  onUnauthorized?(): Promise<string | null>;
}

export interface RequestOptions {
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** Search endpoints have their own, lower per-second limit. */
  search?: boolean;
}

export interface HubSpotClient {
  request<T>(method: "GET" | "POST", path: string, opts?: RequestOptions): Promise<T>;
  callsMade(): number;
}

export interface ClientDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  rps?: number;
  searchRps?: number;
}

/** What a customer pastes is often `Bearer pat-...`, quoted, or with a trailing newline. */
export function sanitizeToken(raw: string): string {
  return raw.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/^bearer\s+/i, "").trim();
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("HubSpot paths must start with a single /");
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) params.set(k, String(v));
  const qs = params.toString();
  return `${BASE_URL}${path}${qs ? `?${qs}` : ""}`;
}

function parseScope(message: string): string | undefined {
  return message.match(/required scopes?\s*:\s*([a-z0-9_.\-]+)/i)?.[1] ?? message.match(/\b(crm\.[a-z0-9_.]+)/i)?.[1];
}

export function createHubSpotClient(tokens: TokenProvider, deps: ClientDeps = {}): HubSpotClient {
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? realSleep;
  const now = deps.now ?? Date.now;
  const generalGap = 1000 / (deps.rps ?? 5);
  const searchGap = 1000 / (deps.searchRps ?? 4);
  let nextGeneral = 0;
  let nextSearch = 0;
  let calls = 0;

  /** Wait until both the general and (for search) the search bucket allow another call. */
  async function pace(search: boolean) {
    const t = now();
    const start = Math.max(t, nextGeneral, search ? nextSearch : 0);
    nextGeneral = start + generalGap;
    if (search) nextSearch = start + searchGap;
    if (start > t) await sleep(start - t);
  }

  const redact = (text: string, token: string) => (token ? text.split(token).join("[token]") : text);

  async function request<T>(method: "GET" | "POST", path: string, opts: RequestOptions = {}): Promise<T> {
    const url = buildUrl(path, opts.query);
    let token = sanitizeToken(await tokens.get());
    let refreshedAfter401 = false;

    for (let attempt = 1; ; attempt++) {
      await pace(Boolean(opts.search));
      calls++;
      let res: Response;
      try {
        res = await doFetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        if (attempt >= MAX_ATTEMPTS) throw new HubSpotTransientError("HubSpot could not be reached");
        await sleep(backoff(attempt));
        continue;
      }

      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      }

      const body = (await res.json().catch(() => null)) as { message?: string; policyName?: string } | null;
      const message = redact(body?.message ?? `HTTP ${res.status}`, token);

      if (res.status === 401) {
        if (!refreshedAfter401 && tokens.onUnauthorized) {
          refreshedAfter401 = true;
          const fresh = await tokens.onUnauthorized();
          if (fresh) {
            token = sanitizeToken(fresh);
            attempt--; // a refresh is not a failed attempt
            continue;
          }
        }
        throw new HubSpotAuthError("HubSpot rejected the credentials");
      }
      if (res.status === 403) {
        throw new HubSpotScopeError("HubSpot says this key does not have access to that data", parseScope(message));
      }
      if (res.status === 429) {
        const retryAfterMs = Math.max(0, Number(res.headers.get("retry-after") ?? 0) * 1000);
        if (body?.policyName === "DAILY") {
          throw new HubSpotRateLimitError("HubSpot daily API limit reached", true, retryAfterMs);
        }
        if (attempt >= MAX_ATTEMPTS) throw new HubSpotRateLimitError("HubSpot is rate limiting requests", false, retryAfterMs);
        await sleep(Math.max(retryAfterMs, backoff(attempt)));
        continue;
      }
      if (res.status >= 500) {
        if (attempt >= MAX_ATTEMPTS) throw new HubSpotTransientError(`HubSpot is having trouble (${res.status})`);
        await sleep(backoff(attempt));
        continue;
      }
      throw new HubSpotRequestError(`HubSpot rejected the request: ${message}`, res.status);
    }
  }

  return { request, callsMade: () => calls };
}

function backoff(attempt: number): number {
  return 400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
}
