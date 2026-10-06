# Rex dashboards: HubSpot live data source (design)

Branch: `feat/rex-hubspot-live-source` · Status: **awaiting review** · Date: 2026-10-07

## 1. Goal

A customer connects HubSpot once and builds Rex dashboards over their CRM data (deals, companies,
contacts, tickets) that stay current, exactly like a linked Google Sheet does today. No change to how
dashboards, filters, sharing or the AI service work.

Non-goals (this branch): databases, OAuth, webhooks, custom objects, engagement objects (calls,
emails, notes), writing back to HubSpot, copying HubSpot's own dashboards (their API cannot export them).

## 2. What exists today (verified in code)

| Piece | Where | How we reuse it |
|---|---|---|
| Dashboard engine: SQL over DuckDB tables, per-filter stored results, public links | `rex.dashboards.service.ts`, `apps/ai/agents/rex/dashboards.py` | Unchanged. A HubSpot object is just another dataset. |
| Dataset = `RexDataset` row whose `meta.rawTable` holds headers, column types, a 500-row preview and `fileKey` (full file on R2) | `rex.csv.ts`, `datasetPayloadForAI` | We write a CSV to R2 and a matching `rawTable`. The AI service already reads `fileKey` and types columns from the preview. |
| Linked-sheet sync: fetch, hash, skip if unchanged, else re-parse and `refreshDashboard` for dependents; 15-min cron; stale sync on dashboard open | `syncLinkedSource`, `syncAllLinkedSources`, `jobs/system.cron.ts` | Same loop and the same "keep last good data on failure" rule, with a different fetcher. |
| Org connections via Composio (`hubspot-marketing` → toolkit `hubspot`) | `mcp.provider.composio.ts`, `packages/integrations-catalog` | Not touched. See section 7. |
| SSRF guard for user URLs | `rex.links.ts` | Not needed: we only call the fixed host `api.hubapi.com`. |

Gaps: nothing stores a third-party credential (no encryption helper exists), nothing turns an API
into a table, and `RexDataset` has no link to a connection.

## 3. HubSpot facts this design depends on

Sources: HubSpot developer docs (fetched 2026-10-07) unless marked *unverified*.

- **Auth is changing.** Creating *new legacy private apps* is disabled for accounts created on/after
  2026-09-28 and for older accounts from **2026-10-26**. Existing private-app tokens keep working, no
  end date announced. The replacement is **Service Keys** (Settings > Integrations > Service Keys;
  public beta; scoped, 7-day rotation grace). Legacy *public* (OAuth) app creation is closed since
  2026-05-26 / 2026-06-23; new OAuth apps must be project-based. Both token types are plain
  `Authorization: Bearer`, so one code path serves both.
- **Reading data.** List `GET /crm/v3/objects/{type}` (cursor `after`, max 100/page, properties via
  `?properties=`); search `POST .../search` (max 200/page, **hard cap 10,000 results per query**, 5
  req/s, filter `hs_lastmodifieddate GTE`); batch read 100/call. Scopes are granular
  (`crm.objects.deals.read`). The list endpoint having no 10k cap is *unverified*; Phase 0 confirms it
  against a real account.
- **Metadata.** Properties `GET /crm/v3/properties/{type}` (name, label, type, enum options; scope
  `crm.schemas.{type}.read`). Pipelines `GET /crm/v3/pipelines/{type}` (stage ids to labels; scope
  `crm.pipelines.{objectType}.read` per the docs; exact deal/ticket scope names confirmed in Phase 0). Owners `GET /crm/v3/owners`. Associations v4 batch read.
- **Limits.** Private app / Service Key: 100 req/10s (Free, Starter), 190 (Pro, Enterprise); daily
  250k to 1M per account. 429 body carries `policyName` SECONDLY or DAILY. These limits are shared with
  all the customer's other integrations, so we must be frugal.
- **Exports API** (async, 30 per rolling 24h, one at a time, needs `crm.export` and Super Admin) is
  not used: too restrictive for a sync that runs every 15 minutes.

## 4. Architecture

