# Veqiro AI — Route Reference

> **Auth:** Every endpoint requires the header `X-Internal-Api-Key: <key>`.  
> **Base URL:** `http://<host>/`  
> **Mock mode:** Set `MOCK_MODE=true` in `.env` to get realistic mock responses without hitting LLM APIs.

---

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| GET | `/ready` | Readiness check (db, redis, gemini, openai) |

**GET /health — Sample Response**
```json
{ "status": "ok", "timestamp": "2026-04-19T10:00:00.000Z" }
```

**GET /ready — Sample Response**
```json
{
  "status": "ready",
  "services": {
    "db": "ok",
    "redis": "ok",
    "gemini": "ok",
    "openai": "ok"
  }
}
```

---

## Router — `/ai/router`

Routes an incoming message to the right AI agent based on intent.

---

### POST `/ai/router/classify`

Classifies a user message and returns which agent should handle it.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | 1–128 chars |
| `message` | string | ✅ | The raw user message |

**Sample Request**
```json
{
  "user_id": "user_abc123",
  "message": "Can you help me draft a LinkedIn post about our product launch?"
}
```

**Sample Response**
```json
{
  "agent_slug": "maya",
  "confidence": 0.94,
  "reasoning": "Message references drafting social content (LinkedIn post), which maps to Maya's content creation domain.",
  "tokens_used": 148,
  "model_used": "gemini-2.0-flash"
}
```

---

## Maya — `/ai/maya`

Content creation agent for social media posts, blogs, and marketing copy across LinkedIn, Twitter, and Instagram.

---

### POST `/ai/maya/chat`

Free-form chat with Maya for content advice or iterative editing.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `conversation_id` | string | ❌ | For continuing a thread |
| `message` | string | ✅ | |
| `history` | array | ❌ | Prior `{role, content}` messages |
| `metadata` | object | ❌ | |

**Sample Response**
```json
{
  "response": "Sure! Here's a punchy hook for your LinkedIn post: 'We just shipped something that cuts onboarding time by 60%...'",
  "agent": "maya",
  "message_id": "msg_01",
  "tokens_used": 312,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/maya/generate-ideas`

Generates a set of content ideas for a given topic and platform.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `platform` | string | ❌ | `linkedin` | `linkedin`, `twitter`, `instagram` |
| `topic_hint` | string | ✅ | | Up to 500 chars |
| `count` | integer | ❌ | `3` | 1–10 |
| `include_image` | boolean | ❌ | `false` | |
| `use_logo` | boolean | ❌ | `false` | |
| `use_mascot` | boolean | ❌ | `false` | |

**Sample Request**
```json
{
  "user_id": "user_abc123",
  "platform": "linkedin",
  "topic_hint": "AI tools for small businesses",
  "count": 2
}
```

**Sample Response**
```json
{
  "ideas": [
    {
      "title": "5 AI tools that save 10+ hours a week",
      "content_type": "listicle",
      "platform": "linkedin",
      "hook": "Most SMB owners don't realise they're doing work that AI can handle in seconds.",
      "predicted_engagement": "high",
      "reasoning": "Listicles with specific time-saving claims perform strongly on LinkedIn.",
      "suggested_hashtags": ["#AI", "#SmallBusiness", "#Productivity"]
    }
  ],
  "generated_at": "2026-04-19T10:00:00.000Z",
  "image": null,
  "tokens_used": 524,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/maya/draft-content`

Drafts a full content piece ready to publish.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `topic` | string | ✅ | | 1–500 chars |
| `platform` | string | ❌ | `linkedin` | |
| `tone_override` | string | ❌ | | e.g. "casual", "authoritative" |
| `word_count_target` | integer | ❌ | `200` | 20–2000 |
| `include_image` | boolean | ❌ | `false` | |
| `use_logo` / `use_mascot` | boolean | ❌ | `false` | |
| `additional_context` | string | ❌ | | Up to 1000 chars |

**Sample Response**
```json
{
  "draft": {
    "title": "Why async-first companies ship faster",
    "body": "Remote teams that default to async communication don't just save meetings — they make better decisions...",
    "hashtags": ["#RemoteWork", "#Leadership", "#Productivity"],
    "cta": "What's your team's async-to-sync ratio? Drop it below 👇",
    "meta_description": null,
    "word_count": 198,
    "platform": "linkedin",
    "tone_used": "thought-leadership"
  },
  "image": null,
  "tokens_used": 687,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/maya/generate-variants`

