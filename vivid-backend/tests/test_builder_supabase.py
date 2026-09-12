"""Phase 4: the Supabase connector (token and OAuth), encrypted connector
tokens, linking a project, the .env the app gets, and the three backend
tools against a stubbed Management API."""
import json

import pytest
from cryptography.fernet import Fernet

from app.builder import supabase, tools
from app.builder.prompt import system_prompt
from app.core.config import settings
from app.services.connectors import supabase as connector
from app.services.connectors import tokens
from tests.builder_fakes import FakeSandbox


class StubAPI:
    """Records calls; answers like api.supabase.com."""
    calls: list = []
    projects_out = [supabase.Project("refone", "One", "org1", "eu-west-1", "ACTIVE_HEALTHY")]
    keys_out = {"url": "https://refone.supabase.co", "anon": "sb_publishable_x",
                "service": "sb_secret_y"}

    def __init__(self, token):
        self.token = token

    async def organizations(self):
        StubAPI.calls.append(("orgs", self.token))
        return [{"id": "org1", "slug": "one", "name": "Acme"}]

    async def projects(self):
        StubAPI.calls.append(("projects", self.token))
        return list(self.projects_out)

    async def api_keys(self, ref):
        StubAPI.calls.append(("keys", ref))
        return dict(self.keys_out)

    async def apply_migration(self, ref, sql, name=None):
        StubAPI.calls.append(("migration", ref, name, sql))
        if "boom" in sql:
            raise supabase.SupabaseError(400, 'syntax error at or near "boom"')

    async def deploy_function(self, ref, slug, code, verify_jwt=True):
        StubAPI.calls.append(("deploy", ref, slug, verify_jwt))
        return {"slug": slug, "version": 3, "url": f"https://{ref}.supabase.co/functions/v1/{slug}"}

    async def set_secrets(self, ref, values):
        StubAPI.calls.append(("secrets", ref, values))


@pytest.fixture(autouse=True)
def stub(monkeypatch):
    StubAPI.calls = []
    monkeypatch.setattr(supabase, "Management", StubAPI)
    monkeypatch.setattr(tools, "Management", StubAPI)
    monkeypatch.setattr(settings, "SECRETS_ENCRYPTION_KEY", Fernet.generate_key().decode())
    return StubAPI


# ------------------------------------------------------------ tokens
def test_tokens_encrypt_when_configured_and_read_legacy(monkeypatch):
    stored = tokens.store("sbp_plain")
    assert stored.startswith("gAAAA") and tokens.read(stored) == "sbp_plain"
    assert tokens.read("ghp_legacy_plaintext") == "ghp_legacy_plaintext"
    assert tokens.read(None) == ""
    monkeypatch.setattr(settings, "SECRETS_ENCRYPTION_KEY", "")
    assert tokens.store("sbp_plain") == "sbp_plain"


# --------------------------------------------------------- connector
async def test_connector_verify_lists_projects():
    info = await connector.verify("sbp_token", {})
    assert info["login"] == "Acme" and info["mode"] == "authenticated"
    assert info["config"]["projects"][0]["ref"] == "refone"
    assert ("projects", "sbp_token") in StubAPI.calls
    with pytest.raises(ValueError):
        await connector.verify("", {})


async def test_oauth_helpers(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_OAUTH_CLIENT_ID", "cid")
    monkeypatch.setattr(settings, "SUPABASE_OAUTH_CLIENT_SECRET", "sec")
    monkeypatch.setattr(settings, "PUBLIC_BASE_URL", "https://api.vivid.test")
    assert supabase.oauth_configured()
    assert supabase.redirect_uri() == "https://api.vivid.test/v1/connectors/supabase/callback"
    verifier, challenge = supabase.pkce_pair()
    url = supabase.authorize_url("st4te", challenge)
    assert url.startswith("https://api.supabase.com/v1/oauth/authorize?")
    assert "client_id=cid" in url and "code_challenge_method=S256" in url
    assert "state=st4te" in url and "response_type=code" in url


async def test_access_token_refreshes_expired_oauth(monkeypatch):
    class C:
        token = tokens.store("old")
        config_json = {"refresh_token": tokens.store("r1"), "expires_at": 1.0}

    class DB:
        committed = False

        async def commit(self):
            self.committed = True

    async def refresh(rt):
        assert rt == "r1"
        return {"access_token": "new", "refresh_token": "r2", "expires_in": 3600}
    monkeypatch.setattr(supabase, "refresh", refresh)
    db = DB()
    assert await connector.access_token(db, C) == "new"
    assert db.committed and tokens.read(C.config_json["refresh_token"]) == "r2"
    assert C.config_json["expires_at"] > 1.0


# --------------------------------------------------------------- tools
async def test_supabase_tools_need_a_backend_and_never_echo_secrets():
    sb = FakeSandbox({"src/App.tsx": "x"})
    out = await tools.execute("apply_migration", {"name": "a", "sql": "select 1"}, sb)
    assert out.text.startswith("error: apply_migration needs a Supabase backend")

    backend = tools.Backend(ref="refone", token="tok")
    assert [s["function"]["name"] for s in tools.schemas_for(backend)][-3:] == [
        "apply_migration", "deploy_edge_function", "set_secret"]
    assert len(tools.schemas_for(None)) == 6

    out = await tools.execute("apply_migration", {"name": "create_bookings",
                                                  "sql": "create table bookings(id int);"},
                              sb, backend)
    assert out.text == "Migration create_bookings applied."
    assert ("migration", "refone", "create_bookings", "create table bookings(id int);") in StubAPI.calls
    out = await tools.execute("apply_migration", {"name": "Bad Name", "sql": "x"}, sb, backend)
    assert "snake_case" in out.text
    out = await tools.execute("apply_migration", {"name": "oops", "sql": "boom"}, sb, backend)
    assert out.text == 'error: Supabase refused: syntax error at or near "boom"'

    out = await tools.execute("deploy_edge_function",
                              {"name": "send-receipt", "code": "Deno.serve(() => new Response('ok'))"},
                              sb, backend)
    assert "https://refone.supabase.co/functions/v1/send-receipt" in out.text
    assert "version 3" in out.text
    out = await tools.execute("deploy_edge_function", {"name": "Bad", "code": "x"}, sb, backend)
    assert "lowercase slug" in out.text

    out = await tools.execute("set_secret", {"key": "STRIPE_KEY", "value": "sk_live_123"}, sb, backend)
    assert out.text == "Secret STRIPE_KEY set for edge functions."
    assert "sk_live_123" not in out.text
    assert ("secrets", "refone", {"STRIPE_KEY": "sk_live_123"}) in StubAPI.calls
    assert "UPPER_SNAKE_CASE" in (await tools.execute("set_secret", {"key": "lower", "value": "v"}, sb, backend)).text


def test_prompt_gets_the_backend_section_only_when_linked():
    assert "Backend: Supabase" not in system_prompt(None, "ctx")
    text = system_prompt(None, "ctx", backend=True)
    assert "Backend: Supabase" in text and "row level security" in text
    assert "service key is only ever used inside edge functions" in text
