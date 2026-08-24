# Veqiro — Agentic AI Interview Prep

One-page mental model + exact code pointers. Read top to bottom once, then use it as a lookup during the interview.

**What Veqiro is:** a multi-agent AI SaaS. Six specialised agents (Maya, Scout, Sage, Rex, Lex, Vega) each run in a Python/FastAPI service (`apps/ai`). A Node/Express server (`apps/server`) owns the database (Prisma/Postgres/Supabase), auth, integrations (Composio/MCP), and orchestrates memory. A Next.js frontend (`apps/main`) is the chat UI.

```
apps/ai      → Python FastAPI. All 6 agents, RAG, LLM calls, tool-calling loop
apps/server  → Node/Express. Prisma schema, memory persistence, Composio/MCP proxy, auth
apps/main    → Next.js frontend, chat UI, agent handoff buttons
```

---

## 1. The 6 Agents

All agents subclass `BaseAgent` in **`apps/ai/agents/base.py`**. Each lives in its own folder with `agent.py` (persona + tools) and `routes.py` (FastAPI endpoints).

| Agent | File | Model | Native tools (`get_tools()`) | Unique bit |
|---|---|---|---|---|
| **Maya** — social content | `agents/maya/agent.py` | `gpt-5.6-luna` | `generate_ideas`, `draft_content`, `generate_variants`, `modify_image`, `revise_content` | Only agent that generates images (`core/image_gen.py`) |
| **Scout** — market/competitor intel | `agents/scout/agent.py` | `gpt-5.6-luna` (env `SCOUT_MODEL`) | `web_search`, `research_topic`, `research_company`, `trending_topics`, `discover_competitors` | Web scraping via `agents/scout/scraper.py` (Serper API) |
| **Sage** — SEO/content strategy | `agents/sage/agent.py` | `gpt-5.6-luna` (env `SAGE_MODEL`) | `keyword_research`, `generate_blog`, `analyze_content`, `content_brief`, `serp_analysis`, `topical_map`, `meta_optimizer`, `page_seo_audit`, `site_audit` | Audit tools call itself over HTTP: `agents/sage/agent.py::_execute_audit_tool()` → `http://127.0.0.1:8000/ai/sage/page-audit` |
| **Rex** — analytics/finance | `agents/rex/agent.py` | `gpt-5.6-luna` | `analyze_metrics`, `forecast_metric`, `financial_analysis`, `compile_briefing`, `generate_investor_update`, `calculate_runway`, `unit_economics`, `scenario_model`, `weekly_digest` | Math in `agents/rex/analytics.py`, forecasting (Prophet/linear regression) in `agents/rex/forecasting.py` |
| **Lex** — legal/compliance | `agents/lex/agent.py` | `gpt-5.6-luna` | `list_documents`, `analyze_contract`, `draft_document`, `explain_legal`, `legal_research`, `compliance_check` | Only agent doing document-grounded RAG Q&A |
| **Vega** — email/calendar | `agents/vega/agent.py` | `gpt-5.6-luna` | **`get_tools()` returns `[]`** | 100% powered by MCP tools (Gmail/Calendar via Composio) — see §8 |

**System prompts are hand-written Python, not templates.** Each agent overrides `build_system_prompt()` and builds the string with plain concatenation, reusing shared blocks from `base.py`: `_core_response_style_block()`, `_no_hallucination_block()`, `_current_date_block()`, `_mcp_catalog_block()`. There's a Jinja2 loader (`core/prompts.py::render_prompt()`) and a `agents/maya/prompts/*.j2` folder — **these are dead code**, not actually called anywhere except their own definition. Say this if asked "are prompts templated?" — good nuance to show you actually read the code.

**Agent registration:** `agents/registry.py` — a flat dict, `_registry: dict[str, BaseAgent] = {}`, populated by each `routes.py` calling `register_agent(agent)` at import time. `get_agent(slug)` / `list_agents()`.

---

## 2. Orchestration — there is NO LangGraph/LangChain/graph engine

Verified by grep — zero imports of `langgraph`/`langchain`, zero `Orchestrator`/`Supervisor`/`Graph` classes anywhere in `apps/ai`.

Instead there are three separate, simpler mechanisms:

1. **Intent classifier** (routing a *new* message to an agent) — `apps/ai/agents/router.py`, endpoint `POST /ai/router/classify`. Either keyword-scores a `_KEYWORD_MAP` dict, or (real mode) one LLM call using `gpt-4.1-mini` expecting JSON `{agent_slug, confidence, reasoning}`. This only labels intent — it doesn't run the conversation.
2. **Per-agent FastAPI routers** — each agent is its own microservice-style module, mounted in `apps/ai/api/main.py` (e.g. `/ai/maya/chat`, `/ai/rex/chat`). There's no single "master" entrypoint.
3. **The tool-calling loop** — `BaseAgent.chat_sync()` in `apps/ai/agents/base.py` (line 567). This is the real "brain":

```python
# apps/ai/agents/base.py (simplified)
for _iteration in range(self.MAX_TOOL_CALLS):        # MAX_TOOL_CALLS = 5, line 299
    response = await self.llm.complete_with_tools(tools=tools, messages=messages, ...)
    if response.finish_reason == "stop":
        break
    results = await asyncio.gather(*(self.execute_tool(tc) for tc in response.tool_calls))
    messages += format_tool_result_messages(response.tool_calls, results)
```

So "orchestration" = a hand-rolled agentic loop per agent + a peer-to-peer delegation tool (`ask_agent`, §9) — a **tool-mediated mesh**, not a DAG. This is a good talking point: you can explain *why* a mesh works fine here (6 independent domain agents, no complex multi-step planning needed) vs when you'd reach for LangGraph (deep multi-step planning, cycles, human-in-the-loop checkpoints).

**Agents are singletons** shared across all orgs/requests (comment in `base.py` explicitly warns: never store per-request state on `self`).

---

## 3. RAG — Retrieval-Augmented Generation

**Core file: `apps/ai/core/rag.py`, class `RAGService`.**

- Vector DB: **Postgres + pgvector** on Supabase (not Pinecone/Chroma). Table defined in raw SQL migration `apps/server/prisma/migrations/20260424000000_add_rag_chunks/migration.sql` — deliberately **not** in `schema.prisma` (owned only by the Python asyncpg layer, not Prisma Client):

```sql
CREATE TABLE rag_chunks (
    id TEXT PRIMARY KEY, user_id TEXT, source_id TEXT, source_type TEXT,
    source_agent TEXT, content TEXT, embedding vector(1536), metadata JSONB
);
CREATE INDEX rag_chunks_embedding_idx ON rag_chunks USING ivfflat (embedding vector_cosine_ops);
```

- Embeddings: **OpenAI `text-embedding-3-small`** (1536-dim), in `apps/ai/core/embeddings.py` — `embed_text()` (single) and `embed_batch()` (used during ingest, index-sorted to preserve order).
- Chunking: `_chunk_text(text, chunk_size=200, overlap=30)` in `rag.py` — word-based, 170-word step, 30-word overlap.
- PDF ingestion: `apps/ai/core/pdf_reader.py` — primary path sends raw PDF bytes to **Gemini vision** (`extract_text_with_vision`), falls back to **PyPDF2** (`extract_text`) on failure.

**Key `RAGService` methods:**

| Method | Purpose |
|---|---|
| `retrieve(user_id, query, top_k=5, source_agent=None, source_id=None)` | Embed query → cosine similarity search, filters score < 0.70 |
| `ingest(user_id, text, source_type, source_id, source_agent)` | Chunk → batch embed → bulk INSERT |
| `ingest_pdf(user_id, pdf_bytes, source_id)` | PDF extract → `ingest()` |
| `retrieve_by_source(user_id, source_id)` | Get ALL chunks for one document (no vector search — full-doc read) |
| `delete_source(user_id, source_id)` | `DELETE ... RETURNING id` |

**Exact retrieval SQL** (pgvector cosine distance operator `<=>`):
```sql
SELECT id, content, source_type, source_agent, metadata,
       1 - (embedding <=> $1::vector) AS score
FROM rag_chunks
WHERE user_id = $2 AND ($3 IS NULL OR source_agent = $3) AND ($6 IS NULL OR source_id = $6)
ORDER BY embedding <=> $1::vector LIMIT $5
```
(score < 0.70 filtered out **in Python after fetch**, not in SQL)