Adapts existing content for multiple platforms at once.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `original_content` | string | ✅ | 1–5000 chars |
| `original_platform` | string | ❌ | Source platform |
| `target_platforms` | array[string] | ✅ | 1–3 platforms |
| `include_images` | boolean | ❌ | |

**Sample Response**
```json
{
  "variants": [
    {
      "platform": "twitter",
      "title": null,
      "body": "Async-first teams ship faster — not because they work more, but because they decide better. 🧵",
      "hashtags": ["#RemoteWork", "#Startups"],
      "char_count": 98,
      "image": null
    },
    {
      "platform": "instagram",
      "title": "Async = better decisions",
      "body": "Stop scheduling meetings for things that can be a Loom. Your team will thank you.",
      "hashtags": ["#WorkSmart", "#StartupLife"],
      "char_count": 84,
      "image": null
    }
  ],
  "tokens_used": 743,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/maya/revise`

Revises a content piece based on specific feedback.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `original_content` | string | ✅ | 1–5000 chars |
| `platform` | string | ❌ | |
| `feedback` | string | ✅ | 1–1000 chars |
| `specific_instructions` | string | ❌ | Up to 500 chars |

**Sample Response**
```json
{
  "revised": {
    "title": "Why async-first companies outship the competition",
    "body": "Remote-first teams that default to async don't just save time in meetings — they make sharper, more deliberate decisions...",
    "hashtags": ["#RemoteWork", "#Leadership"],
    "cta": "Is your team truly async? Tell me below."
  },
  "changes_made": [
    "Strengthened the opening hook",
    "Replaced passive voice in paragraph 2",
    "Made CTA more direct"
  ],
  "tokens_used": 591,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/maya/regenerate-image`

Regenerates a social image from an existing CDN/R2 URL with a new prompt.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `image_url` | string (URL) | ✅ | Existing CDN/R2 image |
| `prompt` | string | ✅ | 1–1000 chars |
| `platform` | string | ❌ | Default: `instagram` |
| `use_logo` / `use_mascot` | boolean | ❌ | |

**Sample Response**
```json
{
  "image": {
    "image_base64": "iVBORw0KGgoAAAANS...",
    "content_type": "image/png",
    "prompt_used": "Minimalist dark background with bold white text: 'Ship faster. Decide better.'"
  },
  "tokens_used": 210,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/maya/regenerate-content`

Regenerates caption/copy for an existing post with a new direction prompt.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `caption` | string | ✅ | 1–5000 chars |
| `prompt` | string | ✅ | 1–1000 chars |
| `platform` | string | ❌ | Default: `linkedin` |

**Sample Response**
```json
{
  "caption": "You don't need another meeting. You need a decision framework. Here's ours after 3 years of remote-first work...",
  "hashtags": ["#RemoteWork", "#Productivity", "#Leadership"],
  "cta": "What framework does your team use? Comment below.",
  "tokens_used": 448,
  "model_used": "gemini-2.0-flash"
}
```

---

## Rex — `/ai/rex`

Financial analytics agent for SaaS metrics, forecasting, runway analysis, and investor reporting.

---

### POST `/ai/rex/chat`

Free-form chat with Rex for financial questions or ad-hoc analysis.

*(Same shape as Maya chat — `user_id`, `message`, optional `history`.)*

---

### POST `/ai/rex/analyze-metrics`

Analyses a time-series of business metrics and surfaces trends, anomalies, and health.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `metrics` | object | ✅ | Keys are metric names; values are `[{date, value}]` arrays |
| `period` | string | ❌ | `monthly` |

**Sample Request**
```json
{
  "user_id": "user_abc123",
  "metrics": {
    "mrr": [
      {"date": "2026-01-01", "value": 42000},
      {"date": "2026-02-01", "value": 45000},
      {"date": "2026-03-01", "value": 49500}
    ]
  }
}
```

**Sample Response**
```json
{
  "analysis": {
    "summary": "MRR has grown 17.9% over 3 months, with consistent month-on-month acceleration.",
    "trend": "upward",
    "anomalies": [],
    "insights": ["March MRR growth rate (10%) exceeded Feb (7.1%) — positive acceleration signal."],
    "health_indicator": "green"
  },
  "charts_data": { "mrr": [42000, 45000, 49500] },
  "tokens_used": 389,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/rex/forecast`

Forecasts a metric's future values over a configurable horizon.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `metric_name` | string | ✅ | | |
| `historical_data` | array | ✅ | | `[{date, value}]` |
| `horizon_days` | integer | ❌ | `30` | |

