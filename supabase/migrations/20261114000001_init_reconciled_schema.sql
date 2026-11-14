-- ============================================================================
-- RECONCILED POSTGRESQL SCHEMA BASELINE (LOCAL DOCKER + SUPABASE CLOUD READY)
-- Fixes SAD §2.3 & §14.3: Global Users + Tenant Memberships, Normalized
-- Entitlements, Immutable Question Snapshots, Server-Only Scoring, Opaque Sync,
-- and Supabase Cloud Database + Supabase Storage Bucket/Key Parity (ADR-009)
-- Migration: 20261114000001_init_reconciled_schema.sql
-- ============================================================================

-- 0. Supabase Cloud + Local Docker Compatibility Shim
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;

-- In standalone local Postgres, create minimal "auth" schema & "auth.uid()" helper.
-- On Supabase Cloud, schema "auth" and "auth.uid()" already exist natively.
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'auth' AND p.proname = 'uid'
    ) THEN
        EXECUTE $func$
            CREATE FUNCTION auth.uid() RETURNS uuid
            LANGUAGE sql STABLE
            AS $body$
                SELECT COALESCE(
                    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
                    NULLIF(current_setting('app.current_user_id', true), '')
                )::uuid;
            $body$;
        $func$;
    END IF;
END
$$;

-- Unified helper functions used by all RLS policies in both Dev and Supabase Cloud
CREATE OR REPLACE FUNCTION public.current_app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
    );
$$;

CREATE OR REPLACE FUNCTION public.current_app_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

