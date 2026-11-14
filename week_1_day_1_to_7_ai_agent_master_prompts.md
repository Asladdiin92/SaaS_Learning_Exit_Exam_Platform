# Week 1 (Days 1–7) Comprehensive AI Code Agent Prompts
**Project: `SaaS_Learning_Exit_Exam_Platform` | IDE: Antigravity (`Gemini 3.8 Flash High`) | Supabase: `sbvyjbipchglzmttkowy` (`eu-west-1`)**

Each daily prompt below is self-contained, idempotent, and includes explicit file paths, architectural invariants (`ADR-001` through `ADR-009`), edge cases, and automated verification commands. If your agent has already scaffolded part of a day's work (such as the initial `MOB-01`–`MOB-08` files), the prompt instructs the agent to **audit existing files, fill in any missing logic or backend wiring, and pass all verification tests** without breaking working code.

---

## Day 1 Prompt — Repository Governance (`AGENTS.md`), Monorepo Layout, Reconciled SQL Migrations & FastAPI Core Engine

Copy and paste this into Antigravity IDE for **Day 1**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md @docs/SaaS_Database_Architecture_and_System_Specification.md @docs/SaaS_Learning_and_Exam_Platform_Implementation_and_Architecture_Guide.md

Execute the complete Day 1 engineering tasks for `SaaS_Learning_Exit_Exam_Platform`. Audit any existing files first, preserve working code, and implement or update all missing pieces:

### Task 1: Workspace Governance (`AGENTS.md`) & Monorepo Directory Structure
1. Create or update `AGENTS.md` in the root directory enforcing:
   - **ADR-001**: Python 3.12 / FastAPI modular monolith in `backend/app/` across 15 domain modules (`core`, `api/v1`, `identity`, `tenants`, `curriculum`, `content`, `assessments`, `learning`, `commerce`, `entitlements`, `mobile_sync`, `ai`, `analytics`, `notifications`, `audit`, `database`, `workers`).
   - **ADR-002**: Global `users` table + many-to-many `tenant_memberships` (never a single `users.tenant_id` column). Scope requests via `X-Tenant-ID` (`NULL` = Personal Workspace).
   - **ADR-003 & ADR-008**: Server-authoritative `feature_entitlements` and provider-abstracted `orders` / `payment_events` (Chapa, Telebirr, Stripe, Sandbox).
   - **ADR-004**: React Native + TypeScript mobile client in `mobile/` covering `MOB-01`..`MOB-30` and the 13-table SQLCipher schema.
   - **ADR-005 & FR-009**: Immutable `question_snapshots` on `exam_attempts`, append-only `local_answer_events`, and strict server-only grading (`public.grade_exam_attempt()`).
   - **ADR-006**: Opaque monotonic sync cursors (`sync_changes.change_seq`) + `TOMBSTONE` operations and UUID `operation_id` idempotency.
   - **ADR-009**: Zero-conflict Local Dev to Supabase Cloud (`sbvyjbipchglzmttkowy` in `eu-west-1`) parity using `supabase/migrations/`, `auth.uid()` shim, `statement_cache_size=0` on port `6543`, and `StorageAdapter` (`storage_bucket` + `storage_object_key`).
2. Ensure all monorepo folders exist: `docs/`, `supabase/migrations/`, `backend/app/`, `backend/scripts/`, `backend/tests/`, `mobile/`, `web/`, and `dev_storage/course-packages/`.