**Sample Response**
```json
{
  "forecast": [
    {"date": "2026-04-01", "value": 53200, "lower_bound": 51000, "upper_bound": 55400},
    {"date": "2026-05-01", "value": 57100, "lower_bound": 54200, "upper_bound": 60000}
  ],
  "confidence": 0.82,
  "methodology": "linear_regression",
  "summary": "MRR is projected to reach ~$57k by May at current growth trajectory.",
  "tokens_used": 462,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/rex/financial-analysis`

Full financial health analysis: MRR, ARR, burn, churn, runway, and profitability.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `revenue_data` | array | ✅ | `[{date, value}]` |
| `expenses_data` | array | ❌ | |
| `subscribers_data` | array | ❌ | |

**Sample Response**
```json
{
  "metrics": {
    "mrr": 49500,
    "arr": 594000,
    "growth_rate": 0.179,
    "churn_rate": 0.023,
    "burn_rate": 32000,
    "net_burn": -17500,
    "runway_months": 18.4,
    "is_profitable": false
  },
  "health_indicator": "amber",
  "narrative": "Strong top-line growth but burn rate is high relative to revenue. At current trajectory, profitability is ~14 months away.",
  "recommendations": [
    "Target Q3 to cut burn by 15% via headcount efficiency",
    "Upsell existing customers — net revenue retention below 110%"
  ],
  "tokens_used": 611,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/rex/compile-briefing`

Cross-agent executive briefing that aggregates data from multiple agents into one summary.

**Input:** `user_id`, `metadata` (optional context/overrides)

**Sample Response**
```json
{
  "briefing": {
    "period": "Week of Apr 14–18, 2026",
    "mrr": 49500,
    "growth": "+10%",
    "key_risks": ["Burn rate above target", "2 large deals slipping to Q2"],
    "highlights": ["Launched v2.3", "Content reach up 34%"],
    "recommended_focus": "Close pipeline — 3 deals worth $8k MRR are decision-ready."
  },
  "tokens_used": 534,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/rex/investor-update`

Generates a polished investor update email from your metrics and bullet points.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `period` | string | ✅ | e.g. "Q1 2026" |
| `metrics` | object | ❌ | Key KPIs |
| `highlights` | array[string] | ❌ | |
| `asks` | array[string] | ❌ | Introductions, help needed |

**Sample Response**
```json
{
  "subject_line": "Veqiro — Q1 2026 Update: $49.5k MRR, +17.9% QoQ",
  "executive_summary": "Strong quarter. MRR grew 18%, churn held at 2.3%, and we shipped 2 major features.",
  "full_email_body": "Hi [Investor],\n\nQ1 was a milestone quarter for Veqiro...\n\nBest,\nFounder",
  "tokens_used": 892,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/rex/runway`

Calculates cash runway with base, optimistic, and pessimistic scenarios.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `cash_on_hand` | float | ✅ | | |
| `monthly_burn` | float | ✅ | | |
| `monthly_revenue` | float | ❌ | `0` | |
| `growth_rate_pct` | float | ❌ | `0` | Monthly growth % |

**Sample Response**
```json
{
  "months_remaining": 18.4,
  "date_of_zero": "2027-10-19",
  "cash_on_hand": 600000,
  "monthly_burn": 32000,
  "monthly_revenue": 49500,
  "net_burn": -17500,
  "scenarios": [
    {"label": "base", "months": 18.4},
    {"label": "optimistic", "months": 26.1},
    {"label": "pessimistic", "months": 11.8}
  ],
  "verdict": "amber",
  "recommendation": "18 months is comfortable but raise or reach profitability before month 12 to avoid pressure.",
  "tokens_used": 317,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/rex/unit-economics`

Computes CAC, LTV, LTV:CAC ratio, and payback period.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `marketing_spend` | array | ✅ | | `[{date, value}]` |
| `new_customers` | array | ✅ | | `[{date, value}]` |
| `avg_monthly_revenue_per_customer` | float | ✅ | | ARPU |
| `avg_customer_lifetime_months` | float | ❌ | `24` | |

**Sample Response**
```json
{
  "cac": 420,
  "ltv": 2880,
  "ltv_cac_ratio": 6.86,
  "payback_months": 8.4,
  "arpu": 120,
  "lifetime_months": 24,
  "ltv_cac_health": "excellent",
  "payback_health": "good",
  "health": "green",
  "benchmark_context": "SaaS benchmark: LTV:CAC > 3 is healthy. At 6.86 you are in top-quartile.",
  "recommendations": ["Consider increasing CAC budget — current LTV:CAC has headroom for higher spend."],
  "tokens_used": 428,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/rex/scenario`

