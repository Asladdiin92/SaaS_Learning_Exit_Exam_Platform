from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SyncOperationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operation_id: UUID
    type: Literal[
        "exam_attempt.submit",
        "bookmark.upsert",
        "support_case.create",
    ]
    created_at: datetime
    payload: dict[str, Any]


class SyncPushRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_id: UUID
    operations: list[SyncOperationIn] = Field(max_length=100)
