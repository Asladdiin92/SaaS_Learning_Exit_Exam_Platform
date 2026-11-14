# SaaS Database Architecture & System Specification (Phases 1–22 — Reconciled v2.1)

| Document Attribute | Approved Baseline Value |
| :--- | :--- |
| **Document Title** | SaaS Database Architecture & System Specification (Phases 1–22) |
| **Companion Suite (4-File Baseline)** | **File 2 of 4** — Reconciled with:<br>1. `Education_SaaS_Platform_System_Analysis_and_Design.docx` (v2.1)<br>2. `SaaS_Database_Architecture_and_System_Specification.md` (v2.1)<br>3. `unified_education_saas_mobile_and_system_specification.md` (v2.1)<br>4. `SaaS_Learning_and_Exam_Platform_Implementation_and_Architecture_Guide.md` (v2.1) |
| **Version & Date** | Version 2.1 — 14 November 2026 (All `ADR-001` to `ADR-009` Corrections Applied) |
| **Database & Backend Stack** | PostgreSQL 16 (`pgvector`), Python 3.12 / FastAPI Modular Monolith, Supabase Cloud + Local Docker Parity |
| **Mobile & Offline Stack** | React Native + TypeScript, 13-Table SQLCipher Local DB, Opaque Monotonic Sync Cursors |

## Phase 1: Foundation & Core Product Architecture

### 1.1 Executive Summary & System Vision

This document specifies the 22-phase database and system architecture for the multi-tenant Education SaaS learning and national exit examination preparation platform aligned with the **Bachelor of Science Degree in Information Technology** curriculum (5 Themes, 15 Courses, 45 Credit Hours).

Version 2.1 reconciles all earlier schema drafts with the approved **Architecture Decision Records (`ADR-001` through `ADR-009`)**:
* **Modular Monolith Backend (`ADR-001`)**: Single deployable **Python 3.12 / FastAPI** runtime containing core API services, authentication handlers, background ingestion/sync workers, and data access layers (replacing earlier Go/Node.js snippet drift).
* **Global User Identity & Multi-Tenant Memberships (`ADR-002`)**: Users authenticate globally (`users`) and hold 0..N institutional memberships (`tenant_memberships`), enabling personal B2C purchases and B2B university seats under one account.
* **Server-Authoritative Entitlements & Provider-Abstracted Payments (`ADR-003`, `ADR-008`)**: Decouples catalog `products`, `orders`, `payment_events` (Chapa, Telebirr, Stripe, Sandbox), and `institution_licenses` from normalized `feature_entitlements`.
* **Immutable Exam Snapshots & Server-Only Scoring (`ADR-005`, `FR-009`)**: Locks `question_snapshots` at attempt start and computes `is_correct` strictly on the server.
* **Opaque Monotonic Sync Cursors & Tombstones (`ADR-006`)**: Replaces client timestamp watermarks (`last_pulled_at`) with server-issued opaque cursors backed by `sync_changes(change_seq)` and `TOMBSTONE` operations.
* **Zero-Conflict Local Dev to Supabase Cloud Parity (`ADR-009`)**: Uses `supabase/migrations/` with an `auth.uid()` compatibility shim and relative `(storage_bucket, storage_object_key)` columns resolved via `StorageAdapter`.

### 1.2 Conceptual Entity-Relationship (ER) Architecture

