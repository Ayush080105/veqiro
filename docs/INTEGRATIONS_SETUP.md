# Social Integrations Setup (Maya Publishing)

Maya can publish drafts to X (Twitter), LinkedIn, and Instagram. Each platform
requires a developer app, OAuth credentials, and a registered redirect URI.
Values go in `apps/server/.env`.

Before you start:
- `BETTER_AUTH_URL` must be publicly reachable (for callbacks). In local dev use
  a tunnel (e.g. `cloudflared tunnel` or `ngrok http 5000`) and set
  `BETTER_AUTH_URL=https://<your-tunnel>`.
- `CLIENT_URL` should point at the dashboard (`http://localhost:3000` in dev).
- Set `INTEGRATIONS_STATE_SECRET` to any strong random string. If unset, the
  integrations module falls back to `BETTER_AUTH_SECRET`.

---

## 1. Cloudflare R2 (required for image publishing)

Maya's image generation returns base64 PNGs. Instagram requires a public HTTPS
URL; LinkedIn/X also work more reliably with hosted media. We upload to R2.

1. Cloudflare dashboard → R2 → Create bucket (e.g. `veqiro-assets`).
2. Settings → **Public access** → enable via R2.dev subdomain or attach a
   custom domain. Copy the public base URL.
3. R2 → Manage R2 API Tokens → Create token with **Object Read & Write** on the
   bucket. Copy Access Key ID + Secret.
4. Fill in `apps/server/.env`:

```
R2_ACCOUNT_ID=<your cf account id>
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=veqiro-assets
R2_PUBLIC_URL=https://pub-XXXXXXXX.r2.dev          # or https://cdn.yourdomain.com
```

---

## 2. X (Twitter) — OAuth 2.0 with PKCE

1. https://developer.x.com → Project → App.
2. **User authentication settings**:
   - Type: **Web App, Automated App or Bot** (Confidential client)
   - App permissions: **Read and write**
   - Callback URL: `${BETTER_AUTH_URL}/api/v1/integrations/twitter/callback`
   - Website URL: your product URL
3. **Keys and tokens** → OAuth 2.0 Client ID & Client Secret → copy.
4. Fill in:
```
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
```

Scopes used: `tweet.read tweet.write users.read offline.access media.write`.
`media.write` (added by X in 2024) is required to upload images via the v2
media upload endpoint.

---

## 3. LinkedIn — OAuth 2.0

1. https://www.linkedin.com/developers → Create app.
2. **Products** tab → request access to:
   - **Sign In with LinkedIn using OpenID Connect** (auto-approved)
   - **Share on LinkedIn** (auto-approved for personal posts)
3. **Auth** tab:
   - Authorized redirect URLs: `${BETTER_AUTH_URL}/api/v1/integrations/linkedin/callback`
   - OAuth 2.0 scopes will show: `openid`, `profile`, `email`, `w_member_social`.
4. Copy Client ID and Client Secret →
```
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

Note: posting to Company Pages (as opposed to personal profiles) requires the
**Community Management API** (review required); this integration posts as the
authenticated person.

---

## 4. Meta / Instagram — Instagram Graph API via Facebook Login

Instagram publishing requires an IG Business or Creator account linked to a
Facebook Page.

1. https://developers.facebook.com/apps → Create App → type **Business**.
2. **Add Products**:
   - **Facebook Login for Business**
   - **Instagram** → **Instagram Graph API**
3. **Facebook Login for Business → Settings**:
   - Valid OAuth Redirect URIs: `${BETTER_AUTH_URL}/api/v1/integrations/instagram/callback`
   - Enforce HTTPS: on
4. **App settings → Basic**: copy App ID and App Secret →
```
META_APP_ID=...
META_APP_SECRET=...
```
5. **App Review → Permissions and Features** — submit for review:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`

Development / testing:
- Add your IG account as a **Tester** in App Roles.
- The IG account must be **Business or Creator** (in the IG app: Settings →
  Account → Switch Account Type).
- Link it to a **Facebook Page** you administer (Meta Business Suite → Accounts
  → Instagram accounts → Add).
- Until review is complete, only app admins/testers can connect; published
  posts go live normally.

---

## 5. Smoke test

1. Restart the server (`pnpm --filter server dev`) after adding env vars.
2. Sign in to the dashboard → **Settings → Integrations**.
3. Click **Connect** on each platform → approve → confirm it shows **Connected**
   with your handle / page name.
4. Go to **Assistants → Maya** → ask Maya to draft a post. On the draft card,
   click **Publish** → pick the account → verify the post appears on the
   platform and a success toast shows.
5. Check the `social_account` table in Postgres for stored tokens and
   `published_post` for the audit trail.