Models what-if scenarios (burn changes, growth accelerations, etc.) against the base case.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `base_metrics` | object | ✅ | `{mrr, burn, cash, growth_rate}` |
| `scenarios` | array | ✅ | Each: `{name, changes: {burn_delta?, mrr_delta?, growth_rate_override?}}` |

**Sample Response**
```json
{
  "base_case": {"runway_months": 18.4, "breakeven_months": 14},
  "scenarios": [
    {
      "name": "Cut burn 20%",
      "runway_months": 24.1,
      "vs_base": "+5.7 months",
      "breakeven_months": 10
    }
  ],
  "recommendation": "A 20% burn reduction has the highest runway impact and pulls breakeven forward by 4 months.",
  "tokens_used": 375,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/rex/weekly-digest`

Generates a Monday CFO-style digest comparing this week vs last week.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `metrics` | object | ✅ | Current week KPIs |
| `prev_week` | object | ✅ | Previous week KPIs |

**Sample Response**
```json
{
  "period": "Apr 14–18, 2026",
  "headline": "MRR up 4.2% WoW — strong week despite higher burn.",
  "wow_changes": [
    {"metric": "mrr", "current": 49500, "previous": 47500, "change_pct": 4.2, "direction": "up"}
  ],
  "alerts": [
    {"severity": "medium", "message": "Burn rate exceeded budget by $3,200 this week."}
  ],
  "green_flags": [
    {"message": "3 new enterprise trials started — highest single-week record."}
  ],
  "focus_this_week": [
    "Convert 2 trials nearing day-14",
    "Review Q2 hiring plan vs runway",
    "Ship analytics dashboard (late)"
  ],
  "generated_at": "2026-04-19T08:00:00.000Z",
  "tokens_used": 503,
  "model_used": "gemini-2.0-flash"
}
```

---

## Scout — `/ai/scout`

Research and competitive intelligence agent — scrapes, summarises, and monitors the web.

---

### POST `/ai/scout/chat`

Free-form chat with Scout for research questions.

*(Same shape as other `/chat` routes.)*

---

### POST `/ai/scout/research-topic`

Deep-dives a topic using web search and summarises findings with strategic insights.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `topic` | string | ✅ | | |
| `depth` | string | ❌ | `standard` | `quick`, `standard`, `deep` |
| `sources_hint` | array[string] | ❌ | | URLs to prioritise |

**Sample Response**
```json
{
  "findings": "The B2B SaaS market is experiencing consolidation, with mid-market tools under pressure from AI-native vertical solutions...",
  "synthesis": "Companies that embed AI into core workflow (not bolted on) are capturing 3–5× more retention than feature-parity competitors.",
  "sources_scraped": ["techcrunch.com/...", "a16z.com/..."],
  "keywords_found": ["vertical AI", "workflow automation", "PLG", "SaaS consolidation"],
  "tokens_used": 1124,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/scout/research-company`

Builds a structured company profile from public sources.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `company_name` | string | ✅ | |
| `company_url` | string | ❌ | |

**Sample Response**
```json
{
  "company": {
    "name": "Notion",
    "description": "All-in-one workspace for notes, docs, databases, and project management.",
    "founded": "2016",
    "team_size": "500–1000",
    "funding": "Series C, $275M total",
    "key_features": ["Blocks editor", "Databases", "AI assistant", "Collaboration"],
    "pricing": {"free": true, "plus": "$8/mo", "business": "$15/mo"},
    "target_market": "Knowledge workers, startups, SMBs",
    "strengths": ["Highly flexible", "Strong brand", "AI integration"],
    "weaknesses": ["Performance on large workspaces", "Steep learning curve"],
    "recent_news": ["Launched Notion AI Q1 2024", "Raised $50M extension round"]
  },
  "scraped_at": "2026-04-19T10:00:00.000Z",
  "tokens_used": 876,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/scout/scan-competitors`

Monitors a list of competitor websites for changes and scores their significance.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `competitors` | array | ✅ | Each: `{name, url, last_scan_hash?}` |

**Sample Response**
```json
{
  "results": [
    {
      "competitor_name": "Notion",
      "url": "https://notion.so/pricing",
      "has_changes": true,
      "change_summary": "Added a new 'Enterprise AI' tier at $25/user/mo.",
      "significance": "high",
      "new_hash": "a3f9c1d..."
    }
  ],
  "scanned_at": "2026-04-19T10:00:00.000Z",
  "tokens_used": 612,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/scout/trending-topics`

