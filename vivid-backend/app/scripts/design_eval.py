"""Does the design skill make pages look better? Render each spec twice,
A without the skill and critique, B with them, screenshot both at desktop
and phone widths, publish both, have a different model score them blind,
and write a page that puts every A next to its B.

    python -m app.scripts.design_eval                 # three specs, no publish
    python -m app.scripts.design_eval --publish --out design.json --html design.html
    python -m app.scripts.design_eval --only sneakers --publish

Calls real models and sandboxes; costs a few dollars for the full set.
"""
import argparse
import asyncio
import html
import json
import random
import sys
import time

import httpx

from app.builder import blob, loop, publish, routing, screenshots
from app.builder.images import ImageMaker, available as images_available
from app.builder.loop import TurnRunner
from app.builder.sandbox.manager import manager
from app.core.config import settings
from app.db.models import BuilderProject, User
from app.db.session import async_session
from app.services.models_gateway import http, provider

SPECS = {
    "sneakers": """# Kicks Lagos
## Goal
An online sneaker store for a small Lagos reseller.
## Users
Shoppers; the owner.
## Pages
Home (hero, featured pairs, trust strip, contact); Shop (grid, filter by brand and size); Sneaker (gallery, sizes, add to cart); Cart (drawer with WhatsApp order).
## Data model
Sneaker: id, name, brand, price (naira), sizes, colour, image. Cart in localStorage.
## Integrations
none
## Out of scope
Payments, accounts.
Brand: no logo or photos yet; generate product and hero images; bold, energetic.
""",
    "salon": """# Bisi's Salon
## Goal
Let clients of a Lagos salon book an appointment online.
## Users
Clients; the owner (sees upcoming bookings).
## Pages
Home (hero, services with prices in naira, hours, location); Book (service, date, time slot, name, phone, confirmation); My bookings (lookup by phone, cancel); Admin (today's list).
## Data model
Service: id, name, minutes, price. Booking: id, serviceId, date, time, name, phone, status. localStorage.
## Integrations
none
## Out of scope
Payments, accounts, staff schedules.
Brand: no logo or photos; generate a warm hero image; elegant, soft neutrals with a gold accent.
""",
    "bakery": """# Golden Crust
## Goal
A one-page site for a Lagos bakery: what we bake, prices, hours, how to order.
## Users
Customers.
## Pages
Home only: hero, signature breads and pastries with prices in naira, how ordering works, hours and location, WhatsApp order button, footer.
## Data model
Static content.
## Integrations
none
## Out of scope
Online payment, accounts.
Brand: no logo or photos; generate the bread photos and a hero; warm, editorial.
""",
}

RUBRIC = ("hierarchy", "spacing", "consistency", "readability", "mobile")

JUDGE = """You are judging two versions of the same web page, First and Second, each shown at \
1280px (desktop) then 390px (phone). Score each version from 1 (poor) to 5 (excellent) on: \
hierarchy (what to read first is obvious), spacing (even rhythm, no cramped or empty areas), \
consistency (type, colour, corners, cards agree), readability (contrast, line length, sizes), \
mobile (nothing overflows or wraps badly at 390px; actions reachable). Then one sentence on \
the main difference. Answer with JSON only:
{"first": {"hierarchy": n, "spacing": n, "consistency": n, "readability": n, "mobile": n},
 "second": {...same keys...}, "note": "..."}"""


async def _eval_user(db) -> User:
    from sqlalchemy import select
    user = (await db.execute(select(User).where(User.email == "design-eval@vivid.local"))).scalar_one_or_none()
    if user is None:
        user = User(email="design-eval@vivid.local", password_hash="x", name="Design eval")
        db.add(user)
        await db.commit()
    return user


