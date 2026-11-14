import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    CHAR,
    BigInteger,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# PostgreSQL Custom ENUM mappings (create_type=False since types exist in DDL)
tenant_status_enum = ENUM(
    "TRIAL", "ACTIVE", "SUSPENDED",
    name="tenant_status",
    create_type=False,
)
membership_role_enum = ENUM(
    "SUPER_ADMIN", "TENANT_ADMIN", "INSTRUCTOR", "STUDENT",
    name="membership_role",
    create_type=False,
)
membership_status_enum = ENUM(
    "INVITED", "ACTIVE", "SUSPENDED", "REMOVED",
    name="membership_status",
    create_type=False,
)
domain_type_enum = ENUM(
    "COGNITIVE", "AFFECTIVE", "PSYCHOMOTOR",
    name="domain_type",
    create_type=False,
)
cognitive_level_enum = ENUM(
    "REMEMBER", "UNDERSTAND", "APPLY", "ANALYSE", "EVALUATE", "CREATE",
    name="cognitive_level",
    create_type=False,
)
resource_type_enum = ENUM(
    "LECTURE_NOTE", "PAST_EXAM", "REFERENCE_BOOK", "LAB_CONTENT", "PROJECT_SPEC", "SOFTWARE_LINK", "EXTERNAL_URL",
    name="resource_type",
    create_type=False,
)
grant_source_type_enum = ENUM(
    "FREE_TIER", "PERSONAL_SUBSCRIPTION", "ONE_TIME_PURCHASE", "INSTITUTION_SEAT",
    name="grant_source_type",
    create_type=False,
)


class Tenant(Base):
    __tablename__ = "tenants"

    tenant_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    status = Column(tenant_status_enum, nullable=False, default="TRIAL")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    memberships = relationship("TenantMembership", back_populates="tenant", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    memberships = relationship("TenantMembership", back_populates="user", cascade="all, delete-orphan")
    devices = relationship("UserDevice", back_populates="user", cascade="all, delete-orphan")


class TenantMembership(Base):
    __tablename__ = "tenant_memberships"

    membership_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id", ondelete="CASCADE"), nullable=False)
    role = Column(membership_role_enum, default="STUDENT", nullable=False)
    status = Column(membership_status_enum, default="ACTIVE", nullable=False)
    cohort_name = Column(String(128), nullable=True)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="memberships")
    tenant = relationship("Tenant", back_populates="memberships")

    __table_args__ = (UniqueConstraint("user_id", "tenant_id", name="uq_tenant_memberships_user_tenant"),)


class UserDevice(Base):
    __tablename__ = "user_devices"

    device_id = Column(UUID(as_uuid=True), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    device_name = Column(String(255), nullable=False)
    os_version = Column(String(64), nullable=True)
    app_version = Column(String(32), nullable=True)
    refresh_token_family_id = Column(UUID(as_uuid=True), nullable=True)
    refresh_token_hash = Column(String(255), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="devices")


class CurriculumVersion(Base):
    __tablename__ = "curriculum_versions"

    version_id = Column(Integer, primary_key=True, autoincrement=True)
    version_code = Column(String(64), unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    published_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    themes = relationship("Theme", back_populates="curriculum_version")


class Theme(Base):
    __tablename__ = "themes"

    theme_id = Column(Integer, primary_key=True, autoincrement=True)
    curriculum_version_id = Column(Integer, ForeignKey("curriculum_versions.version_id", ondelete="RESTRICT"), nullable=False)
    theme_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    total_credit_hours = Column(Integer, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    curriculum_version = relationship("CurriculumVersion", back_populates="themes")
    courses = relationship("Course", back_populates="theme", order_by="Course.course_id")


class Course(Base):
    __tablename__ = "courses"

    course_id = Column(Integer, primary_key=True, autoincrement=True)
    theme_id = Column(Integer, ForeignKey("themes.theme_id", ondelete="CASCADE"), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    credit_hours = Column(Integer, nullable=False)
    general_objective = Column(Text, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    theme = relationship("Theme", back_populates="courses")
    outcomes = relationship("LearningOutcome", back_populates="course", order_by="LearningOutcome.outcome_id")
    resources = relationship("CourseResource", back_populates="course")


class LearningOutcome(Base):
    __tablename__ = "learning_outcomes"

    outcome_id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    description = Column(Text, nullable=False)
    domain = Column(domain_type_enum, default="COGNITIVE", nullable=False)
    level = Column(cognitive_level_enum, default="REMEMBER", nullable=False)
    version = Column(Integer, default=1, nullable=False)

    course = relationship("Course", back_populates="outcomes")


class CourseResource(Base):
    __tablename__ = "course_resources"

    resource_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id", ondelete="CASCADE"), nullable=True)
    type = Column(resource_type_enum, nullable=False)
    title = Column(String(255), nullable=False)
    storage_bucket = Column(String(64), default="course-packages", nullable=False)
    storage_object_key = Column(Text, nullable=False)
    file_size_bytes = Column(BigInteger, default=0, nullable=False)
    sha256_checksum = Column(String(64), nullable=True)
    is_offline_eligible = Column(Boolean, default=True, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    metadata_ = Column("metadata", JSONB, default=dict, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    course = relationship("Course", back_populates="resources")


class FeatureEntitlement(Base):
    __tablename__ = "feature_entitlements"

    entitlement_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id", ondelete="CASCADE"), nullable=True)
    source_type = Column(grant_source_type_enum, nullable=False)
    source_reference_id = Column(UUID(as_uuid=True), nullable=True)
    scope_type = Column(String(64), nullable=False, default="GLOBAL")
    scope_target_id = Column(String(64), nullable=True)
    offline_download_allowed = Column(Boolean, default=True, nullable=False)
    offline_grace_days = Column(Integer, default=7, nullable=False)
    storage_quota_mb = Column(Integer, default=2048, nullable=False)
    ai_monthly_quota = Column(Integer, default=50, nullable=False)
    valid_from = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", backref="entitlements")
    tenant = relationship("Tenant", backref="entitlements")
