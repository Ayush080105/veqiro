# Rex HubSpot Live Data Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a workspace connect HubSpot (Service Key / private-app token now, OAuth when configured) and build Rex dashboards over deals, companies, contacts, tickets and more that stay fresh while viewed, with a manual Refresh.

**Architecture:** A snapshot connector. HubSpot records are pulled (full list, then incremental search by `hs_lastmodifieddate`), shaped into one flat table per object, written as CSV to R2 plus a `rawTable` preview on a `RexDataset` (`sourceKind="hubspot"`). The existing dashboard engine, AI service and sharing are untouched; an `ensureFresh` hook, a 5-minute cron and a Refresh button keep snapshots current.

**Tech Stack:** TypeScript (Express 5, Prisma 7, vitest, papaparse, node `crypto`), Next.js app router + React Query + shadcn UI in `apps/main`.

**Spec:** `docs/superpowers/specs/2026-10-07-rex-hubspot-live-source-design.md` (sections 1-14; the addendum, sections 12-14, wins on conflicts).

## Global Constraints

- Only `https://api.hubapi.com` (and `https://app.hubspot.com/oauth/authorize` for the browser redirect) are ever called; no user-supplied URLs reach `fetch`.
- Credentials are encrypted with AES-256-GCM (`INTEGRATION_SECRET_KEY`, 32 bytes base64) and never appear in any API response, log line, error message or test snapshot.
- Row cap 100,000 and 40 MB CSV per object; activity objects 50,000 rows; 60 columns per object including derived ones.
- Sync cadence: cron every 5 minutes (datasets used by a dashboard only); `ensureFresh` 60 s (editor) / 120 s (public); nightly full reconcile; budget guard stops a connection at 40% of 250,000 calls/day.
- No AI-service (`apps/ai`) changes. No changes to `apps/server/src/modules/mcp/**`.
- Migrations are additive and nullable; written by hand as SQL, applied by the user with `migrate deploy` using `DIRECT_URL`. Never run `migrate dev`.
- Do not use em dashes in UI copy (project rule for user-facing content); no git steps in this plan (the user's rule).
- `apps/main` uses a non-standard Next.js: read the relevant guide in `apps/main/node_modules/next/dist/docs/` before writing page or route code.
- Failures never blank a dashboard: the last good snapshot keeps serving.
- PII columns (email, phone, first/last name, address fields) are excluded unless opted in per column.

## Review Focus

- A HubSpot record with a null/empty property, a stringly-typed number (`"1,000"`, `""`), or a multi-line text value must not break CSV or typing (tests in Task 6).
- Two records sharing the same `hs_lastmodifieddate` straddling a page or 10k-window boundary must not be lost or duplicated (Task 5).
- A 429 with `Retry-After`, a 401 mid-sync, and a 403 on one object of four must each leave the other objects and the old snapshot intact (Tasks 3, 9).
- Two syncs of the same connection started at once (cron plus Refresh click) must run once (Task 9).
- A token that is whitespace-padded, has a `Bearer ` prefix pasted in, or belongs to another portal's wrong scopes must give a clear message (Task 8).
- An OAuth callback with a tampered, expired or replayed `state` must be rejected without touching the database (Task 7).
- Disconnect while a sync is running must not resurrect the connection or leave a credential behind (Task 9).
- A custom property whose name collides with a derived column (`is_won`, `id`) must not overwrite it (Task 6).

## File Structure

Server (`apps/server/src`):
- `common/utils/secretBox.ts` (+test): encrypt/decrypt credentials.
- `modules/agents/rex/hubspot/hubspot.client.ts` (+test): HTTP client, limiter, retries, typed errors, OAuth-aware auth provider.
- `modules/agents/rex/hubspot/hubspot.objects.ts`: `ObjectSpec` registry (tiers 1-2) and custom-object spec builder.
- `modules/agents/rex/hubspot/hubspot.fields.ts` (+test): property catalogue classification and column selection.
- `modules/agents/rex/hubspot/hubspot.pull.ts` (+test): full and incremental pulls, associations, owners, pipelines.
- `modules/agents/rex/hubspot/hubspot.table.ts` (+test): record shaping, CSV, rawTable, merge.
- `modules/agents/rex/hubspot/hubspot.oauth.ts` (+test): state signing, authorize URL, code exchange, refresh.
- `modules/agents/rex/hubspot/hubspot.connections.service.ts` (+test): connect, verify, discover, create datasets, disconnect.
- `modules/agents/rex/hubspot/hubspot.sync.ts` (+test): orchestration, lock, budget, `ensureFresh`, cron entry.
- `modules/agents/rex/hubspot/hubspot.controller.ts`, `hubspot.routes.ts`: HTTP surface.
- Modify: `prisma/schema.prisma`, `prisma/migrations/<ts>_rex_hubspot_connections/migration.sql`, `modules/agents/rex/rex.routes.ts`, `rex.dashboards.service.ts`, `rex.dashboards.controller.ts`, `jobs/system.cron.ts`, `config/env.ts`.

Web (`apps/main/src`):
- `lib/api/rexConnections.ts`: types and hooks.
- `components/agents/rex/connections/ConnectHubSpotDialog.tsx`, `FieldPicker.tsx`, `ConnectionsPanel.tsx`, `templates.ts`.
- Modify: `components/agents/rex/data-tab.tsx`, `components/workspace/agents/rex/RexDashboardsWork.tsx`, `components/agents/rex/dashboards/DashboardEditor.tsx`, `PublicDashboardView.tsx`, `ShareDialog.tsx`, `lib/api/rexDashboards.ts`.

---

### Task 1: Secret box and environment

**Files:**
- Create: `apps/server/src/common/utils/secretBox.ts`, `apps/server/src/common/utils/secretBox.test.ts`
- Modify: `apps/server/src/config/env.ts`

**Interfaces:**
- Produces: `seal(plain: string): string`, `open(sealed: string): string`, `signState(payload: object, ttlMs: number): string`, `verifyState<T>(token: string): T` (throws `SecretBoxError`), `class SecretBoxError extends Error`, `secretsConfigured(): boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, assert, beforeEach } from "vitest";
import { seal, open, signState, verifyState, SecretBoxError, secretsConfigured } from "./secretBox.js";

beforeEach(() => { process.env.INTEGRATION_SECRET_KEY = Buffer.alloc(32, 7).toString("base64"); });

describe("seal/open", () => {
  it("round-trips and never repeats ciphertext", () => {
    const a = seal("pat-na1-secret"), b = seal("pat-na1-secret");
    assert.notEqual(a, b);
    assert.match(a, /^v1:/);
    assert.equal(open(a), "pat-na1-secret");
  });
  it("detects tampering", () => {
    const s = seal("x").split(":"); s[3] = Buffer.from("zz").toString("base64");
    assert.throws(() => open(s.join(":")), SecretBoxError);
  });
  it("refuses to work without a valid key", () => {
    process.env.INTEGRATION_SECRET_KEY = "short";
    assert.equal(secretsConfigured(), false);
    assert.throws(() => seal("x"), /INTEGRATION_SECRET_KEY/);
  });
});

describe("signState/verifyState", () => {
  it("accepts a fresh state and rejects tampered or expired ones", () => {
    const t = signState({ org: "o1" }, 60_000);
    assert.equal(verifyState<{ org: string }>(t).org, "o1");
    assert.throws(() => verifyState(t.slice(0, -2) + "xx"), SecretBoxError);
    assert.throws(() => verifyState(signState({ org: "o1" }, -1)), /expired/);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd apps/server && npx vitest run src/common/utils/secretBox.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

AES-256-GCM with a random 12-byte IV, format `v1:<iv b64>:<tag b64>:<ct b64>`. Key read lazily from `process.env.INTEGRATION_SECRET_KEY`, must decode to exactly 32 bytes else `SecretBoxError("INTEGRATION_SECRET_KEY must be 32 bytes, base64")`. `signState` returns `base64url(JSON{p,exp,n})` + `.` + `base64url(HMAC-SHA256(key-derived-with-label "state"))`; `verifyState` compares with `timingSafeEqual`, checks `exp`, throws `SecretBoxError("state expired")`. Add `INTEGRATION_SECRET_KEY`, `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI` (all optional) to `config/env.ts`.

- [ ] **Step 4: Run tests, expect PASS**

Run: `cd apps/server && npx vitest run src/common/utils/secretBox.test.ts`

---

### Task 2: Data model and migration

**Files:**
- Modify: `apps/server/prisma/schema.prisma` (after `RexDataset`, ~line 1695)
- Create: `apps/server/prisma/migrations/20261007120000_rex_hubspot_connections/migration.sql`

**Interfaces:**
- Produces: Prisma model `RexDataConnection` and nullable `RexDataset` columns `connectionId`, `sourceObject`, `syncCursor`, `lastFullSyncAt`, `syncStartedAt`, `rowCount`, `syncNote`.

- [ ] **Step 1: Edit the schema** exactly as spec section 5, plus `rowCount Int?` and `syncNote String?` on `RexDataset` (truncation / currency notes), `config` default `{}`, and `@@index([connectionId])`.

- [ ] **Step 2: Write migration SQL by hand** (additive only):

```sql
CREATE TABLE "rex_data_connection" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL, "authType" TEXT NOT NULL, "credentialEnc" TEXT NOT NULL,
  "accountLabel" TEXT, "scopes" JSONB NOT NULL DEFAULT '[]', "config" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'active', "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rex_data_connection_pkey" PRIMARY KEY ("id"));
