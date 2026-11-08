# Anthropic as the Main LLM: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every text LLM call in `apps/ai` that runs on OpenAI today (all six agents, router, planner, Rex reports and dashboards, briefing, carousel and context routes) runs on Claude. Image and video generation, plus the Gemini text calls that feed those pipelines, stay on Gemini. Embeddings stay on OpenAI.

**Architecture:** Add an `"anthropic"` provider to `LLMClient` next to `"openai"` and `"gemini"`. Agents keep building messages in the OpenAI shape they use today (`role: "tool"`, `tool_calls`, `tool_call_id`). A pure adapter, `core/anthropic_adapter.py`, converts that shape to the Messages API at the boundary and converts responses back. That keeps `agents/base.py`, `core/runs/step.py` and the stored conversation history unchanged. One setting pair, `MAIN_LLM_PROVIDER` and `MAIN_LLM_MODEL`, chooses the model for every call site, so rolling back to OpenAI is an env change, not a deploy.

**Tech Stack:** Python 3 / FastAPI, `anthropic` Python SDK (async client `AsyncAnthropic`), pytest.

**Spec:** the user request of 2026-11-03: "replace openai with anthropic... for image video etc gemini still okay... for all other work use anthropic key... all agents and all features tools should work as it is... nothing should break due to key provider change."

## Global Constraints

- Gemini stays for: image generation (`GEMINI_IMAGE_MODEL`), video (`gemini-omni-1.1-flash`), vision/PDF (`complete_with_vision*`, `core/pdf_reader.py`), the image-prompt expansion in `core/image_gen.py` and `agents/maya/routes.py:1273`, the video planners in `core/video_director.py` / `core/video_gen.py`, and `evals/graders.py`. Do not touch these.
- Embeddings stay on OpenAI `text-embedding-3-small`. The pgvector columns are `vector(1536)` (`apps/server/prisma/migrations/20260424000000_add_rag_chunks`), and every stored RAG chunk and conversation memory was embedded with that model. Anthropic has no embeddings API.
- The model ID comes only from `settings.MAIN_LLM_MODEL`. No other `"claude-..."` or `"gpt-..."` literal is left in agent code.
- Use the exact model ID strings `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-5-5`, with no date suffix.
- Do not send `temperature`, `top_p` or `top_k` to Anthropic (current models return 400). Do not send `thinking: {type: "disabled"}` or `budget_tokens` (400 on Opus 5.5 / Sonnet 5.5). Do not send forced `tool_choice` `any` or `tool` (400). Do not end `messages` with an assistant turn (prefill returns 400).
- Do not replay thinking blocks. Agent history is rebuilt in OpenAI shape on every turn, so it is not append-only, and replaying blocks after an edit returns 400 on accounts created after 2026-08-31. The responses' thinking blocks are discarded at the adapter.
- The OpenAI code paths stay working and tested. They are the rollback.
- No git steps in this plan. The user handles all git operations.

## Review Focus

1. **History that starts with an assistant turn, or has empty assistant content** (a greeting stored first, a tool-call turn with `content: None`). Anthropic requires the first message to be `user` and rejects empty text blocks. Expected: the request succeeds. Leading assistant turns are dropped and empty text is skipped. Tests: Task 2 `test_leading_assistant_dropped` and `test_empty_assistant_text_skipped`.
2. **Several tool results in one round.** OpenAI sends one `role: "tool"` message per result. Anthropic needs all `tool_result` blocks in a single user message straight after the `tool_use` turn. Expected: they merge into one user message, in order. Test: Task 2 `test_parallel_tool_results_merge`.
3. **Thinking eating the token budget.** Callers pass `max_tokens=4096`, and thinking counts toward it (the same failure `JSON_COMPLETION_MAX_TOKENS` documents for gpt-6-luna). Expected: `max_tokens` is floored at `ANTHROPIC_MIN_MAX_TOKENS` (16000), and an empty `stop_reason="max_tokens"` reply flows into `complete_json`'s existing larger-budget retry. Test: Task 3 `test_max_tokens_floor`.
4. **Safety refusal** (`stop_reason="refusal"`, HTTP 200). Expected: `LLMError("Claude declined (category=...)")`, not an empty string fed into JSON parsing, and not retried by the 1/3/9-second loop. Test: Task 3 `test_refusal_raises_without_retry`.
5. **A response that starts with a `thinking` block.** Text-only consumers break if they read `content[0].text`. Expected: text is taken from `text` blocks only, by type. Test: Task 3 `test_text_read_by_block_type`.

