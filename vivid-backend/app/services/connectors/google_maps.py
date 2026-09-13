"""The Google Maps connector: one browser API key (Maps JavaScript, Places
and Geocoding enabled) that the apps the builder makes use for address
autocomplete, a map on tracking pages and delivery zones by distance.

The key ships inside the app, so the user restricts it to their site's
domain in Google Cloud; the skill tells them so. Verified by geocoding
one address, which any enabled key may do.
"""
import re

import httpx

from app.core.config import settings
from app.services.models_gateway import http

API = "https://maps.googleapis.com/maps/api/geocode/json"
_KEY = re.compile(r"^AIza[0-9A-Za-z_-]{30,}$")


def is_key(value: str) -> bool:
    return bool(_KEY.match((value or "").strip()))


async def verify(token: str, config: dict | None = None) -> dict:
    key = (token or "").strip()
    if not is_key(key):
        raise ValueError("that is not a Google Maps API key (they start with AIza)")
    try:
        r = await http.client().get(API, params={"address": "Lagos, Nigeria", "key": key},
                                    timeout=settings.SUPABASE_API_TIMEOUT)
    except httpx.HTTPError as e:
        raise ValueError(f"could not reach Google Maps: {e.__class__.__name__}")
    if r.status_code >= 400:
        raise ValueError(f"Google Maps answered {r.status_code}")
    body = r.json() if r.content else {}
    status = body.get("status")
    if status == "REQUEST_DENIED":
        raise ValueError("Google rejected the key: " + (body.get("error_message") or
                         "enable the Geocoding, Places and Maps JavaScript APIs for it"))
    if status not in ("OK", "ZERO_RESULTS"):
        raise ValueError(f"Google Maps answered {status or 'nothing'}")
    return {"login": "browser key", "mode": "live", "config": {"apis": ["maps", "places", "geocoding"]}}


def build_tools(connector) -> dict:
    return {}