### Task 2: Reconciled PostgreSQL 16 + `pgvector(384)` Migrations (`supabase/migrations/`)
1. Write `supabase/migrations/20261114000001_init_reconciled_schema.sql` containing:
   - Compatibility shim for `extensions` (`pgcrypto`, `vector`), `auth.uid()`, `public.current_app_user_id()`, and `public.current_app_tenant_id()`.
   - All custom PostgreSQL `ENUM` types (`tenant_status`, `membership_role`, `membership_status`, `domain_type`, `cognitive_level`, `resource_type`, `question_type`, `difficulty_level`, `exam_type`, `attempt_status`, `grant_source_type`, `order_status`).
   - All core tables: `tenants`, `users`, `tenant_memberships`, `user_devices`, `curriculum_versions`, `themes`, `courses`, `learning_outcomes`, `course_resources` (with `storage_bucket` and `storage_object_key`), `questions`, `question_options`, `exam_blueprints`, `exam_attempts` (with `client_operation_id` and `question_snapshots`), `attempt_answers`, `outcome_mastery`, `products`, `orders`, `payment_events`, `institution_licenses`, `seat_assignments`, `feature_entitlements`, `sync_changes`, `sync_operations_log`, `resource_embeddings` (`extensions.vector(384)`), and `audit_logs`.
   - Server-side grading stored function `public.grade_exam_attempt(p_attempt_id UUID)`.
   - Performance indexes (including HNSW cosine index on `resource_embeddings`) and Row-Level Security (`RLS`) policies on `tenant_memberships`, `course_resources`, `exam_attempts`, `outcome_mastery`, and `feature_entitlements`.
2. Write `supabase/migrations/20261114000002_seed_curriculum.sql` idempotently seeding:
   - `curriculum_versions`: `ETH-BSC-IT-2026-V1`
   - All 5 Themes (`4 + 15 + 6 + 9 + 11 = 45 Credit Hours`)
   - All 15 Canonical Courses (`IT-CMTS-101`, `IT-OOPJ-201`, `IT-ADVP-202`, `IT-EDPR-203`, `IT-SYAD-204`, `IT-ITPM-301`, `IT-FDBS-201`, `IT-ADBS-301`, `IT-IPRG-301`, `IT-IPRG-302`, `IT-MABD-401`, `IT-DCCN-201`, `IT-SNAD-301`, `IT-NDVC-302`, `IT-IASC-401`)
   - At least 3 representative `learning_outcomes` per course mapped across `COGNITIVE`, `AFFECTIVE`, and `PSYCHOMOTOR` domains and Bloom's levels (`REMEMBER` through `CREATE`).

### Task 3: FastAPI Modular Monolith Core, RLS Session Middleware & `StorageAdapter`
1. Create/update `backend/requirements.txt`, `backend/.env.example`, and `docker-compose.dev.yml` (single lightweight `pgvector/pgvector:pg16` container mapped to `54322:5432`).
2. Implement `backend/app/core/config.py` using `pydantic-settings` reading `backend/.env`.
3. Implement `backend/app/database/session.py`:
   - Configure `create_async_engine(settings.DATABASE_URL, connect_args={"statement_cache_size": 0})` so Supabase Transaction Pooler (`6543`) never raises prepared statement errors.
   - Provide an async dependency `get_rls_db_session(current_user, x_tenant_id)` that executes `SELECT set_config('app.current_user_id', :uid, true)` and `SELECT set_config('app.current_tenant_id', :tid, true)` inside the transaction.
4. Implement `backend/app/content/storage_adapter.py` supporting `STORAGE_DRIVER=local` (serving via `/api/v1/dev-storage/{bucket}/{object_key:path}`) and `STORAGE_DRIVER=supabase` (calling `supabase.storage.from_(bucket).create_signed_url()`).
5. Implement `backend/app/main.py` with CORS, request-ID middleware, `/healthz`, and `/api/v1` router.

### Day 1 Verification Gate
Run `pytest backend/tests/` and verify `/healthz`, `StorageAdapter` local read/write, and SQL migration syntax checks pass with exit code 0.
```

---

## Day 2 Prompt — Live Supabase Cloud (`sbvyjbipchglzmttkowy`) Migration Runner & 100-Question HU 2023 Model Exit Exam Seeder

Copy and paste this into Antigravity IDE for **Day 2**:

```text
@docs/SaaS_Database_Architecture_and_System_Specification.md @docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 2 engineering tasks: apply our schema and curriculum migrations to Supabase (`sbvyjbipchglzmttkowy`) and seed the 100-question Haramaya University 2023 Model Exit Exam (`IT Model Exam.pdf`).

