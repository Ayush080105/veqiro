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

---

# Addendum (2026-10-07, after review): live updates, entity/field modelling, connect UX + OAuth

Decisions in section 11 are approved. These three sections extend the design; where they conflict with
sections 1-10 they win (notably: sync cadence is 5 min not 15, OAuth is built now behind configuration,
and objects beyond the first four are in scope).

## 12. Live updates

HubSpot cannot push to a token connection (webhooks need a project-based app; the webhooks *journal* is a
pull API that also needs that app and avoids a public endpoint, so it is the Phase 2 path once OAuth is
registered). So "live" here means **fresh on demand, polled cheaply**, which is honest and robust:

| Moment | What happens | Freshness |
|---|---|---|
| Editor open | Browser refetches the dashboard every 30s while the tab is visible. Each fetch calls `ensureFresh(datasets, 60s)`: if a HubSpot dataset was last synced more than 60s ago and nothing is syncing, an incremental sync starts in the background and the *next* poll picks up the new rows. | about 1 min |
| Public link open | Public page refetches every 60s; the public endpoint calls `ensureFresh(datasets, 120s)`, gated by the existing per-token limiter. | about 2 min |
| Nobody watching | Cron every 5 min syncs HubSpot datasets that a dashboard uses. | at most 5 min |
| **Refresh button** | Runs an incremental sync *now* and waits (up to 25s) before recomputing; if HubSpot is slow it answers "still syncing" and the UI keeps polling. A "Full resync" menu item does the full pull. | immediate |

An incremental sync with no changes costs one search call per object, so an always-open dashboard uses
roughly 6k calls/day against the 250k+ plan budget (the 40% daily guard still applies). The UI shows a
**Live pill**: "Live, updated 12s ago", turning amber ("Updating") during a sync and red with a plain
reason on failure. Known limit: deletions in HubSpot show up after the nightly reconcile or a Full resync.

The existing **Refresh** also needs fixing generally: today it only recomputes from stored files and never
re-fetches a linked sheet. It will now sync HubSpot sources first (linked sheets are left as is and flagged to you).

## 13. Entities and fields: how HubSpot's breadth becomes usable tables

**Principle:** one table per object, one row per record, flat columns, human-readable values, explicit join
keys. Dashboards are limited to 5 datasets, so relationships are denormalised instead of added as extra tables.

*Objects (generic `ObjectSpec`, so adding one is data not code):*
- Tier 1, on by default: **deals, companies, contacts, tickets**.
- Tier 2, opt-in: **products, line items, quotes, calls, meetings, tasks** (activity objects capped at 50k rows).
- Tier 3, opt-in, discovered at connect time from `GET /crm/v3/schemas`: **custom objects**, same generic pipeline.
- Not supported (Phase 2): emails and notes (huge, mostly free text), marketing events, forms, lists.

*Fields:*
- Pull the property catalogue (`/crm/v3/properties/{type}`) and classify each: **recommended** (curated set that
  exists in this portal, about 15-25 per object), **custom** (portal-defined), **other** (HubSpot-defined, rest).
  Hidden properties, `json`/`object_coordinates` types and sensitive-flagged properties are never offered.
- Default selection = recommended. The picker shows counts and lets the user add custom/other fields grouped by
  HubSpot's own `groupName`, searchable, with type icons. **Hard cap: 60 columns per object** (derived columns
  count), so the AI schema prompt and DuckDB stay small and fast.
- PII properties (email, phone, names, address) stay off unless opted in per column (section 8).

*Value shaping (so dashboards and the AI get clean data):*
- Enumerations store the **label**, not the internal id (`Closed won`, not `closedwon`); owners become
  `owner_name`; deal/ticket stages and pipelines come from the pipelines API.
- Numbers as plain numerics; date/datetime as ISO text typed `date`; booleans as `true`/`false` categoricals;
  multi-select values keep HubSpot's `;` separator.
- Friendly stable column names for the curated set (`deal_name`, `amount`, `close_date`, `stage`, `pipeline`,
  `owner_name`, `created_at`); other properties keep HubSpot's internal name so renames in HubSpot never break
  a dashboard.
- Every table has `id` (HubSpot record id) as its first column.
- **Derived columns that make dashboards easy:** deals: `is_open`, `is_won`, `is_lost`, `stage_probability`,
  `weighted_amount`; tickets: `is_open`; deals, contacts and tickets: `associated_company_id` and
  `associated_company_name` (primary association). Join: `deals.associated_company_id = companies.id`.
- Currency: `amount` stays in the deal's currency; `deal_currency_code` is included. A dashboard over several
  currencies is flagged in the dataset note (no conversion in v1).

*Making it show up well in dashboards:* no AI-service change. The New dashboard dialog offers **HubSpot
templates** (Sales pipeline, Revenue and win rate, Lead sources and lifecycle, Support tickets) whose prompts
name the real columns (`is_won`, `stage`, `owner_name`, ...) and appear only when the needed objects are synced.
Missing objects show a one-click "Add Deals" instead.

## 14. Connect experience and OAuth

**Wizard (one dialog, four steps, resumable):**
1. **Connect.** Two clear options. *Connect with HubSpot* (OAuth, one click, shown when the server has a HubSpot
   app configured) and *Use a Service Key / private app token*, with a numbered how-to, a "Copy required scopes"
   button, a link to the right HubSpot settings page and the plain note that new private apps close on
   26 Oct 2026. The token field masks input and validates on blur.
2. **Verify.** Shows the HubSpot account and, per object, a green check or an amber "needs scope X" with the
   exact fix and a Re-check button.
3. **Choose data.** Objects as cards with record counts and a recommended-fields summary; "Customise fields"
   opens the picker; PII toggles with a one-line explanation; a warning if an object exceeds the 100k cap.
4. **Syncing.** Per-object progress (rows pulled), then "Build a dashboard" with the templates, or "Done".

**Connections panel** (Data tab): one row per connection with a status chip (Live / Syncing / Needs reconnect /
Paused), account name, last sync, per-object row counts, *Sync now*, *Full resync*, *Edit data*, *Reconnect*,
*Disconnect* (with the keep-or-delete choice). Errors are phrased as actions ("HubSpot says the key was revoked.
Reconnect"), never raw status codes.

**OAuth (built now, enabled by configuration):**
- Env: `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI`. With these unset the OAuth button is
  hidden and the token path works unchanged. Registering the HubSpot app (a project-based public app, since
  legacy public app creation is closed) is a one-time step on your side; the code and tests are ready before it.
- Flow: `POST /connections/hubspot/oauth/start` returns the authorize URL (`app.hubspot.com/oauth/authorize`)
  with an HMAC-signed `state` (org, user, return path, nonce, 10-min expiry) and read scopes as required plus
  optional scopes (tickets, custom objects, products) so smaller plans still connect. The browser is redirected
  (full page, no popup blockers); HubSpot returns to the public callback
  `GET /connections/hubspot/oauth/callback`, which verifies `state` (no session cookie is needed, so cross-domain
  cookies cannot break it), exchanges the code, stores access and refresh tokens encrypted, then redirects back to
  the page the user came from with the wizard on step 2.
- Access tokens last 30 minutes: the client refreshes proactively (1 min before expiry) and once on a 401,
  serialised per connection so concurrent syncs never race two refreshes. A failed refresh marks the connection
  *Needs reconnect*.
- Composio token reuse stays a Phase 2 spike; it would give OAuth without our own HubSpot app.
