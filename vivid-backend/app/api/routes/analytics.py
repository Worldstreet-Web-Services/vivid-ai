"""Pageviews from published apps.

The publish step puts a tiny snippet in every site's index.html that posts
one line per page view here. The request is plain text so the browser
sends it without a preflight, and the response allows any origin, so the
sites need no CORS entry. No cookies, no personal data: the visitor id is a
salted daily hash of address and user agent, enough to count unique
visitors and nothing more.
"""
import hashlib
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.db.models import BuilderPageview, BuilderProject
from app.services import rate_limit

log = logging.getLogger("vivid.builder.analytics")
router = APIRouter(prefix="/a", tags=["builder-analytics"])

CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "86400",
        "Cache-Control": "no-store"}
_MOBILE = ("mobile", "android", "iphone", "ipad", "ipod")


def visitor_id(ip: str, ua: str, day: str) -> str:
    salt = getattr(settings, "SECRET_KEY", None) or getattr(settings, "JWT_SECRET", None) or "vivid"
    return hashlib.sha256(f"{salt}|{ip}|{ua}|{day}".encode()).hexdigest()[:32]


def device_of(ua: str) -> str:
    low = (ua or "").lower()
    return "mobile" if any(m in low for m in _MOBILE) else "desktop"


@router.options("/{project_id}")
async def preflight(project_id: str):
    return Response(status_code=204, headers=CORS)


@router.post("/{project_id}", status_code=204)
async def collect(project_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    try:
        data = json.loads(body.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        return Response(status_code=204, headers=CORS)          # never an error to a visitor
    if not isinstance(data, dict):
        return Response(status_code=204, headers=CORS)
    path = str(data.get("p") or "/")[:512]
    referrer = (str(data.get("r") or "")[:512]) or None
    ip = (request.headers.get("cf-connecting-ip")
          or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
          or (request.client.host if request.client else ""))
    redis = getattr(request.app.state, "redis", None)
    if redis is not None and not await rate_limit.check_bucket(
            redis, f"pv:{project_id}:{ip}", settings.BUILDER_ANALYTICS_PER_MINUTE):
        return Response(status_code=204, headers=CORS)
    project = await db.get(BuilderProject, project_id)
    if project is None:
        return Response(status_code=204, headers=CORS)
    ua = request.headers.get("user-agent", "")
    now = datetime.now(timezone.utc)
    db.add(BuilderPageview(
        project_id=project_id, path=path, referrer=referrer, device=device_of(ua),
        country=(request.headers.get("cf-ipcountry") or None),
        visitor=visitor_id(ip, ua, now.strftime("%Y-%m-%d")), created_at=now))
    await db.commit()
    return Response(status_code=204, headers=CORS)