### RAG is used in TWO modes — know both

**A) Silent/automatic (context-stuffing, not a tool call).** Every chat turn, for any message >4 words, `BaseAgent.chat_sync`/`chat_stream` does:
```python
rag_chunks = await self.rag.retrieve(user_id=..., query=request.message, top_k=5, source_agent=self.slug)
```
and appends `"\n\nRelevant context from knowledge base:\n{chunks}"` straight into the **system prompt string**. The LLM never "decides" to retrieve — it's always pre-fetched. This is important: **it's context injection, not function calling.**

**B) Explicit tool (Lex only).** `LexAgent.get_tools()` (`agents/lex/agent.py`) exposes `analyze_contract`, which the LLM can choose to call; `execute_tool()` handles it via `self.rag.retrieve_by_source(...)`.

**C) Dedicated REST endpoint — the "real" RAG Q&A path.** `apps/ai/agents/lex/routes.py`, `POST /ai/lex/query-document`:
1. `embed_text(query)` → OpenAI embedding
2. `_rag.retrieve(..., source_id=source_id)` → pgvector cosine search
3. Chunks joined into a `[Chunk N | relevance: 0.83]` formatted context string
4. `_llm.complete(system="You are a senior legal counsel...", messages=[{"content": f"Document excerpts:\n{context}\n\nQuestion: {query}"}])`
5. Answer + cited chunks returned to user

**D) Write-back.** After `analyze_contract`/`legal_research`/`compliance_check` (Lex), and after research (Scout) or financial tools (Rex), `_fire_rag_ingest()` (`base.py` line 996, fire-and-forget `asyncio.create_task`) re-ingests the agent's own output into `rag_chunks` so future queries can retrieve it — this is how "memory" and "RAG" blur together (see §4).

---

## 4. Memory — 4 distinct systems (don't conflate them in the interview)

### a) Raw chat transcript
`Message` model in `apps/server/prisma/schema.prisma` (line 635) — every message, unsummarized, `organizationId, role, content, agent, tokensUsed, model`.

### b) Rolling summary + long-term facts (structured)
Two Prisma models:
- **`AgentMemory`** (schema.prisma:671) — **per org, per agent**: `runningSummary` (text), `longTermFacts` (JSON array, capped 60), `messageCount`, `lastSummarizedAt`.
- **`OrgMemory`** (schema.prisma:699) — **org-wide, shared across all agents**: `runningSummary`, `longTermFacts`, `sharedMemory` (JSON: goals/product/decisions/userPreferences, capped 20).

**Trigger (Node side, not Python):** `apps/server/src/config/constants.ts` — `SUMMARIZE_THRESHOLD = 10`, `CONTEXT_HISTORY_LIMIT = 20`. `apps/server/src/common/utils/contextService.ts::recordAgentTurnContext()` increments a message counter every turn; at 10 it calls `triggerSummarize()` (`apps/server/src/modules/context/context.service.ts`), which POSTs to the Python endpoint:

**`POST /ai/context/summarize` → `summarize_conversation()` in `apps/ai/core/context_routes.py` (line 112).** Model: `gpt-4.1-mini`, `temperature=0.2, max_tokens=800`. Returns strict JSON: `updated_summary` (max 400 words) + `extracted_facts` (max 5, tagged `[DECISION]/[METRIC]/[PREFERENCE]/[CONTEXT]/[GOAL]`). Node then writes this into `AgentMemory` and resets `messageCount` to 0. `[PREFERENCE]`-tagged facts go to `OrgMemory.sharedMemory.userPreferences` instead.

### c) Semantic vector memory (raw turn embeddings)
**`apps/ai/core/conversation_memory.py`** — separate `conversation_memories` table (raw SQL, pgvector, `vector(1536)`), NOT the same table as RAG's `rag_chunks`.
- `store_turn(org_id, agent, user_content, assistant_content)` (line 57) — embeds and inserts one row each for user+assistant.
- `retrieve_relevant(org_id, agent, query, top_k=5)` (line 91) — cosine search, `_MIN_SIMILARITY = 0.70` filter.

