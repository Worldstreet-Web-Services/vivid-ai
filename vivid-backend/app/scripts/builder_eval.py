"""Compare models on the builder's own workload.

    python -m app.scripts.builder_eval                       # the configured slots
    python -m app.scripts.builder_eval --build anthropic/claude-sonnet-5
    python -m app.scripts.builder_eval --only build --out eval.json

Five build prompts on a fresh template and five edit prompts on top of a
built app, each run as one turn on the local sandbox driver. Reports steps,
typecheck failures, tokens, cost and whether the turn finished, per prompt
and in total, and writes JSON so two runs can be diffed.

Needs OPENROUTER_API_KEY and a template with node_modules installed
(BUILDER_TEMPLATE_DIR). Runs against the real model: it costs money.
"""
import argparse
import asyncio
import json
import sys
import time

from app.builder import loop, pricing, routing
from app.builder.loop import TurnRunner
from app.builder.sandbox.local import LocalSandbox
from app.core.config import settings

BUILD_PROMPTS = [
    "A todo app with dark mode: add, complete and delete todos, a toggle for dark mode, "
    "and everything saved in localStorage.",
    "A landing page for a Lagos bakery called Golden Crust: hero, menu with prices in "
    "naira, opening hours, and a contact section.",
    "An expense tracker: add expenses with amount, category and date; show a list, "
    "the total, and totals per category.",
    "A pomodoro timer with 25/5 minute cycles, start, pause and reset, and a count of "
    "completed sessions.",
    "A recipe book: a grid of recipe cards with a dialog showing ingredients and steps, "
    "and a search box that filters by name.",
]

#: Applied in order to the app the first build prompt produced.
EDIT_PROMPTS = [
    "Add a counter page and a nav bar to switch between the todo page and the counter.",
    "Make all buttons rounded and blue.",
    "Install zustand and move the todo state into a zustand store.",
    "Fix the delete button: deleting a todo currently does nothing.",
    "Add a badge next to the title showing how many todos are left.",
]

BREAK_DELETE = ("src/App.tsx", "Remove the delete handler's effect so that the delete "
                "button no longer removes a todo (keep the button). Reply with one word.")


async def run_turn(sandbox, stage, text, history):
    runner = TurnRunner(sandbox, stage, history, text)
    started = time.monotonic()
    async for _ in runner.run():
        pass
    r = runner.result
    cost = 0.0
    priced = True
    for call in r.calls:
        c = await pricing.cost_of(call.model, call.usage)
        if c is None:
            priced = False
        else:
            cost += c
    return {
        "prompt": text, "stage": stage, "model": r.model, "reason": r.reason,
        "steps": r.steps, "typecheck_failures": r.typecheck_failures,
        "retried": r.retried, "tokens_in": r.tokens_in, "tokens_out": r.tokens_out,
        "cost_usd": round(cost, 5) if priced else None,
        "seconds": round(time.monotonic() - started, 1),
    }, runner


async def build_suite(prompts):
    rows = []
    for i, text in enumerate(prompts):
        sandbox = await LocalSandbox.create(settings.BUILDER_TEMPLATE_DIR,
                                            settings.BUILDER_LOCAL_ROOT, f"eval-build-{i}")
        try:
            row, _ = await run_turn(sandbox, routing.BUILD, text, [])
        finally:
            await sandbox.kill()
        rows.append(row)
        _print(row)
    return rows


async def edit_suite(prompts):
    sandbox = await LocalSandbox.create(settings.BUILDER_TEMPLATE_DIR,
                                        settings.BUILDER_LOCAL_ROOT, "eval-edit")
    rows = []
    try:
        row, runner = await run_turn(sandbox, routing.BUILD, BUILD_PROMPTS[0], [])
        _print(row)
        history = [{"role": "user", "content": BUILD_PROMPTS[0]}]
        for text in prompts:
            if text.startswith("Fix the delete button"):
                await run_turn(sandbox, routing.EDIT, BREAK_DELETE[1], history)
            row, runner = await run_turn(sandbox, routing.EDIT, text, history)
            rows.append(row)
            _print(row)
            history.append({"role": "user", "content": text})
    finally:
        await sandbox.kill()
    return rows


def _print(row):
    cost = f"${row['cost_usd']:.4f}" if row["cost_usd"] is not None else "n/a"
    print(f"  [{row['stage']}] {row['reason']:<17} steps={row['steps']:<3} "
          f"tsc_fail={row['typecheck_failures']:<2} tokens={row['tokens_in']}/"
          f"{row['tokens_out']} cost={cost} {row['seconds']}s  {row['prompt'][:60]}",
          flush=True)


def _summary(rows):
    n = len(rows) or 1
    return {
        "prompts": len(rows),
        "finished": sum(r["reason"] == loop.ANSWERED for r in rows),
        "mean_steps": round(sum(r["steps"] for r in rows) / n, 1),
        "typecheck_failures": sum(r["typecheck_failures"] for r in rows),
        "retried": sum(r["retried"] for r in rows),
        "cost_usd": round(sum(r["cost_usd"] or 0 for r in rows), 4),
    }


async def main(args) -> int:
    if not settings.OPENROUTER_API_KEY:
        print("OPENROUTER_API_KEY is not set", file=sys.stderr)
        return 2
    if args.build:
        settings.BUILD_MODEL = args.build
    if args.edit:
        settings.EDIT_MODEL = args.edit
    if args.fallback:
        settings.FALLBACK_MODEL = args.fallback
    print(f"build={settings.BUILD_MODEL} edit={settings.EDIT_MODEL} "
          f"fallback={settings.FALLBACK_MODEL} max_steps={settings.BUILDER_MAX_STEPS}")

    report = {"models": {"build": settings.BUILD_MODEL, "edit": settings.EDIT_MODEL,
                         "fallback": settings.FALLBACK_MODEL}}
    if args.only in (None, "build"):
        print("build prompts:")
        rows = await build_suite(BUILD_PROMPTS[:args.n])
        report["build"] = {"rows": rows, "summary": _summary(rows)}
    if args.only in (None, "edit"):
        print("edit prompts:")
        rows = await edit_suite(EDIT_PROMPTS[:args.n])
        report["edit"] = {"rows": rows, "summary": _summary(rows)}
    for key in ("build", "edit"):
        if key in report:
            print(f"{key}: {json.dumps(report[key]['summary'])}")
    if args.out:
        with open(args.out, "w") as f:
            json.dump(report, f, indent=2)
        print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--build", help="slug for BUILD_MODEL")
    p.add_argument("--edit", help="slug for EDIT_MODEL")
    p.add_argument("--fallback", help="slug for FALLBACK_MODEL")
    p.add_argument("--only", choices=["build", "edit"])
    p.add_argument("--n", type=int, default=5, help="prompts per suite")
    p.add_argument("--out", help="write the JSON report here")
    raise SystemExit(asyncio.run(main(p.parse_args())))
