from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(default="Untitled app", max_length=120)
    #: Start in build mode with no spec (a developer who knows what they want).
    skip_plan: bool = False


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    spec_md: str | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    mode: str
    spec_md: str | None
    current_snapshot_id: str | None
    backend_mode: str
    published_url: str | None
    created_at: datetime
    updated_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    parts: list
    model: str | None
    created_at: datetime


class ChatIn(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    #: Reference screenshots for plan mode: https or data URLs, at most four.
    images: list[str] = Field(default_factory=list, max_length=4)


class PreviewOut(BaseModel):
    url: str
    sandbox_id: str
    driver: str


class FileOut(BaseModel):
    path: str
    content: str


class FilesOut(BaseModel):
    files: list[str]


class CancelOut(BaseModel):
    cancelled: bool


class SnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    seq: int
    commit_sha: str | None
    summary: str | None
    size_bytes: int
    created_at: datetime


class UsageOut(BaseModel):
    since: str | None
    model_calls: int
    tokens: int
    sandbox_seconds: float
    storage_bytes: int
    cost_usd: float
    by_kind: dict
