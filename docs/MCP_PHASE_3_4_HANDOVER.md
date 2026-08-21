# MCP Phases 3 & 4 — deploy and test handover

Everything below landed across 18 commits. The code is written, typechecks, and
219 tests pass. **The unattended half has never actually run** — see
[What has not been tested](#what-has-not-been-tested), which is the part that
matters most for whoever picks this up.

---

## What shipped

### Phase 3 — inbound triggers

Agents can now act on events instead of only on request.

- **Discovered, not curated.** Every connected integration contributes its own
  triggers, read from Composio. Measured across the catalogue: **21 of 46
  integrations publish triggers, 191 types between them** (Confluence 23,
  ClickUp 21, Box 20, Sheets 16, Linear 12, Zoom 11). 25 publish none at all —
  including Instagram, LinkedIn, Facebook Pages, Reddit, GA4, Search Console,
  Razorpay, Calendly and Teams. Don't read their absence as a bug.
- **Seven curated triggers keep hand-written instructions** (new email, sent
  email, meeting starting, event created, Slack DM, Zoom recording, new sheet
  rows). Everything else gets a deliberately conservative generic instruction:
  judge whether the event warrants anything, do nothing if not, propose rather
  than act.
- **Public webhook** at `POST /api/v1/mcp/webhooks/composio`, mounted in
  `app.ts` **before `express.json()` and `camelizeBody`**. Both matter:
  signature verification needs the exact bytes, and camelizing would rewrite
  Composio's snake_case `trigger_slug` keys.
- **Nothing unverified gets through.** No signing secret → 503. Bad signature →
  401. `triggers.parse()` accepts unsigned payloads when given no secret, so
  refusing is deliberate.
- **Idempotent.** Events are recorded before handling, deduped on Composio's own
  event id. Composio retries anything slow to acknowledge, and a retry landing
  mid-run is exactly the duplicate this prevents.
- **Rate capped.** 20/hour per subscription, 60/hour per org. Each event is a
  full agent run, so an unbounded configuration is expensive as well as noisy.
- **A trigger firing is not consent.** Unattended runs end in a proposal.

### Phase 4 — plays, approval policy, audit log

- **Plays** — five recurring jobs (Monday briefing, daily inbox triage, Friday
  wrap-up, weekly search check, weekly content plan) with a "Run now" button.
  Definitions live in code so revising a prompt isn't a migration; the DB holds
  only per-org state. The cron matcher is hand-rolled because each org stores
  its own expression — including cron's day-of-month/day-of-week OR rule, which
  is tested.
- **Approval policy** — `ALWAYS_ASK` / `AUTO_RUN` / `NEVER`, most specific rule
  wins. Absence means ask, expressed as absence rather than a seeded row so a
  policy table that fails to load cannot authorise anything.
- **Audit log** — Settings → Usage, filterable by tool / writes / failures.
  Reads the `McpActionLog` rows that already existed and inherits their privacy
  stance: it shows *that* an email was sent, never what it said.

### Maya content plan

- Its own tab beside Published Posts, rendered as a **week calendar** — seven
  day columns, format chips, click a cell for the full reasoning.
- Each slot carries a reason sourced from something actually checked. Slots with
  no real signal are marked **"No strong signal"** rather than given an invented
  justification. A live run produced exactly that honesty, reporting "4 likes vs
  3" and volunteering that reach data was unavailable.
- **"Make this post" / "Make this reel"** opens the existing generator with the
  angle prefilled — hook into `topic`, caption direction into
  `additional_context`.
- Stored in `maya_content_plan`; opening the tab is a pure DB read.

### Cost reduction

This was a significant thread. Before/after per active user:

| Path | Before | After |
|---|---|---|
| Dashboard load | up to 15 provider calls, cached 60s, **refetch on window focus** | **0** |
| Tool listing | per org, per agent, per 30 min, lost on restart | ~1 per toolkit per 6h, shared across all orgs |
| Connection status polling | every 2s, **unbounded** (~1,800/hr if left open) | backs off, stops after ~3 min (~45 max) |
| Trigger events | uncapped | 20/hr per trigger, 60/hr per org |

**Dashboard live tiles, the widget catalogue and the metric engine were deleted**
by the owner's decision — high cost, low value. The Command Center is now the
approval queue plus a 24h action count, both from our own database.

**The Task feature was removed** (48 rows across 16 orgs, all of which had run).
Two of its three defaults duplicated plays. Its cron went with the UI so nothing
fires orphaned. `computeNextRun` was rescued to `common/utils/cron.ts` (expenses
needs it) and `system.cron.ts` moved to `jobs/`.

---

## Deploy

### 1. Environment

```bash
COMPOSIO_WEBHOOK_SECRET=<required — see below>
```

That's the only new **required** variable. The webhook host defaults to
`https://api.veqiro.com` in code, so production can't be broken by omission.
`COMPOSIO_WEBHOOK_URL` overrides it for local ngrok testing.

Get the secret by calling Composio's webhook subscription once — it returns it,
so there's no dashboard hunt:

```ts
const sub = await composio.triggers.setWebhookSubscription({
  webhookUrl: "https://api.veqiro.com/api/v1/mcp/webhooks/composio",
});
console.log(sub.secret);
```

Without it, arming any trigger now refuses with a clear message rather than
appearing to work.

> **Hazard worth understanding first.** `setWebhookSubscription` is
> **account-level** on Composio — one URL per API key, not per environment. If
> anyone points `COMPOSIO_WEBHOOK_URL` at an ngrok tunnel for local testing, it
> repoints *production's* webhooks to their laptop and production silently stops
> receiving events. **Use a separate Composio API key for local work.**

### 2. Migrations

Six new ones:

```
20260821120000_add_mcp_triggers
20260821130000_add_mcp_approval_policy
20260821140000_add_mcp_play
20260821150000_add_mcp_tool_catalog
20260821160000_add_maya_content_plan
20260821170000_add_mcp_trigger_catalog
```

⚠️ **Do not run `prisma migrate dev` — it wants to reset the database.** There is
pre-existing drift on `published_post` / `post_analytics` unrelated to this work.
All six were applied with:

```bash
npx prisma db execute --file prisma/migrations/<name>/migration.sql
npx prisma migrate resolve --applied <name>
```

Do the same in deploy, or fix the drift first.

### 3. Crons

Two new ones start with the server, both assuming a long-running process:

- **Plays scheduler** — every minute, checks which stored cron expressions match
- **MCP retention** — 03:30 UTC, prunes the action log past 365 days and trigger
  events past 90

Neither is idempotent across instances. **Running multiple app instances will
double-fire plays.** Fix that before scaling out.

---

## Test, in this order

Each step proves something the next depends on.

1. **Connect an integration** → the Tasks → Triggers tab lists its real triggers,
   grouped by tool.
2. **Enable one Gmail trigger**, then send yourself an email. This is the one
   that matters — it proves webhook delivery, signature verification, dedupe,
   the agent run, and staging, all at once.
3. **Check the approval queue** — the dashboard should show "1 action needs your
   approval", and Vega's chat should hold the draft.
4. **Approve it** and confirm the email actually sends and appears in the
   activity log.
5. **Plays → Run now** on Monday briefing. Confirm it produces a message and
   doesn't publish anything.
6. **Maya → Content Plan → Generate plan.** Confirm the calendar renders, and
   that **no image is generated** (that was a bug, fixed by `_skip_auto_image`).
7. **Click "Make this post"** — confirm `topic` and `additional_context` land in
   the right fields, not jammed together.
8. **Set an approval rule** to `NEVER` for one tool and confirm a proposed write
   is blocked and recorded.

---

## What has not been tested

Stated plainly because it's the risk that matters:

- **No trigger has ever fired.** The security path is verified (503 with no
  secret, 401 with a bad signature, locally and through a public tunnel). The
  happy path — real event → agent → staged proposal — has never run.
- **No play has run on its schedule.** Only the content plan has run, manually.
- **The generic trigger instruction has never executed.** The curated prompts
  were written against known events; the generic one is unproven, and it now
  covers ~184 of the 191 trigger types.
- **The approval policy has never been exercised.**
- **The audit log UI has never rendered.**
- **The "Make this post" prefill has never been clicked.** Prefill keys must
  match `RunActionDialog`'s `defaultValue` shapes — a mismatch fails silently as
  an empty form, not an error.
- **Instagram carousel publishing** remains unverified against a live account.
  Single-post publishing is proven.

---

## Known gaps and decisions

- **"Weekly Financial Digest" was lost** with the Task removal and has no play
  equivalent. Five lines in `mcp.plays.ts` to restore if wanted.
- **A bad content plan can't be regenerated** until the following week — the
  button hides once a plan exists and the schedule skips. Per-slot regeneration
  would be the better fix.
- **`McpDashboardTile` and `Task` tables are kept but unused.** Nothing reads or
  fires them. Dropping them would destroy real rows over decisions that could be
  revisited; drop migrations are one-liners when you're sure.
- **Trigger agent assignment follows the integration's `primaryAgent`**, so
  Confluence goes to Lex and ClickUp to Rex. Reasonable but arbitrary for some.
  `McpTriggerSubscription.instruction` exists for per-subscription overrides but
  no UI writes it yet.
- **Two pre-existing test failures** (`rex-csv`, `scout`) predate this work and
  are unrelated.
- **An Instagram test post is still live** —
  https://www.instagram.com/p/DcMOXZAG5GJ/ — and Composio exposes no delete-media
  tool, so it must be removed in the app.

---

## Conventions worth keeping

Two rules earned the hard way in this work:

**Verify every provider response against a live account before writing a
definition.** Gmail's `resultSizeEstimate` silently ignores its query (returned
201 for both "unread" and "all"; the real answer was 273). Google Calendar and
Zoom take snake_case and *silently ignore* camelCase. None of these throw — they
just produce wrong data.

**A prompt is not a control.** Twice in this feature an instruction written into
a prompt turned out to be unenforceable. The content plan kept generating images
because that is post-processing in Python keyed off which tool ran, not
something the model chooses — no wording could have stopped it. When behaviour
must not happen, it needs a mechanism, not a sentence.