CREATE INDEX "rex_data_connection_organizationId_idx" ON "rex_data_connection"("organizationId");
ALTER TABLE "rex_dataset" ADD COLUMN "connectionId" TEXT, ADD COLUMN "sourceObject" TEXT,
  ADD COLUMN "syncCursor" JSONB, ADD COLUMN "lastFullSyncAt" TIMESTAMP(3),
  ADD COLUMN "syncStartedAt" TIMESTAMP(3), ADD COLUMN "rowCount" INTEGER, ADD COLUMN "syncNote" TEXT;
CREATE INDEX "rex_dataset_connectionId_idx" ON "rex_dataset"("connectionId");
```

- [ ] **Step 3: Generate the client and typecheck**

Run: `cd apps/server && npx prisma generate && npx tsc --noEmit`
Expected: no errors. (Applying the migration to a database is the user's step.)

---

### Task 3: HubSpot HTTP client

**Files:**
- Create: `hubspot/hubspot.client.ts`, `hubspot/hubspot.client.test.ts`

**Interfaces:**
- Produces:
```ts
export type TokenProvider = { get(): Promise<string>; onUnauthorized?(): Promise<string | null> };
export class HubSpotAuthError extends Error {}                       // 401, refresh failed
export class HubSpotScopeError extends Error { scope?: string }       // 403
export class HubSpotRateLimitError extends Error { daily: boolean; retryAfterMs: number }
export class HubSpotTransientError extends Error {}
export interface HubSpotClient {
  request<T>(method: "GET" | "POST", path: string, opts?: { query?: Record<string, string | number | undefined>; body?: unknown; search?: boolean }): Promise<T>;
  callsMade(): number;
}
export function createHubSpotClient(tokens: TokenProvider, deps?: { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; rps?: number; searchRps?: number }): HubSpotClient;
```

- [ ] **Step 1: Write failing tests** (fake `fetch` and `sleep`): returns JSON on 200; sends `Authorization: Bearer <token>` and never includes the token in thrown messages; retries 429 honouring `Retry-After` seconds then succeeds; `policyName: "DAILY"` throws `HubSpotRateLimitError{daily:true}` without retrying; retries 502 up to 4 attempts then `HubSpotTransientError`; 401 calls `onUnauthorized`, retries once with the new token, and throws `HubSpotAuthError` if still 401; 403 body `{message:"This app hasn't been granted the required scope(s)", ...}` yields `HubSpotScopeError` with parsed scope when present; `search:true` requests are spaced at least `1000/searchRps` ms apart (assert via recorded sleeps); rejects any `path` not starting with `/`; strips `Bearer ` prefixes and whitespace pasted into a token.

- [ ] **Step 2: Run, expect FAIL.** `cd apps/server && npx vitest run src/modules/agents/rex/hubspot/hubspot.client.test.ts`

- [ ] **Step 3: Implement.** Base URL constant `https://api.hubapi.com`; 30 s `AbortSignal.timeout`; spacing limiter (default 5 rps, search 4 rps) implemented as "earliest next start time" per bucket; retry policy as tested; token sanitised with `/^bearer\s+/i` strip + trim at provider level (`sanitizeToken` exported for Task 8).