---

### Task 1: Settings, dependency, and the single model switch

**Files:**
- Modify: `apps/ai/requirements.txt` (add `anthropic`, pinned to the version pip installs)
- Modify: `apps/ai/core/config.py:6-37`
- Modify: `apps/ai/api/main.py:69-76`
- Test: `apps/ai/tests/core/test_main_llm_config.py`

**Interfaces:**
- Produces: `settings.ANTHROPIC_API_KEY: str` (default `"mock-key"`), `settings.MAIN_LLM_PROVIDER: str` (default `"anthropic"`), `settings.MAIN_LLM_MODEL: str` (default `"claude-opus-5-5"`), `settings.ANTHROPIC_EFFORT: str` (default `"medium"`), `settings.ANTHROPIC_MIN_MAX_TOKENS: int` (default `16000`), `settings.ANTHROPIC_FALLBACKS: bool` (default `True`). `SCOUT_MODEL` and `SAGE_MODEL` are deleted.

- [ ] **Step 1: Write the failing test** `test_defaults_point_at_anthropic`: build `Settings(_env_file=None)` and assert `MAIN_LLM_PROVIDER == "anthropic"`, `MAIN_LLM_MODEL == "claude-opus-5-5"`, `ANTHROPIC_MIN_MAX_TOKENS == 16000`, and `not hasattr(s, "SCOUT_MODEL")`.
- [ ] **Step 2: Run it.** `cd apps/ai && ./venv/Scripts/python -m pytest tests/core/test_main_llm_config.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement.** Run `./venv/Scripts/pip install anthropic`, pin the installed version in `requirements.txt`, and add the settings above. In `/ready`, replace `"openai": True` with `"anthropic": True` and keep `"openai": True` (embeddings still use it).
- [ ] **Step 4: Run it again.** Expected: PASS.

### Task 2: OpenAI-shape → Anthropic message and tool conversion (pure functions)

**Files:**
- Create: `apps/ai/core/anthropic_adapter.py`
- Modify: `apps/ai/core/tools.py` (add `tool_defs_to_anthropic`; `format_tool_result_messages` gets an explicit `"anthropic"` branch that returns `tool_results_to_openai(...)`, because history stays OpenAI-shaped)
- Test: `apps/ai/tests/core/test_anthropic_adapter.py`

**Interfaces:**
- Produces:
  - `to_anthropic_messages(messages: list[dict]) -> list[dict]`. Maps `user`/`assistant` string content to text blocks. Maps an assistant message with `tool_calls` to `[text block if non-empty] + tool_use blocks` (`id`, `name`, `input=json.loads(arguments)`, with `{}` on bad JSON). Merges each run of consecutive `role: "tool"` messages into ONE user message of `tool_result` blocks (`tool_use_id=tool_call_id`, `content` = string). Skips empty text. Drops leading assistant turns. Stringifies non-string content the way `_gemini_complete` does.
  - `tool_defs_to_anthropic(tools: list[ToolDefinition]) -> list[dict]` → `{"name", "description", "input_schema"}`, using `raw_schema` when set, else `_params_to_json_schema(t.parameters)`.

- [ ] **Step 1: Write the failing tests.**
  - `test_plain_turns`: `[{"role":"user","content":"hi"},{"role":"assistant","content":"yo"}]` → the same roles, each content `[{"type":"text","text":...}]`.
  - `test_tool_round_trip`: an assistant message with `content: None` and one tool call (`id "tc_1"`, `name "search"`, `arguments '{"q":"x"}'`), then `{"role":"tool","tool_call_id":"tc_1","content":"r"}` → assistant `[{"type":"tool_use","id":"tc_1","name":"search","input":{"q":"x"}}]`, then user `[{"type":"tool_result","tool_use_id":"tc_1","content":"r"}]`.
  - `test_parallel_tool_results_merge`: two tool calls and two tool messages → exactly one user message holding two `tool_result` blocks, in call order.
  - `test_leading_assistant_dropped`: `[assistant "hello", user "q"]` → only the user message.
  - `test_empty_assistant_text_skipped`: assistant `content: ""` with no tool calls → message omitted.
  - `test_tool_defs_raw_schema_verbatim` and `test_tool_defs_from_parameters`: `input_schema` equals `raw_schema`, or equals `_params_to_json_schema(...)`.
- [ ] **Step 2: Run them.** `./venv/Scripts/python -m pytest tests/core/test_anthropic_adapter.py -v`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the two functions above.
- [ ] **Step 4: Run them again.** Expected: PASS.

### Task 3: `LLMClient` gains the `"anthropic"` provider

**Files:**
- Modify: `apps/ai/core/llm.py`. Add branches in `_real_complete` (~line 540), `_real_stream` (~677) and `_real_complete_with_tools` (~813), plus three new methods next to `_openai_*`.
- Modify: `apps/ai/core/anthropic_adapter.py` (request and response helpers)
- Test: `apps/ai/tests/core/test_llm_anthropic.py` (patches `anthropic.AsyncAnthropic` with a fake; no network)

**Interfaces:**
- Consumes: `to_anthropic_messages`, `tool_defs_to_anthropic` (Task 2), settings (Task 1).
- Produces, in `anthropic_adapter.py`:
  - `request_kwargs(model: str, system: str, messages: list[dict], max_tokens: int | None, json_mode: bool) -> dict`. Returns `model`, `max_tokens=max(max_tokens or 0, settings.ANTHROPIC_MIN_MAX_TOKENS)`, `messages=to_anthropic_messages(...)`, `system` (omitted when empty; when `json_mode`, append the line `Respond with only a single valid JSON value. No prose, no markdown fences.`), `output_config={"effort": settings.ANTHROPIC_EFFORT}`, and, when `ANTHROPIC_FALLBACKS`, `betas=["server-side-fallback-2026-07-01"]` and `fallbacks="default"`. It never sets `temperature` or `thinking`.
  - `read_response(resp) -> tuple[str, list[ToolCall], int, int]`. Text is the join of `text` blocks only. `tool_use` blocks become `ToolCall(id=block.id, name=block.name, arguments=dict(block.input))`. It also returns `usage.input_tokens` and `usage.output_tokens`. It raises `LLMError(f"Claude declined (category={...})")` when `stop_reason == "refusal"`.
- Produces, in `LLMClient`: `_anthropic_complete(model, system, messages, max_tokens, json_mode) -> tuple[str, int, int]`, `_anthropic_stream(model, system, messages) -> AsyncGenerator[str]` (uses `client.beta.messages.stream`, yields `text_stream`), `_anthropic_complete_with_tools(model, system, messages, tools, max_tokens, tool_choice) -> tuple[LLMToolResponse, int, int]`. `tool_choice` `"none"` maps to `{"type":"none"}`; anything else maps to `{"type":"auto"}`. `finish_reason` is `"tool_calls"` when any `tool_use` block is present. All three use one module-level `AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)`, created lazily.
- JSON mode: `complete_json` passes `response_format`. The anthropic branch maps it to `json_mode=True`. Parsing still goes through the existing `safe_json_loads` plus the existing one-shot corrective retry. Callers that pass `response_format={"type":"json_object"}` to `complete` directly (Rex `report.py` / `routes.py`) get the same `json_mode=True`.
- The `_real_*` retry loops re-raise a refusal `LLMError` immediately instead of sleeping through 1/3/9 s. Check: `"Claude declined" in str(e)`.

- [ ] **Step 1: Write the failing tests** against a fake client that records kwargs and returns canned blocks.
  - `test_no_sampling_params_sent`: `complete("anthropic", "claude-opus-5-5", "sys", [...], temperature=0.9)` → the recorded kwargs contain neither `temperature` nor `thinking`.
  - `test_max_tokens_floor`: `max_tokens=4096` is sent as 16000, and 20000 is sent as 20000.
  - `test_text_read_by_block_type`: content `[thinking(""), text("hello")]` → returns `"hello"`.
  - `test_json_mode_adds_instruction`: `complete_json(...)` → the system ends with the JSON line, and the result is the parsed dict from text `'{"a":1}'`.
  - `test_tools_round_trip`: a response with a `tool_use` block → `LLMToolResponse.finish_reason == "tool_calls"`, and arguments are a dict. `tool_choice="none"` sends `{"type":"none"}`.
  - `test_refusal_raises_without_retry`: `stop_reason="refusal"` → `LLMError`, and the fake is called exactly once.
  - `test_openai_path_untouched`: the existing openai branch is still selected for `provider="openai"`.
- [ ] **Step 2: Run them.** `./venv/Scripts/python -m pytest tests/core/test_llm_anthropic.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers, the methods and the three dispatcher branches. Langfuse `usage_details` use the real `input_tokens`/`output_tokens`.
- [ ] **Step 4: Run the full suite.** `./venv/Scripts/python -m pytest -q`. Expected: new tests PASS, and existing tests are no worse than before (record the baseline failure count before starting Task 1).

