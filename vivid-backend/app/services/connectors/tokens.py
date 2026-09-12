"""Connector tokens at rest.

Written encrypted (Fernet, SECRETS_ENCRYPTION_KEY) whenever the key is
configured; rows written before that, or on a deployment without the key,
stay plaintext and still read. A Fernet token always starts with "gAAAA",
which no GitHub or Supabase token does, so the two are told apart safely.
"""
from app.builder import secrets

_FERNET_PREFIX = "gAAAA"


def store(token: str) -> str:
    if token and secrets.configured():
        return secrets.encrypt(token)
    return token


def read(stored: str | None) -> str:
    if not stored:
        return ""
    if stored.startswith(_FERNET_PREFIX) and secrets.configured():
        return secrets.decrypt(stored)
    return stored