- [ ] **Step 4: Run tests, expect PASS.**

---

### Task 4: Object registry and field selection

**Files:**
- Create: `hubspot/hubspot.objects.ts`, `hubspot/hubspot.fields.ts`, `hubspot/hubspot.fields.test.ts`

**Interfaces:**
- Produces:
```ts
export type ColumnKind = "numeric" | "date" | "categorical" | "text";
export interface HsProperty { name: string; label: string; type: string; fieldType?: string; groupName?: string; hidden?: boolean; calculated?: boolean; hubspotDefined?: boolean; options?: Array<{ value: string; label: string; hidden?: boolean }> }
export interface ObjectSpec { type: string; label: string; tier: 1 | 2 | 3; rowCap: number; defaults: Record<string, string> /* hs property -> friendly column */; pii: string[]; derived: Array<"is_open" | "is_won" | "is_lost" | "stage_probability" | "weighted_amount" | "associated_company"> ; pipelineObject?: "deals" | "tickets"; ownerProps: string[]; stageProp?: string; pipelineProp?: string }
export const OBJECT_SPECS: Record<string, ObjectSpec>;       // deals, companies, contacts, tickets, products, line_items, quotes, calls, meetings, tasks
export function customObjectSpec(schema: { objectTypeId: string; name: string; labels: { plural: string } }): ObjectSpec;
export interface ColumnPlan { property: string; column: string; kind: ColumnKind; source: "recommended" | "custom" | "other"; pii: boolean; options?: Map<string, string> }
export function classifyProperties(spec: ObjectSpec, props: HsProperty[]): { recommended: ColumnPlan[]; custom: ColumnPlan[]; other: ColumnPlan[] };
export function planColumns(spec: ObjectSpec, props: HsProperty[], sel: { extra: string[]; includePii: string[] }): { columns: ColumnPlan[]; dropped: Array<{ property: string; reason: string }> };
export function hsTypeToKind(type: string, fieldType?: string): ColumnKind | null;   // null = unsupported (json, object_coordinates)
```