| Entity Group | Core Tables | Domain Scope & Purpose |
| :--- | :--- | :--- |
| **Identity & Devices** | `users`, `user_devices`, `federated_identities` | Global student, instructor, and admin accounts plus registered mobile devices and refresh token families. |
| **Multi-Tenancy** | `tenants`, `tenant_memberships`, `tenant_idp_configs` | Institutional workspaces, scoped member roles (`STUDENT`, `INSTRUCTOR`, `TENANT_ADMIN`), and SSO settings. |
| **Curriculum Taxonomy** | `curriculum_versions`, `themes`, `courses`, `learning_outcomes` | Versioned 5-theme, 15-course, 45-credit national B.Sc. IT hierarchy mapped to Bloom's Taxonomy levels. |
| **Content & Packages** | `course_resources`, `resource_ingestion_jobs` | Polymorphic learning assets stored via relative `(storage_bucket, storage_object_key)` references and JSONB metadata. |
| **Assessment & IRT** | `questions`, `question_options`, `question_irt_parameters`, `exam_blueprints` | Versioned question bank, IRT 3PL parameters, and blueprint rules for quizzes, course exams, and 120-Q simulations. |
| **Attempts & Grading** | `exam_attempts`, `attempt_answers`, `coding_test_cases`, `grading_jobs` | Immutable attempt snapshots, server-evaluated item responses, and sandboxed coding/essay grading logs. |
| **Mastery & Engagement** | `outcome_mastery`, `user_streaks`, `badges`, `user_badges`, `leaderboards` | Sliding-window learning outcome mastery estimates and student study habit telemetry. |
| **Commerce & Licensing** | `products`, `orders`, `payment_events`, `institution_licenses`, `seat_assignments` | B2C subscriptions, one-time bundles, provider-verified webhook events, and B2B institutional seat allocations. |
| **Entitlements** | `feature_entitlements`, `usage_records` | Server-evaluated access grants, offline download permissions, storage quotas, and AI Tutor token metering. |
| **Mobile Offline Sync** | `sync_changes`, `sync_operations_log` | Monotonic server change ledger (`UPSERT` / `TOMBSTONE`) and idempotent client mutation log (`operation_id`). |
| **AI & Vector Search** | `resource_embeddings`, `question_embeddings` | `pgvector(384)` HNSW-indexed embeddings for semantic search and grounded RAG tutoring. |
| **Governance & Audit** | `audit_logs`, `notification_logs`, `compliance_audit_findings`, `historical_archival_rules` | Append-only security/business audit trail, notifications, and hot/warm/cold retention rules. |

### 1.3 Canonical Hierarchical Domain Tree (`Theme > Course > Code > Credits > Competencies`)

* **Theme 1: Computer System (4 Credit Hours)**
  * `IT-CMTS-101` — **Computer Maintenance and Technical Support** (4 Credits): Hardware/software failure diagnostics, fault isolation, ESD safety, preventive maintenance, and repair protocols (`COGNITIVE`, `PSYCHOMOTOR`).
* **Theme 2: System/Software Development (15 Credit Hours)**
  * `IT-OOPJ-201` — **Object-Oriented Programming in Java** (3 Credits): Encapsulation, abstraction, inheritance, polymorphism, JVM stack/heap memory, and debugging.
  * `IT-ADVP-202` — **Advanced Programming** (3 Credits): Java Collections Framework, multithreading, concurrency (`ExecutorService`), and exception handling.
  * `IT-EDPR-203` — **Event-Driven Programming** (3 Credits): Event Dispatch Thread (EDT), observer pattern listeners, GUI layouts, and asynchronous worker tasks.
  * `IT-SYAD-204` — **System Analysis and Design** (3 Credits): SDLC models, Object-Oriented System Analysis and Design (OOSAD), and UML 2.5 structural/behavioral diagrams.
  * `IT-ITPM-301` — **IT Project Management** (3 Credits): WBS, PERT/CPM scheduling, risk probability-impact matrices, SQA (ISO 9000/CMMI), and Earned Value Management (EVM).
* **Theme 3: Database System and Information Management (6 Credit Hours)**
  * `IT-FDBS-201` — **Fundamentals of Database System** (3 Credits): ANSI-SPARC architecture, ER/EER modeling, relational algebra, normalization (`1NF`–`BCNF`), and SQL (`DDL`, `DML`, `DCL`).
  * `IT-ADBS-301` — **Advanced Database System** (3 Credits): Heuristic/cost-based query optimization, B+ Tree indexing, ACID transaction processing (`2PL`, `MVCC`), WAL/ARIES recovery, and distributed databases.
* **Theme 4: Mobile Application and Web Development (9 Credit Hours)**
  * `IT-IPRG-301` — **Internet Programming-I** (3 Credits): HTTP/HTTPS protocols, DOM manipulation, semantic HTML5, responsive CSS3 (Flexbox/Grid), and ES6+ asynchronous JavaScript.
  * `IT-IPRG-302` — **Internet Programming-II** (3 Credits): Server-side scripting, session management, database pooling, e-commerce workflows, and OWASP security (`SQLi`, `XSS`, `CSRF`).
  * `IT-MABD-401` — **Mobile Application Development** (3 Credits): Mobile application components, lifecycle transitions, responsive layouts, encrypted local storage (`SQLite`/`SQLCipher`), and background workers.
