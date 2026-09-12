import json
import logging
import secrets as pysecrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models import Connector, User
from app.builder import supabase
from app.core.config import settings
from app.core.errors import APIError
from app.services.connectors import PROVIDERS, tokens

router = APIRouter(prefix="/connectors", tags=["connectors"])
log = logging.getLogger("vivid.connectors")

#: How long a started OAuth flow may take before its state expires.
OAUTH_STATE_TTL = 600


class ConnectorCreate(BaseModel):
    provider: str
    token: str = ""  # personal access token; empty = public mode
    username: str | None = Field(default=None, max_length=100)
    name: str | None = Field(default=None, max_length=128)
    #: Paystack: the public key that goes into the app; never secret.
    public_key: str | None = Field(default=None, max_length=120)


class ConnectorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: str
    name: str
    mode: str = "public"
    #: Supabase: the projects the token can reach, for picking one to link.
    projects: list[dict] = []
    created_at: datetime


def _out(c: Connector) -> ConnectorOut:
    out = ConnectorOut.model_validate(c)
    out.mode = (c.config_json or {}).get("mode", "authenticated" if c.token else "public")
    out.projects = (c.config_json or {}).get("projects") or []
    return out


@router.get("", response_model=list[ConnectorOut])
async def list_connectors(user: User = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(Connector).where(Connector.user_id == user.id))
    return [_out(c) for c in rows.scalars()]


@router.post("", response_model=ConnectorOut, status_code=201)
async def add_connector(body: ConnectorCreate,
                        user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    provider = PROVIDERS.get(body.provider)
    if provider is None:
        raise HTTPException(status_code=400,
                            detail=f"unknown provider; available: {sorted(PROVIDERS)}")
    try:
        info = await provider.verify(body.token, {"username": body.username,
                                                  "public_key": body.public_key})
    except Exception as e:
        raise HTTPException(status_code=422,
                            detail=f"could not verify {body.provider} credentials: {e}")

    existing = (await db.execute(
        select(Connector).where(Connector.user_id == user.id,
                                Connector.provider == body.provider)
    )).scalar_one_or_none()
    name = body.name or f"{body.provider} ({info['login']})"
    if existing is not None:
        existing.token = tokens.store(body.token)
        existing.config_json = info["config"]
        existing.name = name
        await db.commit()
        return _out(existing)
    connector = Connector(user_id=user.id, provider=body.provider,
                          token=tokens.store(body.token), name=name,
                          config_json=info["config"])
    db.add(connector)
    await db.commit()
    return _out(connector)


@router.delete("/{connector_id}", status_code=204)
async def delete_connector(connector_id: str,
                           user: User = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db)):
    c = await db.get(Connector, connector_id)
    if c is None or c.user_id != user.id:
        raise HTTPException(status_code=404, detail="Connector not found")
    await db.delete(c)
    await db.commit()


@router.post("/{connector_id}/test")
async def test_connector(connector_id: str,
                         user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    c = await db.get(Connector, connector_id)
    if c is None or c.user_id != user.id:
        raise HTTPException(status_code=404, detail="Connector not found")
    provider = PROVIDERS[c.provider]
    try:
        info = await provider.verify(tokens.read(c.token), c.config_json or {})
        return {"ok": True, "account": info["login"], "mode": info["mode"]}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ------------------------------------------------------- supabase oauth
@router.get("/supabase/authorize")
async def supabase_authorize(request: Request, user: User = Depends(get_current_user)):
    """Start the Connect Supabase flow. Returns the URL to send the browser
    to (the route is called with a bearer token, which a redirect could not
    carry). State and the PKCE verifier wait in Redis for the callback."""
    if not supabase.oauth_configured():
        raise APIError(503, "not_configured",
                       "Connecting Supabase with a button is not set up on this "
                       "deployment; paste a personal access token instead.")
    state = pysecrets.token_urlsafe(32)
    verifier, challenge = supabase.pkce_pair()
    await request.app.state.redis.set(
        f"oauth:supabase:{state}", json.dumps({"user_id": user.id, "verifier": verifier}),
        ex=OAUTH_STATE_TTL)
    return {"url": supabase.authorize_url(state, challenge)}


@router.get("/supabase/callback", include_in_schema=False)
async def supabase_callback(request: Request, code: str = "", state: str = "",
                            error: str = "", error_description: str = "",
                            db: AsyncSession = Depends(get_db)):
    """Supabase sends the browser here. No bearer token: the state proves
    who started the flow."""
    if error:
        return _oauth_page(f"Supabase said no: {error_description or error}", ok=False)
    redis = request.app.state.redis
    raw = await redis.get(f"oauth:supabase:{state}") if state else None
    if not raw:
        return _oauth_page("This connection link has expired. Start again from Vivid.",
                           ok=False)
    await redis.delete(f"oauth:supabase:{state}")
    pending = json.loads(raw)
    try:
        grant = await supabase.exchange_code(code, pending["verifier"])
        info = await PROVIDERS["supabase"].verify(grant["access_token"], {})
    except (supabase.SupabaseError, Exception) as e:
        log.warning("supabase oauth exchange failed: %s", e)
        return _oauth_page("Supabase did not complete the connection. Please try again.",
                           ok=False)

    config = {**info["config"], "via": "oauth",
              "expires_at": datetime.now().timestamp() + int(grant.get("expires_in") or 3600)}
    if grant.get("refresh_token"):
        config["refresh_token"] = tokens.store(grant["refresh_token"])
    existing = (await db.execute(
        select(Connector).where(Connector.user_id == pending["user_id"],
                                Connector.provider == "supabase"))).scalar_one_or_none()
    name = f"supabase ({info['login']})"
    if existing is not None:
        existing.token = tokens.store(grant["access_token"])
        existing.config_json = config
        existing.name = name
    else:
        db.add(Connector(user_id=pending["user_id"], provider="supabase",
                         token=tokens.store(grant["access_token"]), name=name,
                         config_json=config))
    await db.commit()
    if settings.SUPABASE_OAUTH_RETURN_URL:
        return RedirectResponse(settings.SUPABASE_OAUTH_RETURN_URL + "?connected=supabase",
                                status_code=302)
    return _oauth_page("Supabase is connected. You can close this window.", ok=True)


def _oauth_page(message: str, ok: bool) -> HTMLResponse:
    colour = "#166534" if ok else "#991b1b"
    return HTMLResponse(
        f"<!doctype html><meta charset='utf-8'><title>Vivid</title>"
        f"<body style='font-family:system-ui;padding:3rem;color:{colour}'>"
        f"<p style='font-size:1.1rem'>{message}</p></body>", status_code=200 if ok else 400)