### Task 1: Idempotent Database Migration Runner (`backend/scripts/apply_migrations.py`)
1. Write `backend/scripts/apply_migrations.py` that loads `DIRECT_URL` from `backend/.env` (falling back to `DATABASE_URL` with `+asyncpg` stripped), creates a `schema_migrations (filename PRIMARY KEY, checksum, applied_at)` tracking table, and executes all SQL files in `supabase/migrations/` in lexicographical order inside transactions.
2. Add a `--verify` flag to `apply_migrations.py` that queries the database and asserts:
   - `COUNT(*)` on `themes` == 5 and `SUM(total_credit_hours)` == 45
   - `COUNT(*)` on `courses` == 15 and `SUM(credit_hours)` == 45
   - `COUNT(*)` on `learning_outcomes` >= 45
   - RLS is enabled (`relrowsecurity = true`) on `tenant_memberships`, `course_resources`, `exam_attempts`, `outcome_mastery`, and `feature_entitlements`.

### Task 2: Store & Seed the 100-Question HU CCI Model Exit Exam (`backend/scripts/seed_hu_2023_model_exam.py`)
1. Copy `IT Model Exam.pdf` (if present in `docs/`) to `dev_storage/course-packages/past-exams/HU-CCI-IT-Model-Exit-Exam-2023.pdf` via `StorageAdapter`, compute its SHA-256 checksum and byte size, and upsert the `course_resources` record (`type = 'PAST_EXAM'`, `storage_bucket = 'course-packages'`, `storage_object_key = 'past-exams/HU-CCI-IT-Model-Exit-Exam-2023.pdf'`).
2. Ensure `backend/scripts/seed_hu_2023_model_exam.py` upserts:
   - The `exam_blueprints` record: `"HU CCI B.Sc. IT Graduating Class Model Exit Exam (Jan 2023 — 100 Questions)"` (`type = 'NATIONAL_EXIT_SIMULATION'`, `total_questions = 100`, `duration_seconds = 10800`, `is_offline_eligible = TRUE`).
   - All 100 Multiple-Choice Questions (Q1–Q100) and their options (`A`–`F`) using deterministic `uuid5` IDs so re-running the script never duplicates rows, including the reconstructed Markdown code blocks for Q19, Q23, and Q24 and the Markdown table for Q91.
   - A `sync_changes` (`operation = 'UPSERT'`, `entity_type = 'exam_blueprint'`) entry so mobile clients pull the new exam blueprint via `/api/v1/sync/pull`.

### Task 3: Execute Migrations, Seed Database & Verify Server-Side Grading Function
1. Run `python3 backend/scripts/apply_migrations.py --verify`.
2. Run `python3 backend/scripts/seed_hu_2023_model_exam.py --dry-run` followed by live execution against our database.
3. Write and run `backend/tests/test_day2_curriculum_and_seeder.py` verifying that:
   - All 15 canonical course codes (`IT-CMTS-101` to `IT-IASC-401`) and the 100-question HU Model Exit Exam exist.
   - Calling `public.grade_exam_attempt()` on a test attempt with a locked `question_snapshots` JSONB accurately computes `is_correct`, `correct_count`, and `score_percent` strictly on the server.
