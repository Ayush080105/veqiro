"""Run the customer evals.

    python -m evals.run                       # everything, 3 trials each
    python -m evals.run --agent maya          # one agent
    python -m evals.run --case rex.orders     # case ids starting with this
    python -m evals.run --tier regression     # only what must never break
    python -m evals.run --model gpt-5.6-luna  # same cases on another OpenAI model
    python -m evals.run --baseline evals/runs/20260925-1400   # show what changed since then

Writes evals/runs/<timestamp>/: report.md (read this), results.json, and one transcript per
case. Exit code 1 if any regression case failed a trial.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from evals import harness


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--agent")
    p.add_argument("--case", help="case id prefix")
    p.add_argument("--tier", choices=["regression", "capability"])
    p.add_argument("--trials", type=int, default=3)
    p.add_argument("--concurrency", type=int, default=6)
    p.add_argument("--model", help="swap every OpenAI chat model for this one")
    p.add_argument("--baseline", help="an earlier run directory to compare against")
    p.add_argument("--list", action="store_true", help="list the cases and exit")
    args = p.parse_args()

    harness.setup_env()
    harness.install_stubs(args.model)
    from evals.cases import all_cases

    cases = [c for c in all_cases()
             if (not args.agent or c.agent == args.agent)
             and (not args.case or c.id.startswith(args.case))
             and (not args.tier or c.tier == args.tier)]
    if args.list:
        for c in cases:
            print(f"{c.tier:<11} {c.id:<42} {c.story[:80]}")
        return 0
    if not cases:
        print("no cases match", file=sys.stderr)
        return 2

    out = harness.AI_ROOT / "evals" / "runs" / datetime.now().strftime("%Y%m%d-%H%M%S")
    (out / "transcripts").mkdir(parents=True)
    model = args.model or "app defaults"
    print(f"{len(cases)} cases × {args.trials} trials | model: {model} | judge: "
          f"{__import__('evals.graders', fromlist=['JUDGE_MODEL']).JUDGE_MODEL}\n")

    def progress(case, r):
        mark = "✓" if r["passed"] else "✗"
        print(f"  {mark} {case.id} #{r['trial']}  {r['latency_s']:.1f}s", file=sys.__stdout__, flush=True)

    # The agents print verbose request logs to stdout; keep them out of the eval output.
    import contextlib
    import io
    import logging
    logging.disable(logging.WARNING)
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        results = asyncio.run(harness.run_all(cases, args.trials, args.concurrency, progress))
    logging.disable(logging.NOTSET)
    summary = summarize(cases, results, args.trials)
    summary["model"] = model
    harness.dump(out / "results.json", {"summary": summary, "trials": results})
    write_transcripts(out / "transcripts", cases, results)
    report = render_report(summary, cases, results, args.trials, load_baseline(args.baseline))
    (out / "report.md").write_text(report, encoding="utf-8")
    print("\n" + report.split("\n## Every case")[0])
    print(f"\nFull report: {out / 'report.md'}")
    return 1 if summary["regression_failures"] else 0


def summarize(cases, results, trials) -> dict:
    by_case = defaultdict(list)
    for r in results:
        by_case[r["case"]].append(r)
    per_case = {}
    for c in cases:
        rs = by_case[c.id]
        passes = sum(r["passed"] for r in rs)
        failed = Counter(g["name"] for r in rs for g in r["grades"] if not g["passed"])
        per_case[c.id] = {
            "agent": c.agent, "tier": c.tier, "pass_rate": passes / len(rs),
            "pass_all": passes == len(rs), "pass_any": passes > 0,
            "p50_latency": sorted(r["latency_s"] for r in rs)[len(rs) // 2],
            "top_failures": failed.most_common(3),
        }
    friction = Counter(g["category"] for r in results for g in r["grades"] if not g["passed"])
    costs = [r["cost_usd"] for r in results if r["cost_usd"] is not None]
    return {
        "cases": per_case, "friction": dict(friction), "trials": trials,
        "cost_usd": round(sum(costs), 4) if costs else None,
        "regression_failures": [cid for cid, s in per_case.items() if s["tier"] == "regression" and not s["pass_all"]],
    }


def load_baseline(path: str | None) -> dict | None:
    if not path:
        return None
    return json.loads((Path(path) / "results.json").read_text(encoding="utf-8"))["summary"]


def _pct(x: float) -> str:
    return f"{x * 100:.0f}%"


def render_report(summary, cases, results, trials, baseline) -> str:
    per = summary["cases"]
    lines = [f"# Veqiro customer evals — {datetime.now():%d %b %Y %H:%M}",
             f"Model: {summary['model']} · {len(cases)} cases × {trials} trials · "
             f"cost ≈ ${summary['cost_usd']}" if summary["cost_usd"] is not None else "", ""]

    # Headline per agent. pass^k is what a customer feels: it worked every time they tried.
    lines += ["## By agent", "", f"| Agent | Tier | Cases | Pass rate | Reliable (pass^{trials}) | p50 latency |",
              "|---|---|---|---|---|---|"]
    groups = defaultdict(list)
    for cid, s in per.items():
        groups[(s["agent"], s["tier"])].append(s)
    for (agent, tier), ss in sorted(groups.items()):
        rate = sum(s["pass_rate"] for s in ss) / len(ss)
        reliable = sum(s["pass_all"] for s in ss)
        lat = sorted(s["p50_latency"] for s in ss)[len(ss) // 2]
        lines.append(f"| {agent} | {tier} | {len(ss)} | {_pct(rate)} | {reliable}/{len(ss)} | {lat:.1f}s |")

    lines += ["", "## Where the friction is", "",
              "Failed checks by what the customer would experience:", ""]
    labels = {"works": "no answer / too slow", "renders": "blank card", "usable": "must edit before using",
              "honest": "made something up", "correct": "wrong answer", "helpful": "didn't do what was asked"}
    for cat, n in sorted(summary["friction"].items(), key=lambda x: -x[1]):
        lines.append(f"- **{labels.get(cat, cat)}** ({cat}): {n}")

    reg = summary["regression_failures"]
    lines += ["", f"## Regressions ({len(reg)})", ""]
    lines += [f"- `{cid}` — {', '.join(f'{n} ×{k}' for n, k in per[cid]['top_failures'])}" for cid in reg] or ["None. Everything that worked still works."]

    if baseline:
        lines += ["", "## Since baseline", ""]
        changed = False
        for cid, s in per.items():
            b = baseline["cases"].get(cid)
            if b and abs(s["pass_rate"] - b["pass_rate"]) >= 1 / trials - 1e-9:
                arrow = "better" if s["pass_rate"] > b["pass_rate"] else "WORSE"
                lines.append(f"- `{cid}` {_pct(b['pass_rate'])} → {_pct(s['pass_rate'])} ({arrow})")
                changed = True
        if not changed:
            lines.append("No case moved by a full trial.")

    lines += ["", "## Every case", "", "| Case | Tier | Pass | Most common failure |", "|---|---|---|---|"]
    known = {c.id: c.known_issue for c in cases}
    for cid, s in per.items():
        why = "; ".join(f"{n} ×{k}" for n, k in s["top_failures"]) or ""
        if known.get(cid) and not s["pass_all"]:
            why += f" — known: {known[cid]}"
        lines.append(f"| `{cid}` | {s['tier']} | {_pct(s['pass_rate'])} | {why} |")
    lines += ["", "Read the transcripts of failing cases before trusting a number. "
              "A case failing every trial usually means the case is wrong, not the agent."]
    return "\n".join(lines)


def write_transcripts(folder: Path, cases, results) -> None:
    by_id = {c.id: c for c in cases}
    for r in results:
        c = by_id[r["case"]]
        body = r["response"]
        if isinstance(body, dict):
            body = {k: v for k, v in body.items() if k != "metadata"}  # tool dumps are huge
        grades = "\n".join(f"- {'✓' if g['passed'] else '✗'} [{g['category']}] {g['name']}"
                           + (f" — {g['detail']}" if g["detail"] and not g["passed"] else "")
                           for g in r["grades"])
        md = (f"# {c.id} — trial {r['trial']} — {'PASS' if r['passed'] else 'FAIL'}\n\n"
              f"**Story:** {c.story}\n\n**Tier:** {c.tier}"
              + (f" · **Known issue:** {c.known_issue}" if c.known_issue else "")
              + f"\n\n**Latency:** {r['latency_s']}s · **Tokens:** {r['tokens']}\n\n"
              f"## Checks\n{grades}\n\n## Request\n```json\n"
              f"{json.dumps(c.payload, indent=1, ensure_ascii=False)[:4000]}\n```\n\n"
              f"## Response\n```json\n{json.dumps(body, indent=1, ensure_ascii=False, default=str)[:12000]}\n```\n")
        (folder / f"{c.id}__t{r['trial']}.md").write_text(md, encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