async def run_variant(slug: str, spec: str, variant: str, do_publish: bool) -> dict:
    on = variant == "b"
    settings.BUILDER_DESIGN_SKILL = on
    async with async_session() as db:
        user = await _eval_user(db)
        project = BuilderProject(owner_id=user.id, name=f"eval {slug} {variant}", mode="build", spec_md=spec)
        db.add(project)
        await db.commit()
        pid = project.id
    sandbox = await manager.create_fresh(pid)
    started = time.monotonic()
    try:
        runner = TurnRunner(sandbox, routing.BUILD, [], "Build the first version from the spec.",
                            spec_md=spec, project_id=pid, critique=on,
                            images=ImageMaker(pid, sandbox) if images_available() else None,
                            keepalive=lambda: sandbox.touch())
        async for _ in runner.run():
            pass
        r = runner.result
        shots = await screenshots.capture(sandbox, pid, f"eval-{slug}-{variant}")
        url = None
        if do_publish and publish.configured():
            try:
                site = await publish.build_site(sandbox)
                await publish.Pages().deploy(site, f"eval-{slug}-{variant}", f"design eval {slug} {variant}")
                url = publish.public_url(f"eval-{slug}-{variant}")
            except publish.PublishError as e:
                url = f"publish failed: {e}"
    finally:
        await sandbox.kill()
    return {"variant": variant, "project_id": pid, "reason": r.reason, "steps": r.steps,
            "model": r.model, "typecheck_failures": r.typecheck_failures,
            "critique_rounds": r.critique_rounds, "tokens_in": r.tokens_in,
            "tokens_out": r.tokens_out, "seconds": round(time.monotonic() - started),
            "shots": {s.name: s.url for s in shots}, "shot_data": {s.name: s.data_url for s in shots},
            "url": url}


async def judge(a: dict, b: dict) -> dict:
    """Blind, randomised order. Returns scores keyed back to a and b."""
    ep = provider.openrouter_model(settings.DESIGN_JUDGE_MODEL, role="judge")
    first, second = random.sample([("a", a), ("b", b)], 2)
    content = [{"type": "text", "text": JUDGE}]
    for label, run in ((f"First", first[1]), ("Second", second[1])):
        for name in ("desktop", "mobile"):
            if name in run["shot_data"]:
                content.append({"type": "text", "text": f"{label}, {name}:"})
                content.append({"type": "image_url", "image_url": {"url": run["shot_data"][name]}})
    payload = {"model": ep.model, "messages": [{"role": "user", "content": content}],
               "max_tokens": 600, "temperature": 0, **ep.extra_payload}
    try:
        r = await http.client().post(ep.url(), json=payload, headers=ep.headers, timeout=180)
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        text = text[text.find("{"): text.rfind("}") + 1]
        verdict = json.loads(text)
    except (httpx.HTTPError, ValueError, KeyError, IndexError) as e:
        return {"error": f"judge failed: {e}"}
    out = {first[0]: verdict.get("first", {}), second[0]: verdict.get("second", {}),
           "note": verdict.get("note", ""), "order": [first[0], second[0]]}
    for k in ("a", "b"):
        out[k]["total"] = sum(int(out[k].get(r, 0) or 0) for r in RUBRIC)
    return out


def _cell(run: dict) -> str:
    imgs = "".join(
        f'<figure><img src="{html.escape(run["shots"].get(n) or "")}" alt="{n}"><figcaption>{n}</figcaption></figure>'
        for n in ("desktop", "mobile") if run["shots"].get(n))
    link = f'<a href="{html.escape(run["url"])}">{html.escape(run["url"])}</a>' if run.get("url", "").startswith("http") else html.escape(run.get("url") or "")
    return (f'<div class="run"><h3>{run["variant"].upper()}</h3>{imgs}'
            f'<p>{run["reason"]}, {run["steps"]} steps, critique rounds {run["critique_rounds"]}, '
            f'{run["seconds"]}s<br>{link}</p></div>')


