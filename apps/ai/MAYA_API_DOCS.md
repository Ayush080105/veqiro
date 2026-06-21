# Maya AI Agent — Express.js Integration Guide

**Base URL:** `http://localhost:8000` (or your deployed FastAPI host)
**Content-Type:** `application/json`
**Auth:** Add your `API_SECRET` header for all requests (see [Authentication](#authentication))

---

## Table of Contents
1. [Authentication](#authentication)
2. [Core Concept — Chat is the Main Interface](#core-concept)
3. [API Reference](#api-reference)
   - [POST /ai/maya/chat](#post-aimayanichat)
   - [POST /ai/maya/draft-content](#post-aimayandraft-content)
   - [POST /ai/maya/generate-ideas](#post-aimayanagenerate-ideas)
   - [POST /ai/maya/generate-variants](#post-aimayanagenerate-variants)
   - [POST /ai/maya/revise](#post-aimayanarevise)
   - [POST /ai/maya/regenerate-image](#post-aimayanaregenerate-image)
   - [POST /ai/maya/regenerate-content](#post-aimayanaregeneraete-content)
4. [Cron Jobs & Scheduled Posting](#cron-jobs--scheduled-posting)
5. [Social Media Posting Flow](#social-media-posting-flow)
6. [Handling Images (base64)](#handling-images-base64)
7. [Error Handling](#error-handling)
8. [Things You Must Build on Express Side](#things-you-must-build-on-express-side)

---

## Authentication

All requests must include the API secret header:

```http
X-API-Secret: your-secret-here
```

In Express:
```js
const MAYA_BASE = process.env.FASTAPI_URL; // e.g. http://localhost:8000
const MAYA_SECRET = process.env.FASTAPI_SECRET;

const mayaHeaders = {
  'Content-Type': 'application/json',
  'X-API-Secret': MAYA_SECRET,
};
```

---

## Core Concept

Maya has **two usage modes**:

### Mode 1 — Chat (recommended, smart)
`POST /ai/maya/chat` — Send any natural language message. Maya figures out what to do automatically — it will generate ideas, draft posts, adapt content, or revise based on what the user says. Returns text response + optional generated image.

**Use this for:** Any user-facing chat UI, conversational flows, multi-turn interactions.

### Mode 2 — Direct APIs (deterministic)
The individual endpoints (`/draft-content`, `/generate-ideas`, etc.) give you deterministic control. Use these for **scheduled/cron operations** where you need predictable inputs/outputs without conversational context.

---

## API Reference

---

### POST /ai/maya/chat

**The main endpoint.** Maya autonomously calls the right tool based on the message.

```
POST /ai/maya/chat
```

**Request:**
```json
{
  "user_id": "user_abc123",
  "conversation_id": "conv_xyz456",
  "message": "Write me a LinkedIn post about our new AI feature launch",
  "history": []
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | Maps to the user's brand kit in DB |
| `conversation_id` | string | ✅ | Any unique string per conversation session |
| `message` | string | ✅ | What the user typed |
| `history` | array | ✅ | Previous messages (can be empty array for first turn) |

**History format** (include all previous turns — text only, NO image data):
```json
"history": [
  { "role": "user", "content": "Write a LinkedIn post about AI" },
  { "role": "assistant", "content": "Here's your LinkedIn post: ..." }
]
```

**Response:**
```json
{
  "response": "Here's your LinkedIn post:\n\nMost founders spend 3+ hours...",
  "agent": "maya",
  "message_id": "msg_abc123",
  "tokens_used": 420,
  "model_used": "gpt-4.1-mini",
  "metadata": {
    "tool_calls": [
      { "name": "draft_content", "arguments": { "topic": "AI feature launch", "platform": "linkedin" } }
    ]
  },
  "image": {
    "image_base64": "iVBORw0KGgoAAAANS...",
    "content_type": "image/png",
    "prompt_used": "Brand: Veqiro AI. LinkedIn post image for AI feature launch"
  }
}
```

**Notes:**
- `image` is `null` if no content drafting tool was called
- `image` is always `null` for pure conversation (no drafting intent)
- Store `response` text in history for next turn, **not the full JSON object**
- Images are automatically generated when a post is drafted

**Express example:**
```js
app.post('/api/chat', async (req, res) => {
  const { userId, message, history } = req.body;

  const r = await fetch(`${MAYA_BASE}/ai/maya/chat`, {
    method: 'POST',
    headers: mayaHeaders,
    body: JSON.stringify({
      user_id: userId,
      conversation_id: req.body.conversationId || `conv_${Date.now()}`,
      message,
      history: history || [],
    }),
  });

  const data = await r.json();

  // Save image to R2 if present
  if (data.image?.image_base64) {
    const imageUrl = await uploadBase64ToR2(data.image.image_base64, userId);
    data.image_url = imageUrl;
    delete data.image; // don't send base64 to frontend
  }

  res.json(data);
});
```

---

### POST /ai/maya/draft-content

Directly draft a post for a specific platform. Use for cron jobs and scheduled posting.

```
POST /ai/maya/draft-content
```

**Request:**
```json
{
  "user_id": "user_abc123",
  "topic": "How AI is changing social media marketing",
  "platform": "linkedin",
  "tone_override": null,
  "word_count_target": 250,
  "include_image": true,
  "use_logo": true,
  "use_mascot": false,
  "additional_context": "Focus on time savings for small business owners"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `user_id` | string | ✅ | |
| `topic` | string | ✅ | max 500 chars |
| `platform` | string | ✅ | `linkedin` \| `twitter` \| `instagram` |
| `tone_override` | string\|null | ❌ | max 100 chars |
| `word_count_target` | int | ❌ | 20–2000, default 200 |
| `include_image` | bool | ❌ | default false |
| `use_logo` | bool | ❌ | only applies if brand_kit has logo_url |
| `use_mascot` | bool | ❌ | only applies if brand_kit has mascot_url |
| `additional_context` | string\|null | ❌ | max 1000 chars |

**Response:**
```json
{
  "draft": {
    "title": "The 10x Founder's Content System",
    "body": "Most founders treat content as an afterthought...",
    "hashtags": ["#FounderLife", "#AIMarketing", "#ContentStrategy"],
    "cta": "Follow for more founder growth tips 👇",
    "meta_description": "How founders use AI to 10x their content output",
    "word_count": 243,
    "platform": "linkedin",
    "tone_used": "professional, insight-driven"
  },
  "image": {
    "image_base64": "iVBORw0KGgoAAAANS...",
    "content_type": "image/png",
    "prompt_used": "..."
  }
}
```

---

### POST /ai/maya/generate-ideas

Generate content ideas for a platform and topic.

```
POST /ai/maya/generate-ideas
```

**Request:**
```json
{
  "user_id": "user_abc123",
  "platform": "instagram",
  "topic_hint": "Product launch and behind the scenes",
  "count": 5
}
```

| Field | Validation |
|-------|------------|
| `platform` | `linkedin` \| `twitter` \| `instagram` |
| `count` | 1–10 |
| `topic_hint` | max 500 chars |

**Response:**
```json
{
  "ideas": [
    {
      "title": "Behind the Build: 30 Days to Launch",
      "platform": "instagram",
      "hook": "30 days ago we had nothing. Today we shipped. Here's the real story 📸",
      "predicted_engagement": "Very High",
      "suggested_hashtags": ["#BuildInPublic", "#StartupLife", "#ProductLaunch"],
      "content_type": "carousel",
      "reasoning": "Behind-the-scenes carousels drive saves and shares on Instagram"
    }
  ],
  "generated_at": "2025-03-30T10:00:00"
}
```

---

### POST /ai/maya/generate-variants

Adapt one post for multiple platforms in parallel.

```
POST /ai/maya/generate-variants
```

**Request:**
```json
{
  "user_id": "user_abc123",
  "original_content": "We just launched Veqiro AI — the AI workspace built for founders...",
  "original_platform": "linkedin",
  "target_platforms": ["twitter", "instagram"]
}
```

| Field | Validation |
|-------|------------|
| `original_content` | max 5000 chars |
| `target_platforms` | array, max 3 items, values: `linkedin`\|`twitter`\|`instagram` |

**Response:**
```json
{
  "variants": [
    {
      "platform": "twitter",
      "title": "Twitter Version",
      "body": "We just shipped Veqiro AI 🚀\n\nAI that actually knows your brand...",
      "hashtags": ["#BuildInPublic", "#AI"],
      "char_count": 187,
      "image": null
    },
    {
      "platform": "instagram",
      "title": "Instagram Caption",
      "body": "Something big just dropped. 👇\n\n...",
      "hashtags": ["#AI", "#Founders", "#StartupLife"],
      "char_count": 312,
      "image": null
    }
  ]
}
```

---

### POST /ai/maya/revise

Revise an existing post based on feedback.

```
POST /ai/maya/revise
```

**Request:**
```json
{
  "user_id": "user_abc123",
  "original_content": "We launched our AI tool today...",
  "platform": "linkedin",
  "feedback": "Too generic. Add a specific number and make the hook punchier.",
  "specific_instructions": "Start with a bold statistic"
}
```

**Response:**
```json
{
  "revised": {
    "title": "Revised Post Title",
    "body": "87% of founders waste 3+ hours daily on content...",
    "hashtags": ["#FounderLife", "#AITools"],
    "cta": "Save this if you're ready to reclaim your time 👆"
  },
  "changes_made": [
    "Added specific 87% statistic to the opening hook",
    "Restructured first line to lead with data",
    "Strengthened CTA"
  ]
}
```

---

### POST /ai/maya/regenerate-image

Fetch an existing image from R2, use it as a reference, and regenerate with a new prompt.

```
POST /ai/maya/regenerate-image
```

**Request:**
```json
{
  "user_id": "user_abc123",
  "image_url": "https://pub-xxx.r2.dev/posts/img_abc.png",
  "prompt": "Make the background more vibrant, add more energy",
  "platform": "instagram",
  "use_logo": true,
  "use_mascot": false
}
```

| Field | Notes |
|-------|-------|
| `image_url` | Must be a valid HTTPS URL (R2/CDN) — validated by server |
| `prompt` | max 1000 chars |

**Response:**
```json
{
  "image": {
    "image_base64": "iVBORw0KGgoAAAANS...",
    "content_type": "image/png",
    "prompt_used": "Brand: Veqiro AI. Make the background more vibrant..."
  }
}
```

---

### POST /ai/maya/regenerate-content

Revise a caption with a specific instruction. Lightweight — no full conversation context needed.

```
POST /ai/maya/regenerate-content
```

**Request:**
```json
{
  "user_id": "user_abc123",
  "caption": "We just launched our AI tool. It saves time.",
  "prompt": "Make it more engaging. Add emojis and a question at the end.",
  "platform": "instagram"
}
```

**Response:**
```json
{
  "caption": "Something just changed for founders everywhere 🚀\n\nWe just launched our AI tool...",
  "hashtags": ["#FounderLife", "#AI", "#ProductLaunch"],
  "cta": "What's the one task you'd automate first? Drop it below 👇"
}
```

---

## Cron Jobs & Scheduled Posting

Your Express.js backend handles all scheduling. The flow:

### Recommended Architecture

```
[Cron Job in Express]
    → POST /ai/maya/draft-content  (get content + image)
    → Upload image base64 to R2    (get permanent URL)
    → Store draft in your DB       (status: "scheduled")
    → At scheduled time:
        → Post to Instagram API    (using image URL + caption)
        → Post to LinkedIn API     (using body + hashtags)
        → Post to Twitter API      (using body + hashtags)
        → Update DB status: "published"
```

### Example Cron Flow (Express + node-cron)

```js
const cron = require('node-cron');

// Every Monday at 9am — generate weekly content
cron.schedule('0 9 * * 1', async () => {
  const users = await db.getActiveUsers();

  for (const user of users) {
    // 1. Generate content
    const draft = await fetch(`${MAYA_BASE}/ai/maya/draft-content`, {
      method: 'POST',
      headers: mayaHeaders,
      body: JSON.stringify({
        user_id: user.id,
        topic: user.weeklyTopic || 'AI productivity tips',
        platform: 'linkedin',
        include_image: true,
        use_logo: true,
      }),
    }).then(r => r.json());

    // 2. Save image to R2
    let imageUrl = null;
    if (draft.image?.image_base64) {
      imageUrl = await uploadBase64ToR2(draft.image.image_base64, user.id);
    }

    // 3. Save scheduled post to DB
    await db.scheduledPosts.create({
      userId: user.id,
      platform: 'linkedin',
      caption: draft.draft.body,
      hashtags: draft.draft.hashtags,
      cta: draft.draft.cta,
      imageUrl,
      scheduledFor: getNextPostTime(user),
      status: 'scheduled',
    });
  }
});

// Every minute — check for posts ready to publish
cron.schedule('* * * * *', async () => {
  const postsToPublish = await db.scheduledPosts.findReadyToPublish();

  for (const post of postsToPublish) {
    await publishToSocialMedia(post);
    await db.scheduledPosts.updateStatus(post.id, 'published');
  }
});
```

### Generating Variants for Multi-Platform Posting

```js
// Draft once for LinkedIn, then adapt for all platforms
const draft = await fetch(`${MAYA_BASE}/ai/maya/draft-content`, { ... }).then(r => r.json());

const variants = await fetch(`${MAYA_BASE}/ai/maya/generate-variants`, {
  method: 'POST',
  headers: mayaHeaders,
  body: JSON.stringify({
    user_id: userId,
    original_content: draft.draft.body,
    original_platform: 'linkedin',
    target_platforms: ['twitter', 'instagram'],
  }),
}).then(r => r.json());

// Now you have 3 platform-specific posts from one LLM call
```

---

## Social Media Posting Flow

Maya returns the **content** — your Express backend handles the **posting**.

### What Maya returns per platform

| Field | LinkedIn | Twitter | Instagram |
|-------|----------|---------|-----------|
| `body` | Full post (≤3000 chars) | Tweet (≤280 chars) | Caption (≤2200 chars) |
| `hashtags` | 3-5 tags | 1-3 tags | 15-30 tags (append to caption) |
| `cta` | Included in body | Included in tweet | Separate line at end |
| `image` | Optional | Optional | Recommended |

### Instagram Caption Assembly

```js
function buildInstagramCaption(draft) {
  const hashtagBlock = draft.hashtags.join(' ');
  return `${draft.body}\n\n${hashtagBlock}`;
}
```

### LinkedIn Post Assembly

```js
function buildLinkedInPost(draft) {
  return draft.body; // already formatted, hashtags included
}
```

### Twitter Thread Detection

If the `body` contains `🧵` or is longer than 280 chars, treat as a thread:
```js
function buildTweets(body) {
  if (body.length <= 280 && !body.includes('🧵')) {
    return [body];
  }
  // Split on numbered points or line breaks
  return body.split(/\n\n\d+\//).map(t => t.trim()).filter(Boolean);
}
```

---

## Handling Images (base64)

Maya returns images as `image_base64` strings. **Never store base64 in your DB or send to frontend.** Convert to R2 immediately:

```js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

async function uploadBase64ToR2(base64, userId) {
  const buffer = Buffer.from(base64, 'base64');
  const key = `posts/${userId}/${Date.now()}.png`;

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
  }));

  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
```

---

## Error Handling

Maya returns `422 Unprocessable Entity` for validation errors (e.g., platform not in allowed values):

```js
async function callMaya(endpoint, body) {
  const r = await fetch(`${MAYA_BASE}${endpoint}`, {
    method: 'POST',
    headers: mayaHeaders,
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const err = await r.json();
    // 422 = validation error (bad input)
    // 500 = server error (LLM failure, DB issue)
    throw new Error(`Maya ${endpoint} failed: ${r.status} — ${JSON.stringify(err)}`);
  }

  return r.json();
}
```

---

## Things You Must Build on Express Side

These are **not** handled by Maya — your Express backend owns these:

| Responsibility | Notes |
|----------------|-------|
| **Authentication** | JWT/session verification before calling Maya |
| **Brand kit CRUD** | Create/update/delete brand kit in PostgreSQL — Maya reads it, you write it |
| **Cron scheduling** | `node-cron` or Bull queue for scheduled posts |
| **Social media APIs** | Instagram Graph API, LinkedIn API, Twitter v2 API — Maya doesn't post |
| **R2 image upload** | Convert Maya's base64 → R2 URL immediately |
| **Post approval flow** | Draft → Human review → Approve → Schedule → Publish |
| **Conversation history** | Store per `conversation_id` and pass back in `history` array |
| **Rate limiting** | Add per-user limits (Maya has no rate limiting built in) |
| **Post analytics** | Likes/comments/reach from social APIs — Maya doesn't track this |

---

## Quick Reference — All Endpoints

| Method | Path | Use case |
|--------|------|----------|
| POST | `/ai/maya/chat` | Conversational interface — smart, auto-routes |
| POST | `/ai/maya/draft-content` | Direct post drafting for cron/scheduled jobs |
| POST | `/ai/maya/generate-ideas` | Brainstorm ideas for content calendar |
| POST | `/ai/maya/generate-variants` | Cross-platform adaptation (LinkedIn → Instagram + Twitter) |
| POST | `/ai/maya/revise` | Edit/improve a specific post |
| POST | `/ai/maya/regenerate-image` | Regenerate existing R2 image with new prompt |
| POST | `/ai/maya/regenerate-content` | Quick caption refresh with instruction |

---

*All endpoints return `200 OK` on success. `422` for validation errors. `500` for server/LLM errors.*
