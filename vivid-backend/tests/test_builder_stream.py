"""The UI Message Stream encoder and the collector that stores what was
streamed. A reloaded thread must equal a watched one."""
import json

from app.builder import stream


def test_frame_is_sse_data_line():
    line = stream.frame({"type": "text-delta", "id": "t1", "delta": "hi"})
    assert line.startswith("data: ") and line.endswith("\n\n")
    assert json.loads(line[6:]) == {"type": "text-delta", "id": "t1", "delta": "hi"}
    assert stream.DONE == "data: [DONE]\n\n"
    assert stream.HEADERS["x-vercel-ai-ui-message-stream"] == "v1"


def test_collector_folds_text_and_tools():
    c = stream.PartsCollector()
    for part in [
        stream.start("m1"), stream.start_step(),
        stream.text_start("t1"), stream.text_delta("t1", "Adding "),
        stream.text_delta("t1", "a page."), stream.text_end("t1"),
        stream.tool_input("c1", "write_file", {"path": "src/A.tsx", "content": "x"}),
        stream.tool_output("c1", "Wrote src/A.tsx.\nTypecheck: clean."),
        stream.tool_input("c2", "read_file", {"path": "nope"}),
        stream.tool_error("c2", "error: no such file"),
        stream.finish_step(), stream.data("usage", {"steps": 1}), stream.finish(),
    ]:
        c.add(part)

    assert c.parts == [
        {"type": "step-start"},
        {"type": "text", "text": "Adding a page."},
        {"type": "tool-write_file", "toolCallId": "c1", "state": "output-available",
         "input": {"path": "src/A.tsx", "content": "x"},
         "output": "Wrote src/A.tsx.\nTypecheck: clean."},
        {"type": "tool-read_file", "toolCallId": "c2", "state": "output-error",
         "input": {"path": "nope"}, "errorText": "error: no such file"},
        {"type": "data-usage", "data": {"steps": 1}},
    ]
    assert c.text() == "Adding a page."
    assert stream.text_of(c.parts) == "Adding a page."


def test_collector_keeps_errors_and_aborts():
    c = stream.PartsCollector()
    c.add(stream.error("model down"))
    c.add(stream.abort("cancelled by the user"))
    assert c.parts == [
        {"type": "data-error", "data": {"message": "model down"}},
        {"type": "data-abort", "data": {"reason": "cancelled by the user"}},
    ]
