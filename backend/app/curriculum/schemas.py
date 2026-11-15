from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class CourseSummary(BaseModel):
    course_id: int
    theme_id: int
    code: str
    title: str
    credit_hours: int
    general_objective: str
    version: int = 1

    class Config:
        from_attributes = True


class ThemeOut(BaseModel):
    theme_id: int
    theme_number: int
    title: str
    description: Optional[str] = None
    total_credit_hours: int
    version: int = 1
    courses: List[CourseSummary] = Field(default_factory=list)

    class Config:
        from_attributes = True


class LearningOutcomeOut(BaseModel):
    outcome_id: int
    course_id: int
    outcome_code: Optional[str] = None
    description: str
    domain: str
    level: str

    class Config:
        from_attributes = True


class LearningOutcomeGroup(BaseModel):
    domain: str
    level: str
    outcomes: List[LearningOutcomeOut] = Field(default_factory=list)


class ResourceOut(BaseModel):
    resource_id: UUID
    course_id: int
    tenant_id: Optional[UUID] = None
    type: str
    title: str
    file_size_bytes: int
    is_offline_eligible: bool

    class Config:
        from_attributes = True


class CourseDetailOut(BaseModel):
    course_id: int
    theme_id: int
    code: str
    title: str
    credit_hours: int
    general_objective: str
    theme_title: Optional[str] = None
    outcomes: List[LearningOutcomeOut] = Field(default_factory=list)
    learning_outcomes: List[LearningOutcomeGroup] = Field(default_factory=list)
    resource_count: int = 0
    exam_blueprint_count: int = 0

    class Config:
        from_attributes = True


class ExamBlueprintOut(BaseModel):
    exam_id: UUID
    course_id: Optional[int] = None
    title: str
    type: str
    total_questions: int
    duration_seconds: int
    is_offline_eligible: bool
    version: int
    difficulty: str = "MEDIUM"

    class Config:
        from_attributes = True
