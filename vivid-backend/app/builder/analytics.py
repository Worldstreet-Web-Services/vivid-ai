"""Rollups over builder_pageviews for the owner's stats screen."""
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import BuilderPageview as PV


async def rollup(db: AsyncSession, project_id: str, days: int = 30) -> dict:
    days = max(1, min(days, 365))
    since = datetime.now(timezone.utc) - timedelta(days=days)
    base = select(PV).where(PV.project_id == project_id, PV.created_at >= since)
    rows = (await db.execute(base)).scalars().all()
    by_day: dict[str, dict] = {}
    pages: dict[str, int] = {}
    refs: dict[str, int] = {}
    devices: dict[str, int] = {}
    countries: dict[str, int] = {}
    visitors: set[str] = set()
    for r in rows:
        day = r.created_at.strftime("%Y-%m-%d")
        d = by_day.setdefault(day, {"date": day, "pageviews": 0, "visitors": set()})
        d["pageviews"] += 1
        d["visitors"].add(r.visitor)
        visitors.add(r.visitor)
        pages[r.path] = pages.get(r.path, 0) + 1
        host = urlparse(r.referrer).netloc if r.referrer else "direct"
        refs[host or "direct"] = refs.get(host or "direct", 0) + 1
        devices[r.device] = devices.get(r.device, 0) + 1
        if r.country:
            countries[r.country] = countries.get(r.country, 0) + 1
    top = lambda m, n=10: [{"key": k, "count": v} for k, v in sorted(m.items(), key=lambda kv: -kv[1])[:n]]
    return {
        "days": days,
        "pageviews": len(rows),
        "visitors": len(visitors),
        "by_day": [{"date": v["date"], "pageviews": v["pageviews"], "visitors": len(v["visitors"])}
                   for v in sorted(by_day.values(), key=lambda v: v["date"])],
        "top_pages": top(pages),
        "referrers": top(refs),
        "devices": top(devices, 4),
        "countries": top(countries),
    }
