"""The design skill loader and the critique round: which recipe a project
gets, what the prompt carries, and how a turn looks at its own page."""
import pytest

from app.builder import loop, routing, screenshots, skills, stream
from app.builder.loop import TurnRunner
from app.core.config import settings
from app.services.models_gateway import code_llm
from tests.builder_fakes import FakeSandbox
from tests.test_builder_loop import ScriptedModel, call, collect


@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "k")
    monkeypatch.setattr(settings, "BUILD_MODEL", "vendor/primary")
    monkeypatch.setattr(settings, "EDIT_MODEL", "vendor/primary")
    monkeypatch.setattr(settings, "FALLBACK_MODEL", "vendor/fallback")
    monkeypatch.setattr(settings, "BUILDER_MAX_STEPS", 4)
    monkeypatch.setattr(settings, "BUILDER_CRITIQUE_ROUNDS", 1)
    monkeypatch.setattr(settings, "BUILDER_CRITIQUE_STEPS", 3)
    monkeypatch.setattr(settings, "CODE_STREAM_RETRIES", 1)
    skills.clear_cache()


def test_recipe_routing_and_block():
    assert skills.available() == ["design"]
    assert skills.recipe_for("an ecommerce website for my sneakers") == "shop"
    assert skills.recipe_for("a booking app for my salon") == "booking"
    assert skills.recipe_for("landing page for a bakery") == "landing"
    assert skills.recipe_for("expense tracker with an admin view") == "dashboard"
    assert skills.recipe_for("todo list") is None
    block = skills.design_block("# Spec\nSell sneakers online", "")
    assert block.startswith("## Design skill\n# Design method")
    assert "Recipe: shop" in block and "Recipe: booking" not in block
    assert "| forest |" in block and "Space Grotesk" in block
    assert "name: design" not in block                      # frontmatter stripped


def test_skill_can_be_turned_off(monkeypatch):
    monkeypatch.setattr(settings, "BUILDER_DESIGN_SKILL", False)
    assert skills.design_block("shop", "") == ""


def test_critique_message_carries_both_shots():
    shots = [screenshots.Shot("desktop", 1280, b"\xff\xd8x"), screenshots.Shot("mobile", 390, b"\xff\xd8y")]
    msg = screenshots.critique_message(shots)
    assert msg["role"] == "user" and msg["content"][0]["text"].startswith("Here is your page")
    assert [p["type"] for p in msg["content"]] == ["text", "text", "image_url", "text", "image_url"]
    assert msg["content"][2]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert shots[0].url is None                             # not stored


async def test_capture_reads_both_files_and_stores(monkeypatch):
    stored = {}

    async def put(key, data, content_type="application/gzip"):
        stored[key] = data
    monkeypatch.setattr(screenshots.blob, "put", put)
    monkeypatch.setattr(screenshots.blob, "presigned_url", lambda k, expires_in=3600: f"https://r2/{k}")
    monkeypatch.setattr(settings, "R2_PREFIX", "t/")
    sb = FakeSandbox({"src/App.tsx": "x"})
    sb.blobs[f"/tmp/vivid-shots-{sb.id}/desktop.jpg"] = b"D"
    sb.blobs[f"/tmp/vivid-shots-{sb.id}/mobile.jpg"] = b"M"
    shots = await screenshots.capture(sb, "p1", "m1-r1")
    assert [(s.name, s.data) for s in shots] == [("desktop", b"D"), ("mobile", b"M")]
    assert shots[0].url == "https://r2/t/projects/p1/shots/m1-r1-desktop.jpg"
    assert any("node scripts/screenshot.mjs http://localhost:5173" in c for c in sb.commands)

    from app.builder.sandbox.base import RunResult
    sb2 = FakeSandbox({"src/App.tsx": "x"})
    sb2.responses.append(("screenshot.mjs", RunResult(1, "", "chromium not found")))
    assert await screenshots.capture(sb2, "p1", "x") == []