- [ ] **Step 1: Write failing tests**: `hsTypeToKind` maps number->numeric, date/datetime->date, enumeration/bool->categorical, string->text, json->null; `classifyProperties` excludes hidden and json props, puts `dealname` in recommended and a portal-created `contract_tier` in custom, `hs_analytics_source` in other; `planColumns` always yields `id` first, drops PII (`email`, `phone`, `firstname`, `lastname`, `address`) unless listed in `includePii`, never exceeds 60 columns including derived (extra fields truncated with reason `"column limit"`), skips a user-selected property that collides with a reserved/derived name (`id`, `is_won`, `associated_company_id`) with reason `"reserved name"`, and gives duplicate friendly names a numeric suffix.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** Curated defaults, e.g. deals: `dealname->deal_name, amount->amount, dealstage->stage, pipeline->pipeline, closedate->close_date, createdate->created_at, hs_lastmodifieddate->updated_at, hubspot_owner_id->owner (resolved to owner_name), dealtype->deal_type, hs_deal_stage_probability->stage_probability, deal_currency_code->deal_currency_code, hs_forecast_amount->forecast_amount, hs_closed_amount_in_home_currency->closed_amount_home_currency, hs_analytics_source->lead_source`; companies: `name, domain, industry, numberofemployees->employees, annualrevenue->annual_revenue, city, state, country, lifecyclestage, createdate, hubspot_owner_id, hs_lastmodifieddate`; contacts: `lifecyclestage, hs_lead_status->lead_status, createdate, hs_analytics_source->lead_source, hubspot_owner_id, jobtitle, city, country, hs_lastmodifieddate` with PII list; tickets: `subject, content?(no), hs_pipeline->pipeline, hs_pipeline_stage->stage, hs_ticket_priority->priority, source_type->source, createdate, closed_date, hubspot_owner_id, hs_lastmodifieddate`; tier-2 objects get a smaller default set. `rowCap` 100000 for tier 1, 50000 for others.

- [ ] **Step 4: Run tests, expect PASS.**

---

### Task 5: Pull engine (full, incremental, associations, owners, pipelines)

**Files:**
- Create: `hubspot/hubspot.pull.ts`, `hubspot/hubspot.pull.test.ts`

**Interfaces:**
- Consumes: `HubSpotClient` (Task 3), `ObjectSpec` (Task 4).
- Produces:
```ts
export interface RawRecord { id: string; properties: Record<string, string | null> }
export interface PullResult { records: RawRecord[]; truncated: boolean; calls: number; maxModified: string | null }
export function fullPull(c: HubSpotClient, spec: ObjectSpec, properties: string[], opts?: { cap?: number; onProgress?: (n: number) => void }): Promise<PullResult>;
export function incrementalPull(c: HubSpotClient, spec: ObjectSpec, properties: string[], sinceIso: string, opts?: { cap?: number; overlapMs?: number }): Promise<PullResult>;
export function countRecords(c: HubSpotClient, spec: ObjectSpec): Promise<number>;           // search limit=1 -> total
export function fetchOwners(c: HubSpotClient): Promise<Map<string, string>>;                  // id -> name
export function fetchStages(c: HubSpotClient, pipelineObject: "deals" | "tickets"): Promise<Map<string, { pipeline: string; stage: string; probability: number | null; closed: boolean; won: boolean }>>;
export function fetchPrimaryCompanies(c: HubSpotClient, fromType: string, ids: string[]): Promise<Map<string, { id: string; name: string | null }>>;
export function listSchemas(c: HubSpotClient): Promise<Array<{ objectTypeId: string; name: string; labels: { plural: string } }>>;
export function fetchProperties(c: HubSpotClient, type: string): Promise<HsProperty[]>;
```

- [ ] **Step 1: Write failing tests** with a scripted fake client:
  - `fullPull` follows `paging.next.after` with `limit=100`, passes `properties` comma-joined, stops at `cap` and returns `truncated:true`, reports progress.
  - `incrementalPull` issues search with `hs_lastmodifieddate GTE since-overlap`, sorted ascending, `limit=200`; when a window returns 10,000 results (50 pages of 200) it restarts with `GTE <last record's modified date>` and **keeps records sharing that timestamp exactly once** (dedupe by id); with fewer than 10,000 it does one window; returns `maxModified`.
  - A fake dataset of 25,300 records with 300 sharing one timestamp at the 10,000 boundary comes back with exactly 25,300 unique ids.
  - `fetchStages` marks closed-won via `metadata.isClosed==="true"` and `probability===1`, handling tickets via `ticketState`.
  - `fetchPrimaryCompanies` batches 1,000 ids per v4 batch-read call, prefers the `Primary` label, falls back to the first association, and batch-reads company names 100 at a time.
  - `fetchOwners` pages with `after` until exhausted and includes archived owners.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** against: `GET /crm/v3/objects/{type}?limit=100&after=&properties=`, `POST /crm/v3/objects/{type}/search` (`{filterGroups:[{filters:[{propertyName:"hs_lastmodifieddate",operator:"GTE",value:<ms epoch>}]}],sorts:[{propertyName:"hs_lastmodifieddate",direction:"ASCENDING"}],properties,limit:200,after}` with `search:true`), `GET /crm/v3/pipelines/{deals|tickets}`, `GET /crm/v3/owners?limit=500&archived=false` and again with `archived=true`, `POST /crm/v4/associations/{from}/companies/batch/read`, `POST /crm/v3/objects/companies/batch/read`, `GET /crm/v3/schemas`, `GET /crm/v3/properties/{type}`. Window restart threshold 9,500 results. Pagination `after` always passed as given by HubSpot.

