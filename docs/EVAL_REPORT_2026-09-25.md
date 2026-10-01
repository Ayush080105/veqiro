# Veqiro customer evals: report

> **Update, same day: all findings fixed.** Re-run `apps/ai/evals/runs/20260925-160022`: **38 of 38 cases pass all 3 trials (114/114)**, with no regressions against the run below. All cases are now regression cases, so the whole suite gates releases.
>
> | Finding | Fix | Before → after |
> |---|---|---|
> | 1. Vega emails not sendable | Subject returned in its own field; body cleaned of header lines and markdown. Also applied to draft-reply, meeting follow-up and reschedule. | 0% → 100% |
> | 2. Maya ideas 500 | Null fields fall back to defaults instead of failing validation | 67% → 100% |
> | 3. Rex answered from 25 rows | `query-dataset` now runs model-written, read-only DuckDB SQL over every row it receives (`agents/rex/dataset_sql.py`). The server now sends all stored rows (was 300) and every sheet. | 0% → 100% on all four |
> | 4. Vega ignored memory | Shared rule for all agents: saved facts are answered directly, never redirected | 0% → 100% |
> | 5. Lex dodged "is it risky?" | `explain` opens with a direct answer when the customer asks a question | 67% → 100% |
> | 6. Scout slow | Research depth matched to the question: one discovery call instead of profiling every competitor | 45-74s → 16-28s |
>
> The Instagram-voice case also went from 67% to 100%, but nothing changed there, so treat that as run-to-run variation.
>
> **Still open:**
> - **The 500-row storage cap:** the server still stores at most 500 rows per upload, so larger files are answered over their first 500 rows. Lifting it means storing uploads as Parquet in R2 rather than in the dataset's `meta` JSON, which the dataset list loads in full.
> - **Scout's remaining ~20s** is inside `discover_competitors` itself.
>
> The rest of this document is the original report, before the fixes.

**Date:** 25 Sep 2026 · **Run:** `apps/ai/evals/runs/20260925-152616` · **Model under test:** `gpt-6-luna` (app defaults) · **Judge:** `gemini-3.1-pro-preview`
**Scope:** 38 cases × 3 trials = 114 trials · **Cost:** ≈ $0.08 · **Wall time:** ≈ 3 min

## Summary

Most customer journeys work every time. These are routing, Rex's calculations, Lex's contract reviews and document answers, Maya's posts and memory recall.

The friction sits in five places:

1. Vega's emails can't be sent as written.
2. Maya's idea generation sometimes returns an error.
3. Rex answers whole-file questions about uploaded data from only 25 rows.
4. Vega ignores facts that are in her memory.
5. Scout is slow.

Two of these are small fixes: the Vega email format and the Maya ideas crash. The Rex data gap needs a design change.

| | Result |
|---|---|
| Regression cases passing 3/3 | **28 of 33** |
| Capability cases passing | 0 of 5 (known gaps, expected) |
| Trials that returned an error (HTTP 500) | 1 of 114 |

## Results by agent

| Agent | Tier | Cases | Pass rate | Reliable (3/3) | Median latency |
|---|---|---|---|---|---|
| Rex | regression | 7 | 100% | 7/7 | 3.2s |
| Rex | capability | 4 | 0% | 0/4 | 5.7s |
| Maya | regression | 8 | 92% | 6/8 | 20.0s |
| Lex | regression | 6 | 94% | 5/6 | 25.2s |
| Sage | regression | 1 | 100% | 1/1 | 21.9s |
| Scout | regression | 1 | 100% | 1/1 | 69.7s |
| Vega | regression | 2 | 0% | 0/2 | 3.4s |
| Vega | capability | 1 | 0% | 0/1 | 1.9s |
| Router (team chat) | regression | 8 | 100% | 8/8 | 1.8s |

"Reliable" means the case passed all 3 trials. A customer judges an agent by whether it works every time they try it, and an agent that works 2 times out of 3 feels broken.

## Where the friction is

Failed checks across all trials, grouped by what the customer would experience:

| What the customer experiences | Failed checks |
|---|---|
| Wrong answer | 15 |
| Didn't do what was asked | 8 |
| Has to edit before posting or sending | 6 |
| Got no answer (error) | 1 |
| Blank card | 0 |
| Made something up | 0 |

No trial invented a number, fact or quote. Every "made something up" check passed, including invented figures in posts and emails, fake contract quotes, and a penalty clause that doesn't exist.

## Findings, by priority