### d) Assembly — how it all combines for the next LLM call
`apps/server/src/common/utils/contextService.ts::callAgentWithContext()` (line 190):
1. Fetch `AgentMemory` + `OrgMemory` from Postgres
2. POST to **`POST /ai/context/build` → `build_context()` in `apps/ai/core/context_routes.py`** (line 61) with hot history + summaries + facts. Returns:
   - `hot_messages` = last 8 raw messages (`request.hot_history[-8:]`)
   - `semantic_messages` = top-5 from `retrieve_relevant()`, deduped against hot history
   - `memory_block` = markdown string: `## What I Remember About This Client` / `## Organization Context` / `## Organization Goals & Decisions` / `## Established Facts`
3. `history = [...hot_messages, ...semantic_messages]` sent to the agent
4. `memory_block` sent as `metadata.memory_context`, appended into the system prompt in `agents/base.py` (capped at `_MEMORY_HARD_CAP = 8000` chars, tighter 1200-char cap for short messages)

**Conditional, not always-on:** if `/ai/context/build` throws, Node silently falls back to raw `rawHistory` (no summary/semantic layer that turn).

---

## 5. Brand Kit — org/brand context (the "Brain")

**`apps/ai/core/brand_kit.py`**, class `BrandKit(BaseModel)` — company name/description, value prop, brand voice, colors, fonts, platform tones, competitors, differentiators, plus a **crawled website summary** (via Jina Reader, capped 1200 chars).

- Storage: Prisma `model BrandKit` (schema.prisma:558), keyed `organizationId @unique`.
- Retrieval: `load_brand_kit(organization_id)` — GETs Node's internal API, **cached in-memory 5 min per org** (`_CACHE_TTL = 300`), stale-cache fallback on error.
- **Not universally injected.** Each agent's `build_system_prompt()` calls `load_brand_kit()` when `use_brand_kit=True` — the default for direct user chats, but explicitly **set to `False` for cross-agent `ask_agent` calls** (`base.py` line 649: `use_brand_kit=not is_cross_agent`) to keep delegated sub-prompts lean.
- It's **structured context injected directly into the prompt**, not retrieved via RAG/vector search.

---

## 6. LLM client — one hand-written wrapper, no framework

**`apps/ai/core/llm.py`, class `LLMClient`.** Wraps the raw `openai` SDK (`AsyncOpenAI`) and raw `google-genai` SDK directly — **not LangChain**. Key methods: `complete()`, `complete_json()` (JSON mode + 1 retry), `stream()`, `complete_with_tools()` (provider-specific schema translation via `core/tools.py`), plus image/video generation and vision. Retries with `[0,1,3,9]`s backoff, wrapped in Langfuse spans (`core/observability.py`). `settings.MOCK_MODE` short-circuits everything for tests.

---

## 7. Tools — real function-calling, not fake

**`apps/ai/core/tools.py`** — defines the **schema layer only** (no actual tools live here): `ToolDefinition`, `ToolParameter`, `ToolCall`, `ToolResult`, plus converters `tool_defs_to_openai()` / `tool_defs_to_gemini()` that build the actual `{"type":"function","function":{...}}` schema OpenAI expects. This confirms it's genuine LLM tool-calling — the LLM sees real JSON-schema tool defs and decides.

**Concrete trace — Scout's `research_company` tool:**
1. `ScoutAgent.chat_sync()` → base loop calls `self.llm.complete_with_tools(tools=[...])`
2. LLM decides to emit `tool_calls: [{name: "research_company", args: {...}}]`
3. `execute_tool()` in `agents/scout/agent.py` fires 7 parallel searches/scrapes via `asyncio.gather(serper_search(...) × 6, scrape_url(url))` (uses `agents/scout/scraper.py`)
4. Results fed into a **second LLM call** (`complete_json`) to synthesize structured JSON
5. Result appended back as a `tool` message → loop continues → LLM emits final natural-language answer with `finish_reason="stop"`

This is the pattern to describe if asked "trace a tool call end to end."

---

## 8. MCP / Composio — third-party integrations as tools

