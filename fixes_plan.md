 Plan: Agent Chat Bug Fixes (All Agents Except Rex)

 Context

 The Veqiro platform has six AI agents (Sage, Maya, Scout, Lex, Vega, Rex). Each agent's chat page has a "plus icon" that opens a PlusMenu dialog with
 agent-specific actions. These actions go through a full stack: frontend (Next.js apps/main) → backend server (Express apps/server) → AI service (FastAPI
 apps/ai).

 This plan documents all confirmed bugs found across that stack for Maya, Vega, Lex, Scout, and Sage (Rex excluded per user instruction), along with exact
 fixes.

 ---
 The #1 Root Cause: Missing snake_case → camelCase Body Middleware

 This single bug breaks most plus-icon actions across every agent.

 The frontend RunActionDialog SPECS send all form values as snake_case (e.g. include_image, seed_topic, original_content, email_id). The server Zod schemas
  expect camelCase (e.g. includeImage, seedTopic, originalContent, emailId). There is no body-transform middleware — apps/server/src/app.ts uses bare
 express.json() with nothing after it.

 Result per field type:
 - Required camelCase field missing → Zod throws validation error → action always returns 4xx
 - Optional camelCase field with default → silently uses default, ignoring user's choice

 Completely broken (Zod validation error on every run):

 ┌────────────────────────┬────────────────────────────────────────────────────────────────────────┐
 │         Action         │                       Required fields sent wrong                       │
 ├────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ maya:generate-variants │ original_content → originalContent, target_platforms → targetPlatforms │
 ├────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ maya:revise            │ original_content → originalContent                                     │
 ├────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ maya:regenerate-image  │ image_url → imageUrl                                                   │
 ├────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ sage:keyword-research  │ seed_topic → seedTopic                                                 │
 ├────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ sage:generate-blog     │ target_keyword → targetKeyword                                         │
 ├────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ sage:analyze-content   │ target_keyword → targetKeyword                                         │
 ├────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ sage:content-brief     │ target_keyword → targetKeyword                                         │
 ├────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ scout:research-company │ company_name → companyName                                             │
 ├────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ lex:ingest-document    │ document_name → documentName, pdf_base64 → pdfBase64                   │
 ├────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ lex:analyze-contract   │ contract_text → contractText (refine fails)                            │
 ├────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ lex:draft-document     │ document_type → documentType                                           │
 ├────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ vega:draft-reply       │ email_id → emailId, reply_instructions → replyInstructions             │
 └────────────────────────┴────────────────────────────────────────────────────────────────────────┘

 Silently broken (wrong defaults used, user choices ignored):

 ┌───────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │        Action         │                                                     Fields ignored                                                      │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ maya:draft-content    │ include_image always false (image toggle does nothing!), word_count_target always 200, use_logo/use_mascot always false │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ vega:process-inbox    │ max_emails, auto_label, draft_replies all silently default                                                              │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ vega:calendar-summary │ days_ahead always 7                                                                                                     │
 └───────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

 Working correctly (exact snake_case field names happen to match):

 maya:regenerate-content, scout:scan-competitors, scout:trending-topics, lex:explain, lex:legal-research, lex:compliance-check, vega:create-event,
 vega:executive-briefing, vega:compose-email

 THE FIX — one middleware in apps/server/src/app.ts:

 // Add after express.json() line
 app.use(express.json());
 app.use(camelizeBody);   // ← add this

 function camelizeBody(
   req: express.Request,
   _res: express.Response,
   next: express.NextFunction
 ) {
   if (req.body && typeof req.body === "object") {
     req.body = deepCamelize(req.body);
   }
   next();
 }

 function deepCamelize(obj: unknown): unknown {
   if (Array.isArray(obj)) return obj.map(deepCamelize);
   if (obj !== null && typeof obj === "object") {
     return Object.fromEntries(
       Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
         k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
         deepCamelize(v),
       ])
     );
   }
   return obj;
 }

 This middleware:
 - Runs after express.json() parses the body
 - Converts include_image → includeImage, seed_topic → seedTopic, original_content → originalContent, etc.
 - Handles nested objects (e.g. competitors array items) and arrays recursively
 - Leaves already-camelCase keys unchanged (safe — organizationId, conversationId are unaffected)
 - Fixes ALL twelve broken actions and ALL silently-broken actions in one change

 Additional: MayaIdeationForm references topic_hint but SPEC defaultValue has no such key

 The SPEC for maya:generate-ideas is { platform: "linkedin", count: 5 } — no topic_hint. But the MayaIdeationForm reads value.topic_hint which is
 undefined. The input renders correctly (empty), but when the user types a topic hint and submits, it sends topic_hint → server schema has topicHint
 (optional, default "") → silent mismatch → topic hint always ignored. Add topic_hint: "" to the generate-ideas SPEC defaultValue (but note the
 camelizeBody middleware will convert it to topicHint automatically once that fix lands).

 ---
 Confirmed Bugs — Ordered by Priority

 P0 — Breaking / Blocking Features

 ---
 Bug 1: ContentRegenCard and RevisionDiffCard have no Publish button

 File: apps/main/src/components/agents/maya/cards.tsx

 - ContentRegenCard (rewrite caption action, lines 335–367): shows rewritten caption but no PublishDialog. User has to copy text and go through draft flow
 separately.
 - RevisionDiffCard (revise post action, lines 246–300): shows revised post but no PublishDialog.
 - Both cards need a PublishDialog added the same way DraftPreview has one. The platform must be passed in (currently absent) from the result.

 Confirmed: platform is NOT in these result types (verified in apps/main/src/lib/types/agents.ts).

 Fix — 3-layer change:

 1. AI backend (apps/ai/agents/maya/routes.py):
 - Add platform: str to ReviseResponse (line 179) and ContentRegenResponse (line 550)
 - Return platform=request.platform from both route handlers

 2. Frontend types (apps/main/src/lib/types/agents.ts):
 - Add platform: ContentPlatform to MayaReviseResult (line 191)
 - Add platform: ContentPlatform to MayaContentRegenResult (line 219)

 3. Frontend cards (apps/main/src/components/agents/maya/cards.tsx):
 - ContentRegenCard: add PublishDialog platform={result.platform} caption={result.caption} hashtags={result.hashtags} image={undefined} next to Copy button
 - RevisionDiffCard: add PublishDialog platform={result.platform} caption={result.revised.body} hashtags={result.revised.hashtags} image={undefined} in
 button row

 ---
 Bug 2: ImageRegenCard accesses result.image.prompt_used without null check

 File: apps/main/src/components/agents/maya/cards.tsx, line 316

 // Current (crashes if result.image is null/undefined):
 <p>Prompt: {result.image.prompt_used}</p>

 // Fix:
 <p>Prompt: {result.image?.prompt_used ?? "—"}</p>

 Also add ? safe-access to result.image before calling imageSrc() on line 305.

 ---
 Bug 3: Gmail _parse_message() does not extract email body

 File: apps/ai/agents/vega/gmail.py, lines 184–199

 The _parse_message() function extracts only headers + snippet. It never extracts the actual email body from payload.body.data or payload.parts. This
 means:
 - draft_reply endpoint passes email.get('body', '') → always '' in production
 - The LLM drafts replies with zero email content, only an empty field

 Fix: Extract the body from the Gmail API payload. Gmail stores body in payload.body.data for simple messages, or in payload.parts[*].body.data for
 multipart. Decode from base64url.

 import base64

 def _extract_body(payload: dict) -> str:
     """Recursively extract plaintext body from Gmail payload."""
     mime_type = payload.get("mimeType", "")
     body = payload.get("body", {})
     data = body.get("data", "")

     if data and mime_type in ("text/plain", "text/html"):
         try:
             return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
         except Exception:
             return ""

     for part in payload.get("parts", []):
         text = _extract_body(part)
         if text:
             return text
     return ""

 Then in _parse_message():
 def _parse_message(msg_data: dict) -> dict:
     headers = {h["name"]: h["value"] for h in msg_data.get("payload", {}).get("headers", [])}
     body = _extract_body(msg_data.get("payload", {}))
     return {
         ...
         "body": body or msg_data.get("snippet", ""),  # fallback to snippet
         "snippet": msg_data.get("snippet", ""),
         ...
     }

 ---
 Bug 4: find_free_slots() returns wrong format in production

 File: apps/ai/agents/vega/calendar.py, lines 124–146

 In production mode (non-mock), find_free_slots() returns [{"busy_slots": busy}] — a completely different structure than the expected [{"date", "start",
 "end", "duration_hours"}] that mock mode returns and the frontend expects.

 The CalendarSummaryResponse.free_slots: list[dict] then passes this malformed data to the frontend's CalendarCard.

 Fix: Compute actual free slots by subtracting busy periods from the workday (9am–6pm) for each day in the date range:

 from datetime import datetime, timedelta, timezone

 async def find_free_slots(access_token: str, date_range: dict) -> list[dict]:
     if settings.MOCK_MODE:
         return _MOCK_FREE_SLOTS

     from googleapiclient.discovery import build
     from google.oauth2.credentials import Credentials
     import asyncio

     now = datetime.now(timezone.utc)
     start_dt = datetime.fromisoformat(date_range.get("start", now.isoformat()))
     end_dt = datetime.fromisoformat(date_range.get("end", (now + timedelta(days=7)).isoformat()))

     def _find():
         creds = Credentials(token=access_token)
         service = build("calendar", "v3", credentials=creds)
         body = {
             "timeMin": start_dt.isoformat(),
             "timeMax": end_dt.isoformat(),
             "items": [{"id": "primary"}],
         }
         result = service.freebusy().query(body=body).execute()
         busy = result.get("calendars", {}).get("primary", {}).get("busy", [])

         # Compute free slots per day (9am-6pm work hours)
         free_slots = []
         current = start_dt.replace(hour=9, minute=0, second=0, microsecond=0)
         while current.date() < end_dt.date():
             day_start = current
             day_end = current.replace(hour=18, minute=0)
             slot_start = day_start

             day_busy = [b for b in busy if b["start"][:10] == current.strftime("%Y-%m-%d")]
             day_busy.sort(key=lambda x: x["start"])

             for b in day_busy:
                 b_start = datetime.fromisoformat(b["start"].replace("Z", "+00:00"))
                 b_end = datetime.fromisoformat(b["end"].replace("Z", "+00:00"))
                 if slot_start < b_start:
                     duration = (b_start - slot_start).total_seconds() / 3600
                     if duration >= 0.5:
                         free_slots.append({
                             "date": current.strftime("%Y-%m-%d"),
                             "start": slot_start.strftime("%H:%M"),
                             "end": b_start.strftime("%H:%M"),
                             "duration_hours": round(duration, 1),
                         })
                 slot_start = max(slot_start, b_end)

             if slot_start < day_end:
                 duration = (day_end - slot_start).total_seconds() / 3600
                 if duration >= 0.5:
                     free_slots.append({
                         "date": current.strftime("%Y-%m-%d"),
                         "start": slot_start.strftime("%H:%M"),
                         "end": "18:00",
                         "duration_hours": round(duration, 1),
                     })
             current += timedelta(days=1)
         return free_slots

     return await asyncio.to_thread(_find)

 Also pass a proper date_range to find_free_slots() in calendar_summary route (currently passes {}):
 # In vega/routes.py, calendar_summary():
 now = datetime.now(timezone.utc)
 date_range = {
     "start": now.isoformat(),
     "end": (now + timedelta(days=request.days_ahead)).isoformat(),
 }
 free_slots = await find_free_slots(token, date_range)

 ---
 Bug 5: Instagram missing refresh() method

 File: apps/server/src/modules/integrations/providers/instagram.ts

 The SocialProvider interface has a refresh? optional method. Twitter and LinkedIn implement it; Instagram does not. Instagram uses Meta's long-lived
 tokens (~60 days) that can be extended via the token refresh endpoint.

 Fix: Add refresh() using Meta's long-lived token extension:

 async refresh(currentToken: string): Promise<RefreshResult> {
     const appId = process.env.META_APP_ID;
     const appSecret = process.env.META_APP_SECRET;
     if (!appId || !appSecret) {
         throw new Error("META_APP_ID / META_APP_SECRET not configured");
     }
     const params = new URLSearchParams({
         grant_type: "fb_exchange_token",
         client_id: appId,
         client_secret: appSecret,
         fb_exchange_token: currentToken,
     });
     const res = await fetch(`${TOKEN_URL}?${params.toString()}`);
     if (!res.ok) {
         const err = await res.text();
         throw new Error(`Instagram token refresh failed (${res.status}): ${err}`);
     }
     const json = (await res.json()) as {
         access_token: string;
         expires_in?: number;
     };
     return {
         accessToken: json.access_token,
         expiresAt: json.expires_in
             ? new Date(Date.now() + json.expires_in * 1000)
             : null,
     };
 },

 Also need to add RefreshResult to the import from integrations.types.js.

 ---
 P1 — Significant Bugs (Functional Impact)

 ---
 Bug 6: Twitter media upload hardcodes MIME type as image/png

 File: apps/server/src/modules/integrations/providers/twitter.ts, line 31

 All images are uploaded as image/png regardless of actual format. If a JPEG or WebP is uploaded, Twitter receives a mistyped file which may cause
 rejection.

 Fix: Detect MIME type from the image URL or buffer magic bytes:

 const uploadMedia = async (accessToken: string, imageUrl: string): Promise<string> => {
     const buffer = await fetchImageAsBuffer(imageUrl);

     // Detect content type from URL extension or magic bytes
     const ext = imageUrl.split("?")[0].split(".").pop()?.toLowerCase();
     const mimeMap: Record<string, string> = {
         jpg: "image/jpeg", jpeg: "image/jpeg",
         png: "image/png", gif: "image/gif", webp: "image/webp",
     };
     const mimeType = (ext && mimeMap[ext]) || detectMimeFromBuffer(buffer);
     const filename = `image.${ext ?? "png"}`;

     const form = new FormData();
     const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
     form.append("media", blob, filename);
     form.append("media_category", "tweet_image");
     ...
 };

 function detectMimeFromBuffer(buffer: Buffer): string {
     // Check magic bytes
     if (buffer[0] === 0xFF && buffer[1] === 0xD8) return "image/jpeg";
     if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
     if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
     if (buffer.slice(0,4).toString() === "RIFF") return "image/webp";
     return "image/png"; // fallback
 }

 ---
 Bug 7: LinkedIn platformPostId empty when x-restli-id header missing

 File: apps/server/src/modules/integrations/providers/linkedin.ts, lines 208–212

 If LinkedIn's response doesn't include the x-restli-id header (rare but happens), postUrn = "" and platformPostId = "", making the published post
 untrackable.

 Fix: Also try to extract from the response Location header as fallback, and log a warning when the ID is empty:

 const postUrn =
     res.headers.get("x-restli-id") ??
     res.headers.get("X-RestLi-Id") ??
     res.headers.get("location")?.split("/").pop() ??
     "";
 const id = postUrn.split(":").pop() ?? postUrn;
 const url = postUrn ? `https://www.linkedin.com/feed/update/${postUrn}/` : undefined;
 if (!postUrn) {
     console.warn("[linkedin] publish succeeded but no post URN in response headers");
 }
 return { platformPostId: postUrn || id, url };

 ---
 Bug 8: No image onError handler — broken images show browser default broken icon

 File: apps/main/src/components/agents/maya/cards.tsx, line 134–140

 When an image URL fails to load (CDN error, expired URL, CORS), users see a broken image icon with no explanation.

 Fix: Add onError to all <img> elements in card components:

 {src && (
     <img
         src={src}
         alt="generated"
         className="max-h-72 w-full rounded-none object-cover"
         onError={(e) => {
             (e.target as HTMLImageElement).style.display = "none";
             // Show fallback
         }}
     />
 )}

 A better approach: use a small wrapper component <ImageWithFallback> that shows a "Image failed to load" placeholder when onError fires.

 ---
 Bug 9: draft_reply uses email.get('body', '') with no snippet fallback (vega/routes.py)

 File: apps/ai/agents/vega/routes.py, line 380

 After Bug 3 is fixed (gmail.py body extraction), this should work. But currently in production, drafts are generated with no email context. The
 process_inbox route correctly falls back to snippet (email.get('body', email.get('snippet', ''))), but draft_reply does not.

 Fix (immediate, before Bug 3 is landed):
 f"Body: {email.get('body', email.get('snippet', ''))[:1500]}\n\n"

 ---
 P2 — UX & Quality Improvements

 ---
 Bug 10: Lex DraftDocumentCard downloads with .txt extension

 File: apps/main/src/components/agents/lex/cards.tsx (around line 217–259)

 Legal documents are downloaded as .txt even when they're markdown-formatted. This makes them harder to open in proper editors.

 Fix: Change download extension to .md:
 a.download = "lex-draft.md"

 Or detect format from the content and choose appropriately.

 ---
 Bug 11: RevisionDiffCard has no copy button for hashtags separately

 File: apps/main/src/components/agents/maya/cards.tsx, lines 246–300

 Minor UX: The revised post copy button (line 288–296) concatenates body + cta + hashtags with double newlines, but this may not be the format users want
 for copying hashtags to Instagram separately.

 Not critical — note for future improvement.

 ---
 Files to Modify

 ┌─────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────┐
 │                            File                             │                                        Changes                                         │
 ├─────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/components/agents/maya/cards.tsx              │ Fix ImageRegenCard null check; add onError to images; add PublishDialog to             │
 │                                                             │ ContentRegenCard and RevisionDiffCard                                                  │
 ├─────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/lib/types/agents.ts                           │ Add platform field to MayaContentRegenResult and MayaReviseResult if missing           │
 ├─────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/server/src/modules/integrations/providers/instagram.ts │ Add refresh() method; import RefreshResult                                             │
 ├─────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/server/src/modules/integrations/providers/twitter.ts   │ Fix MIME type detection in uploadMedia()                                               │
 ├─────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/server/src/modules/integrations/providers/linkedin.ts  │ Fix platformPostId fallback and URL construction                                       │
 ├─────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/ai/agents/vega/gmail.py                                │ Add _extract_body() helper; update _parse_message() to include body                    │
 ├─────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/ai/agents/vega/calendar.py                             │ Fix find_free_slots() to compute actual free slots                                     │
 ├─────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/ai/agents/vega/routes.py                               │ Pass proper date_range to find_free_slots(); fix draft_reply body fallback             │
 ├─────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps/main/src/components/agents/lex/cards.tsx               │ Change download extension to .md                                                       │
 └─────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────┘

 ---
 Verification Steps

 After implementing each fix:

 1. Maya ContentRegen / RevisionDiff publish flow: Use the "Revise a post" and "Rewrite caption" actions, verify a PublishDialog appears in the result
 card, and test publishing to a connected platform.
 2. ImageRegenCard crash fix: Call "Regenerate image" action and verify the prompt text renders even if image is null.
 3. Vega Gmail body: With a real Google account connected, use "Draft a reply" and verify the generated draft references actual email content, not a blank
 body.
 4. Vega Calendar free slots: With Google Calendar connected, use "Calendar summary" and verify free_slots in the response matches the expected format with
  date/start/end/duration_hours.
 5. Instagram refresh: Connect an Instagram account, wait for token to be near expiry (or manually update accessTokenExpiresAt to be in the past in DB),
 then try to publish — should auto-refresh instead of failing.
 6. Twitter MIME fix: Upload a JPEG image via Maya draft, publish to Twitter, verify upload succeeds.
 7. LinkedIn tracking: Publish a post to LinkedIn and verify the returned URL and platformPostId are non-empty.
 8. Broken image handling: Use Maya draft with an invalid imageUrl, verify the broken image falls back gracefully (no browser broken icon).
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