- [ ] **Step 4: Run tests, expect PASS.**

---

### Task 6: Table builder (shaping, CSV, rawTable, merge)

**Files:**
- Create: `hubspot/hubspot.table.ts`, `hubspot/hubspot.table.test.ts`

**Interfaces:**
- Consumes: `RawRecord`, `ColumnPlan`, `ObjectSpec`, lookups from Task 5.
- Produces:
```ts
export interface Lookups { owners: Map<string, string>; stages?: Map<string, StageInfo>; companies?: Map<string, { id: string; name: string | null }>; recordCompany?: Map<string, string> }
export interface BuiltTable { headers: string[]; columnTypes: Record<string, ColumnKind>; rows: Array<Record<string, string>> }
export function shapeRecords(spec: ObjectSpec, columns: ColumnPlan[], records: RawRecord[], lookups: Lookups): BuiltTable;
export function mergeSnapshot(prev: Array<Record<string, string>>, delta: Array<Record<string, string>>): Array<Record<string, string>>;   // by id, delta wins
export function toCsv(table: { headers: string[]; rows: Array<Record<string, string>> }): Buffer;
export function fromCsv(buf: Buffer): Array<Record<string, string>>;
export function toRawTable(t: BuiltTable, fileKey: string, previewRows?: number): RawTable;  // 500 preview rows
export const MAX_CSV_BYTES: number;                                                          // 40 MB
```

- [ ] **Step 1: Write failing tests**: enumeration value becomes its label (`closedwon` -> `Closed won`); owner id becomes `owner_name`; deal stage resolves to `stage` and `pipeline` labels with `is_won`/`is_open`/`is_lost`, `stage_probability` and `weighted_amount = amount * probability`; numbers like `"1,000.50"` and `""` become `1000.50` and empty; ISO datetimes stay ISO; null becomes empty string; a text value with commas, quotes and newlines survives `toCsv` -> `fromCsv` unchanged; `id` is the first header; a custom property named `is_won` does not overwrite the derived column; `mergeSnapshot` replaces by id and appends new ids; `toRawTable` keeps 500 preview rows and sets `fileKey`, `columnTypes` match the headers exactly; a table whose CSV would exceed `MAX_CSV_BYTES` is reported (function `assertWithinLimit(buf)` throws `SnapshotTooLargeError` with the row count that fit).

- [ ] **Step 2: Run, expect FAIL. Step 3: Implement** (papaparse `unparse`/`parse`, UTF-8 with no BOM, `\n` newlines). **Step 4: Run, expect PASS.**

---

### Task 7: OAuth

**Files:**
- Create: `hubspot/hubspot.oauth.ts`, `hubspot/hubspot.oauth.test.ts`

**Interfaces:**
- Consumes: `signState`, `verifyState`, `seal`, `open` (Task 1).
- Produces:
```ts
export function oauthConfigured(): boolean;
export const REQUIRED_SCOPES: string[]; export const OPTIONAL_SCOPES: string[];
export function buildAuthorizeUrl(input: { organizationId: string; userId: string; returnTo: string }): string;
export function readCallbackState(state: string): { organizationId: string; userId: string; returnTo: string };   // throws SecretBoxError
export function exchangeCode(code: string, deps?: { fetch?: typeof fetch }): Promise<OAuthTokens>;
export function refreshTokens(refreshToken: string, deps?: { fetch?: typeof fetch }): Promise<OAuthTokens>;
export interface OAuthTokens { accessToken: string; refreshToken: string; expiresAt: number }
export function oauthTokenProvider(load: () => Promise<StoredOAuth>, save: (t: OAuthTokens) => Promise<void>, deps?: { fetch?: typeof fetch; now?: () => number }): TokenProvider;
export function safeReturnTo(path: string | undefined): string;    // only same-origin relative paths, else "/"
```

