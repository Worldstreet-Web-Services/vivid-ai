"""The Supabase connector: a user's own Supabase account, connected once
and usable by every builder project they own.

`token` is a Management API access token: a personal access token the user
pasted (POST /v1/connectors) or the OAuth token from the Connect button
(/v1/connectors/supabase/authorize). OAuth tokens expire; the refresh
token and expiry sit in config_json and `access_token()` renews them.

No chat tools come from this connector: the builder's tools take it as
their backend, the assistant never sees it.
"""
import time

from app.builder import supabase
from app.services.connectors import tokens

#: Renew this long before the recorded expiry.
_REFRESH_MARGIN = 120


async def verify(token: str, config: dict | None = None) -> dict:
    """Who this token belongs to and what it can reach. Raises on a bad
    token, like the GitHub provider."""
    if not token:
        raise ValueError("a Supabase access token is required")
    api = supabase.Management(token)
    orgs = await api.organizations()
    projects = await api.projects()
    login = orgs[0]["name"] if orgs else "supabase"
    cfg = dict(config or {})
    cfg.update({
        "mode": "authenticated",
        "organizations": [{"id": o["id"], "slug": o.get("slug"), "name": o["name"]}
                          for o in orgs],
        "projects": [{"ref": p.ref, "name": p.name, "region": p.region,
                      "status": p.status, "organization_id": p.organization_id}
                     for p in projects],
    })
    return {"login": login, "mode": "authenticated", "config": cfg}


def build_tools(connector) -> dict:
    return {}


async def access_token(db, connector) -> str:
    """A live token, refreshing an expired OAuth token in place."""
    cfg = connector.config_json or {}
    expires_at = cfg.get("expires_at")
    if expires_at and cfg.get("refresh_token") and time.time() > expires_at - _REFRESH_MARGIN:
        fresh = await supabase.refresh(tokens.read(cfg["refresh_token"]))
        connector.token = tokens.store(fresh["access_token"])
        connector.config_json = {
            **cfg,
            "refresh_token": tokens.store(fresh.get("refresh_token") or
                                          tokens.read(cfg["refresh_token"])),
            "expires_at": time.time() + int(fresh.get("expires_in") or 3600),
        }
        await db.commit()
    return tokens.read(connector.token)
