"""The AI SDK UI Message Stream, version 1, over server-sent events.

The builder's chat route answers in this shape so any client built on the
AI SDK (`useChat` with the default transport) renders it with no adapter, and
any other client gets a documented, line-delimited protocol. Spec:
ai-sdk.dev/docs/ai-sdk-ui/stream-protocol. Frames are `data: <json>` and the
stream ends with `data: [DONE]`.

Two things live here: the frame encoder, and `PartsCollector`, which folds the
streamed parts back into the message parts a client would hold after reading
the stream. The collector's output is what gets stored, so a thread reloaded
from the database looks exactly like one that was watched live.
"""
import json
import uuid

MEDIA_TYPE = "text/event-stream"
HEADERS = {
    "x-vercel-ai-ui-message-stream": "v1",
    "Cache-Control": "no-cache, no-transform",
    # Caddy and nginx buffer event streams unless told not to.
    "X-Accel-Buffering": "no",
}
DONE = "data: [DONE]\n\n"


def frame(part: dict) -> str:
    return f"data: {json.dumps(part, ensure_ascii=False)}\n\n"


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


# ---------------------------------------------------------------- parts
def start(message_id: str) -> dict:
    return {"type": "start", "messageId": message_id}


def finish() -> dict:
    return {"type": "finish"}


def start_step() -> dict:
    return {"type": "start-step"}


def finish_step() -> dict:
    return {"type": "finish-step"}


def text_start(text_id: str) -> dict:
    return {"type": "text-start", "id": text_id}


def text_delta(text_id: str, delta: str) -> dict:
    return {"type": "text-delta", "id": text_id, "delta": delta}


def text_end(text_id: str) -> dict:
    return {"type": "text-end", "id": text_id}


def tool_input(call_id: str, name: str, arguments: dict) -> dict:
    return {"type": "tool-input-available", "toolCallId": call_id,
            "toolName": name, "input": arguments}


def tool_output(call_id: str, output) -> dict:
    return {"type": "tool-output-available", "toolCallId": call_id,
            "output": output}


def tool_error(call_id: str, message: str) -> dict:
    return {"type": "tool-output-error", "toolCallId": call_id,
            "errorText": message}


def data(kind: str, payload, data_id: str | None = None) -> dict:
    """A custom part. `kind` becomes `data-<kind>`; the builder uses
    `data-notice` for things like "retrying with a different model" and
    `data-usage` for the turn's token counts."""
    part = {"type": f"data-{kind}", "data": payload}
    if data_id:
        part["id"] = data_id
    return part


def error(message: str) -> dict:
    return {"type": "error", "errorText": message}


def abort(reason: str) -> dict:
    return {"type": "abort", "reason": reason}


# ------------------------------------------------------------ collector
class PartsCollector:
    """Folds streamed parts into the stored message parts.

    Text deltas accumulate into one `text` part per text id. A tool call is
    one `tool-<name>` part whose `state` advances from input-available to
    output-available or output-error. Step markers and data parts are kept
    in order. Errors and aborts are recorded as data parts so a reloaded
    thread still shows that the turn stopped, and why.
    """

    def __init__(self) -> None:
        self.parts: list[dict] = []
        self._text_index: dict[str, int] = {}
        self._tool_index: dict[str, int] = {}

    def add(self, part: dict) -> None:
        kind = part.get("type", "")
        if kind == "text-start":
            self._text_index[part["id"]] = len(self.parts)
            self.parts.append({"type": "text", "text": ""})
        elif kind == "text-delta":
            idx = self._text_index.get(part["id"])
            if idx is not None:
                self.parts[idx]["text"] += part["delta"]
        elif kind == "tool-input-available":
            self._tool_index[part["toolCallId"]] = len(self.parts)
            self.parts.append({"type": f"tool-{part['toolName']}",
                               "toolCallId": part["toolCallId"],
                               "state": "input-available",
                               "input": part["input"]})
        elif kind == "tool-output-available":
            idx = self._tool_index.get(part["toolCallId"])
            if idx is not None:
                self.parts[idx]["state"] = "output-available"
                self.parts[idx]["output"] = part["output"]
        elif kind == "tool-output-error":
            idx = self._tool_index.get(part["toolCallId"])
            if idx is not None:
                self.parts[idx]["state"] = "output-error"
                self.parts[idx]["errorText"] = part["errorText"]
        elif kind == "start-step":
            self.parts.append({"type": "step-start"})
        elif kind.startswith("data-"):
            entry = {"type": kind, "data": part.get("data")}
            if part.get("id"):
                entry["id"] = part["id"]
            self.parts.append(entry)
        elif kind == "error":
            self.parts.append({"type": "data-error",
                               "data": {"message": part.get("errorText", "")}})
        elif kind == "abort":
            self.parts.append({"type": "data-abort",
                               "data": {"reason": part.get("reason", "")}})
        # start, finish, text-end, finish-step carry nothing to keep.

    def text(self) -> str:
        """The message's prose, which is what the model sees as history."""
        return "\n".join(p["text"] for p in self.parts
                         if p.get("type") == "text" and p.get("text")).strip()


def text_of(parts: list[dict]) -> str:
    """Prose of a stored parts list, for building model history."""
    return "\n".join(p.get("text", "") for p in parts
                     if p.get("type") == "text" and p.get("text")).strip()
