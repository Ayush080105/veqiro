# Maya end-to-end pipeline report

**Date:** 2026-04-25
**Tested against:** real LLM (`gpt-4o-mini` text + `gemini-2.5-flash` images), Express on `:5000`, FastAPI on `:8000`, Supabase Postgres.
**Test identity:** org `1xDKGYZJ6Ijo…JkycC` ("Test"), user `bt23cse181@iiitn.ac.in`.

---

## Architecture

```
┌─────────────────────┐    POST /api/v1/agents/maya/{action}      ┌────────────────────┐    POST /ai/maya/{action}    ┌────────────────────┐
│  apps/main          │    Cookie session OR                       │  apps/server       │   X-Internal-Api-Key         │  apps/ai           │
│  Next.js (port 3001)│    Authorization: Bearer INTERNAL_API_KEY  │  Express (port    │ ───────────────────────────► │  FastAPI (port 8000)│
│  React Query        │ ─────────────────────────────────────────► │  5000)            │                              │  verify_internal_key│
│  apiFetch (fetch +  │                                            │  authMiddleware    │                              │  Pydantic validate │
│  credentials)       │ ◄───────────────────────────────────────── │  Zod parse         │ ◄─────────────────────────── │  MayaAgent + LLM   │
└─────────────────────┘                                            │  service ↔ Prisma  │                              └─────────┬──────────┘
                                                                   └────────────────────┘                                        │
                                                                          │                                                      ▼
                                                                          ▼                                            OpenAI gpt-4o-mini (text)
                                                                   Postgres (Supabase)                                 Gemini 2.5-flash (image)
                                                                   Message, PublishedPost,                             + brand-kit fetch back
                                                                   SocialAccount, Organization                           to Express GET /internal/brand-kit/:org
                                                                          │                                                      │
                                                                          └──────── R2 (when configured) ───────────────────────┘
                                                                                    base64 → S3-compatible upload
```

Two auth lanes hit the same routes:
- **Browser path**: cookie session (Better Auth) → middleware reads `session.activeOrganizationId`.
- **Internal path** (curl, agent-to-agent): `Authorization: Bearer ${INTERNAL_API_KEY}` + `userId`/`organizationId` in the body.

The Express server always calls FastAPI with `X-Internal-Api-Key`. FastAPI uses [verify_internal_key](apps/ai/core/auth.py) globally on every router.

---

## Per-endpoint pipelines

For each endpoint: **frontend trigger → request body → server → AI request → AI response → DB writes → final response**.

### 1. `POST /agents/maya/chat` — conversational message