- [ ] **Step 1: Write failing tests**: authorize URL contains `client_id`, exact `redirect_uri`, space-separated required `scope`, `optional_scope`, and a verifiable `state`; tampered/expired state rejected; `safeReturnTo("//evil.com")`, `"https://evil.com"` and `"javascript:x"` all return `/`; `exchangeCode` posts `application/x-www-form-urlencoded` `grant_type=authorization_code` to `https://api.hubapi.com/oauth/v1/token` and returns `expiresAt = now + expires_in`; `oauthTokenProvider.get()` refreshes when within 60 s of expiry and **two concurrent `get()` calls trigger one refresh**; `onUnauthorized` refreshes once; refresh failure `invalid_grant` throws `HubSpotAuthError`; error messages never include the code, tokens or client secret; `oauthConfigured()` is false when any of the three env vars is missing.

- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS.**

Scopes: required `crm.objects.contacts.read crm.objects.companies.read crm.objects.deals.read crm.objects.owners.read crm.schemas.contacts.read crm.schemas.companies.read crm.schemas.deals.read`; optional `tickets crm.objects.custom.read crm.schemas.custom.read crm.objects.line_items.read crm.objects.quotes.read e-commerce crm.pipelines.orders.read`. (Exact names are confirmed against a real portal in the smoke test; optional scopes degrade gracefully.)

---

### Task 8: Connection service