```
 UI (Data tab)                Server (apps/server, Rex module)                 HubSpot
 Connect dialog ─token──►  connections.service ──encrypt──► RexDataConnection
                                  │ validate ───────────────────────────────► GET objects?limit=1 per object
                                  ▼
                           create RexDataset per object (sourceKind="hubspot")
                                  │
 cron */15 + Sync now + ──► hubspot.sync (full | incremental) ──────────────► list / search / properties /
 open-dashboard stale check       │                                            pipelines / owners / associations
                                  ▼
                           rows ─► snapshot CSV on R2 + rawTable preview ─► RexDataset.meta
                                  │ content hash changed?
                                  ▼
                           refreshDashboard() for dashboards using it  (existing code, unchanged)
```

Units (one purpose each, tested in isolation):

1. `common/utils/secretBox.ts`: AES-256-GCM `seal/open` for credentials. Format `v1:<iv>:<tag>:<ct>`
   (base64). Key from `INTEGRATION_SECRET_KEY` (32 bytes, base64). Missing or malformed key means the
   connect endpoint fails with a clear error and nothing is stored in plaintext. Key rotation is out of
   scope; the `v1` prefix leaves room for it.
2. `rex/hubspot/hubspot.client.ts`: thin fetch wrapper. Fixed base URL, bearer auth, 30s timeout,
   per-connection token bucket (default 5 req/s, search 4 req/s), retry with jitter on 429/5xx honoring
   `Retry-After` (max 4 tries), typed errors: `AuthError` (401), `MissingScopeError` (403, parses the
   required scope), `RateLimitedError` (daily budget), `TransientError`. Never logs the token.
3. `rex/hubspot/hubspot.objects.ts`: registry of supported objects (deals, companies, contacts,
   tickets): default property set (about 15-25 each), which columns are derived, which are PII.
4. `rex/hubspot/hubspot.pull.ts`: `fullPull` (list endpoint) and `incrementalPull` (search, ascending by
   `hs_lastmodifieddate`, watermark window that advances when a window reaches 9,500 rows, dedupe by id).
   Pure functions over the client, so they are testable with a fake client.
5. `rex/hubspot/hubspot.table.ts`: raw records to table. Resolves enum ids to labels
   (`dealstage_label`, `pipeline_label`, `owner_name`), adds `associated_company_id` via v4 batch
   associations, maps HubSpot property types to Rex column types (number to numeric, date/datetime to
   date, enumeration/bool to categorical, string to text), writes CSV (papaparse), builds `rawTable`
   (500-row preview, `fileKey`), merges an incremental delta into the previous snapshot by record id.
6. `rex/rex.connections.service.ts` + controller + routes: connect, list, disconnect, create datasets,
   sync now, property picker. All org-scoped like the existing dashboards controller.
7. `rex.hubspot.sync.ts`: orchestrates one dataset sync: lock, decide full vs incremental, pull, build,
   upload, hash-compare, swap R2 key (delete the old one), refresh dependent dashboards, record
   state. `syncAllHubspot()` registered in `jobs/system.cron.ts` next to the sheet sync.
8. Frontend: `ConnectHubSpotDialog`, "HubSpot" badge, last-synced and error display, Sync now, reconnect banner.

## 5. Data model (additive migration, nothing existing changes)

```prisma
model RexDataConnection {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  provider       String            // "hubspot"
  authType       String            // "token" now; "oauth" later
  credentialEnc  String            // secretBox ciphertext, never returned by any API
  accountLabel   String?           // portal id / name for display
  scopes         Json     @default("[]")   // objects verified readable at connect time
  config         Json     @default("{}")   // per-object: enabled, extra properties, includePii columns
  status         String   @default("active")   // active | auth_error | paused
  lastError      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([organizationId])
  @@map("rex_data_connection")
}
// RexDataset gains (all nullable / defaulted):
//   connectionId String?, sourceObject String?, syncCursor Json?, lastFullSyncAt DateTime?, syncStartedAt DateTime?
//   @@index([connectionId])
```

Datasets keep using existing columns: `sourceKind="hubspot"`, `lastSyncedAt`, `syncError`, `syncEnabled`,
`contentHash`. `metricKey="hubspot_<object>"`, `points=[]`, so metric digests/alerts ignore them.
Migration follows the repo rule (diff + curated `migrate deploy` with `DIRECT_URL`; no `migrate dev`).

## 6. Sync behaviour

