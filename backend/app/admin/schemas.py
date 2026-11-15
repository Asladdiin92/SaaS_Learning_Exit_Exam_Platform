from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class AdminOverviewStats(BaseModel):
    total_users: int
    active_devices: int
    total_institutions: int
    total_attempts: int
    total_orders: int
    total_revenue_etb: float
    total_questions: int
    total_courses: int
    ai_queries_quota_allocated: int
    system_status: str = "HEALTHY"


class AdminUserItem(BaseModel):
    user_id: UUID
    email: str
    full_name: str
    is_email_verified: bool
    created_at: datetime
    membership_count: int = 0
    active_device_count: int = 0
    primary_role: str = "STUDENT"


class AdminUserDetail(BaseModel):
    user_id: UUID
    email: str
    full_name: str
    is_email_verified: bool
    created_at: datetime
    updated_at: datetime
    memberships: List[dict] = []
    devices: List[dict] = []
    entitlements: List[dict] = []
    recent_attempts: List[dict] = []
    recent_orders: List[dict] = []


class AdminUserStatusUpdate(BaseModel):
    is_email_verified: Optional[bool] = None
    role: Optional[str] = None
    cohort_name: Optional[str] = None


class AdminEntitlementGrant(BaseModel):
    offline_download_allowed: bool = True
    storage_quota_mb: int = Field(default=2048, ge=100)
    ai_monthly_quota: int = Field(default=100, ge=0)
    valid_days: int = Field(default=30, ge=1)


class AdminActivityLogItem(BaseModel):
    id: str
    category: str  # AUTH, SYNC, EXAM_GRADING, COMMERCE, SECURITY
    action: str
    actor_email: Optional[str] = None
    description: str
    timestamp: datetime
    status: str = "SUCCESS"  # SUCCESS, WARNING, ERROR
    details: Optional[dict] = None


class AdminCourseItem(BaseModel):
    course_id: int
    theme_id: int
    theme_name: str
    code: str
    title: str
    credit_hours: int
    general_objective: Optional[str] = None
    resource_count: int = 0
    question_count: int = 0


class AdminCourseUpdate(BaseModel):
    title: Optional[str] = None
    credit_hours: Optional[int] = None
    general_objective: Optional[str] = None


class AdminQuestionItem(BaseModel):
    question_id: UUID
    course_id: int
    course_code: str
    question_text: str
    bloom_level: str
    options_count: int
    explanation: Optional[str] = None
    options: List[dict] = []


class AdminQuestionCreate(BaseModel):
    course_id: int
    question_text: str
    bloom_level: str = "APPLY"
    explanation: Optional[str] = None
    options: List[dict] = []  # [{option_label, option_text, is_correct, explanation}]


class AdminProductItem(BaseModel):
    product_id: UUID
    code: str
    name: str
    description: Optional[str] = None
    price_amount: float
    currency: str
    billing_interval: Optional[str] = None
    is_active: bool
    features_summary: List[str] = []


class AdminProductUpdate(BaseModel):
    name: Optional[str] = None
    price_amount: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class AdminOrderItem(BaseModel):
    order_id: UUID
    user_email: str
    product_name: str
    amount: float
    currency: str
    status: str
    provider: Optional[str] = None
    created_at: datetime


class AdminSystemHealth(BaseModel):
    status: str
    api_version: str
    database: dict
    storage: dict
    active_pooler_connections: int
    applied_migrations: int
    uptime_timestamp: str