Discovers trending topics in a given industry, scored by momentum and content opportunity.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `industry` | string | ✅ | | |
| `count` | integer | ❌ | `10` | |

**Sample Response**
```json
{
  "trends": [
    {
      "topic": "AI agents in B2B SaaS",
      "momentum": "rising",
      "relevance_score": 0.94,
      "content_angle": "How autonomous AI agents are replacing 3 categories of SaaS tools",
      "search_volume_estimate": "18k–25k/mo"
    }
  ],
  "generated_at": "2026-04-19T10:00:00.000Z",
  "tokens_used": 734,
  "model_used": "gemini-2.0-flash"
}
```

---

## Sage — `/ai/sage`

SEO and long-form blog content agent — keyword research, blog generation, and content analysis.

---

### POST `/ai/sage/chat`

Free-form chat with Sage for SEO questions.

*(Same shape as other `/chat` routes.)*

---

### POST `/ai/sage/keyword-research`

Generates a keyword list with intent classification and difficulty scores.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `seed_topic` | string | ✅ | | |
| `niche` | string | ❌ | | |
| `competitor_urls` | array[string] | ❌ | | |
| `count` | integer | ❌ | `20` | |

**Sample Response**
```json
{
  "keywords": [
    {
      "keyword": "ai tools for small business",
      "search_intent": "commercial",
      "estimated_difficulty": 42,
      "relevance_score": 0.91,
      "suggested_content_type": "listicle",
      "related_keywords": ["best ai software smb", "ai automation small business"]
    }
  ],
  "clusters": [
    {
      "cluster_name": "AI Productivity",
      "keywords": ["ai tools for small business", "ai automation small business"],
      "primary_intent": "commercial"
    }
  ],
  "tokens_used": 819,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/sage/generate-blog`

Generates a full SEO-optimised blog post with meta, headings, and optional schema markup.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `topic` | string | ✅ | | |
| `target_keyword` | string | ✅ | | |
| `secondary_keywords` | array[string] | ❌ | | |
| `word_count` | integer | ❌ | `2000` | |
| `output_format` | string | ❌ | `markdown` | `markdown`, `html`, `wordpress`, `wix` |
| `include_meta` | boolean | ❌ | `true` | |
| `include_schema_markup` | boolean | ❌ | `false` | |
| `tone_override` | string | ❌ | | |

**Sample Response**
```json
{
  "blog": {
    "title": "10 Best AI Tools for Small Business in 2026",
    "meta_title": "10 Best AI Tools for Small Business (2026) | Veqiro",
    "meta_description": "Discover the top AI tools helping small businesses save time and grow faster in 2026.",
    "slug": "best-ai-tools-small-business-2026",
    "content": "## Introduction\n\nArtificial intelligence is no longer just for enterprise...",
    "word_count": 2008,
    "headings": ["Introduction", "1. ChatGPT for Customer Support", "..."],
    "target_keyword": "ai tools for small business",
    "secondary_keywords": ["small business automation", "ai software 2026"]
  },
  "seo_score": 87,
  "seo_suggestions": ["Add FAQ schema for featured snippet opportunity", "Internal link to pricing page"],
  "tokens_used": 3241,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/sage/analyze-content`

Scores existing content for SEO and returns specific improvement recommendations.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `content` | string | ✅ | Full article text |
| `target_keyword` | string | ✅ | |
| `url` | string | ❌ | Existing live URL |

**Sample Response**
```json
{
  "score": 71,
  "issues": ["Target keyword missing from H1", "No internal links found"],
  "improvements": ["Add target keyword to first 100 words", "Include 2–3 internal links to related posts"],
  "missing_keywords": ["ai automation", "small business tools 2026"],
  "readability_grade": "Grade 9 (Good)",
  "tokens_used": 567,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/sage/content-brief`

Creates a detailed SEO content brief for writers or further AI generation.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `topic` | string | ✅ | |
| `target_keyword` | string | ✅ | |
| `competitor_urls` | array[string] | ❌ | |

**Sample Response**
```json
{
  "brief": {
    "topic": "AI tools for small business",
    "target_keyword": "ai tools for small business",
    "search_intent": "commercial",
    "recommended_word_count": 2200,
    "content_type": "listicle",
    "title_options": [
      "10 Best AI Tools for Small Business in 2026",
      "The Ultimate AI Toolkit for SMBs (2026 Edition)"
    ],
    "h2_structure": ["What to Look for in AI Tools", "Top 10 AI Tools", "How to Get Started"],
    "must_include_topics": ["pricing", "ease of use", "integrations"],
    "must_answer_questions": ["Is AI affordable for small business?", "Which AI tool is best for beginners?"],
    "competitor_gaps": ["None of top-3 ranking articles cover AI agents"],
    "cta_recommendation": "Free trial sign-up",
    "estimated_traffic_potential": "1,200–2,800 visits/mo"
  },
  "tokens_used": 698,
  "model_used": "gemini-2.0-flash"
}
```