### Task 4: Point every call site at the main model

**Files (each `("openai", "gpt-6-luna")` becomes the settings-driven pair):**
- `apps/ai/core/llm.py:19`: rename `GPT4O_MINI` to `MAIN_MODEL = (settings.MAIN_LLM_PROVIDER, settings.MAIN_LLM_MODEL)`
- `apps/ai/agents/router.py:4` and its usages: import `MAIN_MODEL`
- `apps/ai/agents/base.py:336-337`: `default_provider = settings.MAIN_LLM_PROVIDER`, `default_model = settings.MAIN_LLM_MODEL`
- Delete the per-agent overrides in `agents/{lex,maya,rex,sage,scout,vega}/agent.py` (Sage and Scout read the deleted `SAGE_MODEL`/`SCOUT_MODEL`), so each inherits from `base.py`
- `apps/ai/agents/planner.py:36`: `PLANNER_MODEL = MAIN_MODEL`
- `apps/ai/agents/rex/report.py:223,482,516`, `apps/ai/briefing.py:120,179,354`, `apps/ai/core/carousel.py:292`, `apps/ai/core/context_routes.py:142`: `*MAIN_MODEL`, or `provider=..., model=...` taken from it
- `apps/ai/agents/router.py:57` example `model_used`: `"claude-opus-5-5"`
- Test: `apps/ai/tests/core/test_main_llm_config.py` (extend)