* **Theme 5: Networking and Information Security (11 Credit Hours)**
  * `IT-DCCN-201` — **Data Communications and Computer Networks** (3 Credits): OSI 7-layer and TCP/IP models, physical transmission media, data link framing, IPv4/IPv6 subnetting (VLSM/CIDR), and transport protocols.
  * `IT-SNAD-301` — **System & Network Administration** (3 Credits): Linux/Windows Server administration, user/group permissions, LVM/RAID storage, DNS/DHCP/SSH services, automated backups, and shell scripting.
  * `IT-NDVC-302` — **Network Device & Configuration** (3 Credits): Router and switch CLI configuration, VLAN segmentation, 802.1Q trunking, STP, static/dynamic routing (OSPF), ACLs, and NAT/PAT.
  * `IT-IASC-401` — **Information Assurance and Security** (2 Credits): CIA triad, threat/risk assessment, symmetric/asymmetric cryptography (AES, RSA, SHA, PKI), network defense (firewalls, IDS/IPS, VPNs), and incident response.

### 1.4 Cross-Theme Dependency Graph

1. **Hardware & Infrastructure Layer**: `Theme 1 (IT-CMTS-101)` $\rightarrow$ `Theme 5 (IT-DCCN-201, IT-NDVC-302, IT-SNAD-301)`.
2. **Software & Data Layer**: `Theme 2 (IT-OOPJ-201, IT-ADVP-202, IT-SYAD-204)` $\rightarrow$ `Theme 3 (IT-FDBS-201, IT-ADBS-301)`.
3. **Application & Security Layer**: `Theme 4 (IT-IPRG-301, IT-IPRG-302, IT-MABD-401)` $\rightarrow$ `Theme 3 (Database Integration)` & `Theme 5 (IT-IASC-401 Secure Architecture)`.
4. **Governance Layer**: `Theme 2 (IT-ITPM-301)` governs quality assurance, risk management, and delivery lifecycles across all themes.

## Phase 2: Logical Data Model, Reconciled PostgreSQL DDL & RLS Policies

### 2.1 Supabase Cloud & Local Docker Compatibility Shim (`ADR-009`)

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;
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
```

### 2.2 Custom PostgreSQL Enumerations

```sql
CREATE TYPE tenant_status AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');
CREATE TYPE membership_role AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'INSTRUCTOR', 'STUDENT');
CREATE TYPE membership_status AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');
CREATE TYPE domain_type AS ENUM ('COGNITIVE', 'AFFECTIVE', 'PSYCHOMOTOR');
CREATE TYPE cognitive_level AS ENUM ('REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYSE', 'EVALUATE', 'CREATE');
CREATE TYPE resource_type AS ENUM ('LECTURE_NOTE', 'PAST_EXAM', 'REFERENCE_BOOK', 'LAB_CONTENT', 'PROJECT_SPEC', 'SOFTWARE_LINK', 'EXTERNAL_URL');
CREATE TYPE question_type AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'CODING', 'ESSAY');
CREATE TYPE difficulty_level AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE exam_type AS ENUM ('PRACTICE_QUIZ', 'COURSE_EXAM', 'NATIONAL_EXIT_SIMULATION');
CREATE TYPE attempt_status AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'SCORED', 'INVALIDATED');
CREATE TYPE grant_source_type AS ENUM ('FREE_TIER', 'PERSONAL_SUBSCRIPTION', 'ONE_TIME_PURCHASE', 'INSTITUTION_SEAT');
CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'DISPUTED');
```

### 2.3 Core Relational Tables (Identity, Tenancy, Curriculum, Resources, Exams & Mastery)

```sql
-- 1. Tenants (Institutional Workspaces)
CREATE TABLE tenants (
    tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status tenant_status NOT NULL DEFAULT 'TRIAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Global Users (Decoupled from single tenant_id per ADR-002)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tenant Memberships (Many-to-Many User <-> Institution Mapping)
CREATE TABLE tenant_memberships (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    role membership_role NOT NULL DEFAULT 'STUDENT',
    status membership_status NOT NULL DEFAULT 'ACTIVE',
    cohort_name VARCHAR(128),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, tenant_id)
);

