from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class AITutorMessageRequest(BaseModel):
    course_id: Optional[int] = None
    question_id: Optional[UUID] = None
    prompt: str = Field(..., min_length=1, max_length=2000)


class CitationItem(BaseModel):
    resource_id: Optional[str] = None
    title: str
    chunk_index: Optional[int] = None
    relevance_score: float = Field(default=0.85, ge=0.0, le=1.0)


class DistractorRationaleItem(BaseModel):
    option_label: str
    is_correct: bool
    rationale: str


class AITutorMessageResponse(BaseModel):
    tutor_response: str
    concept_summary: str
    step_by_step_explanation: str
    distractor_analysis: List[DistractorRationaleItem] = Field(default_factory=list)
    citations: List[CitationItem] = Field(default_factory=list)
    remaining_monthly_quota: int = Field(default=50, ge=0)