**`apps/ai/core/mcp/`** — a thin *client*, not a self-hosted MCP server. Node holds the Composio master API key; Python only makes internal REST calls to it.
- `client.py` — `list_connection_tools()`, `call_connection_tool()` (GET/POST to Node's `/api/v1/internal/mcp/...`)
- `cache.py` — `get_mcp_tools()`, 30-min TTL per `(org_id, agent_slug)`, enforces OpenAI's 128-tool cap by truncating on an `important` flag
- `naming.py` — sanitizes tool names to `mcp_<integration>_<tool>` (e.g. `mcp_gmail_send_email`)

MCP tools are merged into every agent's tool list in `chat_sync()` alongside native tools. **Vega has zero native tools** — 100% of its capability (Gmail, Calendar) comes from MCP. Write-capable MCP tools (`is_write=True`) are staged as `pending_actions` for user confirmation instead of executing immediately — a safety/confirm-before-execute pattern.

---

## 9. Agent-to-agent collaboration — two SEPARATE mechanisms (this is the best interview differentiator)

### Backend: real delegation via a tool (`ask_agent`)
`apps/ai/agents/registry.py::get_ask_agent_tool()` builds a synthetic tool `ask_agent(agent_slug, question)`, appended to **every** agent's tool list in `chat_sync()` (with the calling agent excluded from the enum, no self-calls). When the LLM invokes it:

```python
# apps/ai/agents/base.py — _execute_cross_agent_call() (line 954)
target_agent = get_agent(target_slug)          # registry.py lookup
return await target_agent.chat_sync(inner_request)   # real in-process call, not HTTP
```
This is a genuine in-process method call between agent singletons — the calling LLM decides autonomously to delegate. Example: Rex's `compile_briefing` tool explicitly calls this against Maya and Scout in parallel to gather summaries (`agents/rex/agent.py`).

### Frontend: handoff buttons (pure UI, no backend agent call)
Documented in root `AGENTS.md`. Result cards (e.g. `apps/main/src/components/agents/scout/cards.tsx`) expose `onFollowUpAction(actionId, prefill)`. Flow:
- `ActionResultRenderer.tsx` → `ChatMessage.tsx` → page-level `handleFollowUp()` in `apps/main/src/app/(dashboard)/assistants/[id]/page.tsx`
- Different target agent → `router.push('/assistants/{targetAgent}?action=...&prefill=...')` (prefill JSON in the URL)
- Target page reads `searchParams`, opens `RunActionDialog.tsx`, shallow-merges prefill over that action's `defaultValue`

**Say this explicitly if asked:** clicking "Draft post" on a Scout card does **not** trigger any backend agent call — it's client-side navigation with a pre-filled form. Real agent-to-agent reasoning only happens through `ask_agent`.

---

## 10. End-to-end trace — pick this example: "user asks Rex for a briefing that includes social + market context"

1. **Frontend** → POST to `/ai/rex/chat` (mounted via `agents/rex/routes.py`, included in `apps/ai/api/main.py`)
2. **Node pre-step** (`contextService.ts::callAgentWithContext`) — fetches `AgentMemory`/`OrgMemory` from Postgres, calls `POST /ai/context/build` → gets `hot_messages` + `semantic_messages` + `memory_block`
3. **Python entrypoint** → `RexAgent.chat_sync(request)` → `BaseAgent.chat_sync()` (`agents/base.py:567`)
4. **Prompt construction** — `build_system_prompt()`: brand kit (`brand_kit.py::load_brand_kit`, since this is a direct call, `use_brand_kit=True`) + `memory_context` from step 2 + RAG auto-retrieve (`self.rag.retrieve(source_agent="rex")`) all appended to system prompt
5. **Tool list built** — Rex's native tools + `ask_agent` (registry.py) + any connected MCP tools
6. **LLM call** — `self.llm.complete_with_tools(...)` → LLM picks `compile_briefing`
7. **Tool execution** — `execute_tool("compile_briefing")` in `agents/rex/agent.py` runs analytics (`agents/rex/analytics.py`) **and** calls `_execute_cross_agent_call({"agent_slug":"maya"})` + `{"agent_slug":"scout"}` in parallel — each of those runs its OWN full `chat_sync()` loop recursively (with `_cross_agent_call=True` to skip brand kit/avoid deep recursion)
8. **Result assembly** — combined tool result appended to `messages`, loop iterates, LLM produces final natural-language briefing (`finish_reason="stop"`)
9. **Write-back** — `_fire_rag_ingest()` fires async, writing this briefing into `rag_chunks` (source_agent="rex") for future retrieval
10. **Response returned** → Node persists the `Message` row, increments `AgentMemory.messageCount`; if it hits 10, next turn triggers `/ai/context/summarize`
11. **Frontend** renders the response; if it's a rich card, follow-up buttons let the user manually jump to Maya/Scout (frontend handoff, separate from what already happened server-side in step 7)

---

## 11. Architecture map (say this out loud as your summary)

```
User message
   │
   ▼
Node (apps/server) ── loads AgentMemory + OrgMemory (Prisma/Postgres) ──▶ POST /ai/context/build
   │                                                                            │
   │                                                          apps/ai/core/context_routes.py
   │                                                     (hot_messages + semantic_messages + memory_block)
   ▼
Python agent router (per-agent FastAPI route, e.g. /ai/rex/chat)
   │
   ▼
BaseAgent.chat_sync()  (apps/ai/agents/base.py)
   │
   ├─ build_system_prompt() ── Brand Kit (core/brand_kit.py, Prisma BrandKit)
   │                        ── memory_context (from Node)
   │                        ── RAG auto-retrieve (core/rag.py → rag_chunks / pgvector)
   │
   ├─ tools = native tools ∪ ask_agent (registry.py) ∪ MCP tools (core/mcp/)
   │
   ├─ LLM loop: llm.complete_with_tools() → execute_tool() → feed result back → repeat (≤5x)
   │        │
   │        ├─ tool call → local Python (scraper.py / analytics.py / gmail.py / rag.py)
   │        ├─ tool call → ask_agent → ANOTHER agent's chat_sync() (recursive, in-process)
   │        └─ tool call → MCP → Node → Composio → Gmail/Calendar/Slack etc.
   │
   ▼
Final LLM response
   │
   ├─ _fire_rag_ingest() ── async write into rag_chunks (long-term/RAG memory)
   ├─ Node stores Message row, increments AgentMemory.messageCount
   └─ if messageCount ≥ 10 → next turn triggers /ai/context/summarize (gpt-4.1-mini)
                              → updates AgentMemory.runningSummary + longTermFacts
```

---

## Quick-fire answers for likely interview questions

- **"Do you use LangChain/LangGraph?"** No — hand-rolled tool-calling loop (`BaseAgent.chat_sync`) using raw OpenAI/Gemini SDKs directly (`core/llm.py`). Deliberate choice for full control over the loop, retries, and MCP integration.
- **"Is RAG a tool or automatic?"** Both — silently auto-injected into every prompt for messages >4 words (context stuffing), AND exposed as an explicit callable tool for Lex's contract analysis. The real similarity-search Q&A path is a dedicated REST endpoint (`/ai/lex/query-document`), separate from the chat tool loop.
- **"How many kinds of memory?"** Four: raw transcript (`Message`), structured rolling summary + facts (`AgentMemory`/`OrgMemory`, Prisma), semantic vector memory of raw turns (`conversation_memories`, pgvector), and RAG knowledge base (`rag_chunks`, pgvector) — plus Brand Kit as a fifth, non-conversational org-context store.
- **"How do agents talk to each other?"** Two independent mechanisms: a real backend `ask_agent` tool the LLM can invoke autonomously (in-process recursive `chat_sync()` call), and a frontend-only "handoff button" that pre-fills another agent's form via URL params — no backend call involved in the latter.
- **"What triggers summarization?"** Node-side counter (`AgentMemory.messageCount`), threshold 10 (`SUMMARIZE_THRESHOLD` in `apps/server/src/config/constants.ts`), calls `gpt-4.1-mini` via `/ai/context/summarize`.
- **"Vector DB?"** Postgres + pgvector on Supabase, `vector(1536)` columns, cosine distance operator `<=>`, ivfflat index. Two separate tables for two separate purposes: `rag_chunks` (documents/tool outputs) and `conversation_memories` (raw turn embeddings).