def write_html(report: dict, path: str) -> None:
    rows = []
    for slug, item in report["specs"].items():
        j = item.get("judge", {})
        score = (f'A {j.get("a", {}).get("total", "?")} vs B {j.get("b", {}).get("total", "?")}'
                 if "error" not in j else j["error"])
        rows.append(f'<section><h2>{slug} <small>{html.escape(score)}</small></h2>'
                    f'<p class="note">{html.escape(j.get("note", ""))}</p>'
                    f'<div class="pair">{_cell(item["a"])}{_cell(item["b"])}</div></section>')
    doc = f"""<!doctype html><meta charset="utf-8"><title>Design eval</title>
<style>body{{font:14px system-ui;margin:24px;color:#111}} .pair{{display:grid;grid-template-columns:1fr 1fr;gap:24px}}
.run img{{max-width:100%;border:1px solid #ddd;border-radius:6px;margin:4px 0}} figure{{margin:0 0 8px}} figcaption{{color:#666;font-size:12px}}
h2 small{{color:#444;font-weight:400;margin-left:12px}} .note{{color:#444}} section{{margin-bottom:48px}}</style>
<h1>Design eval: A without the skill, B with skill and critique</h1>
<p>Models: build {html.escape(report["models"]["build"])}, judge {html.escape(report["models"]["judge"])}. Totals: {html.escape(json.dumps(report["summary"]))}</p>
{''.join(rows)}"""
    with open(path, "w") as f:
        f.write(doc)


async def main(args) -> int:
    if not settings.OPENROUTER_API_KEY:
        print("OPENROUTER_API_KEY is not set", file=sys.stderr)
        return 2
    chosen = {k: v for k, v in SPECS.items() if not args.only or k in args.only}
    report = {"models": {"build": settings.BUILD_MODEL, "judge": settings.DESIGN_JUDGE_MODEL},
              "specs": {}}
    totals = {"a": 0, "b": 0, "judged": 0}
    for slug, spec in chosen.items():
        print(f"== {slug}", flush=True)
        item = {}
        for variant in ("a", "b"):
            try:
                item[variant] = await run_variant(slug, spec, variant, args.publish)
            except Exception as e:                 # one broken run must not end the eval
                item[variant] = {"variant": variant, "project_id": "", "reason": "crashed",
                                 "error": f"{e.__class__.__name__}: {str(e)[:200]}", "steps": 0,
                                 "critique_rounds": 0, "seconds": 0, "shots": {}, "shot_data": {},
                                 "url": None}
                print(f"   {variant.upper()}: crashed: {item[variant]['error']}", flush=True)
                continue
            r = item[variant]
            print(f"   {variant.upper()}: {r['reason']} steps={r['steps']} critique={r['critique_rounds']} "
                  f"{r['seconds']}s shots={list(r['shots'])} {r['url'] or ''}", flush=True)
        if item["a"]["shots"] and item["b"]["shots"]:
            item["judge"] = await judge(item["a"], item["b"])
        else:
            item["judge"] = {"error": "a variant produced no screenshots"}
        j = item["judge"]
        if "error" not in j:
            totals["a"] += j["a"]["total"]; totals["b"] += j["b"]["total"]; totals["judged"] += 1
            print(f"   judge: A {j['a']['total']} vs B {j['b']['total']} (order shown {j['order']}) {j['note']}", flush=True)
        else:
            print("   judge:", j["error"], flush=True)
        for v in ("a", "b"):
            item[v].pop("shot_data", None)
        report["specs"][slug] = item
    report["summary"] = totals
    print("summary:", json.dumps(totals))
    if args.out:
        with open(args.out, "w") as f:
            json.dump(report, f, indent=2)
        print("wrote", args.out)
    if args.html:
        write_html(report, args.html)
        print("wrote", args.html)
    if not args.keep:
        async with async_session() as db:
            for item in report["specs"].values():
                for v in ("a", "b"):
                    row = (await db.get(BuilderProject, item[v]["project_id"])
                           if item[v].get("project_id") else None)
                    if row is not None:
                        await db.delete(row)
            await db.commit()
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--only", nargs="*", help="spec slugs to run")
    p.add_argument("--publish", action="store_true", help="publish both variants to Pages")
    p.add_argument("--out", help="JSON report path")
    p.add_argument("--html", help="HTML side-by-side report path")
    p.add_argument("--keep", action="store_true", help="keep the eval project rows")
    raise SystemExit(asyncio.run(main(p.parse_args())))
