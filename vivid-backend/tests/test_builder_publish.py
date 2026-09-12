"""Publishing: the alias and hash rules, the build in the sandbox, and the
Pages direct-upload protocol against a recording HTTP stub."""
import json

import pytest

from app.builder import publish
from app.builder.publish import BuiltSite, Pages, PublishError
from app.core.config import settings
from app.services.models_gateway import http
from tests.builder_fakes import FakeSandbox


def test_alias_and_hash():
    assert publish.alias_for("My Salon App!", "abcdef123456") == "my-salon-app-abcdef"
    assert publish.alias_for("", "0123456789") == "app-012345"
    assert len(publish.alias_for("a" * 80, "0123456789")) <= 28
    # blake3(base64(body) + extension)[:32], as Cloudflare's deploy helper does.
    assert publish.file_hash(b"<html></html>", "index.html") == "4752155c2c0c0320b40bca1d83e8380a"
    assert publish.file_hash(b"x", "a/b/c.js") != publish.file_hash(b"x", "a/b/c.css")
    assert len(publish.file_hash(b"x", "noext")) == 32


def test_public_url_and_configured(monkeypatch):
    monkeypatch.setattr(settings, "CF_PAGES_PROJECT", "vivid-apps")
    assert publish.public_url("todo-abc123") == "https://todo-abc123.vivid-apps.pages.dev"
    monkeypatch.setattr(settings, "BUILDER_PUBLISH_HOST", "{alias}.vividcode.app")
    assert publish.public_url("todo-abc123") == "https://todo-abc123.vividcode.app"
    monkeypatch.setattr(settings, "CF_API_TOKEN", "")
    assert not publish.configured()


async def test_build_site_reads_dist_and_checks_it():
    sb = FakeSandbox({"src/App.tsx": "x", "dist/index.html": "<html>hi</html>",
                      "dist/assets/app.js": "console.log(1)"})
    site = await publish.build_site(sb)
    assert site.files == {"index.html": b"<html>hi</html>", "assets/app.js": b"console.log(1)"}
    assert site.size == len(b"<html>hi</html>") + len(b"console.log(1)")
    assert any(c.startswith("rm -rf dist && npx vite build") for c in sb.commands)

    del sb.files["dist/index.html"]
    with pytest.raises(PublishError, match="no index.html"):
        await publish.build_site(sb)

    from app.builder.sandbox.base import RunResult
    sb.responses.append(("vite build", RunResult(1, "", "error TS2322: bad")))
    with pytest.raises(PublishError, match="build failed"):
        await publish.build_site(sb)


class StubHTTP:
    """Answers the five Pages calls and records them."""

    def __init__(self, project_exists=True, missing=None):
        self.calls = []
        self.project_exists = project_exists
        self.missing = missing

    async def request(self, method, url, headers=None, timeout=None, json=None, data=None, files=None):
        self.calls.append({"method": method, "url": url, "auth": headers["Authorization"],
                           "json": json, "data": data, "files": files})
        return _Resp(self._answer(method, url, json))

    async def get(self, url, headers=None, timeout=None):
        self.calls.append({"method": "GET", "url": url, "auth": headers["Authorization"]})
        return _Resp({"success": True}, 200 if self.project_exists else 404)

    def _answer(self, method, url, body):
        if url.endswith("/upload-token"):
            return {"success": True, "result": {"jwt": "JWT"}}
        if url.endswith("/check-missing"):
            return {"success": True, "result": self.missing if self.missing is not None else body["hashes"]}
        if url.endswith("/assets/upload") or url.endswith("/upsert-hashes"):
            return {"success": True, "result": True}
        if url.endswith("/deployments"):
            return {"success": True, "result": {"id": "dep1", "url": "https://x.pages.dev"}}
        if url.endswith("/pages/projects"):
            return {"success": True, "result": {"name": "vivid-apps"}}
        return {"success": False, "errors": [{"message": f"unexpected {url}"}]}


class _Resp:
    def __init__(self, body, status=200):
        self._body, self.status_code, self.text = body, status, json.dumps(body)

    def json(self):
        return self._body


@pytest.fixture
def cf(monkeypatch):
    monkeypatch.setattr(settings, "CF_API_TOKEN", "cf-token")
    monkeypatch.setattr(settings, "CF_ACCOUNT_ID", "acct")
    monkeypatch.setattr(settings, "CF_PAGES_PROJECT", "vivid-apps")
    stub = StubHTTP()
    monkeypatch.setattr(http, "client", lambda: stub)
    return stub


async def test_deploy_follows_the_direct_upload_protocol(cf):
    site = BuiltSite({"index.html": b"<html></html>", "assets/a.js": b"1"})
    out = await Pages().deploy(site, "todo-abc123", "first")
    assert out["id"] == "dep1"
    urls = [c["url"].split("/client/v4/")[1] for c in cf.calls]
    assert urls == [
        "accounts/acct/pages/projects/vivid-apps",
        "accounts/acct/pages/projects/vivid-apps/upload-token",
        "pages/assets/check-missing",
        "pages/assets/upload",
        "pages/assets/upsert-hashes",
        "accounts/acct/pages/projects/vivid-apps/deployments",
    ]
    token_call, check, upload, upsert, deploy = cf.calls[1:]
    assert token_call["auth"] == "Bearer cf-token" and check["auth"] == "Bearer JWT"
    h_index = publish.file_hash(b"<html></html>", "index.html")
    assert set(check["json"]["hashes"]) == {h_index, publish.file_hash(b"1", "assets/a.js")}
    entry = [e for e in upload["json"] if e["key"] == h_index][0]
    assert entry["metadata"] == {"contentType": "text/html"} and entry["base64"] is True
    assert json.loads(deploy["data"]["manifest"]) == {
        "/index.html": h_index, "/assets/a.js": publish.file_hash(b"1", "assets/a.js")}
    assert deploy["data"]["branch"] == "todo-abc123"
    assert deploy["files"][0][0] == "_redirects" and b"/index.html" in deploy["files"][0][1][1]


async def test_deploy_skips_present_files_and_creates_project(monkeypatch):
    monkeypatch.setattr(settings, "CF_API_TOKEN", "t")
    monkeypatch.setattr(settings, "CF_ACCOUNT_ID", "acct")
    stub = StubHTTP(project_exists=False, missing=[])
    monkeypatch.setattr(http, "client", lambda: stub)
    await Pages().deploy(BuiltSite({"index.html": b"x"}), "a-b", "m")
    urls = [c["url"].split("/client/v4/")[1] for c in stub.calls]
    assert urls[1] == "accounts/acct/pages/projects"            # created
    assert "pages/assets/upload" not in urls                      # nothing missing


async def test_cloudflare_errors_are_publish_errors(monkeypatch):
    monkeypatch.setattr(settings, "CF_API_TOKEN", "t")
    monkeypatch.setattr(settings, "CF_ACCOUNT_ID", "acct")

    class Bad(StubHTTP):
        def _answer(self, method, url, body):
            return {"success": False, "errors": [{"code": 8000000, "message": "token lacks Pages:Edit"}]}
    monkeypatch.setattr(http, "client", lambda: Bad())
    with pytest.raises(PublishError, match="token lacks Pages:Edit"):
        await Pages().deploy(BuiltSite({"index.html": b"x"}), "a-b", "m")
    monkeypatch.setattr(settings, "CF_API_TOKEN", "")
    with pytest.raises(PublishError, match="not configured"):
        Pages()
