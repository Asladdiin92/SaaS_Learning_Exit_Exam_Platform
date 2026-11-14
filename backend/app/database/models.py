import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    and_,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    CHAR,
    BigInteger,
    CheckConstraint,
    ForeignKeyConstraint,
    Table,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

course_resource_categories = Table(
    "course_resource_categories",
    Base.metadata,
    Column(
        "resource_id",
        UUID(as_uuid=True),
        ForeignKey("course_resources.resource_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "category_id",
        Integer,
        ForeignKey("resource_categories.category_id", ondelete="RESTRICT"),
        primary_key=True,
    ),
)

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
difficulty_level_enum = ENUM(
    "EASY", "MEDIUM", "HARD",
    name="difficulty_level",
    create_type=False,
)
exam_type_enum = ENUM(
    "PRACTICE_QUIZ", "COURSE_EXAM", "NATIONAL_EXIT_SIMULATION",
    name="exam_type",
    create_type=False,
)
question_type_enum = ENUM(
    "MULTIPLE_CHOICE", "TRUE_FALSE", "CODING", "ESSAY",
    name="question_type",
    create_type=False,
)
attempt_status_enum = ENUM(
    "IN_PROGRESS", "SUBMITTED", "SCORED", "INVALIDATED",
    name="attempt_status",
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


class RefreshTokenHistory(Base):
    __tablename__ = "refresh_token_history"

    token_hash = Column(CHAR(64), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    device_id = Column(UUID(as_uuid=True), ForeignKey("user_devices.device_id", ondelete="CASCADE"), nullable=False)
    family_id = Column(UUID(as_uuid=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


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
    chapters = relationship(
        "CourseChapter",
        back_populates="course",
        order_by="CourseChapter.chapter_number",
    )


class CourseChapter(Base):
    __tablename__ = "course_chapters"
    __table_args__ = (
        UniqueConstraint("course_id", "chapter_number", name="uq_course_chapters_number"),
        UniqueConstraint("chapter_id", "course_id", name="uq_course_chapters_id_course"),
        CheckConstraint("chapter_number > 0", name="ck_course_chapters_number_positive"),
        CheckConstraint("semester IN (1, 2)", name="ck_course_chapters_semester"),
        CheckConstraint("version > 0", name="ck_course_chapters_version_positive"),
            CheckConstraint(
                "length(trim(academic_year_label)) > 0",
                name="ck_course_chapters_academic_year_not_blank",
            ),
    )

    chapter_id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    chapter_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    academic_year_label = Column(String(32), nullable=False)
    semester = Column(SmallInteger, nullable=False)
    description = Column(Text, nullable=True)
    version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    course = relationship("Course", back_populates="chapters")
    resources = relationship(
        "CourseResource",
        back_populates="chapter",
        primaryjoin=lambda: and_(
            CourseChapter.chapter_id == CourseResource.chapter_id,
            CourseChapter.course_id == CourseResource.course_id,
        ),
        foreign_keys=lambda: [CourseResource.chapter_id],
    )


class ResourceCategory(Base):
    __tablename__ = "resource_categories"
    __table_args__ = (
        CheckConstraint("length(trim(slug)) > 0", name="ck_resource_categories_slug_not_blank"),
        CheckConstraint("length(trim(name)) > 0", name="ck_resource_categories_name_not_blank"),
    )

    category_id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(64), unique=True, nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    resources = relationship(
        "CourseResource",
        secondary=course_resource_categories,
        back_populates="categories",
    )


class ExamBlueprint(Base):
    __tablename__ = "exam_blueprints"

    exam_id = Column(UUID(as_uuid=True), primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="SET NULL"), nullable=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id", ondelete="CASCADE"), nullable=True)
    title = Column(String(255), nullable=False)
    type = Column(exam_type_enum, nullable=False)
    total_questions = Column(Integer, nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    is_offline_eligible = Column(Boolean, nullable=False, default=True)
    reveal_answers_immediately = Column(Boolean, nullable=False, default=True)
    version = Column(Integer, nullable=False, default=1)
    rules_json = Column(JSONB, nullable=False, default=dict)


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    attempt_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_operation_id = Column(UUID(as_uuid=True), unique=True, nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id", ondelete="CASCADE"), nullable=True)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exam_blueprints.exam_id", ondelete="RESTRICT"), nullable=False)
    status = Column(attempt_status_enum, nullable=False, default="IN_PROGRESS")
    question_snapshots = Column(JSONB, nullable=False, default=list)
    score_percent = Column(Numeric(5, 2), nullable=True)
    correct_count = Column(Integer, nullable=True)
    total_questions = Column(Integer, nullable=False)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    scored_at = Column(DateTime(timezone=True), nullable=True)


class Question(Base):
    __tablename__ = "questions"

    question_id = Column(UUID(as_uuid=True), primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    outcome_id = Column(Integer, ForeignKey("learning_outcomes.outcome_id", ondelete="SET NULL"), nullable=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id", ondelete="CASCADE"), nullable=True)
    question_text = Column(Text, nullable=False)
    type = Column(question_type_enum, nullable=False, default="MULTIPLE_CHOICE")
    level = Column(String(32), nullable=False, default="REMEMBER")
    difficulty = Column(difficulty_level_enum, nullable=False)
    explanation = Column(Text, nullable=True)
    version = Column(Integer, nullable=False, default=1)
    is_published = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class QuestionOption(Base):
    __tablename__ = "question_options"

    option_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.question_id", ondelete="CASCADE"), nullable=False)
    option_label = Column(CHAR(1), nullable=False)
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False, default=False)


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"

    answer_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attempt_id = Column(UUID(as_uuid=True), ForeignKey("exam_attempts.attempt_id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.question_id", ondelete="RESTRICT"), nullable=False)
    selected_option_id = Column(UUID(as_uuid=True), ForeignKey("question_options.option_id", ondelete="RESTRICT"), nullable=True)
    text_or_code_response = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=False, default=False)
    response_time_seconds = Column(Integer, nullable=True)
    sequence_no = Column(Integer, nullable=False, default=1)
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_attempt_answers_attempt_question"),
        CheckConstraint(
            "response_time_seconds IS NULL OR response_time_seconds >= 0",
            name="ck_attempt_answers_response_time_nonnegative",
        ),
    )


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
    __table_args__ = (
        ForeignKeyConstraint(
            ["chapter_id", "course_id"],
            ["course_chapters.chapter_id", "course_chapters.course_id"],
            name="fk_course_resources_chapter_course",
            ondelete="SET NULL (chapter_id)",
        ),
    )

    resource_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    chapter_id = Column(Integer, nullable=True)
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
    chapter = relationship(
        "CourseChapter",
        back_populates="resources",
        primaryjoin=lambda: and_(
            CourseChapter.chapter_id == CourseResource.chapter_id,
            CourseChapter.course_id == CourseResource.course_id,
        ),
        foreign_keys=lambda: [CourseResource.chapter_id],
    )
    categories = relationship(
        "ResourceCategory",
        secondary=course_resource_categories,
        back_populates="resources",
    )


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
