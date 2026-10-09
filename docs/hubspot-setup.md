# HubSpot in Rex: setup guide

Two audiences: the people who connect their HubSpot (section 1), and whoever runs Veqiro (section 2).

## 1. For users: where and how to connect

**Where.** Rex workspace, then either:
- **Data** tab: the "Live data sources" panel at the top, button *Connect HubSpot*.
- **Work, Dashboards**: button *Connect HubSpot* next to *New dashboard*.

Both open the same four-step window: connect, check access, choose data, sync. Next to each *Connect HubSpot* button there is an ⓘ that opens a guide (how it works, steps for each way to connect, privacy, and what to do if something goes wrong). The connect step also shows the steps for whichever way is selected, right above the box where the key goes. "Connect with HubSpot" is listed only once the server has it set up. At the end it offers ready-made dashboards (pipeline, revenue and win rate, leads, tickets, top accounts).

**Three ways to connect**

| Way | What the user does | Needs from Veqiro |
|---|---|---|
| **Service Key** (recommended, works today) | In HubSpot: *Settings, Integrations, Service Keys*, create a key, add the read scopes the window lists (it has a *Copy all scopes* button), paste the key. | Only the encryption key (section 2a). |
| **Existing private app token** | Paste the token of a private app that already exists. HubSpot stops letting accounts *create* new private apps from 26 Oct 2026; existing ones keep working. | Same. |
| **Connect with HubSpot** (OAuth, one click) | Click the button, approve in HubSpot, land back in Rex. The person approving must be a HubSpot Super Admin. | A registered HubSpot app (section 2b). The button only appears once it is configured. |

**What Rex reads.** Read only. Deals, companies, contacts and tickets by default; products, line items, quotes, calls, meetings, tasks and the account's custom objects if the key allows and the user ticks them. Contact names, emails and phone numbers are left out unless the user opts in per field, and publishing a dashboard that reads them asks for a confirmation.

**Keeping it fresh.** Dashboards update while open (about a minute), every 5 minutes in the background, and on the *Refresh* button. Deleted HubSpot records disappear after the nightly check or *Full resync* (the arrow next to Refresh).

**If something breaks.** The connection shows *Needs reconnecting* with a *Reconnect* button. Reconnecting replaces the key on the same connection (it must be the same HubSpot account) and keeps all dashboards and choices. Dashboards keep showing the last good data meanwhile.

## 2. For whoever runs Veqiro

### 2a. Required for any HubSpot connection

1. **Apply the migration** `apps/server/prisma/migrations/20261007120000_rex_hubspot_connections` (additive). Use `migrate deploy` with `DIRECT_URL`, never `migrate dev` (this database has drift).
2. **Set `INTEGRATION_SECRET_KEY`** in every environment (local `.env`, Coolify). It encrypts the stored HubSpot keys. Generate one:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   Keep it safe and do not change it later: keys stored under the old value become unreadable and users would have to reconnect. Without it the window says connecting isn't set up, and nothing is stored.
3. **Nothing else.** The 5-minute sync runs inside the existing API server (`jobs/system.cron.ts`); there is no queue or worker to add. Existing HubSpot connections made through Integrations (Composio) are untouched and separate.

### 2b. Optional: the "Connect with HubSpot" button

This is the only part that needs something created outside the code.

1. Create a free **HubSpot developer account** and a **project-based app** on the current developer platform (legacy public apps can no longer be created). Use the HubSpot CLI (`hs project create`).
2. In the app's config set the auth type to **OAuth**, add the **redirect URL**, and list the scopes:
   - **Redirect URL:** `<your API base URL>/agents/rex/connections/hubspot/oauth/callback`. Must be HTTPS and a domain name (no IP addresses).
   - **Required scopes** (must match `REQUIRED_SCOPES` in `apps/server/src/modules/agents/rex/hubspot/hubspot.oauth.ts` exactly): `crm.objects.contacts.read crm.objects.companies.read crm.objects.deals.read crm.objects.owners.read crm.schemas.contacts.read crm.schemas.companies.read crm.schemas.deals.read`
   - **Optional scopes** (match `OPTIONAL_SCOPES`): `tickets crm.objects.custom.read crm.schemas.custom.read crm.objects.line_items.read crm.objects.quotes.read e-commerce crm.pipelines.orders.read`. HubSpot drops the ones an account's plan doesn't have, so smaller accounts still connect.