```

---

## Day 3 Prompt — FastAPI Identity, Rotating Refresh Auth, Multi-Tenant Workspaces & Curriculum REST API (`/api/v1/*`)

Copy and paste this into Antigravity IDE for **Day 3**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md @docs/SaaS_Database_Architecture_and_System_Specification.md

Execute the complete Day 3 backend API implementation for Slice 1 & Slice 2 in `backend/app/`:

### Task 1: Cryptographic Auth, Token Rotation & Device Registry (`backend/app/identity/`)
1. Implement password hashing using `argon2-cffi` (`PasswordHasher`) and JWT signing/verification (`PyJWT`, `HS256`, 15-minute access token TTL).
2. Implement the authentication and device endpoints:
   - `POST /api/v1/auth/register`: Creates global `users` row, seeds default `FREE_TIER` personal `feature_entitlements` grant, and returns user + initial tokens.
   - `POST /api/v1/auth/login`: Authenticates email + password, registers/updates `user_devices`, issues a 15-minute `access_token`, a single-use `refresh_token` (30-day TTL) bound to `refresh_token_family_id`, and a signed 7-day `offline_biometric_grant` payload.
   - `POST /api/v1/auth/refresh`: Rotates `refresh_token`. If a previously rotated/revoked refresh token is replayed, immediately revoke the entire `refresh_token_family_id` across `user_devices` and return `401 TOKEN_REUSE_DETECTED`.
   - `POST /api/v1/auth/logout`: Revokes the active device session.
   - `POST /api/v1/devices/register` and `DELETE /api/v1/devices/{id}`.

### Task 2: Multi-Tenant Workspaces & Entitlements (`backend/app/tenants/` & `backend/app/entitlements/`)
1. Implement `GET /api/v1/me/workspaces`: Returns the user's `Personal Student Workspace` (`tenant_id = null`) plus all active `tenant_memberships` (e.g., institutional student or instructor seats with `organization_name`, `role`, `cohort_name`, and `status`).
2. Implement `POST /api/v1/tenants` (create institutional workspace) and `POST /api/v1/tenants/{id}/invitations` (invite student/instructor to tenant).
3. Implement `GET /api/v1/me/entitlements`: Evaluates all active personal (`tenant_id IS NULL`) and institutional (`tenant_id = X-Tenant-ID`) grants in `feature_entitlements`, returning effective access flags (`offline_download_allowed`, `storage_quota_mb`, `ai_monthly_quota`, `offline_grace_days`, and signed `offline_grant` token).

### Task 3: Curriculum, Course Detail & Practice Catalog Endpoints (`backend/app/curriculum/` & `backend/app/assessments/`)
1. Implement `GET /api/v1/curriculum/themes`: Returns all 5 themes ordered by `theme_number` with nested course summaries (`course_id`, `code`, `title`, `credit_hours`, `version`).
2. Implement `GET /api/v1/courses/{id}`: Returns full course details, `general_objective`, `learning_outcomes` (grouped by domain and Bloom's level), resource count, and exam blueprint count.
3. Implement `GET /api/v1/courses/{id}/resources`: Lists authorized `course_resources` (`tenant_id IS NULL OR tenant_id = current_tenant_id`) with file size, SHA-256 checksum, version, and offline eligibility.
4. Implement `GET /api/v1/exams`: Lists eligible `exam_blueprints` (including the 100-question HU CCI Model Exit Exam and course practice quizzes) filtered by `course_id`, `type`, and `difficulty`.

### Day 3 Verification Gate
Write and run `backend/tests/test_day3_auth_workspaces_and_rls.py` verifying:
1. Full register -> login -> refresh rotation -> replay detection revokes token family.
2. Workspace switching (`X-Tenant-ID`) properly isolates Tenant A resources from Tenant B users under PostgreSQL RLS.
3. `/api/v1/curriculum/themes`, `/api/v1/courses/{id}`, and `/api/v1/exams` return the 5 themes, 15 courses, and 100-question HU Model Exit Exam.
```

---

## Day 4 Prompt — React Native Design System, Network Reachability Engine (`<ConnectionBanner />`), Keychain Storage & Typed API Client

Copy and paste this into Antigravity IDE for **Day 4**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 4 React Native engineering tasks in `mobile/`. Audit existing files in `mobile/src/shared/` and add or upgrade all required modules so connectivity detection, token rotation, and UI components match Section 4, Section 6.2, and Section 7 of the specification:

### Task 1: Network Reachability Observer & `<ConnectionBanner />` (`mobile/src/shared/network/`)
1. Create `mobile/src/shared/network/NetworkContext.tsx`:
   - Observe device connectivity state AND verify actual backend API reachability (`/healthz` ping with 3-second timeout when link is up) so captive portals or dead mobile data connections are accurately detected as `OFFLINE`.
   - Expose `{ isOnline, isReachable, isMetered, dataSaverEnabled, lastVerifiedOnlineAt, checkReachabilityNow }`.
2. Create `mobile/src/shared/components/ConnectionBanner.tsx` (Component #3 in Section 7):
   - Collapses smoothly to `0dp` height when `isOnline && isReachable` and `syncQueueCount === 0` and no grant is expiring.
   - Renders high-contrast WCAG AA banners for:
     - `OFFLINE_WITH_CACHE`: Amber banner `"Offline mode — Showing content synced on [Timestamp]"`
     - `METERED_DATA_SAVER`: Blue pill `"Data Saver active — Large downloads require confirmation"`
     - `SYNCING`: Blue banner `"Syncing N item(s) with server..."`
     - `SYNC_FAILED` / `NEEDS_ATTENTION`: Red banner `"N sync item(s) need attention — Tap to open Sync Center"`
     - `GRANT_EXPIRING`: Amber notice `"Offline access grant expires in <24h — Connect to refresh"`

### Task 2: Zero-Secret Keychain/Keystore Adapter (`mobile/src/shared/secure-storage/`)
1. Audit and enhance `mobile/src/shared/secure-storage/index.ts`:
   - Store `refresh_token`, `device_id` (auto-generated UUIDv4 persisted on first boot), `offline_biometric_grant` (JSON containing `user_id`, `full_name`, `email`, `workspaces[]`, `issued_at`, `expires_at`, and `biometric_enabled`), and wrapped AES-256 package keys exclusively in `expo-secure-store`.
   - Add a helper `isOfflineGrantValid()` that checks `offline_biometric_grant.expires_at > Date.now()` and returns the cached identity for offline login.
   - Enforce that 15-minute `access_token` is held strictly in volatile memory (never written to `AsyncStorage` or SQLite).

### Task 3: Typed API Client with Auto-Refresh & Workspace Scoping (`mobile/src/shared/api/client.ts`)
1. Upgrade `mobile/src/shared/api/client.ts`:
   - Base URL configurable via `EXPO_PUBLIC_API_URL` (defaulting to `http://127.0.0.1:8000/api/v1` so physical Android devices connected via `adb reverse tcp:8000 tcp:8000` reach the host FastAPI server seamlessly).
   - Automatically attach `Authorization: Bearer <accessToken>`, `X-Tenant-ID: <activeWorkspaceId>` (omitted when in Personal Workspace), `X-Device-ID: <deviceId>`, and `Idempotency-Key: <uuid>` on mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Implement a single-flight `401 Unauthorized` interceptor that calls `POST /api/v1/auth/refresh` using the Keychain `refresh_token`, updates the in-memory `access_token` and rotated `refresh_token`, and replays queued requests without race conditions.

### Task 4: Reusable Shell Components (`mobile/src/shared/components/`)
1. Ensure `<AppHeader />`, `<WorkspaceSwitcherChip />`, `<SyncStatusChip />`, `<EntitlementBadge />`, `<PackageDownloadButton />` (supporting all 6 deterministic states: `LOCKED`, `ELIGIBLE`, `QUEUED`, `DOWNLOADING`, `PAUSED`, `AVAILABLE_OFFLINE`, `EXPIRED`), and `<InlineError />` are exported from `mobile/src/shared/components/index.ts` and enforce `minHeight: 48, minWidth: 48` touch targets.

### Day 4 Verification Gate
Write and run Jest unit tests in `mobile/src/tests/network_and_api_client.test.ts` testing:
1. `<ConnectionBanner />` state rendering across Online, Offline with cache, Sync Pending, and Expired Grant states.
2. Single-flight `401` token refresh rotation and `X-Tenant-ID` header scoping in `client.ts`.
3. `npm run typecheck && npm test` passes with 0 errors.
```

---

## Day 5 Prompt — 13-Table SQLite/SQLCipher Offline Database Engine, Repositories & Sub-16ms Query Benchmarks

Copy and paste this into Antigravity IDE for **Day 5**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 5 offline database and repository layer engineering tasks in `mobile/src/shared/database/`:

### Task 1: Complete 13-Table Local Schema, WAL Mode & Migration Runner (`schema.ts` & `db.ts`)
1. Audit `mobile/src/shared/database/schema.ts` and `db.ts` to ensure all 13 tables from Section 8.2 exist with strict foreign keys (`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;`) and composite indexes:
   - `local_themes`, `local_courses`, `local_outcomes`, `local_resources`, `download_packages`, `local_exam_packages`, `local_exam_attempts`, `local_answer_events`, `sync_operations`, `sync_state`, `local_bookmarks`, `local_progress_cache`, `device_profile`.
2. Ensure `db.ts` provides a clean `withTransaction(async (tx) => { ... })` helper so multi-statement writes (such as saving an exam answer event + updating the attempt timestamp, or applying a `/sync/pull` batch + advancing `sync_state.opaque_cursor`) execute atomically.

### Task 2: Domain Repositories & Eviction Safety Guards (`mobile/src/shared/database/`)
1. Implement/upgrade `curriculumRepository.ts`:
   - `upsertCurriculumSnapshot(themes, courses, outcomes)` inside a single transaction.
   - `getThemesWithOfflineStatus(searchQuery?, offlineOnly?)` joining `local_themes`, `local_courses`, and `download_packages`.
   - `getCoursesByTheme(themeId)` and `getCourseOverview(courseId)` returning course metadata, grouped Bloom's `local_outcomes`, cached `local_resources`, and cached `local_exam_packages`.
   - Include a built-in offline seed fallback of the 5 Themes and 15 canonical B.Sc. IT courses (`IT-CMTS-101` to `IT-IASC-401`, 45 Credits) so first-time offline evaluation or Jest tests work deterministically even before first pull.
2. Implement `examAttemptRepository.ts`:
   - `createLocalAttempt(examPackageId, userId, tenantId)` creating an `IN_PROGRESS` row in `local_exam_attempts`.
   - `saveAnswerTransactional(localAttemptId, questionId, selectedOptionId, isFlagged)` inserting an append-only row with monotonic `sequence_no` into `local_answer_events` and updating `local_exam_attempts` in one transaction (`NFR-03`).
   - `submitAttemptOfflineTransactional(localAttemptId)` transitioning `local_exam_attempts.status = 'SUBMITTED_LOCAL_PENDING'` and inserting a `sync_operations` row (`operation_id = UUIDv4`, `type = 'exam_attempt.submit'`, `state = 'QUEUED'`).
3. Implement `storageGuardRepository.ts`:
   - `getProtectedCounts(userId)` returning the count of `IN_PROGRESS` / `SUBMITTED_LOCAL_PENDING` exam attempts and unaccepted `sync_operations`.
   - `evictEligibleCacheOnly(targetBytesToFree)` implementing the hard guardrail from `MOB-27`: **never** delete or evict `local_exam_attempts`, `local_answer_events`, or `sync_operations`, and never delete a `download_package` referenced by an active attempt.

### Day 5 Verification Gate
Write and run `mobile/src/tests/offline_database_repositories.test.ts` verifying:
1. Transactional answer persistence (`saveAnswerTransactional`) commits both `local_answer_events` and `local_exam_attempts` and survives simulated restart.
2. `submitAttemptOfflineTransactional` creates an immutable `sync_operations` entry with a UUID `operation_id`.
3. `evictEligibleCacheOnly` refuses to touch active exam attempts or pending sync operations.
4. `npm run typecheck && npm test` passes 100%.
```

---

## Day 6 Prompt — Authentication Stack (`MOB-01` to `MOB-04`), Offline Biometric Unlock & Multi-Workspace Switcher

Copy and paste this into Antigravity IDE for **Day 6**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 6 authentication, biometric offline unlock, and multi-workspace switching tasks across `mobile/src/services/auth-session/` and `mobile/src/features/auth/` (`MOB-01` through `MOB-04`):

### Task 1: Auth Session Service & Logout Safety Protocol (`AuthSessionContext.tsx`)
1. Upgrade `mobile/src/services/auth-session/AuthSessionContext.tsx`:
   - Connect `signIn(email, password)`, `register(fullName, email, password)`, and `refreshWorkspaces()` to our real FastAPI endpoints (`/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/me/workspaces`, `/api/v1/me/entitlements`) via `apiClient`, with graceful local fallback in development if the server is unreachable.
   - Upon successful online login, store the rotating `refresh_token` and a 7-day `offline_biometric_grant` (including user profile and workspaces list) in `secure-storage`.
   - Implement `unlockOfflineWithBiometrics()`: checks `isOfflineGrantValid()`, prompts OS biometric verification (`Fingerprint / Face ID` via `expo-local-authentication` with safe dev fallback on emulators), and restores the user's cached session and workspace in Airplane Mode (`MOB-02`).
   - Implement `switchWorkspace(workspaceId)`: updates `activeWorkspace`, sets the `X-Tenant-ID` header on `apiClient`, and triggers a scoped data refresh without leaking tenant data into Personal Workspace.
   - Implement the **Logout Safety Protocol (Section 6.4)**: before signing out, query `storageGuardRepository.getProtectedCounts(user.id)`. If unsynced `sync_operations` or `IN_PROGRESS` exam attempts exist, return a warning state requiring explicit user confirmation (`"Sync Now First"` vs. `"Sign Out & Keep Encrypted Queue for My Account"`).

### Task 2: Polish & Wire `MOB-01` through `MOB-04` Screens (`mobile/src/features/auth/`)
1. `MOB-01` (`WelcomeScreen.tsx`):
   - 3-slide value proposition carousel (5 Themes / 15 Courses / 45 Credits; Offline Wi-Fi Package Downloads; Bloom's Taxonomy Mastery Tracking).
   - Live language selector pill (`English`, `Afaan Oromo`, `Amharic` i18n dictionary hook).
   - Inline offline banner disabling `Create Free Account` when `!isOnline` with clear copy: `"Internet connection required for first-time account creation."`
2. `MOB-02` (`SignInScreen.tsx`):
   - Email/Institutional ID + Password inputs with inline validation, `Sign In` CTA, and `Sign In with Institution SSO` (OIDC PKCE flow hook).
   - Conditional **Offline Biometric Unlock Card** rendered automatically when `!isOnline && hasValidOfflineGrant`: shows cached user name, grant expiry timestamp, and `"Unlock Offline Library with Fingerprint / Face ID"` button.
3. `MOB-03` (`CreateAccountScreen.tsx`):
   - Full Name, Email, Password with live strength checklist, Terms/Privacy consent checkbox, and 6-digit identity verification step.
4. `MOB-04` (`WorkspaceSelectionScreen.tsx`):
   - Lists `Personal Student Workspace` (`B2C`) alongside all institutional memberships (`e.g., Haramaya University — College of Computing and Informatics • Student Seat`) with role badge, entitlement summary, and offline availability indicator.

### Day 6 Verification Gate
Write and run `mobile/src/tests/auth_and_workspace_flows.test.ts` verifying:
1. Online login persists `offline_biometric_grant` in secure storage and routes to `MOB-04` when multiple workspaces exist.
2. In Airplane Mode (`isOnline = false`), `MOB-02` displays the Offline Biometric Unlock Card and unlocks into the cached workspace.
3. Attempting to sign out while an unsynced exam operation exists triggers the Section 6.4 Logout Safety warning.
```

---

## Day 7 Prompt — Home Dashboard & Curriculum Discovery (`MOB-05` to `MOB-08`) + End-to-End USB/`scrcpy` Airplane-Mode Verification

Copy and paste this into Antigravity IDE for **Day 7**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 7 tasks for `MOB-05` through `MOB-08` (`mobile/src/features/home/` and `mobile/src/features/curriculum/`) and build our Week 1 end-to-end verification script for Fedora Linux + Android (`scrcpy`/ADB):

### Task 1: Live Sync + Sub-16ms SQLite Rendering on `MOB-05` to `MOB-08`
1. `MOB-05` (`HomeDashboardScreen.tsx`):
   - Top `<AppHeader />` with `<WorkspaceSwitcherChip />` (opens workspace switcher modal), `<SyncStatusChip />` (live count from `sync_operations`), and Notification bell.
   - `<ConnectionBanner />` directly below header.
   - **Zone 1 (Continue Learning Hero Card)**: Dynamically queries the most recent `IN_PROGRESS` exam attempt from `local_exam_attempts` or the most recent bookmark from `local_bookmarks` (falling back to `IT-CMTS-101` for new users) with a direct resume CTA.
   - **Zone 2 (Offline Readiness Strip)**: Live counts from SQLite for `Downloaded Courses`, `Offline Exam Packages`, and `Pending Sync Items`.
   - **Zone 3 (Weak-Outcome Practice Recommendations)**: Queries lowest-mastery outcomes from `local_outcomes` / `local_progress_cache` and offers one-tap practice launch.
   - **Zone 4 (Recent Courses & Study Streak Pill)**: Horizontal course strip + daily streak counter.
2. `MOB-06` (`ThemeCatalogScreen.tsx`):
   - Renders immediately (`<16ms`) from `curriculumRepository.getThemesWithOfflineStatus()` while refreshing from `GET /api/v1/curriculum/themes` in the background when online.
   - Instant search input (filtering across theme titles, course codes `IT-CMTS-101`..`IT-IASC-401`, and course titles) and `All Themes` | `Available Offline` filter chips.
3. `MOB-07` (`CourseListScreen.tsx`):
   - Displays all courses for the selected theme with course code pill, credit hours badge, `<EntitlementBadge />`, outcome mastery progress bar, and interactive `<PackageDownloadButton />` showing exact MB size.
4. `MOB-08` (`CourseOverviewScreen.tsx`):
   - Course header with code, title, credit hours, general objective, and **Course Package Control Card** (`Package v1 • Last updated timestamp • Download / Available Offline`).
   - 3 Segmented Tabs:
     - `Outcomes`: Lists `local_outcomes` grouped by `COGNITIVE`, `AFFECTIVE`, `PSYCHOMOTOR` and Bloom's level badge (`REMEMBER` -> `CREATE`) with mastery score bars.
     - `Resources`: Lists course resources from `local_resources` (including the seeded `Haramaya University CCI — B.Sc. IT Model Exit Exam (Jan 2023 PDF)`).
     - `Practice`: Lists eligible course quizzes and the seeded 100-question `HU CCI B.Sc. IT Graduating Class Model Exit Exam` with question count (`100 Questions`), duration (`180 mins`), and `Start / View Instructions` CTA.
   - Bottom `Ask AI Course Tutor` button (enabled when online; shows `"Online connection required for AI Tutor"` notice when offline).

### Task 2: Week 1 End-to-End Verification Script & USB/`scrcpy` Helper (`scripts/verify_week1.sh`)
1. Create an executable script `scripts/verify_week1.sh` that:
   - Runs `pytest` across the entire `backend/tests/` suite.
   - Runs `npm run typecheck` and `npm test` inside `mobile/`.
   - Checks if an Android device (`Samsung Galaxy A05s` / `A04s`) is connected via `adb devices`, and if present, automatically configures `adb reverse tcp:8000 tcp:8000` and `adb reverse tcp:8081 tcp:8081` so the physical phone over `scrcpy` connects directly to local FastAPI (`:8000`) and Metro (`:8081`).
2. Run `bash scripts/verify_week1.sh` and confirm 100% of backend and mobile tests pass.
```

---

## Quick Reference: How to Run Each Day in Antigravity IDE

| Day | What You Do Before Pasting the Prompt | Command to Verify Completion |
| :--- | :--- | :--- |
| **Day 1** | Ensure the 4 spec files are inside `docs/` and `backend/.env` has your Supabase credentials. | `cd backend && pytest` |
| **Day 2** | Place `IT Model Exam.pdf` inside `docs/IT Model Exam.pdf`. | `python3 backend/scripts/apply_migrations.py --verify` |
| **Day 3** | None — paste the Day 3 prompt directly. | `cd backend && pytest tests/test_day3_auth_workspaces_and_rls.py` |
| **Day 4** | None — paste the Day 4 prompt directly. | `cd mobile && npm run typecheck && npm test` |
| **Day 5** | None — paste the Day 5 prompt directly. | `cd mobile && npx jest src/tests/offline_database_repositories.test.ts` |
| **Day 6** | None — paste the Day 6 prompt directly. | `cd mobile && npx jest src/tests/auth_and_workspace_flows.test.ts` |
| **Day 7** | Plug in your Samsung Galaxy phone via USB (optional, for `adb reverse` + `scrcpy`). | `bash scripts/verify_week1.sh` |
