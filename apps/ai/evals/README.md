# Customer evals

These evals check whether a real customer gets what they came for, first time, without having to fix it. Each case is one thing a customer actually does. It uses a fictional Indian brand with a brand kit and memory, messy uploads and Hinglish messages. It hits the same endpoint the server calls and is graded on what the customer would feel.

The approach follows Anthropic's [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents).

```
cd apps/ai
python -m evals.run                        # all cases, 3 trials each (~2 min, ~$0.10)
python -m evals.run --agent lex            # one agent
python -m evals.run --case rex.orders      # case ids starting with this
python -m evals.run --tier regression      # the gate: must stay at 100%
python -m evals.run --model gpt-5.6-luna   # same cases, another OpenAI model
python -m evals.run --baseline evals/runs/<earlier run>   # what got better or worse
python -m evals.run --list
```

Each run writes `evals/runs/<timestamp>/`, which is gitignored:
- `report.md`: results per agent, where the friction is, regressions, and every case.
- `transcripts/`: one file per trial, holding the request, the response and every check.
- `results.json`: the raw data.

The run exits with code 1 if any regression case fails any trial, so it can gate a deploy.

## Reading the report

- **Pass rate** is the share of trials that passed.
- **Reliable (pass^3)** counts the cases that passed all 3 trials. This is the number a customer feels: an agent that works 2 times out of 3 feels broken.
- **Where the friction is** groups failed checks by what the customer experiences:

| Category | What the customer experiences |
|---|---|
| `works` | They got no answer, or it was too slow |
| `renders` | The card came back blank |
| `usable` | They have to edit it before posting or sending, because of `[Your Name]`, raw `**markdown**`, or a length over the limit |
| `honest` | It made up a number, a fact or a quote |
| `correct` | The answer is wrong |
| `helpful` | It didn't do what they asked, bounced questions back, or used the wrong voice |

**Read transcripts before trusting a number.** If a case fails every trial, the case is usually wrong, not the agent. While these evals were being built, 7 of the first 12 failures turned out to be mistakes in the cases, not in the agents.

## Tiers

- **regression**: works today and must keep working. A failure here blocks a release.
- **capability**: a known gap, with `known_issue` saying why. These fail today, and passing one means progress. Once a capability case passes reliably, move it to regression.

## Adding a case

Take cases from real complaints and real bugs, not from imagination. Add one to `cases/<agent>.py`:

```python
Case(id="maya.draft.tweet_fits", agent="maya", endpoint="/ai/maya/draft-content",
     payload={...exactly what the server sends...},
     graders=[max_chars("draft.body", 280, "a tweet (280)"), ...],
     story="Founder wants one tweet. Over 280 characters, it cannot be posted.")
```

- **Prefer code graders.** `number`, `mentions`, `answers_first`, `max_chars`, `no_placeholders`, `no_markdown`, `grounded_numbers` and `quotes_exist` are cheap, exact, and explain their own failures.
- **Use `judge(...)` only for what code can't check**, such as voice or whether the agent bounced a question back. Write each criterion as a yes/no that two people would agree on. The judge is `gemini-3.1-pro-preview` by default, a different model family from the agents under test. You can override it with `EVAL_JUDGE_MODEL`.
- **Compute expected answers from the fixture**, as `cases/rex.py` does, rather than typing them in.
- **Balance the set.** For every "should flag this" case, add a "should not flag this" case. For example, `lex.review.fair_nda_not_alarmist` stops Lex scoring well by calling everything risky.

## Isolation

`harness.py` runs the real app in-process and cuts it off from everything live:
- no database: the pool raises, and RAG returns the case's fixture chunks;
- no Langfuse or Sentry;
- no brand-kit fetches: personas are seeded into the brand-kit cache;
- no video generation, which raises;
- no image generation, which returns a 1px stub. The cases don't grade pixels, and images cost money.

Web search (Scout, Sage) and the OpenAI and Gemini text calls are real.