3. Upload the project (`hs project upload`), then copy the **client ID and client secret** from the app's Auth page.
4. Set `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI` (the exact redirect URL above) and redeploy. The button appears.

**Limits to know before relying on OAuth for everyone** (HubSpot's current rules):
- Until the app is **listed on the HubSpot Marketplace** it can be installed in at most **25 accounts** (a privately distributed app: 10). Listing requires HubSpot's app review. After listing there is no cap.
- Installing needs a **Super Admin** (or Marketplace access) in the customer's HubSpot.
- Users will see an "unverified app" notice until the app is listed.

Because of this, **Service Keys are the dependable route for all customers today**; OAuth is a convenience that becomes unlimited after Marketplace listing.

### 2c. Check it works with a real account

1. `HUBSPOT_TOKEN=<a Service Key> npx tsx apps/server/scripts/hubspot-smoke.ts --deep`
   Confirms what documentation could not: that the list endpoint pages past 10,000 records, that each object's "modified since" filter works (contacts have a built-in fallback), the real scope names, and the real property and stage shapes.
2. Connect from the UI, tick Deals, and watch the sync finish; build the *Sales pipeline* dashboard.
3. Edit a deal in HubSpot; with the dashboard open it should change within about 1 to 2 minutes, or immediately after *Refresh*.
4. Make a dashboard public and check what the page shows.

`apps/server/scripts/hubspot-contract-check.ts` and `.py` prove the file format against the AI service's real loader without any HubSpot account.

### 2d. Operating it

- **Cost and load.** No AI tokens are used by syncing or polling. A sync with no changes is one HubSpot call per object. Recomputing a dashboard after data changes uses AI-service CPU, limited to one recompute per dashboard every 2 minutes. HubSpot calls count against the customer's HubSpot quota; a connection stops for the day at 100,000 calls.
- **Where errors show.** Per dataset and per connection in the Data tab panel (plain language). Server logs are prefixed `[rex-hubspot]`.
- **Capacity.** Fine for tens to low hundreds of connected accounts on the current in-process scheduler. Beyond that, move syncing to a real queue.
- **Known limits.** 100,000 records and 40 MB per object (50,000 for activity objects); 60 columns per object; deletions appear after the nightly check; Reports download is hidden for HubSpot datasets (it reads only a 500-row preview).

### 2e. Filling a test account with demo data

`apps/server/scripts/hubspot-seed.ts` creates varied demo records (about 60 companies, 260 contacts, 420 deals spread over a year in every stage, 130 tickets) so dashboards have something to show. Run it yourself, so the key stays with you. It needs a **separate key with write scopes** (the connection key is read only) from a **test or developer account**, never a real CRM.

```
HUBSPOT_TOKEN=<write key> npx tsx scripts/hubspot-seed.ts --portal <account id>              # dry run, writes nothing
HUBSPOT_TOKEN=<write key> npx tsx scripts/hubspot-seed.ts --portal <account id> --scale 0.05 --yes   # small pilot
HUBSPOT_TOKEN=<write key> npx tsx scripts/hubspot-seed.ts --portal <account id> --yes          # full set
HUBSPOT_TOKEN=<write key> npx tsx scripts/hubspot-seed.ts --portal <account id> --cleanup --yes   # remove what it made
```

Write scopes: `crm.objects.contacts.write`, `crm.objects.companies.write`, `crm.objects.deals.write`, `tickets`, plus the read scopes. It refuses to run if `--portal` does not match the key's account, writes nothing without `--yes`, and records every id it creates in `hubspot-seed-manifest.<account>.json` so `--cleanup` removes exactly those records.

