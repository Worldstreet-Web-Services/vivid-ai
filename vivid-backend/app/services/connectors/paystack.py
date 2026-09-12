"""The Paystack connector: a user's own Paystack account, so the apps the
builder makes can take card, transfer and USSD payments that land in the
user's balance. Vivid never holds money.

`token` is the secret key (sk_test_... or sk_live_...), stored encrypted;
the public key (pk_...) rides in config_json because the browser app needs
it. Verified by listing one transaction, which any secret key may do.
"""
import re

import httpx

from app.core.config import settings
from app.services.models_gateway import http

API = "https://api.paystack.co"
_SECRET = re.compile(r"^sk_(test|live)_[A-Za-z0-9]{20,}$")
_PUBLIC = re.compile(r"^pk_(test|live)_[A-Za-z0-9]{20,}$")


def is_secret_key(value: str) -> bool:
    return bool(_SECRET.match(value or ""))


def is_public_key(value: str) -> bool:
    return bool(_PUBLIC.match(value or ""))


async def verify(token: str, config: dict | None = None) -> dict:
    """Raises on a bad key. `config['public_key']` is required, and must be
    from the same mode (test or live) as the secret."""
    cfg = dict(config or {})
    public = str(cfg.get("public_key") or "").strip()
    if not is_secret_key(token):
        raise ValueError("that is not a Paystack secret key (sk_test_... or sk_live_...)")
    if not is_public_key(public):
        raise ValueError("a Paystack public key (pk_test_... or pk_live_...) is required too")
    mode = "live" if token.startswith("sk_live_") else "test"
    if not public.startswith(f"pk_{mode}_"):
        raise ValueError("the public and secret keys must both be test keys or both live keys")
    try:
        r = await http.client().get(f"{API}/transaction", params={"perPage": 1},
                                    headers={"Authorization": f"Bearer {token}"},
                                    timeout=settings.SUPABASE_API_TIMEOUT)
    except httpx.HTTPError as e:
        raise ValueError(f"could not reach Paystack: {e.__class__.__name__}")
    if r.status_code == 401:
        raise ValueError("Paystack rejected the secret key")
    if r.status_code >= 400:
        raise ValueError(f"Paystack answered {r.status_code}")
    cfg.update({"mode": mode, "public_key": public})
    return {"login": mode, "mode": mode, "config": cfg}


def build_tools(connector) -> dict:
    return {}