---

## Lex — `/ai/lex`

Legal AI agent for contract analysis, document drafting, compliance checks, and legal research.

> **Disclaimer:** All Lex responses include a legal disclaimer. Lex is an AI assistant, not a licensed attorney.

---

### POST `/ai/lex/chat`

Free-form chat with Lex on legal topics (includes auto-appended legal disclaimer).

*(Same shape as other `/chat` routes.)*

---

### POST `/ai/lex/ingest-document`

Uploads and processes a legal PDF into the vector store for RAG-based queries.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `document_name` | string | ✅ | |
| `document_type` | string | ❌ | `nda`, `service_agreement`, etc. |
| `pdf_base64` | string | ✅ | Base64-encoded PDF |

**Sample Response**
```json
{
  "source_id": "src_lex_abc123",
  "chunks_created": 42,
  "page_count": 8,
  "summary": "Mutual NDA between Company A and Company B covering proprietary software and customer data.",
  "key_topics": ["confidentiality obligations", "exclusions", "term and termination", "jurisdiction"],
  "document_type_detected": "mutual_nda",
  "tokens_used": 743,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/lex/analyze-contract`

Performs risk analysis on a contract, flagging unusual clauses and missing protections.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `source_id` | string | ❌ | From `/ingest-document` (uses RAG) |
| `contract_text` | string | ❌ | Inline text (alternative to source_id) |
| `analysis_focus` | array[string] | ❌ | e.g. `["liability", "ip"]` |

**Sample Response**
```json
{
  "analysis": {
    "summary": "Standard mutual NDA with one high-risk clause around perpetual IP assignment.",
    "risk_level": "medium",
    "risks": [
      {
        "clause": "Section 4.2 — IP Assignment",
        "risk": "Assigns IP created during engagement to Company A in perpetuity, even for pre-existing work.",
        "severity": "high"
      }
    ],
    "unusual_clauses": ["Liquidated damages clause of $500k — atypical for an NDA"],
    "missing_protections": ["No mutual limitation of liability", "No dispute resolution clause"],
    "key_terms": {"term": "2 years", "jurisdiction": "Delaware"},
    "overall_assessment": "Negotiate IP and liability clauses before signing."
  },
  "disclaimer": "This analysis is for informational purposes only and does not constitute legal advice.",
  "tokens_used": 1087,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/lex/draft-document`

Drafts a legal document template for a given type and jurisdiction.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `document_type` | string | ✅ | | `mutual_nda`, `service_agreement`, etc. |
| `requirements` | string | ✅ | | Plain-English description |
| `jurisdiction` | string | ❌ | `United States (Delaware)` | |
| `additional_clauses` | array[string] | ❌ | | |

**Sample Response**
```json
{
  "document": "MUTUAL NON-DISCLOSURE AGREEMENT\n\nThis Agreement is entered into as of [DATE]...",
  "review_notes": [
    "Insert governing law clause referencing your specific state",
    "Have legal counsel review IP exclusions before use"
  ],
  "disclaimer": "This draft is a template only and does not constitute legal advice.",
  "tokens_used": 2134,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/lex/explain`

Explains a legal clause or document in plain English.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `text` | string | ✅ | Legal text to explain |
| `context` | string | ❌ | Additional context |

**Sample Response**
```json
{
  "explanation": "This clause means that if you share any of the company's confidential information — even accidentally — you could be held liable for up to $500,000 in damages without the company having to prove actual harm.",
  "key_terms": {
    "liquidated damages": "A pre-agreed penalty amount written into the contract.",
    "breach": "Violating the terms of the agreement."
  },
  "related_concepts": ["Indemnification", "Limitation of liability"],
  "practical_implications": [
    "Treat all shared materials as strictly confidential",
    "Avoid forwarding documents without written approval"
  ],
  "tokens_used": 476,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/lex/legal-research`

Researches a legal question across a given jurisdiction and legal domain.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `query` | string | ✅ | | |
| `jurisdiction` | string | ❌ | `United States` | |
| `legal_areas` | array[string] | ❌ | | e.g. `["contract law", "IP"]` |