- [ ] **Step 1: Write the failing test** `test_no_hardcoded_openai_chat_model`: walk `apps/ai/{agents,core,briefing.py}` `*.py` (excluding `tests`) and assert no file contains `"gpt-6-luna"`. Then assert every class in `agents.*.agent` has `default_provider == settings.MAIN_LLM_PROVIDER`.
- [ ] **Step 2: Run it.** Expected: FAIL, listing the files above.
- [ ] **Step 3: Make the replacements.** Leave `_FIXED_TEMPERATURE_MODELS` / `_REASONING_EFFORT_REQUIRED_FOR_TOOLS` in place: they only affect the OpenAI rollback path. Allow-list `core/llm.py` for those two sets in the test.
- [ ] **Step 4: Run** the test, then the full suite. Expected: PASS, with the baseline unchanged.

### Task 5: Cost tracking, evals, and a live smoke check

**Files:**
- Modify: `apps/server/src/modules/admin/admin.costs.ts:1-7`. Add `"claude-opus-5-5": 4.00 / 1_000_000`, `"claude-sonnet-5-5": 2.00 / 1_000_000` and `"claude-haiku-5-5": 0.10 / 1_000_000` (input rate, matching how the existing rows are filled).
- Modify: `apps/ai/evals/harness.py:27-31,59,115-129`. Add Claude prices (`(4.0, 20.0)`, `(2.0, 10.0)`, `(0.10, 0.50)`). Patch `anthropic.resources.beta.messages.AsyncMessages.create` the same way `AsyncCompletions.create` is patched, so `model_override` and token cost work for `claude-` models.
- Create: `apps/ai/scripts/anthropic_smoke.py`. With the real key and `MOCK_MODE=false`, it runs one call each of `complete`, `complete_json`, `stream`, and `complete_with_tools` (one dummy `echo` tool, then the tool result sent back for a final answer). It prints PASS/FAIL per call and exits non-zero on any failure.

- [ ] **Step 1: Run the smoke script.** `cd apps/ai && ./venv/Scripts/python scripts/anthropic_smoke.py`. Expected: four PASS lines (this spends a few cents).
- [ ] **Step 2: Run the evals on Claude** using the existing eval command, then compare scores with the last gpt-6-luna run in `apps/ai/evals/runs/`. Expected: no agent regresses beyond normal run-to-run noise. Any agent that does is reported to the user before rollout. The plan does not tune prompts on its own.
- [ ] **Step 3: Click-through in the app** (`localhost:3001`, chrome-devtools MCP, see memory `reference_local_browser_testing`). Run one action per agent: Maya `draft-content`, Scout `research-topic`, Sage `keyword-research`, Rex `analyze-metrics` and a dashboard prompt, Lex `query-document` (exercises embeddings plus Claude), Vega chat with an MCP tool call, and one handoff button. Expected: each card renders with no 5xx in the server log.

---

## Rollback

Set `MAIN_LLM_PROVIDER=openai` and `MAIN_LLM_MODEL=gpt-6-luna` in `apps/ai/.env` (or the deploy env), then restart the AI service. No code change is needed.