-- 1. Custom Enumerations
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status') THEN
        CREATE TYPE tenant_status AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_role') THEN
        CREATE TYPE membership_role AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'INSTRUCTOR', 'STUDENT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') THEN
        CREATE TYPE membership_status AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'domain_type') THEN
        CREATE TYPE domain_type AS ENUM ('COGNITIVE', 'AFFECTIVE', 'PSYCHOMOTOR');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cognitive_level') THEN
        CREATE TYPE cognitive_level AS ENUM ('REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYSE', 'EVALUATE', 'CREATE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resource_type') THEN
        CREATE TYPE resource_type AS ENUM ('LECTURE_NOTE', 'PAST_EXAM', 'REFERENCE_BOOK', 'LAB_CONTENT', 'PROJECT_SPEC', 'SOFTWARE_LINK', 'EXTERNAL_URL');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type') THEN
        CREATE TYPE question_type AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'CODING', 'ESSAY');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') THEN
        CREATE TYPE difficulty_level AS ENUM ('EASY', 'MEDIUM', 'HARD');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exam_type') THEN
        CREATE TYPE exam_type AS ENUM ('PRACTICE_QUIZ', 'COURSE_EXAM', 'NATIONAL_EXIT_SIMULATION');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attempt_status') THEN
        CREATE TYPE attempt_status AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'SCORED', 'INVALIDATED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grant_source_type') THEN
        CREATE TYPE grant_source_type AS ENUM ('FREE_TIER', 'PERSONAL_SUBSCRIPTION', 'ONE_TIME_PURCHASE', 'INSTITUTION_SEAT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'DISPUTED');
    END IF;
END $$;

-- 2. Global Identity & Multi-Tenant Workspaces (Fixes ADR-002)
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status tenant_status NOT NULL DEFAULT 'TRIAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    role membership_role NOT NULL DEFAULT 'STUDENT',
    status membership_status NOT NULL DEFAULT 'ACTIVE',
    cohort_name VARCHAR(128),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS user_devices (
    device_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    os_version VARCHAR(64),
    app_version VARCHAR(32),
    refresh_token_family_id UUID,
    refresh_token_hash VARCHAR(255),
    revoked_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Versioned Curriculum & Polymorphic Resources (5 Themes, 15 Courses, 45 Cr)
CREATE TABLE IF NOT EXISTS curriculum_versions (
    version_id SERIAL PRIMARY KEY,
    version_code VARCHAR(64) UNIQUE NOT NULL, -- e.g., 'ETH-BSC-IT-2026-V1'
    title VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS themes (
    theme_id SERIAL PRIMARY KEY,
    curriculum_version_id INT NOT NULL REFERENCES curriculum_versions(version_id) ON DELETE RESTRICT,
    theme_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_credit_hours INT NOT NULL CHECK (total_credit_hours > 0),
    version INT NOT NULL DEFAULT 1,
    UNIQUE (curriculum_version_id, theme_number)
);

CREATE TABLE IF NOT EXISTS courses (
    course_id SERIAL PRIMARY KEY,
    theme_id INT NOT NULL REFERENCES themes(theme_id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    credit_hours INT NOT NULL CHECK (credit_hours > 0),
    general_objective TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS learning_outcomes (
    outcome_id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    domain domain_type NOT NULL DEFAULT 'COGNITIVE',
    level cognitive_level NOT NULL DEFAULT 'REMEMBER',
    version INT NOT NULL DEFAULT 1
);

-- Stores relative (storage_bucket, storage_object_key) for seamless Local Disk <-> Supabase Storage parity
CREATE TABLE IF NOT EXISTS course_resources (
    resource_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = Global Curriculum Resource
    type resource_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    storage_bucket VARCHAR(64) NOT NULL DEFAULT 'course-packages',
    storage_object_key TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    sha256_checksum VARCHAR(64),
    is_offline_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Versioned Question Bank, Blueprints & Immutable Exam Attempts (Fixes ADR-005 & FR-009)
CREATE TABLE IF NOT EXISTS questions (
    question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    outcome_id INT REFERENCES learning_outcomes(outcome_id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = Global Pool
    question_text TEXT NOT NULL,
    type question_type NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    level cognitive_level NOT NULL DEFAULT 'REMEMBER',
    difficulty difficulty_level NOT NULL DEFAULT 'MEDIUM',
    explanation TEXT,
    version INT NOT NULL DEFAULT 1,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS question_options (
    option_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    option_label CHAR(1) NOT NULL, -- 'A', 'B', 'C', 'D'
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS exam_blueprints (
    exam_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id INT REFERENCES courses(course_id) ON DELETE SET NULL, -- NULL for 120-Q Full Exit Simulation
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    type exam_type NOT NULL DEFAULT 'PRACTICE_QUIZ',
    total_questions INT NOT NULL CHECK (total_questions > 0),
    duration_seconds INT NOT NULL CHECK (duration_seconds > 0),
    is_offline_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    reveal_answers_immediately BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    rules_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS exam_attempts (
    attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_operation_id UUID UNIQUE, -- Idempotency key for offline/online creation or submission
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exam_blueprints(exam_id) ON DELETE RESTRICT,
    status attempt_status NOT NULL DEFAULT 'IN_PROGRESS',
    question_snapshots JSONB NOT NULL DEFAULT '[]'::jsonb, -- Immutable snapshot locked at attempt start
    score_percent NUMERIC(5,2) CHECK (score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)),
    correct_count INT,
    total_questions INT NOT NULL CHECK (total_questions > 0),
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMPTZ,
    scored_at TIMESTAMPTZ
);

-- Note: Clients NEVER submit is_correct; server grading procedure computes it from question_snapshots
CREATE TABLE IF NOT EXISTS attempt_answers (
    answer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES exam_attempts(attempt_id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(question_id) ON DELETE RESTRICT,
    selected_option_id UUID REFERENCES question_options(option_id) ON DELETE RESTRICT,
    text_or_code_response TEXT,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    response_time_seconds INT CHECK (response_time_seconds IS NULL OR response_time_seconds >= 0),
    sequence_no INT NOT NULL DEFAULT 1,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS outcome_mastery (
    mastery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    outcome_id INT NOT NULL REFERENCES learning_outcomes(outcome_id) ON DELETE CASCADE,
    attempts_evidence_count INT NOT NULL DEFAULT 0,
    correct_evidence_count INT NOT NULL DEFAULT 0,
    mastery_score NUMERIC(4,3) NOT NULL DEFAULT 0.000 CHECK (mastery_score BETWEEN 0.000 AND 1.000),
    last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE NULLS NOT DISTINCT (user_id, tenant_id, outcome_id)
);

-- 5. Provider-Abstracted Commerce & Server-Authoritative Entitlements (Fixes ADR-003 & ADR-008)
CREATE TABLE IF NOT EXISTS products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    billing_interval_days INT,
    price_amount NUMERIC(10,2) NOT NULL CHECK (price_amount >= 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'ETB',
    entitlement_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key UUID UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(8) NOT NULL,
    status order_status NOT NULL DEFAULT 'PENDING',
    payment_provider VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_events (
    payment_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(64) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE RESTRICT,
    verified_amount NUMERIC(10,2) NOT NULL,
    verified_currency VARCHAR(8) NOT NULL,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS feature_entitlements (
    entitlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = Personal Entitlement
    source_type grant_source_type NOT NULL,
    source_reference_id UUID,
    scope_type VARCHAR(64) NOT NULL,
    scope_target_id VARCHAR(64),
    offline_download_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    offline_grace_days INT NOT NULL DEFAULT 7,
    storage_quota_mb INT NOT NULL DEFAULT 2048,
    ai_monthly_quota INT NOT NULL DEFAULT 50,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

-- 6. Opaque Monotonic Sync Ledger, Tombstones & Idempotent Operation Log (Fixes ADR-006)
CREATE TABLE IF NOT EXISTS sync_changes (
    change_seq BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    operation VARCHAR(16) NOT NULL CHECK (operation IN ('UPSERT', 'TOMBSTONE')),
    version INT NOT NULL DEFAULT 1,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_operations_log (
    operation_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES user_devices(device_id) ON DELETE RESTRICT,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    operation_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('ACCEPTED', 'REJECTED')),
    reason_code VARCHAR(64),
    server_entity_id UUID,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Vector Embeddings (Matched 384-d for all-MiniLM-L6-v2)
CREATE TABLE IF NOT EXISTS resource_embeddings (
    embedding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES course_resources(resource_id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_content TEXT NOT NULL,
    embedding extensions.vector(384) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_courses_theme ON courses(theme_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_course ON learning_outcomes(course_id);
CREATE INDEX IF NOT EXISTS idx_resources_course_tenant ON course_resources(course_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_questions_course_outcome ON questions(course_id, outcome_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_tenant ON exam_attempts(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_resources_metadata_gin ON course_resources USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_sync_changes_seq_scope ON sync_changes(change_seq, tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_user_active ON feature_entitlements(user_id, tenant_id, valid_until);
CREATE INDEX IF NOT EXISTS idx_resource_embeddings_hnsw ON resource_embeddings USING hnsw (embedding extensions.vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 8. Deterministic Server-Side Grading Procedure (FR-009, ADR-005)
CREATE OR REPLACE FUNCTION public.grade_exam_attempt(p_attempt_id UUID)
RETURNS TABLE(final_score NUMERIC(5,2), total_correct INT, total_items INT) AS $$
DECLARE
    v_correct INT := 0;
    v_total INT := 0;
    v_score NUMERIC(5,2) := 0.00;
BEGIN
    -- Update attempt_answers.is_correct strictly from exam_attempts.question_snapshots
    UPDATE attempt_answers aa
    SET is_correct = EXISTS (
        SELECT 1
        FROM exam_attempts ea,
             jsonb_array_elements(ea.question_snapshots) AS q,
             jsonb_array_elements(q->'options') AS opt
        WHERE ea.attempt_id = p_attempt_id
          AND (q->>'question_id')::uuid = aa.question_id
          AND (opt->>'option_id')::uuid = aa.selected_option_id
          AND (opt->>'is_correct')::boolean = TRUE
    )
    WHERE aa.attempt_id = p_attempt_id;

    SELECT COUNT(aa.answer_id), Total
    INTO v_correct, v_total
    FROM (
        SELECT ea.total_questions AS Total
        FROM exam_attempts ea
        WHERE ea.attempt_id = p_attempt_id
    ) meta
    LEFT JOIN attempt_answers aa ON aa.attempt_id = p_attempt_id AND aa.is_correct = TRUE
    GROUP BY Total;

    v_score := ROUND((COALESCE(v_correct, 0)::numeric / GREATEST(v_total, 1)::numeric) * 100.0, 2);

    UPDATE exam_attempts
    SET status = 'SCORED',
        correct_count = COALESCE(v_correct, 0),
        score_percent = v_score,
        submitted_at = COALESCE(submitted_at, CURRENT_TIMESTAMP),
        scored_at = CURRENT_TIMESTAMP
    WHERE attempt_id = p_attempt_id;

    RETURN QUERY SELECT v_score, COALESCE(v_correct, 0), v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Row-Level Security (RLS) Policies
ALTER TABLE course_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_resources FORCE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_answers FORCE ROW LEVEL SECURITY;
ALTER TABLE feature_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE outcome_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_mastery FORCE ROW LEVEL SECURITY;
ALTER TABLE sync_operations_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_operations_log FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS rls_resources_tenant_isolation ON course_resources;
    CREATE POLICY rls_resources_tenant_isolation ON course_resources
        FOR ALL
        USING (
            tenant_id IS NULL
            OR tenant_id = public.current_app_tenant_id()
        );

    DROP POLICY IF EXISTS rls_attempts_owner_and_tenant ON exam_attempts;
    CREATE POLICY rls_attempts_owner_and_tenant ON exam_attempts
        FOR ALL
        USING (
            user_id = public.current_app_user_id()
            AND (
                tenant_id IS NULL
                OR tenant_id = public.current_app_tenant_id()
            )
        );

    DROP POLICY IF EXISTS rls_answers_owner_via_attempt ON attempt_answers;
    CREATE POLICY rls_answers_owner_via_attempt ON attempt_answers
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM exam_attempts ea
                WHERE ea.attempt_id = attempt_answers.attempt_id
                  AND ea.user_id = public.current_app_user_id()
            )
        );

    DROP POLICY IF EXISTS rls_entitlements_owner_and_tenant ON feature_entitlements;
    CREATE POLICY rls_entitlements_owner_and_tenant ON feature_entitlements
        FOR ALL
        USING (
            user_id = public.current_app_user_id()
            AND (
                tenant_id IS NULL
                OR tenant_id = public.current_app_tenant_id()
            )
        );

    DROP POLICY IF EXISTS rls_mastery_owner_and_tenant ON outcome_mastery;
    CREATE POLICY rls_mastery_owner_and_tenant ON outcome_mastery
        FOR ALL
        USING (
            user_id = public.current_app_user_id()
            AND (
                tenant_id IS NULL
                OR tenant_id = public.current_app_tenant_id()
            )
        );

    DROP POLICY IF EXISTS rls_sync_operations_owner ON sync_operations_log;
    CREATE POLICY rls_sync_operations_owner ON sync_operations_log
        FOR ALL
        USING (
            user_id = public.current_app_user_id()
        );
END $$;

-- 10. Role Grants for RLS Enforcement
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;
