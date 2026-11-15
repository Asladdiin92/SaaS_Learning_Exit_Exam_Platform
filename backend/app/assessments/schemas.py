from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StartAttemptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_id: UUID
    mode: Literal["ONLINE", "OFFLINE_PACKAGE"]


class AnswerSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: UUID
    selected_option_id: Optional[UUID] = None
    text_or_code_response: Optional[str] = None
    response_time_seconds: Optional[int] = Field(default=None, ge=0)
    sequence_no: int = Field(default=1, ge=1)


class SubmitAttemptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operation_id: Optional[UUID] = None
    answers: list[AnswerSubmission] = Field(default_factory=list)


class QuestionOptionSnapshotOut(BaseModel):
    option_id: UUID
    option_label: str
    option_text: str


class QuestionSnapshotOut(BaseModel):
    question_id: UUID
    course_id: int
    outcome_id: Optional[int]
    question_text: str
    type: str
    level: str
    difficulty: str
    options: list[QuestionOptionSnapshotOut]


class StartAttemptResponse(BaseModel):
    attempt_id: UUID
    exam_id: UUID
    status: str
    total_questions: int
    question_snapshots: list[QuestionSnapshotOut]


class AnswerSavedResponse(BaseModel):
    attempt_id: UUID
    saved: bool


class OutcomeBreakdownItem(BaseModel):
    outcome_id: int
    total_questions: int
    correct_count: int
    score_percent: float


class ReviewItem(BaseModel):
    question_id: UUID
    selected_option_id: Optional[UUID] = None
    is_correct: Optional[bool] = None
    correct_option_id: Optional[UUID] = None
    explanation: Optional[str] = None
    option_explanations: Optional[dict[str, str]] = None


class AttemptResultResponse(BaseModel):
    attempt_id: UUID
    status: str
    score_percent: float
    correct_count: int
    total_questions: int
    scored_at: datetime
    outcome_breakdown: list[OutcomeBreakdownItem]
    review_items: list[ReviewItem]