**Files:**
- Create: `hubspot/hubspot.connections.service.ts`, `hubspot/hubspot.connections.service.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4, 5, 7; `prisma.rexDataConnection`, `prisma.rexDataset`.
- Produces:
```ts
export interface VerifyReport { account: string | null; objects: Array<{ type: string; label: string; tier: 1|2|3; ok: boolean; count: number | null; missingScope?: string; message?: string }> }
export function connectWithToken(a: { organizationId: string; userId: string; token: string }): Promise<{ connectionId: string; verify: VerifyReport }>;
export function connectWithOAuthTokens(a: { organizationId: string; userId: string; tokens: OAuthTokens }): Promise<{ connectionId: string; verify: VerifyReport }>;
export function verifyConnection(organizationId: string, connectionId: string): Promise<VerifyReport>;
export function listConnections(organizationId: string): Promise<ConnectionView[]>;      // no credential fields
export function discoverFields(organizationId: string, connectionId: string, objectType: string): Promise<{ recommended: FieldView[]; custom: FieldView[]; other: FieldView[]; cap: number }>;
export function saveSelection(a: { organizationId: string; userId: string; connectionId: string; objects: Array<{ type: string; extra: string[]; includePii: string[] }> }): Promise<{ datasets: Array<{ id: string; sourceObject: string }> }>;
export function disconnect(organizationId: string, connectionId: string, mode: "keep" | "delete"): Promise<void>;
export function getTokenProvider(conn: ConnectionRow): TokenProvider;                    // token or OAuth, used by sync
```

- [ ] **Step 1: Write failing tests** (prisma and client mocked with `vi.mock`): a pasted `"Bearer  abc "` is sanitised; verify marks an object `ok:false` with `missingScope` when the probe returns `HubSpotScopeError`; a 401 on the first probe throws a `BadRequestError` "HubSpot rejected that key" and stores nothing; credentials are stored via `seal` and `listConnections` output has no `credential*` keys (assert with `JSON.stringify`); `saveSelection` creates one `RexDataset` per object named `HubSpot . Deals` (middle dot) with `sourceKind:"hubspot"`, `metricKey:"hubspot_deals"`, `points:[]`, `syncEnabled:true`, and is idempotent (second call updates config instead of duplicating); `disconnect("keep")` deletes the credential, sets datasets `syncEnabled:false` and `syncError:"Disconnected"`; `disconnect("delete")` also removes datasets and their R2 objects; org scoping: another org's id yields `NotFoundError`.

- [ ] **Step 2: Run, expect FAIL. Step 3: Implement** (account label best-effort from `GET /account-info/v3/details`, swallowed on failure; datasets created through `rexRepository.createDataset`, then updated with `connectionId`, `sourceObject`; first sync is kicked by Task 9's `syncDataset`, not here). **Step 4: Run, expect PASS.**

---

### Task 9: Sync orchestration, freshness and cron

**Files:**
- Create: `hubspot/hubspot.sync.ts`, `hubspot/hubspot.sync.test.ts`
- Modify: `jobs/system.cron.ts`

**Interfaces:**
- Consumes: Tasks 3-8, `refreshDashboard` from `rex.dashboards.service.ts`, R2 helpers (`uploadBuffer`, `deleteObject`, `getPresignedGetUrl`) plus an exported `fetchR2Buffer` (export the existing function from `rex.csv.ts`).
- Produces:
```ts
export type SyncMode = "auto" | "incremental" | "full";
export function syncDataset(datasetId: string, opts?: { mode?: SyncMode; waitMs?: number }): Promise<{ status: "synced" | "unchanged" | "busy" | "error" | "timeout"; rows?: number; message?: string }>;
export function syncConnection(organizationId: string, connectionId: string, opts?: { mode?: SyncMode; waitMs?: number }): Promise<{ results: Array<{ datasetId: string; status: string }> }>;
export function ensureFresh(organizationId: string, datasetIds: string[], maxAgeMs: number): void;      // fire and forget, never throws
export function syncAllHubspot(): Promise<void>;
export function decideMode(d: { syncCursor: unknown; lastFullSyncAt: Date | null; configChanged: boolean }, now: Date): "full" | "incremental";
export const DAILY_BUDGET: number;   // 100_000 = 40% of 250k
```

- [ ] **Step 1: Write failing tests** (all collaborators mocked): `decideMode` picks full when no cursor, when never fully synced, when the last full sync is older than 24 h **and the clock is past 02:00 UTC**, and when config changed, otherwise incremental; `syncDataset` skips with `busy` when `syncStartedAt` is fresh (lock via conditional `updateMany`, stale after 10 minutes); unchanged content hash returns `unchanged`, does not upload and does not call `refreshDashboard`; a changed hash uploads the new CSV, writes `meta.rawTable` with the new `fileKey`, sets `rowCount`, `lastSyncedAt`, clears `syncError`, deletes the old key **after** the DB update, and refreshes only dashboards whose `datasetIds` include it; a `HubSpotAuthError` sets the connection `auth_error`, leaves the dataset snapshot and `meta` untouched and records a readable `syncError`; a `HubSpotScopeError` on one object leaves the other objects syncing; a `HubSpotRateLimitError{daily:true}` stops the connection for the day without marking it broken; a connection already at `DAILY_BUDGET` is skipped; `ensureFresh` triggers only for datasets older than `maxAgeMs` and swallows rejections; `syncAllHubspot` only syncs datasets referenced by a dashboard and runs at most 3 connections concurrently; syncing a connection that was disconnected mid-run stores nothing.

- [ ] **Step 2: Run, expect FAIL. Step 3: Implement.** Per-day call counter kept in `connection.config.usage = { day: "YYYY-MM-DD", calls: n }`. First sync of a dataset with a truncated pull sets `syncNote` ("Showing the 100,000 most recently created records"). Register `cron.schedule("*/5 * * * *", () => void syncAllHubspot().catch(...))` in `system.cron.ts`. **Step 4: Run, expect PASS.**

---

### Task 10: HTTP surface and dashboard integration

**Files:**
- Create: `hubspot/hubspot.controller.ts`, `hubspot/hubspot.routes.ts`, `hubspot/hubspot.controller.test.ts`
- Modify: `rex.routes.ts`, `rex.dashboards.service.ts`, `rex.dashboards.controller.ts`, `app.ts` (request-log body redaction if bodies are logged)

**Interfaces:**
- Produces routes under `/agents/rex/connections` (authenticated): `GET /` (list + `{oauthAvailable}`), `POST /hubspot/token`, `POST /hubspot/oauth/start`, `GET /:id/verify`, `GET /:id/objects/:type/fields`, `PUT /:id/selection`, `POST /:id/sync` (`{mode, wait}`), `DELETE /:id?mode=keep|delete`; public: `GET /agents/rex/connections/hubspot/oauth/callback`.
- Dashboard changes: `getDashboard` and `getPublicDashboard` call `ensureFresh(orgId, datasetIds, 60_000 / 120_000)`; `refreshDashboard(..., { force: true })` is preceded, in the `refresh` controller only, by `syncConnection` for HubSpot datasets (wait up to 25 s); `editorView.sources` includes `sourceKind`, `syncNote`, `rowCount`, `connectionId`; `shareDashboard` returns `{ containsPii: boolean }` computed from the datasets' `config.includePii`, and enabling public access requires `confirmPii: true` when it is true.

- [ ] **Step 1: Write failing tests**: zod rejects an empty or 5,000-char token; responses never contain the substring of a stored token (assert with a recognisable fake token); callback with a bad `state` redirects to `/?hubspot=error` and performs no database call; callback success redirects to `returnTo` plus `?hubspot=connected&connection=<id>`; `share` without `confirmPii` returns 409 when PII columns are included; org scoping on every `:id` route.

- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS** (`cd apps/server && npx vitest run && npx tsc --noEmit`).

---

### Task 11: Web API client

**Files:**
- Create: `apps/main/src/lib/api/rexConnections.ts`
- Modify: `apps/main/src/lib/api/rexDashboards.ts` (poll + sources fields + share confirm)

**Interfaces:**
- Produces: types `ConnectionView`, `VerifyReport`, `FieldView`, hooks `useConnections()`, `useConnectToken()`, `useStartOAuth()`, `useVerify(id)`, `useFields(id, type)`, `useSaveSelection()`, `useSyncConnection()`, `useDisconnect()`; in `rexDashboards.ts`: `useDashboard` gets `refetchInterval` 30 s while visible (3 s while `refreshStatus==="running"`), `refetchIntervalInBackground:false`; `DashboardSource` gains `syncNote`, `rowCount`, `connectionId`; `useShareDashboard` accepts `{ isPublic, confirmPii? }`.

- [ ] **Step 1:** Read `apps/main/node_modules/next/dist/docs/` guide sections for client components/data fetching, then implement following the `useDashboard` style. **Step 2:** `cd apps/main && npx tsc --noEmit`, expect PASS.

---

### Task 12: Connect wizard, field picker, connections panel

**Files:**
- Create: `components/agents/rex/connections/ConnectHubSpotDialog.tsx`, `FieldPicker.tsx`, `ConnectionsPanel.tsx`, `templates.ts`
- Modify: `components/agents/rex/data-tab.tsx` (add "Connect HubSpot" card and panel above the file drop zone), `components/workspace/agents/rex/RexDashboardsWork.tsx` (HubSpot "live" badge for `sourceKind==="hubspot"`, templates row, "Connect HubSpot" shortcut when no sources, return handling of `?hubspot=connected`)

**Interfaces:**
- Consumes: Task 11 hooks. `templates.ts` exports `HUBSPOT_TEMPLATES: Array<{ id; title; needs: string[]; prompt: string }>` (Sales pipeline, Revenue and win rate, Lead sources and lifecycle, Support tickets) with prompts naming real columns.

- [ ] **Step 1:** Load the `frontend-design` and `ui-ux-pro-max` skills and reuse existing `components/ui/*` (Dialog, Button, Checkbox, Input, Skeleton). Build the four-step wizard (spec section 14): step state in the dialog, OAuth button shown only when `oauthAvailable`, token help with copy-scopes button and the 26 Oct 2026 note, per-object verify list with Re-check, object cards with counts and a PII toggle, searchable grouped field picker with the 60-column counter, progress step polling `useConnections` every 2 s until datasets report `lastSyncedAt`, then template buttons. Connections panel with status chip and actions. **Step 2:** no em dashes in copy; keyboard focus order and `aria-label`s on icon buttons; mobile-width layout. **Step 3:** `cd apps/main && npx tsc --noEmit && npx next lint` (or the repo's lint script), expect PASS.

---

### Task 13: Freshness UI and PII share confirmation

**Files:**
- Modify: `components/agents/rex/dashboards/DashboardEditor.tsx`, `PublicDashboardView.tsx`, `ShareDialog.tsx`, `app/share/rex/dashboard/[token]/page.tsx` (only if it owns the fetch loop)

- [ ] **Step 1:** Add a `LivePill` (green "Live, updated Ns ago" with a 1 s ticking relative time, amber "Updating", red with the dataset's `syncError`) to the editor header; make the Refresh button show "Syncing HubSpot" and use the new server behaviour; add a "Full resync" item to a small menu. Public view polls every 60 s via `refetchInterval` and shows "Updated Ns ago". Share dialog shows a confirmation checkbox when the server answers 409 `containsPii`. **Step 2:** `npx tsc --noEmit`, expect PASS.

---

### Task 14: Verification, smoke script and docs

**Files:**
- Create: `apps/server/scripts/hubspot-smoke.ts`
- Modify: `AGENTS.md` (Rex section: HubSpot connector, handoff note), `docs/superpowers/specs/...` (Phase 0 findings placeholder removed once the smoke script has run)

- [ ] **Step 1:** Smoke script: reads `HUBSPOT_TOKEN`, runs verify, counts, 3-page `fullPull` and one `incrementalPull` per object, prints the property classification and column plan, never prints the token. **Step 2:** Run the entire suites: `cd apps/server && npx vitest run && npx tsc --noEmit`; `cd apps/main && npx tsc --noEmit`; `cd apps/ai && python -m pytest -q` only to prove nothing there changed (expect the same result as on `main`). **Step 3:** Run the app and drive the wizard against a mocked HubSpot only if no real token is available; record exactly what was and was not verified in the final report.

---

## Self-Review

- **Spec coverage:** sections 3-4 (Tasks 3, 5, 6), 5 (Task 2), 6 (Task 9), 7 (not touched; MCP unchanged, Global Constraints), 8 (Tasks 1, 4, 8, 10, 13), 9 (every task's tests, Task 14), 12 (Tasks 9, 10, 11, 13), 13 (Tasks 4, 5, 6, 12), 14 (Tasks 7, 8, 10, 12). The Composio-token spike and webhooks are Phase 2 by design.
- **Placeholders:** none; unverified HubSpot facts (list-endpoint pagination beyond 10k, exact deal/ticket scope names, account-info endpoint) are isolated to the smoke script and degrade gracefully in code (`label` best-effort, optional scopes).
- **Type consistency:** `TokenProvider`, `HubSpotClient`, `ObjectSpec`, `ColumnPlan`, `RawRecord`, `BuiltTable`, `OAuthTokens`, `VerifyReport` are defined once and consumed under the same names.
- **Known gap flagged for the user:** the Reports DOCX generator reads only the 500-row preview, so reports over HubSpot datasets will under-count; linked-sheet Refresh does not re-fetch the sheet. Neither is changed here.