async def test_turn_critiques_after_answering(monkeypatch):
    """Write, answer, then a critique round: the model sees two images,
    fixes, answers again. Steps for the fixes come from the extra budget."""
    model = ScriptedModel([
        ("Building.", [call("write_file", {"path": "src/App.tsx", "content": "v1"})]),
        ("Done, take a look.", []),
        ("Tightening the hero spacing.", [call("edit_file", {"path": "src/App.tsx", "old_string": "v1", "new_string": "v2"}, "c2")]),
        ("Adjusted the hero and the phone layout.", []),
    ])
    monkeypatch.setattr(code_llm, "stream_chat", model.stream_chat)

    async def fake_capture(sandbox, project_id, label, store=True):
        return [screenshots.Shot("desktop", 1280, b"D", key=None),
                screenshots.Shot("mobile", 390, b"M", key=None)]
    monkeypatch.setattr(screenshots, "capture", fake_capture)
    monkeypatch.setattr(settings, "BUILDER_MAX_STEPS", 2)     # the critique needs its own budget

    sb = FakeSandbox({"src/App.tsx": "x"})
    runner = TurnRunner(sb, routing.BUILD, [], "a shop", spec_md="# Spec\nA sneaker shop",
                        project_id="p1")
    parts, c = await collect(runner)
    assert runner.result.reason == loop.ANSWERED and runner.result.critique_rounds == 1
    assert runner.result.steps == 4 and sb.files["src/App.tsx"] == "v2"
    critique = [p for p in parts if p["type"] == "data-critique"]
    assert critique[0]["data"]["round"] == 1 and len(critique[0]["data"]["screenshots"]) == 2
    # The third request carried the screenshots as images after the answer.
    third = model.requests[2]["messages"]
    assert third[-1]["role"] == "user" and third[-1]["content"][2]["type"] == "image_url"
    assert "Design skill" in third[0]["content"] and "Recipe: shop" in third[0]["content"]
    assert c.text().endswith("Adjusted the hero and the phone layout.")


async def test_no_critique_without_ui_changes_or_when_off(monkeypatch):
    model = ScriptedModel([("Nothing to change.", [])])
    monkeypatch.setattr(code_llm, "stream_chat", model.stream_chat)
    captured = []

    async def fake_capture(*a, **k):
        captured.append(1)
        return []
    monkeypatch.setattr(screenshots, "capture", fake_capture)
    runner = TurnRunner(FakeSandbox({"src/App.tsx": "x"}), routing.EDIT, [], "hi", project_id="p1")
    await collect(runner)
    assert captured == [] and runner.result.critique_rounds == 0

    model = ScriptedModel([("", [call("write_file", {"path": "src/A.tsx", "content": "z"})]), ("ok", [])])
    monkeypatch.setattr(code_llm, "stream_chat", model.stream_chat)
    runner = TurnRunner(FakeSandbox({"src/App.tsx": "x"}), routing.EDIT, [], "hi", project_id="p1",
                        critique=False)
    await collect(runner)
    assert captured == [] and runner.result.reason == loop.ANSWERED


async def test_generate_image_tool_stores_and_returns_a_path(monkeypatch):
    """The image model's bytes become an asset (store + app file) and the
    model gets the public path back; the per-turn cap holds."""
    from app.builder import images as images_mod
    from app.builder import tools
    from app.services.models_gateway import media
    from tests.test_builder_assets import png

    calls = []

    async def fake_generate(prompt, aspect_ratio="1:1"):
        calls.append((prompt, aspect_ratio))
        return png(64, 64), "image/png"
    monkeypatch.setattr(media, "generate_image", fake_generate)

    added = []

    class FakeAsset:
        def __init__(self, name):
            self.name, self.meta = name, {"width": 64, "height": 64}

    async def fake_add(db, project_id, filename, mime, data):
        added.append((project_id, filename, mime, len(data)))
        return FakeAsset(filename)

    class FakeSession:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        def add(self, row): added.append(("usage", row.kind, row.unit))
        async def commit(self): pass
    monkeypatch.setattr(images_mod.assets, "add", fake_add)
    monkeypatch.setattr(images_mod, "async_session", lambda: FakeSession())
    monkeypatch.setattr(settings, "BUILDER_IMAGES_PER_TURN", 2)

    sb = FakeSandbox({"src/App.tsx": "x"})
    maker = images_mod.ImageMaker("p1", sb)
    out = await tools.execute("generate_image", {"prompt": "a red running sneaker, side view",
                                                 "name": "air-zoom-red", "aspect": "square"},
                              sb, None, maker)
    assert out.text.startswith("Image ready at /uploads/air-zoom-red.png (64x64")
    assert "1 more this turn" in out.text
    assert calls[0][1] == "1:1" and "Photorealistic" in calls[0][0]
    assert added[0] == ("p1", "air-zoom-red.png", "image/png", len(png(64, 64)))
    assert ("usage", "model", "images") in added
    assert sb.blobs["public/uploads/air-zoom-red.png"] == png(64, 64)

    await tools.execute("generate_image", {"prompt": "a white court sneaker", "name": "court"}, sb, None, maker)
    out = await tools.execute("generate_image", {"prompt": "one more please", "name": "third"}, sb, None, maker)
    assert out.text.startswith("error: you have made 2 images this turn")
    out = await tools.execute("generate_image", {"prompt": "x", "name": "Bad Name"}, sb, None, maker)
    assert "describe the picture" in out.text or "lowercase slug" in out.text
    out = await tools.execute("generate_image", {"prompt": "a nice shoe photo", "name": "shoe"}, sb, None, None)
    assert out.text.startswith("error: image generation is not available")
    assert [s["function"]["name"] for s in tools.schemas_for(None, maker)][-1] == "generate_image"
    assert "generate_image" not in [s["function"]["name"] for s in tools.schemas_for(None)]