### 1. Vega's emails can't be sent as written (0 of 6 trials passed)
- **What happens:** `compose-email` puts `**To:** … **Subject:** …` in markdown at the top of the email body. The subject field comes back empty when the customer leaves it blank.
- **Customer impact:** the Gmail draft shows literal asterisks and header lines. The customer has to clean up every email before sending it, including investor updates.
- **Cases:** `vega.compose.investor_update`, `vega.compose.hinglish_instructions`.
- **Fix:** return the subject in its own field, and keep the body plain text with no header lines. This is a small prompt and parsing change in `agents/vega/routes.py`, `compose_email`.

### 2. Maya's idea generation sometimes returns an error (1 of 3 trials)
- **What happens:** the model returned `visual_description: null` and the `ContentIdea` model rejected it, so the request failed with an HTTP 500 ("Idea generation returned unparseable data — retry").
- **Customer impact:** the customer sees an error instead of ideas and has to retry.
- **Case:** `maya.ideas.five_distinct`.
- **Fix:** make `visual_description` (and other optional text fields) default to `""` when the model returns null. This is a one-line schema change in `agents/maya/routes.py`.

### 3. Rex answers whole-file questions from 25 rows (0 of 12 trials, known gap)
- **What happens:** `query-dataset` puts only the first 25 rows of an upload in the prompt (`_sheet_context`). On a 320-row orders export, Rex answered the top city, the number of returns, March revenue and the best month from that sample. It does say it only saw 25 rows, but the customer still gets no answer.
- **Customer impact:** the questions owners ask most (totals, counts, rankings) fail on any real-sized file. The test file is built so the first 25 rows point to Delhi while the whole file points to Mumbai. A sampled answer would send the ad budget to the wrong city.
- **Cases:** `rex.orders.top_city`, `returns_count`, `march_revenue_hinglish`, `best_month`.
- **Fix:** compute answers over the whole file. The proposed design is text-to-SQL on DuckDB: the model writes a read-only query, we run it on the full data, and the model explains the result. These four cases become the acceptance test.

### 4. Vega ignores facts in her memory (0 of 3 trials, capability)
- **What happens:** asked "what's our MRR right now?", Vega replied "Head to Rex for the current figure", even though "MRR is ₹18.4 lakh" was in the memory she was given.
- **Customer impact:** the customer is sent to another agent for something Vega already knows. Memory is meant to be shared across the whole team of agents.
- **Case:** `memory.cross_agent_fact`.
- **Fix:** change Vega's scope rules so she answers from memory first and only redirects when she doesn't have the answer.

### 5. Lex doesn't answer "is it risky?" directly (1 of 3 trials)
- **What happens:** the customer asked in Hinglish what an indemnity clause means and whether it's risky. Lex explained the consequences well but never said "yes, it's risky".
- **Customer impact:** the customer has to work out the answer to the question they actually asked.
- **Case:** `lex.explain.hinglish`.
- **Fix:** have `explain` lead with a direct answer when the customer's context asks a yes/no question.

### 6. Scout is slow
- **What happens:** a competitor question took 23-74s, and over 100s when several requests ran at the same time. The answers themselves were good.
- **Customer impact:** a minute or more of waiting in chat.
- **Case:** `scout.chat.competitors`.
- **Next step:** profile the web-search and scraping steps, and cap or parallelise the pages fetched.

### Minor
- **Maya's Instagram voice (1 of 3 trials):** one caption read as corporate rather than warm and playful. This is worth watching but not acting on yet.

## What works every time

- **Routing:** team chat sent 24 of 24 messages to the right agent, including Hinglish ones.
- **Rex's numbers:**
  - It got the runway, MRR growth and churn-spike answers from an uploaded file right.
  - The runway form gave the right result.
  - A casual chat question like "60 lakh in bank, 5 lakh burn" got the correct answer, with no request for data the customer had already given.
- **Lex:**
  - It flags the one-sided contract as high risk, with concrete changes to ask for.
  - It does not over-flag the fair NDA.
  - It answers from the uploaded document using real quotes.
  - It says "not in the document" instead of inventing a clause.
  - Its drafts use the details the customer provided.
- **Maya:**
  - Posts use only the customer's numbers.
  - Tweets fit 280 characters.
  - Revisions follow both instructions.
  - Chat requests produce a post rather than a list of questions.
  - It signs as the founder, using her name from memory.
- **Memory:** a short follow-up question still recalls saved facts, so the fix in `68256c4` holds.

## Method

Adapted from Anthropic's [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents).

- **Customer-shaped cases:**
  - Two fictional Indian businesses with brand kits and saved memory: Kulhad Co., a D2C chai brand, and LedgerLoop, a B2B SaaS.
  - Messages mix English and Hinglish.
  - The uploads are messy, for example `₹1,299` next to a bare `1299`.
  - Each request is exactly what the server sends to the AI service.
