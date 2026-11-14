from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel


class CourseSummary(BaseModel):
    course_id: int
    theme_id: int
    code: str
    title: str
    credit_hours: int
    general_objective: str

    class Config:
        from_attributes = True


class ThemeOut(BaseModel):
    theme_id: int
    theme_number: int
    title: str
    description: Optional[str] = None
    total_credit_hours: int
    courses: List[CourseSummary] = []

    class Config:
        from_attributes = True


class LearningOutcomeOut(BaseModel):
    outcome_id: int
    course_id: int
    description: str
    domain: str
    level: str

    class Config:
        from_attributes = True


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
    outcomes: List[LearningOutcomeOut] = []
    resources: List[ResourceOut] = []

    class Config:
        from_attributes = True
