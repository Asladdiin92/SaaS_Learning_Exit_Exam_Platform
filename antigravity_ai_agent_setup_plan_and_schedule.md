# Antigravity IDE AI Agent Setup, Master Instructions, Project Plan & 28-Day Schedule
**Project: `SaaS_Learning_Exit_Exam_Platform` | Supabase Ref: `sbvyjbipchglzmttkowy` (`eu-west-1`)**

| Configuration Item | Detected Value from Your Workspace |
| :--- | :--- |
| **IDE & Agent Runtime** | Antigravity IDE (`Gemini 3.8 Flash High` • `Turbo` Mode) |
| **Local Project Directory** | `SaaS_Learning_Exit_Exam_Platform` |
| **Host Environment** | Fedora Linux (8GB RAM) + Android physical device testing (`scrcpy` over USB/Wi-Fi) |
| **Supabase Organization & Project** | `SaaS_Project` $\rightarrow$ `Asladdiin93's Project` (`main` / `PRODUCTION`) |
| **Supabase Project Ref & URL** | `sbvyjbipchglzmttkowy` • `https://sbvyjbipchglzmttkowy.supabase.co` |
| **Supabase Database Region & Tier** | `West EU (Ireland)` (`eu-west-1`) • `Nano` Compute (`60` max direct connections) |

## 1. Quick-Start Terminal Setup (Run Before Your First Agent Prompt)

Because your Supabase instance (`sbvyjbipchglzmttkowy`) is already live and healthy on the `Nano` tier in `eu-west-1` (and you are developing on an 8GB RAM Fedora machine), you have a huge advantage: **you do not need to run a heavy local 10-container Supabase Docker stack**. You can either connect FastAPI directly to your Supabase Cloud project or use the single lightweight `pgvector/pgvector:pg16` container (`<150 MB RAM`) when coding offline.

### Step 1.1: Place Your 4 Reconciled Specification Files into `docs/`
Inside your `SaaS_Learning_Exit_Exam_Platform` project folder, create a `docs/` directory and place the 4 reconciled files inside it so you can `@mention` them in Antigravity IDE:

```bash
mkdir -p docs supabase/migrations backend web mobile
```

Place these 4 files in `docs/`:
1. `docs/Education_SaaS_Platform_System_Analysis_and_Design.docx`
2. `docs/SaaS_Database_Architecture_and_System_Specification.md`
3. `docs/unified_education_saas_mobile_and_system_specification.md`
4. `docs/SaaS_Learning_and_Exam_Platform_Implementation_and_Architecture_Guide.md`

### Step 1.2: Get Your 2 Credentials from the Supabase Dashboard (`sbvyjbipchglzmttkowy`)
In your open browser tab (`https://supabase.com/dashboard/project/sbvyjbipchglzmttkowy`):
1. Click the green **`Connect`** button at the top bar:
   * Copy the **Transaction Pooler string (Port `6543`)** $\rightarrow$ use this for `DATABASE_URL` in FastAPI (`postgresql+asyncpg://postgres.sbvyjbipchglzmttkowy:[YOUR-DB-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`).
   * Copy the **Session Pooler / Direct string (Port `5432`)** $\rightarrow$ use this for `DIRECT_URL` when running SQL migrations (`postgresql://postgres.sbvyjbipchglzmttkowy:[YOUR-DB-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`).
2. In the left sidebar, click **Project Settings (Gear Icon) $\rightarrow$ API**:
   * Copy `anon` `public` key $\rightarrow$ `SUPABASE_ANON_KEY`
   * Copy `service_role` `secret` key $\rightarrow$ `SUPABASE_SERVICE_ROLE_KEY` *(Backend only — never expose in React Native or Next.js public env)*
3. In the left sidebar, click **Storage $\rightarrow$ New Bucket**:
   * Create a **Private** bucket named exactly: `course-packages`

## 2. Persistent Workspace Rules (`AGENTS.md` / `.antigravity/rules.md`)

Tell your Antigravity agent to save the following block as `AGENTS.md` in the root of `SaaS_Learning_Exit_Exam_Platform`. Antigravity automatically reads `AGENTS.md` on every turn so the agent never drifts from your architecture.