| Layer | Detail |
|---|---|
| Frontend trigger | `useSendMessage` hook ([assistants.ts:150](apps/main/src/lib/api/assistants.ts#L150)). Optimistically appends user message to React Query cache. |
| Request body | `{ organizationId, content, conversationId? }` |
| Server route | `msgMaya` ([maya.controller.ts:24](apps/server/src/modules/agents/maya/maya.controller.ts#L24)) → `sendMessageSchema.parse` → `mayaService.sendMessage` |
| Server → AI | Persists user message, fetches last 10 messages, then `aiService.post("/ai/maya/chat", { user_id, conversation_id, message, history })` ([maya.service.ts:74](apps/server/src/modules/agents/maya/maya.service.ts#L74)) |
| AI handler | `maya_chat` ([routes.py:262](apps/ai/agents/maya/routes.py#L262)) → `MayaAgent.chat_sync` → `BaseAgent.chat_sync` (with RAG augmentation) → OpenAI `gpt-4o-mini`. After LLM response, [agent.py:134](apps/ai/agents/maya/agent.py#L134) inspects tool calls; if `draft_content`/`generate_ideas`/`generate_variants` fired → triggers Gemini image gen. |
| AI response | `ChatSyncResponse { response, agent, message_id, tokens_used, model_used, metadata, image? }` |
| Server post-process | If image has `image_base64` and R2 configured → upload, store URL on Message row. |
| DB writes | 2 rows: user `Message` + assistant `Message` (with `tokensUsed`, `model`, `imageUrl`). |
| Final response | `{ role: "assistant", content, imageUrl?, createdAt }` |
| **Status** | ✅ verified working — 35s real LLM round trip |

> **⚠️ Note**: The server passes `user_id: organizationId` ([maya.service.ts:75](apps/server/src/modules/agents/maya/maya.service.ts#L75)) — almost certainly a bug. Should be `user_id: userId`. Doesn't break anything because the AI side only uses `user_id` for logging/RAG keys, but it's wrong.

### 2. `GET /agents/maya/chat` — retrieve history

| Layer | Detail |
|---|---|
| Frontend trigger | `useMessages` hook ([assistants.ts:142](apps/main/src/lib/api/assistants.ts#L142)) |
| Request | Query string `?organizationId=...` |
| Server | `getMayaMessages` → `mayaRepository.findAllMayaMessages(orgId)` |
| AI | **none** (DB-only read) |
| Final response | `Message[]` with `role`, `content`, `imageUrl`, `createdAt`, `customInput` |
| **Status** | ✅ verified, returns full history |

### 3. `POST /agents/maya/generate-ideas`

| Layer | Detail |
|---|---|
| Frontend | "Generate post ideas" form in [forms.tsx](apps/main/src/components/agents/maya/forms.tsx) → `useRunAgentAction({ actionId: "maya:generate-ideas" })` |
| Body | `{ organizationId, platform, topicHint?, count?=3, includeImage?, useLogo?, useMascot? }` |
| Server | `generateIdeas` controller → service writes user `Message`, posts to `/ai/maya/generate-ideas` |
| AI body | Same fields, snake_case |
| AI handler | [routes.py:271](apps/ai/agents/maya/routes.py#L271) — builds system prompt (with brand kit), prompts gpt-4o-mini for JSON array, parses with `safe_json_loads`. If `include_image=true` → calls `generate_social_image` (Gemini). |
| AI response | `{ ideas: ContentIdea[], image?: ImageResult, tokens_used, model_used, generated_at }` |
| Server post-process | `hostImage` uploads base64 → R2 if configured |
| DB writes | 2 rows (user/assistant) with `customInput.tool="generate-ideas"`. **Note**: `tokensUsed`/`model` not persisted. |
| **Status** | ✅ verified — 7s without image |

### 4. `POST /agents/maya/draft-content`

| Layer | Detail |
|---|---|
| Frontend | `DraftPostForm` → `useRunAgentAction` |
| Body | `{ organizationId, topic, platform, toneOverride?, wordCountTarget?=200, includeImage?, useLogo?, useMascot?, additionalContext? }` |
| Server | `draftContent` controller → service forwards to `/ai/maya/draft-content` |
| AI handler | [routes.py:332](apps/ai/agents/maya/routes.py#L332) — loads brand kit, picks tone (override or platform default), prompts gpt-4o-mini for JSON object, optionally generates Gemini image with aspect ratio + reference URLs. |
| AI response | `{ draft: { title, body, hashtags[], cta, meta_description, word_count, platform, tone_used }, image?, tokens_used, model_used }` |
| DB writes | 2 rows; assistant row's `imageUrl` set if R2 hosting succeeds |
| **Status** | ✅ verified — 6s no image, 21s with image (Gemini), base64 ~1.65 MB |

### 5. `POST /agents/maya/generate-variants`

| Layer | Detail |
|---|---|
| Frontend | `VariantsForm` |
| Body | `{ organizationId, originalContent, originalPlatform, targetPlatforms[1-3], includeImages? }` |
| Server | `generateVariants` controller |
| AI handler | [routes.py:407](apps/ai/agents/maya/routes.py#L407) — `asyncio.gather` parallel calls, one prompt per target platform. |
| AI response | `{ variants: ContentVariant[], tokens_used, model_used }` per-variant `{ platform, title, body, hashtags[], char_count, image? }` |
| **Status** | ✅ verified — 5s for 2 platforms |

### 6. `POST /agents/maya/revise`

| Layer | Detail |
|---|---|
| Frontend | `ReviseForm` |
| Body | `{ organizationId, originalContent, platform, feedback, specificInstructions? }` |
| Server | `revise` controller |
| AI handler | [routes.py:483](apps/ai/agents/maya/routes.py#L483) — single LLM call expecting JSON `{ revised: { title, body, hashtags, cta }, changes_made: [strings] }` |
| **Status** | ❌ **BROKEN — deterministic 500** |

**The bug**: prompt at [routes.py:520](apps/ai/agents/maya/routes.py#L520) doesn't tell the LLM `hashtags` is an array. gpt-4o-mini consistently returns `"#AI #Productivity #Innovation"` (one string) but `RevisedContent.hashtags: list[str]` rejects it. Verified 3/3 attempts fail.

### 7. `POST /agents/maya/regenerate-image`

| Layer | Detail |
|---|---|
| Frontend | `ImageRegenCard` "Regenerate" button → `useRunAgentAction` |
| Body | `{ organizationId, imageUrl, prompt, platform, useLogo?, useMascot? }` |
| Server | `regenerateImage` controller |
| AI handler | [routes.py:590](apps/ai/agents/maya/routes.py#L590) — `_fetch_asset(image_url)` to get reference bytes. If fetched → `generate_image_with_image_bytes` (Gemini edit). If fetch fails → plain `generate_image` (Gemini). |
| AI response | `{ image: ImageResult { image_base64, content_type, prompt_used }, model_used: "gemini-2.5-flash-image" }` |
| Server post-process | `hostImage` uploads to R2 if configured |
| DB writes | 2 rows; assistant row has `imageUrl` if R2 succeeds |
| **Status** | ✅ verified — 66s |

### 8. `POST /agents/maya/regenerate-content`

| Layer | Detail |
|---|---|
| Frontend | `ContentRegenCard` "Regenerate caption" → `useRunAgentAction` |
| Body | `{ organizationId, caption, prompt, platform }` |
| Server | `regenerateContent` controller |
| AI handler | [routes.py:616](apps/ai/agents/maya/routes.py#L616) — single LLM call returning `{ caption, hashtags[], cta }` |
| **Status** | ✅ verified — 4s |

### 9. `POST /agents/maya/publish` — server-only, no AI call

| Layer | Detail |
|---|---|
| Frontend | `publish-dialog.tsx` → `usePublishPost` hook |
| Body | `{ organizationId, socialAccountId, caption, hashtags?, imageUrl? OR imageBase64? }` (XOR enforced) |
| Server flow ([maya.service.ts:337](apps/server/src/modules/agents/maya/maya.service.ts#L337)) | (1) `integrationsRepository.findById(socialAccountId)` — must belong to org. (2) If `imageBase64` → upload to R2 (or 400 if R2 missing). (3) Instagram + no image → 400. (4) Lazy OAuth refresh if token expires <60s. (5) Create `PublishedPost` row with `status=pending`. (6) `providers[platform].publish({ account, caption, imageUrl })`. (7) On success → update row `status=success`, `platformPostId`, `publishedAt`; write Maya assistant message. (8) On failure → `status=failed`, `error=<message>`. |
| Final response | `{ platform, platformPostId, url?, publishedAt }` |
| **Status** | ✅ guard verified (404 with non-existent socialAccountId). Real publish blocked: no `SocialAccount` rows, empty OAuth keys, no `R2_*` for image upload. |

---

## Verification results summary

| # | Check | Result | Latency |
|---|---|---|---|
| 1 | Env / wiring pre-flight | ⚠️ partial | — |
| 2 | AI `/health` | ✅ 200 | <1ms |
| 3 | Express boot | ✅ 200 | — |
| 4 | `POST /agents/maya/chat` | ✅ 200 | ~35s |
| 5 | `GET /agents/maya/chat` | ✅ 200 | <1s |
| 6 | `POST /generate-ideas` | ✅ 200 | 7s |
| 7 | `POST /draft-content` (no image) | ✅ 200 | 6s |
| 8 | `POST /draft-content` (image) | ✅ 200 | 21s, base64 1.65 MB |
| 9 | `POST /generate-variants` | ✅ 200 | 5s |
| 10 | `POST /revise` | ❌ **500 deterministic** | 4s (3/3 failed) |
| 11 | `POST /regenerate-content` | ✅ 200 | 4s |
| 12 | `POST /regenerate-image` | ✅ 200 | 66s, base64 2.2 MB |
| 13 | `POST /publish` (no account) | ✅ 404 "Social account not found" | <1s |
| 14 | Bad bearer token | ✅ 401 "Unauthorized" | <1s |
| 15 | DB persistence | ✅ | — |

---

## What's missing / not working

### Real bugs

| # | Where | Impact | Fix |
|---|---|---|---|
| **1** | [apps/ai/agents/maya/routes.py:520](apps/ai/agents/maya/routes.py#L520) prompt for `revise` | `revise` endpoint returns 500 100% of the time | Change `hashtags` to `hashtags (array of strings)` in the prompt — match the working draft-content/generate-ideas prompt style |
| **2** | [apps/server/src/modules/agents/maya/maya.service.ts:75](apps/server/src/modules/agents/maya/maya.service.ts#L75) | `user_id` field sent to `/ai/maya/chat` is the **organizationId**, not the user's id. Logs/RAG personalization on AI side is keyed wrong | Change `user_id: organizationId` → `user_id: userId` |
| **3** | All action services (`generateIdeas`, `draftContent`, `generateVariants`, `revise`, `regenerateImage`, `regenerateContent`) | Don't pass `tokensUsed` / `model` into `createAssistantMessage`, so the Message rows have `tokens=0, model=null` | Pass `tokensUsed: data.tokens_used, model: data.model_used` like [maya.service.ts:101-102](apps/server/src/modules/agents/maya/maya.service.ts#L101-L102) does for chat |
| **4** | [apps/server/src/middlewares/auth.middleware.ts:21](apps/server/src/middlewares/auth.middleware.ts#L21) | `console.log(authHeader)` leaks the full bearer token to stdout on every request | Remove |

### Configuration gaps (env)

| Env | Where | Effect today | Fix |
|---|---|---|---|
| `BRAND_KIT_SERVICE_URL=http://your-express-host:port` | apps/ai/.env | Brand kit fetch fails silently → every Maya post uses generic `BrandKit()` defaults (`"My Company"`, generic voice). Confirmed in image prompt logs. | Set `http://localhost:5000` for dev |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | apps/server/.env (all unset) | Images return as base64 (1.6-2.2 MB JSON payload). UI must handle that. `publish` with image fails. | Provision Cloudflare R2 + set the 5 vars |
| `TWITTER_CLIENT_ID/SECRET`, `LINKEDIN_CLIENT_ID/SECRET`, `META_APP_ID/SECRET` | apps/server/.env | Can't connect new social accounts; can't publish | Set OAuth credentials per provider |
| `INTEGRATIONS_STATE_SECRET` | apps/server/.env | OAuth state-signing secret missing — connect-account flow likely broken | Generate a random secret |
| `API_SECRET` | apps/ai/.env | Empty — unused today but flag for future review | Confirm whether anything reads it |

### Quality / observability gaps

- **No tests.** [apps/server/src/modules/agents/maya/maya.test.ts](apps/server/src/modules/agents/maya/maya.test.ts) is one TODO line. The AI side has zero coverage of `MayaAgent`. Every regression has to be caught by curl.
- **`MOCK_MODE` mock data is stale**. The mock LinkedIn idea hardcodes "AI productivity for founders" regardless of `topic_hint`. Fine for plumbing but not realistic.
- **Duplicate constant misuse**: `SAGE_HISTORY_LIMIT` is used in Maya's chat history fetch ([maya.service.ts:71](apps/server/src/modules/agents/maya/maya.service.ts#L71)) — works, but should be renamed to a generic `AGENT_CHAT_HISTORY_LIMIT` or have a Maya-specific one.
- **No streaming**: chat returns a single JSON. For LinkedIn drafts the user waits 6-10s with no indication. The AI side has streaming infra ([core/llm.py:252](apps/ai/core/llm.py#L252)) but nobody calls it from `/chat`.
- **Error surfacing is opaque**: when AI returns 500, the server propagates `"Request failed with status code 500"` — no detail surfaces to the UI. A user can't tell whether to retry.

### Frontend / UX gaps

- The Maya chat surface itself isn't directly mounted on a route I can find — only `/workspace/content` references Maya, and that page has mock data. Confirm: is there a chat surface at `/workspace/maya` or similar?
- Frontend dev port is **3001** (`next dev -p 3001`), not 3000.

---

## Next steps (ranked)

### P0 — fix today, all small

1. **Patch the `revise` prompt** ([routes.py:520](apps/ai/agents/maya/routes.py#L520)): say `hashtags (array of strings)` and `cta (string)`. Restart `uvicorn`. Re-run the curl below. This is a 1-line fix that turns a deterministic 500 into a working endpoint.
2. **Fix the `user_id` swap** in [maya.service.ts:75](apps/server/src/modules/agents/maya/maya.service.ts#L75).
3. **Set `BRAND_KIT_SERVICE_URL=http://localhost:5000`** in `apps/ai/.env`. Restart `uvicorn`. Maya output quality jumps from "My Company" to your real brand voice. Verify by running `draft-content` again and grepping the AI logs for `brand_kit loaded | org=…`.
4. **Remove `console.log(authHeader)`** in auth.middleware.ts:21 — leaking the bearer token in dev logs is a low-grade hazard.

### P1 — observability

5. **Persist `tokensUsed` + `model` on action endpoints**. Same shape as the chat endpoint. One field-add per service call. Without this you have no per-tool token accounting.
6. **Surface upstream errors**: in [aiService.ts](apps/server/src/common/utils/aiService.ts), add an axios response interceptor that, on 5xx, throws a `BadRequestError(detail)` instead of letting the raw axios error bubble up. UI then sees the actual `"Content revision failed — retry"` instead of `"Request failed with status code 500"`.

### P2 — config

7. **Provision R2** (or alternative). Until then publish-with-image is unusable. If R2 isn't on the roadmap, return a structured fallback URL (data URI) and document base64 as the contract.
8. **Wire a real `SocialAccount`** for at least one platform (LinkedIn is easiest), so `/publish` can be tested end-to-end. Set the OAuth keys + `INTEGRATIONS_STATE_SECRET`.

### P3 — long-running

9. **Tests**. Replace the one-line TODO `maya.test.ts` with at least a smoke suite that hits each endpoint against `MOCK_MODE=true`. CI should run this on every push to apps/server or apps/ai. Even 7 happy-path tests would have caught the `revise` bug on day one.
10. **Streaming the chat endpoint**. The infrastructure is there in `core/llm.py` — wire `chat_sync` → `chat_stream` for the Maya chat surface and switch the frontend to consume an SSE stream.
11. **Mount or remove the unused mock content page** at `apps/main/src/app/(dashboard)/workspace/content/page.tsx`. If it's the intended Maya surface, replace the mock data with `useMessages("maya", organizationId)` + `useSendMessage(...)`.

---

## How to re-run verification

Both AI (`:8000`) and Express (`:5000`) need to be running, plus Postgres must be reachable.

```bash
USERID="uIPNZfP40BC4cJlTa5LhxTlahgcAwL1G"
OID="1xDKGYZJ6Ijo2qfbqhi37mLlElBJkycc"
KEY="HD4dvXxKTQ6Cgg72hbbECK5lkIAYIoeB"  # value of INTERNAL_API_KEY
BASE=http://localhost:5000/api/v1/agents/maya
H_AUTH="Authorization: Bearer $KEY"
H_JSON="Content-Type: application/json"

# chat
curl -s -X POST $BASE/chat -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"userId\":\"$USERID\",\"organizationId\":\"$OID\",\"content\":\"Give me 3 LinkedIn hooks about onboarding friction.\"}"

# generate-ideas
curl -s -X POST $BASE/generate-ideas -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"userId\":\"$USERID\",\"organizationId\":\"$OID\",\"platform\":\"linkedin\",\"topicHint\":\"founder onboarding\",\"count\":3}"

# draft-content (no image)
curl -s -X POST $BASE/draft-content -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"userId\":\"$USERID\",\"organizationId\":\"$OID\",\"topic\":\"AI productivity\",\"platform\":\"linkedin\"}"

# draft-content (with image)
curl -s -X POST $BASE/draft-content -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"userId\":\"$USERID\",\"organizationId\":\"$OID\",\"topic\":\"AI productivity\",\"platform\":\"instagram\",\"includeImage\":true}"

# generate-variants
curl -s -X POST $BASE/generate-variants -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"userId\":\"$USERID\",\"organizationId\":\"$OID\",\"originalContent\":\"...\",\"originalPlatform\":\"linkedin\",\"targetPlatforms\":[\"twitter\",\"instagram\"]}"

# revise (currently 500)
curl -s -X POST $BASE/revise -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"userId\":\"$USERID\",\"organizationId\":\"$OID\",\"originalContent\":\"...\",\"platform\":\"linkedin\",\"feedback\":\"Strengthen the hook with a specific number\"}"

# regenerate-content
curl -s -X POST $BASE/regenerate-content -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"userId\":\"$USERID\",\"organizationId\":\"$OID\",\"caption\":\"...\",\"prompt\":\"Make it more engaging\",\"platform\":\"linkedin\"}"

# regenerate-image
curl -s -X POST $BASE/regenerate-image -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"userId\":\"$USERID\",\"organizationId\":\"$OID\",\"imageUrl\":\"https://...\",\"prompt\":\"...\",\"platform\":\"instagram\"}"

# publish (will 404 with no SocialAccount row)
curl -s -X POST $BASE/publish -H "$H_AUTH" -H "$H_JSON" \
  -d "{\"userId\":\"$USERID\",\"organizationId\":\"$OID\",\"socialAccountId\":\"<id>\",\"caption\":\"hi\"}"
```