**Sample Response**
```json
{
  "summary": "Under US contract law, non-compete clauses are enforceable in most states but must be reasonable in scope, duration, and geography.",
  "applicable_laws": ["California Business and Professions Code §16600", "FTC Non-Compete Rule (2024)"],
  "key_requirements": ["Legitimate business interest", "Reasonable geographic scope", "Duration ≤ 12–24 months"],
  "relevant_cases": ["Edwards v. Arthur Andersen LLP (Cal. 2008)"],
  "practical_guidance": ["California effectively bans non-competes — use NDAs instead.", "FTC 2024 rule banned most employee non-competes federally."],
  "jurisdiction_notes": "California is the most restrictive US state for non-competes.",
  "confidence_level": "high",
  "disclaimer": "This is AI-generated legal research, not legal advice.",
  "tokens_used": 921,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/lex/compliance-check`

Evaluates a business practice or dataset against one or more regulatory frameworks.

**Input**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | |
| `description` | string | ✅ | What you're checking (data handling, process, etc.) |
| `frameworks` | array[string] | ✅ | e.g. `["GDPR", "CCPA", "SOC2"]` |
| `business_context` | string | ❌ | |

**Sample Response**
```json
{
  "overall_status": "partial",
  "framework_results": [
    {
      "framework": "GDPR",
      "status": "partial",
      "gaps": ["No documented lawful basis for processing", "Data retention policy missing"],
      "requirements": ["Article 6 lawful basis", "Article 13 privacy notice", "Article 17 right to erasure"]
    }
  ],
  "critical_gaps": ["No data retention policy", "No cookie consent mechanism"],
  "remediation_steps": [
    {"priority": "high", "action": "Document lawful basis for all data processing activities"},
    {"priority": "medium", "action": "Implement cookie consent banner"}
  ],
  "estimated_effort": "3–6 weeks with legal and engineering involvement",
  "disclaimer": "This is not a legal compliance audit. Engage a qualified DPO for formal assessment.",
  "tokens_used": 1043,
  "model_used": "gemini-2.0-flash"
}
```

---

## Vega — `/ai/vega`

Executive assistant agent for email triage, calendar management, and daily briefings via Google Workspace.

> **Note:** Most Vega routes require `metadata.google_access_token` for Gmail/Calendar access. `node_actions` in responses are instructions for the backend to execute API calls on behalf of the user.

---

### POST `/ai/vega/chat`

Free-form chat with Vega for scheduling questions or email advice.

*(Same shape as other `/chat` routes.)*

---

### POST `/ai/vega/process-inbox`

Triages a batch of emails, assigns priorities, drafts replies, and applies labels.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `max_emails` | integer | ❌ | `20` | |
| `auto_label` | boolean | ❌ | `true` | |
| `draft_replies` | boolean | ❌ | `true` | |
| `metadata` | object | ✅ | | Must include `google_access_token` |

**Sample Response**
```json
{
  "processed": [
    {
      "email_id": "msg_18f3a2",
      "subject": "Contract renewal — urgent",
      "from_name": "Alice @ Acme",
      "priority": "urgent",
      "summary": "Acme wants to renew but needs updated pricing by Friday.",
      "suggested_action": "Reply with updated pricing deck",
      "label_applied": "urgent",
      "draft_created": true,
      "draft_id": "draft_001"
    }
  ],
  "stats": {
    "total_processed": 12,
    "urgent": 1,
    "high": 3,
    "medium": 6,
    "low": 2,
    "drafts_created": 4,
    "labels_applied": 12
  },
  "node_actions": [
    {"action": "apply_gmail_label", "email_id": "msg_18f3a2", "label": "urgent"},
    {"action": "create_gmail_draft", "draft_id": "draft_001"}
  ],
  "tokens_used": 1356,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/vega/draft-reply`

Drafts a reply to a specific email based on instructions.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `email_id` | string | ✅ | | Gmail message ID |
| `reply_instructions` | string | ✅ | | What to say |
| `tone` | string | ❌ | `professional` | |
| `save_as_draft` | boolean | ❌ | `true` | |
| `metadata` | object | ✅ | | `google_access_token` |

**Sample Response**
```json
{
  "draft": {
    "to": "alice@acme.com",
    "subject": "Re: Contract renewal — urgent",
    "body": "Hi Alice,\n\nThank you for reaching out. Please find the updated pricing attached...",
    "saved": true
  },
  "suggested_follow_up": "Follow up Thursday if no response by EOD.",
  "node_actions": [{"node_action": "create_gmail_draft", "email_id": "msg_18f3a2"}],
  "tokens_used": 487,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/vega/calendar-summary`

