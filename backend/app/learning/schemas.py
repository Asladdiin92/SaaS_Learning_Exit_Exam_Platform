from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ProgressSummaryResponse(BaseModel):
    overall_readiness_percent: float = Field(..., ge=0.0, le=100.0)
    active_courses_count: int = Field(..., ge=0)
    total_courses_count: int = Field(..., ge=0)
    validated_attempts_count: int = Field(..., ge=0)
    study_streak_days: int = Field(..., ge=0)
    last_calculated_at: str
    disclaimer: str = (
        "Mastery scores are rolling estimates based on validated practice evidence, "
        "not official university grades."
    )


class ThemeMasteryItem(BaseModel):
    theme_id: int
    theme_number: int
    title: str
    credit_hours: int
    courses_count: int
    mastery_score: float = Field(..., ge=0.0, le=1.0)
    mastery_percentage: float = Field(..., ge=0.0, le=100.0)
    attempted_outcomes_count: int = Field(default=0, ge=0)
    total_outcomes_count: int = Field(default=0, ge=0)


class BloomLevelItem(BaseModel):
    level: str
    display_name: str
    attempted_count: int = Field(default=0, ge=0)
    correct_count: int = Field(default=0, ge=0)
    mastery_score: float = Field(default=0.0, ge=0.0, le=1.0)
    mastery_percentage: float = Field(default=0.0, ge=0.0, le=100.0)


class OutcomeMasteryDetail(BaseModel):
    outcome_id: int
    outcome_code: Optional[str] = None
    description: str
    domain: str
    level: str
    attempts_evidence_count: int = Field(default=0, ge=0)
    correct_evidence_count: int = Field(default=0, ge=0)
    mastery_score: float = Field(default=0.0, ge=0.0, le=1.0)


class CourseMasteryItem(BaseModel):
    course_id: int
    theme_id: int
    code: str
    title: str
    credit_hours: int
    mastery_score: float = Field(default=0.0, ge=0.0, le=1.0)
    mastery_percentage: float = Field(default=0.0, ge=0.0, le=100.0)
    total_outcomes_count: int = Field(default=0, ge=0)
    attempted_outcomes_count: int = Field(default=0, ge=0)
    outcomes: List[OutcomeMasteryDetail] = Field(default_factory=list)


class RecentAttemptSummary(BaseModel):
    attempt_id: UUID
    exam_id: UUID
    exam_title: str
    score_percent: Optional[float] = None
    passed: bool = False
    duration_seconds: Optional[int] = None
    scored_at: Optional[str] = None


class StudentProgressResponse(BaseModel):
    summary: ProgressSummaryResponse
    themes: List[ThemeMasteryItem]
    blooms_distribution: List[BloomLevelItem]
    courses: List[CourseMasteryItem]
    recent_attempts: List[RecentAttemptSummary]