```markdown
# AGENTS.md — Master Engineering Rules for SaaS_Learning_Exit_Exam_Platform

## 1. Authoritative Specification Baseline
Always follow the reconciled v2.1 specifications in `docs/`:
- `docs/unified_education_saas_mobile_and_system_specification.md` (30-screen React Native UI/UX, 13-table SQLCipher schema, 27 `/api/v1/*` endpoints, ADR-001..009)
- `docs/SaaS_Database_Architecture_and_System_Specification.md` (PostgreSQL 16 + pgvector(384) DDL, RLS policies, server-side grading)
- `docs/SaaS_Learning_and_Exam_Platform_Implementation_and_Architecture_Guide.md` (5 Themes, 15 Courses, 45 Credit Hours, vertical-slice build order)

## 2. Locked Technology Stack & Architectural Invariants (ADR-001 to ADR-009)
1. **Backend (`backend/`)**: Python 3.12 + FastAPI modular monolith (`backend/app/` with 15 domain modules). Do NOT introduce NestJS, Golang, or microservices.
2. **Database & Migrations (`supabase/migrations/`)**: PostgreSQL 16 with `pgvector(384)` (matching `all-MiniLM-L6-v2`). All DDL lives in `supabase/migrations/YYYYMMDDHHMMSS_*.sql` with the `auth.uid()` / `public.current_app_user_id()` compatibility shim.
3. **Supabase Cloud Connection (`sbvyjbipchglzmttkowy` in `eu-west-1`)**:
   - Project URL: `https://sbvyjbipchglzmttkowy.supabase.co`
   - FastAPI runtime queries use `DATABASE_URL` (Transaction Pooler port `6543` with `statement_cache_size=0` for PgBouncer compatibility).
   - Schema migrations use `DIRECT_URL` (Session Pooler port `5432`).
4. **Storage Parity (`ADR-009`)**: Store relative `(storage_bucket, storage_object_key)` on `course_resources` (`bucket = 'course-packages'`). Resolve download URLs exclusively through `StorageAdapter` (`STORAGE_DRIVER=local` or `supabase`).
5. **Identity & Multi-Tenancy (`ADR-002`)**: Global `users` table + many-to-many `tenant_memberships`. Never put a single `tenant_id` column on `users`. Scope requests via `X-Tenant-ID` header (`NULL` = Personal Workspace).
6. **Entitlements & Payments (`ADR-003`, `ADR-008`)**: Client screens never decide paid access from tier names. Evaluate `feature_entitlements` on the server; activate orders only after signature-verified webhook events (`payment_events`).
7. **Immutable Exam Snapshots & Server Scoring (`ADR-005`, `FR-009`)**: Lock `question_snapshots` JSONB at attempt creation. Never accept `is_correct` from clients. Offline attempts save transactionally to `local_answer_events` (`<16ms`) and display as `Provisional / Awaiting Server Sync` until scored by `public.grade_exam_attempt()`.
8. **Opaque Monotonic Sync Cursors (`ADR-006`)**: Use `sync_changes(change_seq)` + `TOMBSTONE` operations for `/api/v1/sync/pull` and UUID `operation_id` idempotency for `/api/v1/sync/push`. Never rely on device wall-clock timestamps.
9. **Mobile Client (`mobile/`) & 8GB RAM Host Discipline**: React Native + TypeScript covering `MOB-01` to `MOB-30` and the 13-table SQLCipher database. Keep background watchers light for an 8GB RAM Fedora host and test Android builds on physical devices via ADB/`scrcpy`.
```

## 3. Copy-Paste Kickoff Prompts for Antigravity IDE

### Prompt 1 — Project Bootstrap, `AGENTS.md`, Supabase Migration & FastAPI Skeleton (Paste This First!)

Copy and paste the prompt below directly into your Antigravity IDE chat box:

```text
@docs/unified_education_saas_mobile_and_system_specification.md @docs/SaaS_Database_Architecture_and_System_Specification.md @docs/SaaS_Learning_and_Exam_Platform_Implementation_and_Architecture_Guide.md

We are starting Slice 1 of the SaaS_Learning_Exit_Exam_Platform monorepo. Please execute the following setup steps cleanly and sequentially:

1. Create `AGENTS.md` in the repository root locking in ADR-001 through ADR-009, our Supabase project (`sbvyjbipchglzmttkowy`, URL `https://sbvyjbipchglzmttkowy.supabase.co`, region `eu-west-1`), and our 8GB RAM Fedora development constraints.
2. Create the monorepo folder structure:
   - `supabase/migrations/`
   - `backend/app/{core,api/v1,identity,tenants,curriculum,content,assessments,learning,commerce,entitlements,mobile_sync,ai,analytics,notifications,audit,database,workers}`
   - `backend/tests/`
   - `web/` (placeholder README for Next.js portal)
   - `mobile/` (placeholder README for React Native student client)
   - `dev_storage/course-packages/`
3. Create `.env.example` and `.gitignore` at the root and in `backend/` pre-configured for Supabase project `sbvyjbipchglzmttkowy` (`https://sbvyjbipchglzmttkowy.supabase.co`), including `DATABASE_URL` (port 6543 with asyncpg), `DIRECT_URL` (port 5432), `STORAGE_DRIVER=local`, `STORAGE_BUCKET=course-packages`, and `JWT_SECRET_KEY`.
4. Write `supabase/migrations/20261114000001_init_reconciled_schema.sql` containing the complete reconciled PostgreSQL 16 + `pgvector(384)` schema, the `auth.uid()` compatibility shim, `public.current_app_user_id()`, `public.current_app_tenant_id()`, `public.grade_exam_attempt()`, and all Row-Level Security (RLS) policies.
5. Write `supabase/migrations/20261114000002_seed_curriculum.sql` seeding `curriculum_versions` (`ETH-BSC-IT-2026-V1`), all 5 Themes (45 Credit Hours), all 15 canonical B.Sc. IT Courses (`IT-CMTS-101` through `IT-IASC-401`), and initial `learning_outcomes`.
6. Create `docker-compose.dev.yml` with the lightweight single-container `pgvector/pgvector:pg16` setup (mapped to port `54322`) so we can test offline without consuming >150 MB RAM.
7. Build the FastAPI foundation in `backend/`:
   - `backend/requirements.txt` (`fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `pydantic-settings`, `pyjwt`, `argon2-cffi`, `supabase`, `pytest`, `httpx`)
   - `backend/app/core/config.py` (with `statement_cache_size=0` on the asyncpg engine so Supabase Transaction Pooler port 6543 works without prepared-statement errors)
   - `backend/app/database/session.py` (setting `app.current_user_id` and `app.current_tenant_id` per transaction for RLS)
   - `backend/app/content/storage_adapter.py` (`StorageAdapter` supporting both `local` disk and `supabase` signed URLs)
   - `backend/app/main.py` with `/healthz` and `/api/v1` router mount.
8. Run `pytest` on a smoke test verifying the FastAPI app boots and `/healthz` returns 200 OK.
```

### Prompt 2 — Apply Migrations to Supabase Cloud (`sbvyjbipchglzmttkowy`) & Build Slice 1 Backend Auth

Once Prompt 1 completes and you have pasted your real Supabase DB password into `backend/.env`, give the agent this prompt:

```text
Now let's complete Slice 1 (Identity, Multi-Tenant Workspaces & Cross-Tenant RLS Verification):

1. Write a lightweight Python migration runner script `backend/scripts/apply_migrations.py` that connects via `DIRECT_URL` and applies `supabase/migrations/20261114000001_init_reconciled_schema.sql` and `supabase/migrations/20261114000002_seed_curriculum.sql` idempotently to our Supabase database (`sbvyjbipchglzmttkowy`), then verifies that all 5 themes and 15 courses (`IT-CMTS-101` to `IT-IASC-401`) exist.
2. Implement the Slice 1 endpoints in `backend/app/identity/` and `backend/app/tenants/`:
   - `POST /api/v1/auth/register` (global `users` creation with Argon2id hashing)
   - `POST /api/v1/auth/login` (15-min access JWT + rotating refresh token bound to `user_devices`)
   - `POST /api/v1/auth/refresh` (single-use refresh token rotation + token-family revocation on reuse)
   - `POST /api/v1/auth/logout`
   - `GET /api/v1/me/workspaces` (returns Personal Workspace + all active `tenant_memberships`)
   - `POST /api/v1/tenants` and `POST /api/v1/tenants/{id}/invitations`
   - `GET /api/v1/curriculum/themes` and `GET /api/v1/courses/{id}`
3. Write integration tests in `backend/tests/test_slice1_auth_and_rls.py` proving:
   - A single user can authenticate and list both their Personal Workspace and an Institution Workspace.
   - Row-Level Security blocks User A in Tenant A from reading or mutating Tenant B's protected records.
```

### Prompt 3 — Initialize React Native Mobile App (`MOB-01` to `MOB-08`) & 13-Table SQLCipher DB

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Let's build the React Native mobile foundation (`mobile/`) for Slices 1 & 2 (`MOB-01` through `MOB-08`):

1. Scaffold the TypeScript React Native project in `mobile/` following the exact directory structure in Section 8.1 (`src/app`, `src/features`, `src/shared`, `src/services`).
2. Implement the design system tokens (`src/shared/theme/`) with the Light/Dark WCAG AA hex palette, typography scale, and 48dp minimum touch targets.
3. Implement `src/shared/database/` with the 13-table local SQLite/SQLCipher schema (`local_themes` through `device_profile`) and transactional migration runner.
4. Implement `src/shared/secure-storage/` wrapping iOS Keychain / Android Keystore for the rotating refresh token and biometric unlock policy (zero secrets in AsyncStorage).
5. Build `AuthStack` (`MOB-01` Welcome, `MOB-02` SignIn with Offline Biometric Unlock Card, `MOB-03` CreateAccount, `MOB-04` WorkspaceSelection) and `StudentTabs` with `MOB-05` HomeDashboard, `MOB-06` ThemeCatalog, `MOB-07` CourseList, and `MOB-08` CourseOverview connected to our FastAPI `/api/v1` endpoints and cached in local SQLite for instant (<16ms) offline rendering.
```

### Prompt 4 — Slice 3: Protected Resource Downloads, `StorageAdapter` & Reader (`MOB-09` to `MOB-12`)

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Let's implement Slice 3 (Course Resources, Signed Download Grants, Protected Content Reader & Download Manager):

1. In `backend/app/content/`, implement `GET /api/v1/courses/{id}/resources` and `POST /api/v1/resources/{id}/download-grant` using `StorageAdapter` (`course-packages` bucket) to verify `feature_entitlements`, issue signed download URLs, SHA-256 checksums, and wrapped AES-256 keys.
2. In `mobile/src/services/download-manager/`, implement resumable chunked downloads, SHA-256 checksum verification before activation, and LRU cache cleanup that protects active exams and unsynced operations.
3. Build screens `MOB-09` (ResourceLibrary), `MOB-10` (ResourceDetail), `MOB-11` (ProtectedContentReader with dynamic user `<WatermarkOverlay />`, Android `FLAG_SECURE`, and 3-second debounced bookmark persistence), and `MOB-12` (DownloadManager).
```

### Prompt 5 — Slice 4 & 5: Locked Exam Runner, Server Grading & Opaque-Cursor Sync (`MOB-13` to `MOB-20`, `MOB-28`)

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Let's implement Slices 4 & 5 (Immutable Exam Snapshots, Locked Exam Runner, Server-Only Grading & Opaque-Cursor Delta Sync):

1. In `backend/app/assessments/`, implement `GET /api/v1/exams`, `POST /api/v1/exams/{id}/attempts` (serializing immutable `question_snapshots` without exposing `is_correct` keys), `POST /api/v1/attempts/{id}/answers`, and `POST /api/v1/attempts/{id}/submit` calling `public.grade_exam_attempt()`.
2. In `backend/app/mobile_sync/`, implement `GET /api/v1/sync/pull` (using monotonic `sync_changes.change_seq` and `TOMBSTONE` rows), `POST /api/v1/sync/push` (idempotent on `operation_id` UUID), and `GET /api/v1/sync/status`.
3. In `mobile/src/features/exams/` and `sync/`, build:
   - `MOB-13` PracticeCatalog & `MOB-14` ExamInstructions
   - `MOB-15` ExamRunner inside `ExamSessionStack` (commits each selected option to `local_answer_events` in a SQLite transaction BEFORE showing "Saved Locally ✓", uses monotonic timer checkpoints, and renders the 120-question virtualized `<QuestionPaletteSheet />`)
   - `MOB-16` SubmitConfirmation, `MOB-17` SubmissionStatus (6-step tracker), `MOB-18` ExamResult (distinguishing `Server Verified ✓` vs. `Submitted Offline — Awaiting Server Validation / Provisional`), `MOB-19` AnswerReview, `MOB-20` AttemptHistory, and `MOB-28` SyncCenter.
```

### Prompt 6 — Slice 6, 7 & 8: Mastery Analytics, RAG AI Tutor, Commerce & Production Hardening (`MOB-21` to `MOB-30`)

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Let's complete Slices 6, 7 & 8 (Progress Analytics, Grounded RAG AI Tutor, Provider-Abstracted Commerce, and Profile/Security Controls):

1. Backend:
   - `GET /api/v1/me/progress` (theme readiness, Bloom's cognitive distribution, and controlled DuckDB/Parquet analytical snapshot watermarks)
   - `POST /api/v1/ai/tutor/messages` (`pgvector(384)` retrieval using `all-MiniLM-L6-v2` with course chunk citations and monthly quota metering)
   - `GET /api/v1/products`, `POST /api/v1/orders`, `POST /api/v1/checkout-sessions`, `POST /api/v1/webhooks/{provider}` (Chapa, Telebirr, Stripe, Sandbox adapter), `GET /api/v1/me/entitlements`, and `/api/v1/devices/*`.
2. Mobile:
   - `MOB-21` ProgressOverview & `MOB-22` CourseProgress
   - `MOB-23` ProfileHome (with unsynced-queue logout safety warning), `MOB-24` PlansAndAccess (separating Personal Plans vs. University Seats), `MOB-25` Store, `MOB-26` CheckoutStatus (webhook polling), `MOB-27` StorageSettings, `MOB-29` DevicesAndSecurity, and `MOB-30` Notifications, Language & Offline Help.
```

## 4. Structured 28-Day (4-Week) Project Execution Schedule

This schedule is calibrated for solo/AI-assisted development in Antigravity IDE on your Fedora machine, pacing work into verifiable vertical slices so you have a working build at the end of every single week.

| Week & Days | Target Vertical Slice | Daily Engineering Deliverables | End-of-Slice Verification Gate |
| :--- | :--- | :--- | :--- |
| **Week 1: Days 1–3** | **Slice 1A: Repo, Supabase DB & FastAPI Core** | **Day 1**: Create `AGENTS.md`, monorepo folders, `.env`, and run Prompt 1.<br>**Day 2**: Apply `20261114000001_init_reconciled_schema.sql` and `20261114000002_seed_curriculum.sql` to Supabase (`sbvyjbipchglzmttkowy`).<br>**Day 3**: Build FastAPI Auth (`/register`, `/login`, `/refresh`, `/logout`) + `/me/workspaces` and RLS session middleware. | `pytest` passes 100% on auth token rotation and cross-tenant RLS isolation against PostgreSQL 16. |
| **Week 1: Days 4–7** | **Slice 1B & 2: Mobile Shell, SQLCipher & Curriculum** | **Day 4**: Scaffold React Native (`mobile/`), theme tokens, and Keychain/Keystore adapter.<br>**Day 5**: Run SQLCipher 13-table spike on Android device over `scrcpy`/USB.<br>**Day 6**: Build `MOB-01`..`04` (Auth + Biometric Unlock + Workspace Switcher).<br>**Day 7**: Build `MOB-05`..`08` (Home, 5 Themes, 15 Courses, Course Overview). | App signs in on physical Android phone, switches workspaces, and browses all 15 IT courses in Airplane Mode. |
| **Week 2: Days 8–11** | **Slice 3: StorageAdapter, Downloads & Reader** | **Day 8**: Configure `course-packages` bucket in Supabase Storage; build FastAPI `StorageAdapter` + `/resources/{id}/download-grant`.<br>**Day 9**: Build mobile resumable downloader + SHA-256 checksum verifier.<br>**Day 10**: Build `MOB-09`..`10` & `MOB-12` (Resource Library, Detail, Download Manager).<br>**Day 11**: Build `MOB-11` Protected Content Reader (AES-256 RAM stream, `<WatermarkOverlay />`, `FLAG_SECURE`). | Encrypted course PDF/note downloads over Wi-Fi, verifies SHA-256, and opens offline with watermark and screen-capture block. |
| **Week 2: Days 12–14** | **Slice 4: Assessment Engine & Locked Exam Runner** | **Day 12**: Build `/exams`, `/exams/{id}/attempts` (immutable `question_snapshots`), and `public.grade_exam_attempt()`.<br>**Day 13**: Build `MOB-13`..`15` (Practice Catalog, Instructions, Locked Exam Runner with `<16ms` transactional SQLite save & 120-Q palette).<br>**Day 14**: Build `MOB-16`, `MOB-18`..`20` (Submit Confirm, Result, Review, History). | Force-closing the app mid-exam on Question 12 restores exact state, timer, and answers on relaunch; server grades attempt accurately. |
| **Week 3: Days 15–18** | **Slice 5: Opaque-Cursor Sync Engine & Recovery** | **Day 15**: Build `sync_changes` ledger triggers and `/sync/pull`, `/sync/push`, `/sync/status` in FastAPI.<br>**Day 16**: Build mobile `sync-engine` (atomic pull batch cursor commit + UUID idempotent push).<br>**Day 17**: Build `MOB-17` (Submission Status stepper) & `MOB-28` (Sync Center: Pending, Rejected, History).<br>**Day 18**: Chaos test offline exam submissions, duplicate push retries, and expired grants. | Airplane-mode exam completion shows `Provisional / Awaiting Sync`, syncs exactly once on reconnect, and updates to `Server Verified ✓`. |
| **Week 3: Days 19–21** | **Slice 6: Mastery Analytics, Lake Mirror & RAG Tutor** | **Day 19**: Build `/me/progress` (Theme & Bloom's mastery) + `MOB-21`..`22` Progress screens.<br>**Day 20**: Build Python PDF ingestion + `all-MiniLM-L6-v2` (`pgvector(384)`) + `/ai/tutor/messages` with source citations.<br>**Day 21**: Build DuckDB + Parquet/Iceberg analytical mirror with `snapshot_id` watermark. | Progress charts display server-validated mastery + freshness timestamp; AI Tutor answers questions citing exact course chunks. |
| **Week 4: Days 22–25** | **Slice 7: Commerce, Webhooks & Next.js Portals** | **Day 22**: Build `/products`, `/orders`, `/checkout-sessions`, `/webhooks/{provider}` (Chapa/Telebirr/Stripe/Sandbox), and `/me/entitlements`.<br>**Day 23**: Build `MOB-24`..`26` (Plans & Access, Store, Checkout Status polling).<br>**Day 24–25**: Build Next.js (`web/`) Instructor question/resource authoring portal and Institution Admin seat/cohort dashboard. | Simulated webhook event activates entitlement idempotently; Institution Admin assigns a seat and views privacy-thresholded cohort report. |
| **Week 4: Days 26–28** | **Slice 8: Storage Guard, Security & Pilot Launch** | **Day 26**: Build `MOB-23`, `MOB-27`, `MOB-29`, `MOB-30` (Profile, LRU Storage Guard, Device Registry, Offline Help) + Logout queue guard.<br>**Day 27**: Profile memory/FPS on Samsung Galaxy A04s/A05s; run full security/RLS regression suite.<br>**Day 28**: Tag `v1.0.0-pilot`, verify Supabase PITR/backups, and package pilot Android APK/AAB. | Zero unsynced data lost during cache cleanup or logout; pilot build runs smoothly at 60fps on target Android devices. |