Returns a structured overview of upcoming calendar events, conflicts, and free slots.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `days_ahead` | integer | ❌ | `7` | |
| `metadata` | object | ✅ | | `google_access_token` |

**Sample Response**
```json
{
  "events": [
    {"title": "Board call", "start": "2026-04-21T10:00:00Z", "end": "2026-04-21T11:00:00Z"}
  ],
  "conflicts": [
    {"event_a": "Board call", "event_b": "Investor 1:1", "overlap_minutes": 30}
  ],
  "free_slots": [
    {"date": "2026-04-21", "start": "14:00", "end": "16:00", "duration_hours": 2}
  ],
  "daily_summary": {
    "2026-04-21": {"total_meetings": 3, "busy_hours": 4.5, "free_hours": 3.5}
  },
  "tokens_used": 412,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/vega/create-event`

Creates a calendar event from a natural language description.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `description` | string | ✅ | | Natural language, e.g. "1hr call with Bob tomorrow at 2pm" |
| `check_conflicts` | boolean | ❌ | `true` | |
| `metadata` | object | ✅ | | `google_access_token` |

**Sample Response**
```json
{
  "event": {
    "title": "Call with Bob",
    "start": "2026-04-20T14:00:00Z",
    "end": "2026-04-20T15:00:00Z",
    "attendees": ["bob@example.com"],
    "description": ""
  },
  "conflicts": [],
  "google_event_id": "gcal_event_xyz",
  "created": true,
  "node_actions": [{"node_action": "create_calendar_event", "event_id": "gcal_event_xyz"}],
  "tokens_used": 298,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/vega/executive-briefing`

Generates a personalised daily briefing combining inbox and calendar data.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `include_email` | boolean | ❌ | `true` | |
| `include_calendar` | boolean | ❌ | `true` | |
| `metadata` | object | ✅ | | `google_access_token` |

**Sample Response**
```json
{
  "briefing": {
    "date": "2026-04-19",
    "good_morning": "Good morning. You have 3 urgent emails and 5 meetings today.",
    "priority_score": 82,
    "urgent_actions": [
      "Reply to Acme contract renewal by EOD",
      "Prepare board slides for Monday"
    ],
    "today_schedule": [
      {"time": "10:00", "title": "Board call", "duration_min": 60}
    ],
    "upcoming_this_week": ["Investor demo Thu 2pm", "Team retro Fri 3pm"],
    "email_summary": {"unread": 24, "urgent": 3, "drafts_ready": 4},
    "free_time_today": "2pm–4pm",
    "focus_recommendation": "Block 2–4pm for board deck prep — no meetings, low interruption window.",
    "generated_at": "2026-04-19T07:00:00.000Z"
  },
  "tokens_used": 879,
  "model_used": "gemini-2.0-flash"
}
```

---

### POST `/ai/vega/compose-email`

Composes a new outbound email from instructions.

**Input**
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `user_id` | string | ✅ | | |
| `to` | string | ✅ | | Recipient email |
| `subject` | string | ✅ | | |
| `instructions` | string | ✅ | | What to write |
| `tone` | string | ❌ | `professional` | |
| `include_cta` | boolean | ❌ | `true` | |
| `metadata` | object | ✅ | | `google_access_token` |

**Sample Response**
```json
{
  "draft": {
    "to": "investor@vc.com",
    "subject": "Veqiro — Q1 Update & Intro Request",
    "body": "Hi Sarah,\n\nI wanted to share a quick Q1 update and follow up on the intro to the Sequoia team...\n\nBest,\nFounder"
  },
  "node_actions": [{"node_action": "create_gmail_draft"}],
  "tokens_used": 543,
  "model_used": "gemini-2.0-flash"
}
```

---

## Summary

| Agent | Prefix | # Routes | Purpose |
|-------|--------|----------|---------|
| Router | `/ai/router` | 1 | Intent classification — routes messages to the right agent |
| Maya | `/ai/maya` | 7 | Social media & marketing content generation |
| Rex | `/ai/rex` | 10 | Financial analytics, forecasting, investor reporting |
| Scout | `/ai/scout` | 5 | Web research & competitive intelligence |
| Sage | `/ai/sage` | 5 | SEO keyword research & long-form blog generation |
| Lex | `/ai/lex` | 7 | Legal document analysis, drafting & compliance |
| Vega | `/ai/vega` | 7 | Email triage, calendar management & executive briefings |
| **Total** | | **42** | |