-- 4. Curriculum Versions, Themes, Courses & Learning Outcomes
CREATE TABLE curriculum_versions (
    version_id SERIAL PRIMARY KEY,
    version_code VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE themes (
    theme_id SERIAL PRIMARY KEY,
    curriculum_version_id INT NOT NULL REFERENCES curriculum_versions(version_id) ON DELETE RESTRICT,
    theme_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_credit_hours INT NOT NULL CHECK (total_credit_hours > 0),
    version INT NOT NULL DEFAULT 1,
    UNIQUE (curriculum_version_id, theme_number)
);

CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    theme_id INT NOT NULL REFERENCES themes(theme_id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    credit_hours INT NOT NULL CHECK (credit_hours > 0),
    general_objective TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1
);

CREATE TABLE learning_outcomes (
    outcome_id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    domain domain_type NOT NULL DEFAULT 'COGNITIVE',
    level cognitive_level NOT NULL DEFAULT 'REMEMBER',
    version INT NOT NULL DEFAULT 1
);

-- 5. Course Resources (Uses relative storage_bucket + storage_object_key per ADR-009)
CREATE TABLE course_resources (
    resource_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = Global resource
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

-- 6. Questions, Options, Exam Blueprints & Immutable Exam Attempts (ADR-005)
CREATE TABLE questions (
    question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    outcome_id INT REFERENCES learning_outcomes(outcome_id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    type question_type NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    level cognitive_level NOT NULL DEFAULT 'REMEMBER',
    difficulty difficulty_level NOT NULL DEFAULT 'MEDIUM',
    explanation TEXT,
    version INT NOT NULL DEFAULT 1,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE question_options (
    option_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    option_label CHAR(1) NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE exam_blueprints (
    exam_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id INT REFERENCES courses(course_id) ON DELETE SET NULL,
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

CREATE TABLE exam_attempts (
    attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_operation_id UUID UNIQUE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exam_blueprints(exam_id) ON DELETE RESTRICT,
    status attempt_status NOT NULL DEFAULT 'IN_PROGRESS',
    question_snapshots JSONB NOT NULL DEFAULT '[]'::jsonb,
    score_percent NUMERIC(5,2) CHECK (score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)),
    correct_count INT,
    total_questions INT NOT NULL CHECK (total_questions > 0),
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMPTZ,
    scored_at TIMESTAMPTZ,
    CONSTRAINT chk_submitted_after_started CHECK (submitted_at IS NULL OR submitted_at >= started_at)
);

CREATE TABLE attempt_answers (
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

CREATE TABLE outcome_mastery (
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
```

### 2.4 Indexing & Row-Level Security (RLS) Multi-Tenant Policies

```sql
CREATE INDEX idx_courses_theme ON courses(theme_id);
CREATE INDEX idx_outcomes_course ON learning_outcomes(course_id);
CREATE INDEX idx_resources_course_tenant ON course_resources(course_id, tenant_id);
CREATE INDEX idx_questions_course_outcome ON questions(course_id, outcome_id);
CREATE INDEX idx_attempts_user_tenant ON exam_attempts(user_id, tenant_id);
CREATE INDEX idx_resources_metadata_gin ON course_resources USING GIN (metadata);

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_memberships_isolation ON tenant_memberships
    FOR ALL USING (
        user_id = public.current_app_user_id()
        OR tenant_id = public.current_app_tenant_id()
    );

CREATE POLICY rls_resources_isolation ON course_resources
    FOR ALL USING (
        tenant_id IS NULL
        OR tenant_id = public.current_app_tenant_id()
    );

CREATE POLICY rls_attempts_isolation ON exam_attempts
    FOR ALL USING (
        user_id = public.current_app_user_id()
        AND (tenant_id IS NULL OR tenant_id = public.current_app_tenant_id())
    );
```

The Day 15 migration adds scope-bound HMAC cursors over `sync_changes.change_seq`, owner-scoped bookmark/support-case storage, and a cached result payload on `sync_operations_log`. Triggers append `UPSERT` changes for course, resource, exam-blueprint, and entitlement writes; resource unpublishes/deletes and entitlement revocations/deletes append `TOMBSTONE` changes. Authenticated clients can read only changes visible to their user/workspace scope; ledger writes are restricted to the security-definer trigger.

## Phase 3: Curriculum Seed Script, Server-Side Grading & REST API Contracts

### 3.1 Canonical 5-Theme / 15-Course Seed Data Script

```sql
INSERT INTO curriculum_versions (version_id, version_code, title, is_active)
VALUES (1, 'ETH-BSC-IT-2026-V1', 'B.Sc. in Information Technology National Curriculum & Exit Exam Blueprint', TRUE);

INSERT INTO themes (theme_id, curriculum_version_id, theme_number, title, description, total_credit_hours) VALUES
  (1, 1, 1, 'Computer System', 'Hardware diagnostics, computer maintenance, technical support, and component-level repair protocols.', 4),
  (2, 1, 2, 'System/Software Development', 'Object-oriented programming, data structures, event-driven GUI apps, UML system design, and IT project management.', 15),
  (3, 1, 3, 'Database System and Information Management', 'Relational modeling, normalization, SQL, query optimization, ACID transactions, and distributed databases.', 6),
  (4, 1, 4, 'Mobile Application and Web Development', 'Client/server web engineering, HTTP security, and offline-capable mobile application development.', 9),
  (5, 1, 5, 'Networking and Information Security', 'OSI/TCP-IP networking, system administration, router/switch CLI configuration, and cybersecurity.', 11);

INSERT INTO courses (course_id, theme_id, code, title, credit_hours, general_objective) VALUES
  (1,  1, 'IT-CMTS-101', 'Computer Maintenance and Technical Support', 4, 'Identify hardware and software failures and apply preventive maintenance and repair procedures.'),
  (2,  2, 'IT-OOPJ-201', 'Object-Oriented Programming in Java', 3, 'Apply encapsulation, inheritance, polymorphism, and JVM memory principles to build modular applications.'),
  (3,  2, 'IT-ADVP-202', 'Advanced Programming', 3, 'Develop concurrent, thread-safe, and resilient software using generic collections and exception hierarchies.'),
  (4,  2, 'IT-EDPR-203', 'Event-Driven Programming', 3, 'Design responsive graphical user interfaces using event listeners, dispatch threads, and asynchronous workers.'),
  (5,  2, 'IT-SYAD-204', 'System Analysis and Design', 3, 'Analyze business requirements and model software architectures using OOSAD and UML 2.5 diagrams.'),
  (6,  2, 'IT-ITPM-301', 'IT Project Management', 3, 'Plan, estimate, manage risk, and assure quality across software projects using PERT/CPM and EVM.'),
  (7,  3, 'IT-FDBS-201', 'Fundamentals of Database System', 3, 'Design normalized relational schemas from ER/EER models and implement DDL, DML, and DCL SQL queries.'),
  (8,  3, 'IT-ADBS-301', 'Advanced Database System', 3, 'Optimize relational queries, enforce ACID concurrency control, implement WAL recovery, and design distributed DBs.'),
  (9,  4, 'IT-IPRG-301', 'Internet Programming-I', 3, 'Build accessible, responsive client-side web interfaces using semantic HTML5, CSS3 Flexbox/Grid, and ES6+ JS.'),
  (10, 4, 'IT-IPRG-302', 'Internet Programming-II', 3, 'Architect secure server-side web applications with database connection pooling, session state, and OWASP defenses.'),
  (11, 4, 'IT-MABD-401', 'Mobile Application Development', 3, 'Engineer cross-platform and native mobile applications with lifecycle safety and encrypted offline persistence.'),
  (12, 5, 'IT-DCCN-201', 'Data Communications and Computer Networks', 3, 'Analyze OSI/TCP-IP protocol layers, transmission media, and IPv4/IPv6 VLSM/CIDR addressing.'),
  (13, 5, 'IT-SNAD-301', 'System & Network Administration', 3, 'Deploy, harden, and automate Linux/Windows network servers, storage volumes, directory services, and backups.'),
  (14, 5, 'IT-NDVC-302', 'Network Device & Configuration', 3, 'Configure enterprise routers and switches with VLANs, 802.1Q trunking, STP, OSPF, ACLs, and NAT.'),
  (15, 5, 'IT-IASC-401', 'Information Assurance and Security', 2, 'Assess cyber threats, apply symmetric/asymmetric cryptography, and enforce defense-in-depth security policies.');
```

### 3.2 Deterministic Server-Side Grading Procedure (`FR-009`, `ADR-005`)

Clients never send `is_correct`. The server grades submitted option selections strictly against the immutable `question_snapshots` JSONB locked on `exam_attempts`:

```sql
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

    SELECT COUNT(*), Total
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
```

## Phase 4: Performance Optimization, Vector Search (`pgvector`) & Caching

### 4.1 Reconciled `pgvector(384)` Embeddings Schema

To eliminate the earlier 1536 vs. 384 dimension mismatch (`SAD §2.3`), MVP vector columns default to `extensions.vector(384)` matching `SentenceTransformer('all-MiniLM-L6-v2')` (if an enterprise deployment switches to 1536-d OpenAI/Voyage embeddings, set `EMBEDDING_DIM=1536` prior to migration):

```sql
CREATE TABLE resource_embeddings (
    embedding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES course_resources(resource_id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_content TEXT NOT NULL,
    embedding extensions.vector(384) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE question_embeddings (
    embedding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    embedding extensions.vector(384) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resource_embeddings_hnsw ON resource_embeddings
USING hnsw (embedding extensions.vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_question_embeddings_hnsw ON question_embeddings
USING hnsw (embedding extensions.vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

### 4.2 Redis Look-Aside Caching, Keyset Pagination & PgBouncer Pooling

* **Redis Look-Aside & Rate Limiting**: Caches static curriculum trees (`cache:curriculum:v1:themes`), short-lived download grant tokens, and rate-limit buckets for `/auth/*`, `/ai/tutor/*`, and `/sync/*`.
* **Deterministic Keyset Pagination**: High-volume lists (`questions`, `exam_attempts`, `course_resources`) use `(created_at DESC, id DESC)` tuple keyset pagination instead of `OFFSET`.
* **Connection Pooling**: PgBouncer in transaction-pooling mode (port `6543` on Supabase Cloud; direct port `5432` for Alembic/Supabase DDL migrations).

## Phase 5: Zero-Downtime Migrations & Declarative Table Partitioning

* **Expand-Contract Migrations**: Schema changes add nullable columns first, dual-write in FastAPI, backfill in batches, and contract in a subsequent migration. Indexes build via `CREATE INDEX CONCURRENTLY`.
* **Declarative Range Partitioning**: High-volume telemetry tables (`attempt_answers_partitioned`, `audit_logs`) partition by monthly `recorded_at` / `created_at` ranges for fast partition pruning and cold storage archival.

## Phase 6: Analytics, Outcome Mastery Aggregation & Controlled Data Lake Mirror

### 6.1 Sliding-Window Student Outcome Mastery Query

```sql
SELECT
    ea.user_id,
    ea.tenant_id,
    q.outcome_id,
    lo.description AS outcome_description,
    lo.level AS cognitive_level,
    COUNT(aa.answer_id) AS attempts_evidence_count,
    SUM(CASE WHEN aa.is_correct THEN 1 ELSE 0 END) AS correct_evidence_count,
    ROUND(AVG(CASE WHEN aa.is_correct THEN 1.0 ELSE 0.0 END), 3) AS mastery_score
FROM attempt_answers aa
JOIN exam_attempts ea ON aa.attempt_id = ea.attempt_id
JOIN questions q ON aa.question_id = q.question_id
JOIN learning_outcomes lo ON q.outcome_id = lo.outcome_id
WHERE ea.status = 'SCORED'
  AND ea.user_id = public.current_app_user_id()
GROUP BY ea.user_id, ea.tenant_id, q.outcome_id, lo.description, lo.level;
```

### 6.2 Controlled Data Lake Mirror (`Iceberg / Parquet + DuckDB`)

To provide an unambiguous, auditable analytical mirror without querying OLTP tables during heavy institutional reporting:
1. **WAL / Outbox Mirroring**: Changes from PostgreSQL logical replication or `sync_changes` write atomic Parquet/Apache Iceberg snapshots to object storage (`s3://lake/raw_mirror/` and PII-sanitized `s3://lake/curated_analytics/`) with explicit `_op = 'D'` tombstones.
2. **Embedded DuckDB Analytical Queries**: FastAPI's `analytics/` module queries the curated Parquet/Iceberg mirror directly using DuckDB, injecting mandatory `tenant_id` filters and minimum cohort thresholds (`COUNT(DISTINCT user_id) >= 5`) and returning the exact `snapshot_id` watermark in every dashboard response.

## Phase 7: Automated Resource Ingestion & Polymorphic Asset Processing

Uploaded PDFs, lecture notes, and past exam papers undergo asynchronous extraction (`pdfplumber` + `PyPDF2` + fallback OCR), automatic taxonomy classification against `learning_outcomes`, 512-token sliding-window chunking (64-token overlap), and 384-d `all-MiniLM-L6-v2` vectorization tracked in `resource_ingestion_jobs`.

## Phase 8: AI-Driven Adaptive Assessment (3PL IRT) & Grounded RAG Tutoring

* **3PL IRT Calibration (`question_irt_parameters`)**: Tracks discrimination ($a_i$), difficulty ($b_i \in [-4, 4]$), and pseudo-guessing ($c_i$) parameters for adaptive question selection.
* **120-Question National Exit Simulation Assembly**: Allocates items strictly proportional to course credit hours (`ROUND((credit_hours / 45.0) * 120)`).
* **Grounded RAG Tutor**: Queries `resource_embeddings` filtered by authorized `course_resources` (`cosine_distance < 0.25`), attaches verbatim source citations (`resource_title`, page/chunk index), and meters token consumption against `feature_entitlements.ai_monthly_quota`.

## Phase 9: Reconciled Python/FastAPI Containerization, CI/CD & Observability

*(Fixes the earlier Golang Dockerfile contradiction in Phase 9 by standardizing on the confirmed Python 3.12 / FastAPI runtime per `ADR-001`.)*

```dockerfile
# Stage 1: Python 3.12 Dependency Builder
FROM python:3.12-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# Stage 2: Hardened Non-Root FastAPI Production Runtime
FROM python:3.12-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appgroup && useradd -r -g appgroup appuser
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels
COPY ./backend/app /app/app
USER appuser:appgroup
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

## Phase 10: Security, Jurisdiction-Appropriate Privacy & Disaster Recovery

* **Cryptography**: TLS 1.3 in transit; AES-256 at rest for PostgreSQL volumes, object storage buckets, and mobile SQLCipher databases; short-lived 15-minute access JWTs + rotating refresh token families.
* **Privacy Governance**: Enforces RBAC + PostgreSQL RLS isolation, immutable `audit_logs`, and account anonymization/export pipelines appropriate to Ethiopian and international higher-education deployments (without falsely claiming US-specific FERPA jurisdiction).
* **Backups & PITR**: Continuous WAL archiving with tested Point-in-Time Recovery (PITR) runbooks.

## Phase 11: Provider-Abstracted Monetization, Institutional Licensing & Entitlements

*(Fixes the earlier Stripe-only / `tenants.subscription_tier` contradiction per `ADR-003` and `ADR-008`.)*

```sql
CREATE TABLE institution_licenses (
    license_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    contract_reference VARCHAR(128) NOT NULL,
    licensed_seats INT NOT NULL CHECK (licensed_seats > 0),
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    offline_download_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seat_assignments (
    seat_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES institution_licenses(license_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    UNIQUE (license_id, user_id)
);
```

## Phases 12–20: Staged Enterprise Capabilities (`ADR-007`)

Per `ADR-001` and `ADR-007`, Phases 12 through 20 are architecturally defined and staged for post-pilot growth:
* **Phase 12 (Multi-Tenant Isolation Tiers & Sharding)**: Start on Pooled RLS (`Phase 2`); unlock Siloed Schema-per-Tenant or Dedicated DB-per-Tenant only for enterprise contracts requiring physical isolation.
* **Phase 13 (Real-Time WebSockets & Collaborative Study Rooms)**: FastAPI WebSocket gateways backed by Redis Pub/Sub (`study_session_rooms`, `room_participants`, `room_chat_messages`).
* **Phase 14 (Automated Coding, Essay & Lab Grading)**: Ephemeral gVisor/Firecracker sandboxes for Java, C++, Python, and SQL code execution (`coding_test_cases`, `grading_jobs`).
* **Phase 15 (Gamification & Behavioral Nudges)**: `user_streaks`, `badges`, `user_badges`, `leaderboards`, and `notification_logs`.
* **Phase 16 (Graph Prerequisite Mapping & Fine-Grained ABAC)**: Cross-course outcome prerequisite graphs and resource-scoped permissions.
* **Phase 17 (Enterprise SSO, SAML 2.0, OIDC PKCE & SCIM 2.0)**: `tenant_idp_configs`, `federated_identities`, and `scim_audit_logs`.
* **Phase 18 (Continuous Compliance & Automated RLS Pen-Testing)**: Hourly synthetic cross-tenant isolation tests and OWASP ZAP API scans (`compliance_audit_findings`).
* **Phase 19 (Edge Caching & CDN Byte-Range Acceleration)**: Signed CDN byte-range delivery for resumable mobile package downloads.
* **Phase 20 (Master Data Governance & Cold Archival)**: Golden-record curriculum versioning (`curriculum_versions`) and automated hot/warm/cold archival (`historical_archival_rules`).

## Phase 21: Reconciled FastAPI Implementation Scripts (Webhook & Embedding Worker)

### 21.1 Idempotent Provider-Abstracted FastAPI Payment Webhook (`ADR-003`, `ADR-008`)

*(Replaces the legacy Node.js Stripe snippet that wrote directly to `tenants` and `users.tenant_id`.)*

```python
from fastapi import APIRouter, Header, HTTPException, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid

router = APIRouter(prefix="/api/v1/webhooks", tags=["commerce"])

@router.post("/{provider}")
async def handle_payment_webhook(
    provider: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    x_signature: str = Header(default=""),
):
    raw_body = await request.body()
    # 1. Verify cryptographic webhook signature via provider adapter (Chapa / Telebirr / Stripe / Sandbox)
    event = verify_provider_webhook(provider=provider.upper(), payload=raw_body, signature=x_signature)

    async with db.begin():
        # 2. Idempotency check on (provider, provider_event_id)
        existing = await db.execute(
            text("SELECT payment_event_id FROM payment_events WHERE provider = :p AND provider_event_id = :eid"),
            {"p": provider.upper(), "eid": event.event_id},
        )
        if existing.first():
            return {"status": "already_processed"}

        # 3. Verify order amount & currency match
        order_row = (await db.execute(
            text("SELECT order_id, user_id, tenant_id, product_id, amount, currency FROM orders WHERE order_id = :oid FOR UPDATE"),
            {"oid": event.order_id},
        )).mappings().first()
        if not order_row or order_row["amount"] != event.amount or order_row["currency"] != event.currency:
            raise HTTPException(status_code=400, detail="Order verification mismatch")

        # 4. Record payment event, mark order PAID, and grant server-authoritative entitlement
        await db.execute(
            text("""
                INSERT INTO payment_events (provider, provider_event_id, order_id, verified_amount, verified_currency)
                VALUES (:p, :eid, :oid, :amt, :cur)
            """),
            {"p": provider.upper(), "eid": event.event_id, "oid": event.order_id, "amt": event.amount, "cur": event.currency},
        )
        await db.execute(text("UPDATE orders SET status = 'PAID', updated_at = NOW() WHERE order_id = :oid"), {"oid": event.order_id})
        await db.execute(
            text("""
                INSERT INTO feature_entitlements (user_id, tenant_id, source_type, source_reference_id, scope_type, offline_download_allowed)
                VALUES (:uid, :tid, 'ONE_TIME_PURCHASE', :oid, 'ALL_COURSES', TRUE)
            """),
            {"uid": order_row["user_id"], "tid": order_row["tenant_id"], "oid": order_row["order_id"]},
        )

    return {"status": "accepted"}
```

### 21.2 Python Resource Embedding Worker (`384-d all-MiniLM-L6-v2`)

```python
import os
import psycopg2
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")  # Produces 384-dimensional vectors matching vector(384)
conn = psycopg2.connect(os.environ["DIRECT_URL"])

def process_resource_chunk(resource_id: str, chunk_index: int, chunk_text: str) -> None:
    embedding = model.encode(chunk_text, normalize_embeddings=True).tolist()
    assert len(embedding) == 384, f"Expected 384 dimensions, got {len(embedding)}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO resource_embeddings (resource_id, chunk_index, chunk_content, embedding)
            VALUES (%s, %s, %s, %s::extensions.vector)
            """,
            (resource_id, chunk_index, chunk_text, embedding),
        )
    conn.commit()
```

## Phase 22: React Native Mobile Application & Offline-First Sync Architecture

* **React Native + TypeScript Client (`ADR-004`)**: Implements the 30-screen navigation topology (`MOB-01` to `MOB-30`, mapped to `SAD MOB-01..24`) and 16 reusable components.
* **13-Table SQLCipher Local Database**: Encrypts on-device relational tables (`local_themes`, `local_courses`, `local_outcomes`, `local_resources`, `download_packages`, `local_exam_packages`, `local_exam_attempts`, `local_answer_events`, `sync_operations`, `sync_state`, `local_bookmarks`, `local_progress_cache`, `device_profile`) using AES-256 keys stored in iOS Keychain / Android Keystore.
* **Opaque Cursor Delta Sync (`ADR-006`) & Append-Only Exam Queue (`ADR-005`)**: Pulls server changes via `GET /api/v1/sync/pull?cursor=<opaque>` inside a single local transaction and pushes queued mutations (`exam_attempt.submit`, `bookmark.upsert`) idempotently via `POST /api/v1/sync/push`.
* **Honest DRM & Storage Guards**: Enforces `FLAG_SECURE`, dynamic user watermarks, resumable SHA-256 verified downloads, and LRU cache cleanup that **never** evicts active attempts or unsynced operations.