- **First sync (full):** list endpoint, 100/page, capped at **100,000 rows and 40 MB per object**
  (under the AI service's 50 MB file limit). Hitting the cap sets a visible "truncated" note on the dataset.
- **Every 15 min (incremental):** search with `hs_lastmodifieddate >= watermark - 2 min` (overlap
  absorbs HubSpot's indexing delay), merged into the previous snapshot by id. A cycle with no changes costs 1 call.
- **Nightly full reconcile** (first run after 02:00 UTC): catches deletes and merges; also whenever the property
  selection changes.
- **Which datasets sync:** only those used by a dashboard (same rule as linked sheets), plus Sync now
  (1 per minute per connection) and a stale check when a dashboard is opened.
- **Budget guard:** a connection stops for the day at 40% of the plan's daily limit (assume the lowest, 250k, when the plan is unknown).
- **Concurrency:** one sync per connection (`syncStartedAt` lock, stale after 10 min), safe across
  multiple server instances.
- **Failures never blank a dashboard.** 401 sets the connection `auth_error`, pauses it and shows
  "Reconnect"; 403 marks only that object; 429/5xx back off and retry next tick; the last good snapshot
  keeps serving.

## 7. The MCP / Composio question

The catalog already lists `hubspot-marketing` on Composio's `hubspot` toolkit (managed OAuth, about 263
actions). It will connect and works for **agent actions** (search a contact, create a deal). It is the
wrong tool for dashboards: 100 rows per call, one Composio round trip per call, billed per tool call,
no 10k-cap handling, and its tools are built for chat loops with approval staging, not scheduled bulk
reads. So: **the dashboard feed does not use MCP**, and this work does not modify any MCP code, so
existing Vega/Maya/Rex-chat HubSpot behaviour cannot regress. A customer can have both connected.
Phase 2 spike: check whether a Composio connected account exposes the live OAuth access token. If
it does, "Use my existing HubSpot connection" gives one-click OAuth without us registering a HubSpot app.

## 8. Security and privacy

- Token encrypted at rest, never returned, never logged; connect request body is excluded from request logging.
- Least privilege: instructions list only read scopes; connect validates by reading and reports missing scopes.
- **PII default-off:** contact email, phone, first/last name, address are excluded unless the user
  opts in per column. When any included dataset has PII columns, enabling a public link on a dashboard that uses it shows a confirmation.
- Disconnect: stops syncing and deletes the stored credential immediately; the user chooses to keep the
  last snapshot (dashboards keep working, marked "disconnected") or delete the datasets and their R2 files.
- Org isolation: every query scoped by `organizationId`; R2 keys use the existing org-prefixed builder.

## 9. Testing

Vitest, no live HubSpot in CI: client (retry, `Retry-After`, error classification, token never in
messages), pull (pagination, 10k window advance with tied timestamps, dedupe, overlap), table (type
mapping, label resolution, merge, CSV round trip against the AI service's expectations, PII exclusion),
secretBox (round trip, tamper detection, bad key), sync state machine (lock, auth_error pause, partial
failure keeps snapshot), routes (org scoping, token never in responses). One manual smoke script that
runs against a real HubSpot account when a token is supplied.

## 10. Phases

- **Phase 0 (blocker for design numbers):** one real HubSpot account (a free developer test account is
  enough) to confirm list-endpoint pagination past 10k, property/pipeline shapes, and the Service Key scope names.
- **Phase 1 (this branch):** everything above for deals, companies, contacts, tickets.
- **Phase 2:** OAuth (project-based public app) or Composio token reuse; webhooks for near-real-time;
  custom objects and extra properties; engagement objects.
- **Phase 3:** database connector (Postgres/MySQL) on the same `RexDataConnection` + snapshot pipeline.

## 11. Decisions needing your sign-off

1. **Token-paste (Service Key or existing private-app token) first, OAuth later.** Reason: no HubSpot
   app registration needed to ship, but new private apps close on 2026-10-26, so Service Keys must be
   the documented path from day one.
2. **Default-off PII** for contact identity columns.
3. **Row cap 100k / 40 MB per object** in v1.
4. **A real HubSpot test account/token** from you for Phase 0 and the smoke test.
5. **New env var** `INTEGRATION_SECRET_KEY` must be set in every environment (local, Coolify) before deploy.