- **Grading:**
  - **Code checks first:** exact numbers, blank placeholders, raw markdown, character limits, numbers not traceable to the brief, and quotes not in the document.
  - **LLM judge for the rest:** voice and "did it bounce the question back". It is a different model family from the agents, and every criterion is a yes/no.
  - **Expected answers** are computed from the fixture files, not typed in by hand.
- **Balanced cases:** a bad contract is paired with a fair one, and a question the document answers with one it doesn't. An agent can't score well by flagging everything or answering everything.
- **Three trials per case**, reported as a pass rate and as reliability (all 3 passed).
- **Two tiers:** *regression* cases must stay at 100%, and a failure blocks release. *Capability* cases track known gaps.
- **Isolation:** evals run the real app in-process with no database, no Langfuse, no brand-kit fetches, no video generation and stubbed images. They make real OpenAI and Gemini text calls and real web searches.
- **Validating the cases:** every failure's transcript was read before it was counted. In the first rounds, 7 of 12 failures were mistakes in the cases, not the agents: wrong fields checked, the judge not seeing the brand kit, and criteria that were stricter than intended. They were fixed before this run.

## Limitations

- **Small sample:** there are 38 cases, and several agents have only 1-2 of them (Sage, Scout, Vega). A pass here is a signal, not proof of quality.
- **Shared judge risk:** one judge model grades style and helpfulness. Its verdicts matched a human read of the transcripts reviewed so far, but they haven't been checked systematically.
- **Coverage gaps:**
  - No Gmail- or Calendar-connected flows (inbox triage, replying to a real email), because they need live accounts.
  - No image quality checks.
  - No video.
- **Latency depends on concurrency:** the evals run 6 requests at a time, which inflates the timings for the slow agents.

## Next steps

1. **Fix findings 1 and 2** (Vega email format, Maya ideas crash), then re-run with `--baseline evals/runs/20260925-152616` to confirm they pass and nothing else moved.
2. **Run `python -m evals.run --tier regression` before each AI deploy.** It exits with code 1 on any regression.
3. **Plan the Rex whole-file fix** (finding 3). The four `rex.orders.*` cases are its acceptance test.
4. **Grow the set to 20-50 cases per agent from real customer failures,** starting with support tickets and anything reported in chat.

## Appendix: every case

| Case | Tier | Pass | Most common failure |
|---|---|---|---|
| `rex.dataset.churn_spike` | regression | 100% | |
| `rex.dataset.runway_from_upload` | regression | 100% | |
| `rex.dataset.mrr_added` | regression | 100% | |
| `rex.orders.top_city` | capability | 0% | named Delhi, not Mumbai (sampled 25 rows) |
| `rex.orders.returns_count` | capability | 0% | did not give 27 (sampled 25 rows) |
| `rex.orders.march_revenue_hinglish` | capability | 0% | did not give ₹86,717 (sampled 25 rows) |
| `rex.orders.best_month` | capability | 0% | did not name January (sampled 25 rows) |
| `rex.orders.chart_request` | regression | 100% | |
| `rex.runway.endpoint` | regression | 100% | |
| `rex.chat.runway_casual` | regression | 100% | |
| `maya.draft.linkedin_milestone` | regression | 100% | |
| `maya.draft.tweet_fits` | regression | 100% | |
| `maya.draft.instagram_voice` | regression | 67% | voice read as corporate ×1 |
| `maya.ideas.five_distinct` | regression | 67% | HTTP 500 on null `visual_description` ×1 |
| `maya.revise.shorter_no_hashtags` | regression | 100% | |
| `maya.chat.writes_post` | regression | 100% | |
| `maya.chat.hinglish_diwali` | regression | 100% | |
| `maya.chat.uses_memory_signoff` | regression | 100% | |
| `lex.review.one_sided_msa` | regression | 100% | |
| `lex.review.fair_nda_not_alarmist` | regression | 100% | |
| `lex.ask.notice_period` | regression | 100% | |
| `lex.ask.not_in_document` | regression | 100% | |
| `lex.explain.hinglish` | regression | 67% | didn't answer "is it risky" directly ×1 |
| `lex.draft.nda_uses_given_details` | regression | 100% | |
| `sage.brief.gst_software` | regression | 100% | |
| `vega.compose.investor_update` | regression | 0% | markdown headers in body ×3; not ready to send ×3 |
| `vega.compose.hinglish_instructions` | regression | 0% | markdown headers in body ×3 |
| `memory.short_followup_recalls_fact` | regression | 100% | |
| `memory.cross_agent_fact` | capability | 0% | redirected to Rex instead of using memory ×3 |
| `scout.chat.competitors` | regression | 100% | |
| `router.1` to `router.8` | regression | 100% each | |
