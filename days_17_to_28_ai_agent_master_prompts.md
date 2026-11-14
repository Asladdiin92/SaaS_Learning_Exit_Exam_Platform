# Days 17–28 Comprehensive AI Code Agent Prompts (Slices 5B, 6, 7 & 8 — To Pilot Launch)
**Project: `SaaS_Learning_Exit_Exam_Platform` | IDE: Antigravity (`Gemini 3.8 Flash High`) | Supabase: `sbvyjbipchglzmttkowy` (`eu-west-1`)**

These twelve daily prompts (`Day 17` through `Day 28`) complete the entire 28-day engineering roadmap: **Sync Center & Airplane-Mode Chaos Recovery (`MOB-28`)**, **Outcome Mastery & Bloom's Analytics (`MOB-21`–`MOB-22`)**, **Python PDF Ingestion + `pgvector(384)` Grounded RAG AI Tutor**, **Controlled DuckDB/Parquet Data Lake Mirror**, **Provider-Abstracted Commerce (`MOB-24`–`MOB-26`)**, **Next.js Instructor/Institution/Admin Portals (`web/`)**, **Profile, Storage Guard, Security & Offline Help (`MOB-23`, `MOB-27`, `MOB-29`, `MOB-30`)**, and **Pilot Release Packaging (`v1.0.0-pilot`)**.

---

## Day 17 Prompt — `MOB-28` Sync Center UI (Pending, Needs Attention/Rejected, Synced History Tabs) & Recovery Workflows

Copy and paste this into Antigravity IDE for **Day 17**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 17 implementation of `MOB-28` (`SyncCenterScreen.tsx`) in `mobile/src/features/sync/`:

### Task 1: Sync Health Header & Manual Sync Trigger (`MOB-28`)
1. Build `mobile/src/features/sync/SyncCenterScreen.tsx`:
   - **Sync Health Summary Card**:
     - Dynamic status badge: `All Changes Synced ✓` (green), `Syncing with Server...` (blue), `N Operations Queued (Offline)` (amber), or `N Operation(s) Need Attention` (red).
     - Displays `Last Successful Pull: [Timestamp]`, `Last Successful Push: [Timestamp]`, and `Committed Server Cursor: Sequence #`.
     - Primary CTA: `Sync Now` button (invokes `SyncEngineService.syncAllNow()` when online; disabled with `"Reconnect to internet to sync"` tooltip when offline).

### Task 2: Three Segmented Queue Inspection & Resolution Tabs
1. **Tab 1 — Pending Queue (`state IN ('QUEUED', 'UPLOADING', 'RETRYABLE_FAILURE')`)**:
   - Lists every pending local mutation in chronological order (`exam_attempt.submit`, `bookmark.upsert`, `support_case.create`) showing creation timestamp, retry count, next scheduled backoff time, and explicit status pill (`Queued on Device` / `Retrying`).
   - **Strict UX Rule (`Section 10.3 MOB-21`)**: Never display pending items as already uploaded.
2. **Tab 2 — Needs Attention / Rejected (`state === 'REJECTED_NEEDS_RESOLUTION'`)**:
   - Maps server `reason_code` values (`GRANT_EXPIRED`, `BLUEPRINT_SUPERSEDED`, `VALIDATION_ERROR`) to plain-language explanations and reassures the student: *"Your exam answers are safely preserved on this device."*
   - Provides 3 actionable recovery buttons per item:
     - `Refresh Access & Retry Upload` (calls `GET /api/v1/me/entitlements` then re-queues the operation for `POST /api/v1/sync/push`)
     - `Retry Upload Now`
     - `Export Signed Diagnostic Evidence` (bundles the signed local attempt payload + `operation_id` into a support attachment and navigates to `MOB-30` Support Ticket form).
3. **Tab 3 — Recently Synced (`state === 'SERVER_ACCEPTED'`)**:
   - Displays the audit trail of confirmed operations with `operation_id`, `server_id`, and server confirmation timestamp.

### Day 17 Verification Gate
Write and run `mobile/src/tests/sync_center_screen.test.ts` verifying:
1. Pending, Rejected, and Accepted operations render in their respective tabs with accurate badges.
2. Tapping `Refresh Access & Retry Upload` on a `GRANT_EXPIRED` item refreshes entitlements and transitions the item back to `QUEUED` -> `SERVER_ACCEPTED`.
```

---

## Day 18 Prompt — Offline Sync Chaos, Clock-Skew Immunity & Airplane-Mode Recovery Test Suite

Copy and paste this into Antigravity IDE for **Day 18**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md @docs/SaaS_Database_Architecture_and_System_Specification.md

Execute the complete Day 18 chaos and recovery testing tasks across `backend/tests/` and `mobile/src/tests/`:

### Task 1: Journey B & Journey C End-to-End Offline Chaos Scenarios
1. Create `mobile/src/tests/offline_chaos_and_recovery.test.ts` simulating and verifying these 5 critical edge cases:
   - **Scenario 1 (Dropped HTTP Response on Push)**: Client sends `POST /api/v1/sync/push` for a 100-question exam attempt; server accepts and grades it, but the network drops before the client receives the HTTP 200 response. On reconnect, `SyncEngineService` calls `GET /api/v1/sync/status?operation_ids=...`, sees `ACCEPTED`, and marks the local attempt `ACCEPTED_RESULT_READY` without re-uploading.
   - **Scenario 2 (Skewed Device Wall Clock — `ADR-006`)**: User sets their phone's system clock backward by 3 days (`2026-11-11`) while offline, completes an exam, and reconnects. Verify that `/api/v1/sync/pull` (using opaque `change_seq` cursor) and `<ExamTimer />` (using monotonic elapsed seconds) are completely unaffected by the skewed wall clock.
   - **Scenario 3 (Subscription/Grant Expires While Offline — SAD Journey C)**: While disconnected in Airplane Mode, `offline_biometric_grant.expires_at` passes beyond the offline grace window. Verify that:
     - Opening *new* protected packages or starting *new* paid offline exams is blocked with the `Access Expired` state.
     - Already-created `IN_PROGRESS` or `SUBMITTED_LOCAL_PENDING` exam attempts in `local_exam_attempts` and `sync_operations` are **preserved intact** and uploaded when connection returns.
   - **Scenario 4 (Mid-Batch Pull Crash)**: Simulate a SQLite error on item 15 of a 25-item `/api/v1/sync/pull` batch; verify the transaction rolls back completely and `sync_state.opaque_cursor` stays at the prior watermark.
   - **Scenario 5 (Duplicate Webhook + Duplicate Push)**: Verify both backend and mobile remain 100% idempotent under 5x concurrent duplicate retries.

### Day 18 Verification Gate
Run both `cd backend && pytest` and `cd mobile && npm test` and confirm 100% pass rate across all chaos scenarios.
```

---

## Day 19 Prompt — Outcome Mastery Engine (`GET /api/v1/me/progress`) & Mobile Progress Screens (`MOB-21`, `MOB-22`)

Copy and paste this into Antigravity IDE for **Day 19**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md @docs/SaaS_Database_Architecture_and_System_Specification.md

Execute the complete Day 19 progress analytics and outcome mastery implementation across `backend/app/learning/` and `mobile/src/features/progress/` (`MOB-21` & `MOB-22`):

### Task 1: Server-Validated Progress & Bloom's Mastery Endpoint (`GET /api/v1/me/progress`)
1. Implement `GET /api/v1/me/progress` in `backend/app/learning/router.py`:
   - Scoped to `current_user_id` and active workspace (`X-Tenant-ID`).
   - Computes and returns:
     - `last_calculated_at` UTC timestamp
     - `overall_readiness_percent` (credit-hour weighted average across the 5 themes, 45 total credits)
     - `active_courses_count`, `total_courses_count` (15), `validated_attempts_count`
     - `themes_mastery[]`: Each of the 5 themes with `theme_id`, `title`, `credit_hours`, `mastery_percent`, and nested `courses[]` summary
     - `blooms_distribution[]`: Mastery percentage and attempted item count across all 6 `cognitive_level` tiers (`REMEMBER`, `UNDERSTAND`, `APPLY`, `ANALYSE`, `EVALUATE`, `CREATE`)
     - `courses_detail[]`: Per-course `learning_outcomes[]` with `domain`, `level`, `attempts_evidence_count`, `correct_evidence_count`, and rolling `mastery_score` (`0.000`–`1.000`).

### Task 2: `MOB-21` Progress Overview Dashboard (`ProgressOverviewScreen.tsx`)
1. Build `mobile/src/features/progress/ProgressOverviewScreen.tsx` (`MOB-21`):
   - **Data Freshness Banner**: Displays `"Last synced & calculated: [Timestamp]"`—and if `sync_operations` contains pending `exam_attempt.submit` rows, appends an amber pill: `"+N offline attempt(s) awaiting sync; mastery scores will update after sync"`.
   - Period filter pills: `7 Days` | `30 Days` | `All Time`.
   - **Top 3 KPI Cards**: `Overall Readiness (%)`, `Courses Active (X/15 • Y/45 Cr)`, and `Validated Attempts (M Synced • +N Pending)`.
   - **Section 1 — Mastery by Theme (5 Progress Bars)**: Interactive cards for Theme 1 through Theme 5 showing credit weight and mastery bar; tapping drills down into `MOB-22`.
   - **Section 2 — Bloom's Taxonomy Cognitive Distribution**: 6-row horizontal bar chart (`Remember` -> `Create`) highlighting cognitive strengths vs. gaps.
   - **Mandatory Methodology Footnote (`SAD Section 17.1`)**: *"Mastery scores are rolling estimates based on your validated practice responses, not official university grades."*

### Task 3: `MOB-22` Course Progress & Outcome Mastery (`CourseProgressScreen.tsx`)
1. Build `mobile/src/features/progress/CourseProgressScreen.tsx` (`MOB-22`):
   - Course header with code (`e.g., IT-FDBS-201`), credit hours, overall course mastery %, and `<CourseProgressCard />` visually separating server-verified mastery from unsynced local attempts.
   - Lists all course `learning_outcomes` grouped by domain (`COGNITIVE`, `AFFECTIVE`, `PSYCHOMOTOR`) showing Bloom's level badge, evidence count (`e.g., 8/10 correct`), mastery bar, and a `"Practice This Outcome"` button that launches a targeted quiz in `MOB-13`/`MOB-14`.

### Day 19 Verification Gate
Write and run `backend/tests/test_day19_progress_mastery.py` and `mobile/src/tests/progress_screens.test.ts` verifying credit-weighted theme calculations, Bloom's distribution, and pending local attempt badges on `MOB-21` and `MOB-22`.
```

---

## Day 20 Prompt — Python PDF Ingestion Worker, `pgvector(384)` Embeddings (`all-MiniLM-L6-v2`) & Grounded RAG AI Tutor

Copy and paste this into Antigravity IDE for **Day 20**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md @docs/SaaS_Database_Architecture_and_System_Specification.md @docs/SaaS_Learning_and_Exam_Platform_Implementation_and_Architecture_Guide.md

Execute the complete Day 20 AI ingestion and grounded RAG tutoring implementation in `backend/app/ai/`, `backend/app/workers/`, and `mobile/src/features/ai/`:

### Task 1: Dual-Engine PDF Ingestion & 384-d `pgvector` Embedding Worker (`backend/app/workers/ingestion_worker.py`)
1. Implement `backend/app/workers/ingestion_worker.py`:
   - Extracts text and page metadata from uploaded PDFs (`pdfplumber` + `PyPDF2` fallback) and normalizes UTF-8 whitespace/headers.
   - Segments text into 512-token sliding-window chunks (with 64-token overlap), preserving code blocks and tables intact.
   - Encodes chunks into 384-dimensional normalized vectors using `all-MiniLM-L6-v2` (with a deterministic local hash-embedding fallback in lightweight test mode so CI/pytest runs in <1 second without downloading external weights when offline) and inserts them into `resource_embeddings (resource_id, chunk_index, chunk_content, embedding)`.

### Task 2: Grounded RAG AI Tutor Endpoint (`POST /api/v1/ai/tutor/messages`)
1. Implement `POST /api/v1/ai/tutor/messages` in `backend/app/ai/router.py`:
   - Accepts `{ "course_id": int, "question_id": "uuid | null", "prompt": str }`.
   - **Step 1 (Entitlement & Quota Check)**: Verifies active workspace access and checks that the user's monthly AI usage in `usage_records` is below `feature_entitlements.ai_monthly_quota`. If exhausted, returns `429 QUOTA_EXHAUSTED` with remaining reset date.
   - **Step 2 (Tenant-Isolated Vector Retrieval)**: Queries `resource_embeddings` joined with `course_resources` strictly filtered by `course_id = :cid AND (tenant_id IS NULL OR tenant_id = current_tenant_id)` ordered by cosine distance (`embedding <=> :query_vec ASC LIMIT 3`).
   - **Step 3 (Grounded Synthesis & Citations)**: Builds a grounded response using only the retrieved course chunks (and if `question_id` is passed from `MOB-19` Answer Review, includes the question's official `explanation`), attaches explicit `citations: [{ resource_id, resource_title, chunk_index, snippet }]`, records token/call consumption in `usage_records`, and includes the advisory notice: *"AI Tutor explanations are study assistance grounded in course materials, not official grading policy."*

### Task 3: Mobile Grounded AI Tutor Drawer (`AiTutorSheet.tsx` on `MOB-08` & `MOB-19`)
1. Create `mobile/src/features/ai/AiTutorSheet.tsx`:
   - Opens from `MOB-08` (`Ask AI Course Tutor`) or `MOB-19` (`Ask AI Tutor to Explain Step-by-Step`).
   - Displays remaining monthly AI quota badge (`e.g., 49 / 50 queries remaining`).
   - Renders tutor responses with tappable **Source Citation Chips** (`e.g., [Source: Computer Maintenance Lecture Note • Chunk #4]`)—tapping a citation opens `MOB-11` (`ProtectedContentReader`) to that resource.
   - When `!isOnline`, disables input with a clear banner: `"AI Tutor requires an active internet connection. You can still read your downloaded course notes offline."`

### Day 20 Verification Gate
Write and run `backend/tests/test_day20_rag_ai_tutor.py` and `mobile/src/tests/ai_tutor_sheet.test.ts` verifying tenant-isolated chunk retrieval, citation attachment, quota decrementing, and `429 QUOTA_EXHAUSTED` enforcement.
```

---

## Day 21 Prompt — Controlled Data Lake Mirror (`Parquet / Iceberg + DuckDB`) & Snapshot-Watermarked Analytics

Copy and paste this into Antigravity IDE for **Day 21**:

```text
@docs/Education_SaaS_Platform_System_Analysis_and_Design.docx @docs/SaaS_Database_Architecture_and_System_Specification.md

Execute the complete Day 21 Controlled Data Lake Mirror and Institutional Analytics implementation in `backend/app/analytics/`:

### Task 1: Two-Zone Atomic Parquet Data Lake Mirror (`backend/app/analytics/lake_mirror.py`)
1. Implement `DataLakeMirrorService` in `backend/app/analytics/lake_mirror.py`:
   - Exports deterministic, atomic snapshots from PostgreSQL tied to `MAX(sync_changes.change_seq)` into two isolated lake directories under `dev_storage/lake/` (and syncable via `StorageAdapter`):
     - **Zone 1 (`raw_mirror/`)**: Exact 1:1 mirror of operational tables (`users`, `tenants`, `exam_attempts`, `attempt_answers`, `orders`, `feature_entitlements`) including explicit `_op` (`'U'` / `'D'` tombstone) and `_snapshot_seq` columns. Restricted strictly to `SUPER_ADMIN` and automated reconciliation jobs.
     - **Zone 2 (`curated_analytics/`)**: PII-sanitized star-schema analytical tables (`fact_exam_responses`, `fact_tenant_billing`, `dim_course_outcome`, `dim_tenant_cohort`) where `email` and `full_name` are stripped and replaced with salted cryptographic hashes (`student_anon_hash`).
   - Writes an atomic `manifest.json` containing `{ "snapshot_id": "SNAP-000042", "change_seq_watermark": 42, "mirrored_at": "iso8601", "row_counts": {...}, "sha256_checksums": {...} }`.

### Task 2: Embedded DuckDB Query Engine & Reconciliation Health Check (`backend/app/analytics/duckdb_service.py`)
1. Implement `AnalyticsLakeQueryService` (using `duckdb` if installed, with automatic SQLite/Parquet arrow fallback so it runs in any environment without native binary issues):
   - Queries `curated_analytics` snapshots and injects mandatory `tenant_id = :active_tenant_id` filtering for `TENANT_ADMIN` callers.
   - **Privacy Threshold Guard (`SAD Section 13.2`)**: For institutional cohort reports, suppresses granular subgroup breakdowns if `COUNT(DISTINCT student_anon_hash) < 5` to prevent individual student re-identification.
   - **Mirror Reconciliation Verifier**: Compares row counts and checksums between live PostgreSQL and the latest lake `manifest.json`, returning `{ "mirror_status": "IN_SYNC" | "LAGGING", "snapshot_id": "...", "mirrored_at": "...", "lag_sequences": 0 }`.
2. Expose:
   - `GET /api/v1/analytics/institution-cohort` (for Institution Admins: active seats vs. licensed seats, course participation, theme score distributions, outcome gaps, and `snapshot_id` watermark).
   - `GET /api/v1/analytics/lake-mirror/status` (for Platform Admins: direct inspection of `raw_mirror` & `curated_analytics` snapshot manifests, row counts, and reconciliation status).

### Day 21 Verification Gate
Write and run `backend/tests/test_day21_data_lake_mirror.py` verifying:
1. Running `DataLakeMirrorService.sync_snapshot()` creates a verified `snapshot_id`, strips PII in `curated_analytics`, and reports `mirror_status == "IN_SYNC"`.
2. Tenant A's `TENANT_ADMIN` cannot query Tenant B's rows in the lake mirror, and cohorts with `< 5` students enforce the privacy threshold.
```

---

## Day 22 Prompt — Provider-Abstracted Commerce, Signed Webhooks & Institutional Seat Licensing (`/api/v1/products`, `/orders`, `/webhooks/*`)

Copy and paste this into Antigravity IDE for **Day 22**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md @docs/SaaS_Database_Architecture_and_System_Specification.md

Execute the complete Day 22 commercial engine, provider-abstracted payments, and institutional seat licensing tasks in `backend/app/commerce/`:

### Task 1: Product Catalog Seed & Provider Adapter Pattern (`ADR-008`)
1. Seed the canonical commercial catalog in `products`:
   - `FREE_STUDENT` (`0 ETB`, basic catalog, limited quizzes)
   - `STUDENT_PREMIUM_MONTHLY` (`299 ETB`, 30-day recurring, full 15 courses, 2 GB offline downloads, 50 AI queries/mo)
   - `STUDENT_PREMIUM_ANNUAL` (`2499 ETB`, 365-day recurring, full 15 courses, 5 GB offline downloads, 100 AI queries/mo)
   - `HU_EXIT_EXAM_BUNDLE_2026` (`199 ETB`, one-time purchase, permanent access to National Exit Exam Simulations + offline exam packages)
   - `INSTITUTION_STANDARD_SEAT` (`B2B`, per-seat institutional license).
2. Implement `PaymentProviderAdapter` in `backend/app/commerce/providers.py` with concrete adapters for `CHAPA`, `TELEBIRR`, `STRIPE`, and `SANDBOX` (HMAC-SHA256 webhook signature verification for each provider).

### Task 2: Orders, Checkout Sessions, Idempotent Webhooks & Seat Assignment Endpoints
1. Implement `GET /api/v1/products`: Returns active products and terms.
2. Implement `POST /api/v1/orders`: Creates a `PENDING` order idempotently using `Idempotency-Key`.
3. Implement `POST /api/v1/checkout-sessions`: Initializes the provider checkout session URL and returns `{ checkout_url, order_id, status: "PENDING" }`.
4. Implement `POST /api/v1/webhooks/{provider}` (`SAD Section 6.3` & `12.4`):
   - Verifies the provider's cryptographic HMAC signature (`X-Chapa-Signature`, `X-Telebirr-Signature`, `Stripe-Signature`, or `X-Sandbox-Signature`).
   - Checks `payment_events` for `(provider, provider_event_id)`—if already processed, returns `200 {"status": "already_processed"}` idempotently.
   - Verifies that `verified_amount == order.amount` and `verified_currency == order.currency`.
   - Marks `orders.status = 'PAID'`, inserts a server-authoritative grant into `feature_entitlements`, and writes an `UPSERT` into `sync_changes`.
5. Implement `POST /api/v1/tenants/{id}/licenses/{license_id}/seats` allowing an Institution Admin to assign or reclaim a licensed seat (`seat_assignments`) and automatically create/revoke the student's institutional `feature_entitlements` row.

### Day 22 Verification Gate
Write and run `backend/tests/test_day22_commerce_and_webhooks.py` verifying:
1. Forged webhook signatures or mismatched amounts/currencies are rejected with `400/401` and never activate entitlements.
2. A valid signed webhook marks the order `PAID` and creates `feature_entitlements`; replaying the exact same webhook payload 3 times creates only 1 entitlement.
3. Personal purchases and institutional seat grants coexist independently (`ADR-002`, `ADR-003`).
```

---

## Day 23 Prompt — Mobile Commercial Screens: Plans & Access (`MOB-24`), Store (`MOB-25`) & Checkout Status Poller (`MOB-26`)

Copy and paste this into Antigravity IDE for **Day 23**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 23 mobile commerce and entitlement UI tasks in `mobile/src/features/commerce/` (`MOB-24`, `MOB-25`, `MOB-26`):

### Task 1: `MOB-24` Plans & Access Screen (`PlansAndAccessScreen.tsx`)
1. Build `mobile/src/features/commerce/PlansAndAccessScreen.tsx` (`MOB-24`):
   - **Effective Access Summary Banner**: Displays combined active privileges (`Offline Downloads: Enabled • Quota: 2.0 GB • AI Tutor Queries: 49/50 remaining`). When offline, shows `"Last verified with server: [Timestamp]"`.
   - **Section A — Institutional License Seats**: Cards showing sponsoring institution (`e.g., Haramaya University — CCI`), cohort, seat status (`Active` / `Expired`), and validity window.
   - **Section B — Personal Subscriptions & One-Time Bundles**: Cards showing personal plans (`Student Premium`, `HU Exit Exam Bundle 2026`), status (`Active`, `Payment Pending`, `Cancelled — Access until [Date]`), and offline grace policy.
   - Action buttons: `"Verify Latest Access with Server"` (`GET /api/v1/me/entitlements`) and `"Browse Plans & Bundles (MOB-25)"`.

### Task 2: `MOB-25` Store & Product Details Screen (`StoreScreen.tsx`)
1. Build `mobile/src/features/commerce/StoreScreen.tsx` (`MOB-25`):
   - Segmented tabs: `Subscriptions (Monthly / Annual)` | `One-Time Exam & Course Bundles`.
   - Product cards displaying server-fetched price (`ETB` / `USD`), billing interval, included courses/exams, offline download allowance, and cancellation/refund terms.
   - `<PurchaseCTA />`: When offline, disables checkout with `"Connect to the internet to purchase or renew a plan."` When online, revalidates product price, creates an idempotent server order (`POST /api/v1/orders`), and navigates to `MOB-26`.

### Task 3: `MOB-26` Checkout & Purchase Status Poller (`CheckoutStatusScreen.tsx`)
1. Build `mobile/src/features/commerce/CheckoutStatusScreen.tsx` (`MOB-26`):
   - Displays Order Summary, Payment Provider selector (`Chapa`, `Telebirr`, `Card / Stripe`, `Dev Sandbox Instant Verify`), and external checkout launch button (`POST /api/v1/checkout-sessions`).
   - Implements the 4 deterministic post-checkout status states:
     1. **`Payment Verification Pending`**: Polls `GET /api/v1/me/entitlements` (and order status) with backoff; displays high-contrast warning: *"We are confirming your payment with the provider. Do not pay again while verification is in progress."*
     2. **`Payment Confirmed — Access Activated ✓`**: Shows unlocked entitlement details and CTA to download courses/exams immediately.
     3. **`Payment Failed / Cancelled`**: Safe retry using idempotent order check.
     4. **`Connection Lost During Checkout`**: Preserves `order_id` locally and offers `"Check Payment Status"` when connection returns.

### Day 23 Verification Gate
Write and run `mobile/src/tests/commerce_screens.test.ts` verifying:
1. `MOB-24` renders Institutional Seats and Personal Purchases in separate sections.
2. `MOB-25` blocks checkout initiation when offline.
3. `MOB-26` stays in `Payment Verification Pending` (blocking duplicate payment taps) until the server entitlement endpoint confirms activation.
```

---

## Day 24 Prompt — Next.js (`web/`) Public Catalog, Student Web Workspace & Instructor Content/Question Authoring Portal

Copy and paste this into Antigravity IDE for **Day 24**:

```text
@docs/Education_SaaS_Platform_System_Analysis_and_Design.docx @docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 24 web application tasks in `web/` (Next.js + TypeScript) covering the Public Site, Student Web Portal, and Instructor Authoring Portal (`SAD Section 13.1`):

### Task 1: Next.js Foundation & Shared Typed API Client (`web/src/`)
1. Scaffold or audit the Next.js TypeScript application in `web/` with clean modular routes:
   - `/` (Public Curriculum & Plan Preview: 5 Themes, 15 B.Sc. IT Courses, 45 Credit Hours, Pricing, and Institution Inquiry)
   - `/login` & `/workspaces` (Global authentication + Workspace Switcher setting `X-Tenant-ID`)
   - `/student` (Student Web Dashboard: Course Reader, Online Practice Exam Runner, Progress & Mastery Charts)
   - `/instructor` (Instructor & Content Manager Portal)
   - `/institution` (Institution Administrator Portal — Day 25)
   - `/admin` (Platform Operator Console — Day 25).

### Task 2: Instructor Content & Question Bank Authoring Portal (`web/src/app/instructor/`)
1. Build the Instructor Portal scoped strictly to the instructor's assigned courses and active tenant:
   - **Resource Uploader & Version Manager**: Upload PDFs, lecture notes, and lab guides into `course-packages` via `StorageAdapter`, tag with `learning_outcomes`, set offline eligibility, and publish new versions (`version + 1`).
   - **Question Bank Editor**: Create and version assessment items (`MULTIPLE_CHOICE`, `TRUE_FALSE`, `CODING`, `ESSAY`) linked to a `course_id`, `outcome_id`, Bloom's `cognitive_level` (`REMEMBER`..`CREATE`), `difficulty` (`EASY`, `MEDIUM`, `HARD`), options `A`–`F`, and step-by-step `explanation`.
   - **Exam Blueprint Builder**: Configure practice quizzes, course exams, and exit simulations (setting duration, question count, offline eligibility, and answer-key reveal policy).

### Day 24 Verification Gate
Verify `web/` TypeScript compilation (`tsc --noEmit`) and run an integration test confirming an Instructor can publish a new question and exam blueprint that immediately appears in `/api/v1/sync/pull` for mobile students.
```

---

## Day 25 Prompt — Next.js (`web/`) Institution Admin Portal & Platform Operator Console (With Live Data Lake Mirror Explorer)

Copy and paste this into Antigravity IDE for **Day 25**:

```text
@docs/Education_SaaS_Platform_System_Analysis_and_Design.docx @docs/SaaS_Database_Architecture_and_System_Specification.md

Execute the complete Day 25 implementation of the Institution Administrator Portal (`/institution`) and Platform Operator Console (`/admin`) in `web/` and `backend/`:

### Task 1: Institution Administrator Portal (`web/src/app/institution/` — `SAD Section 13.2`)
1. Build the Institution Admin Dashboard connected to `/api/v1/tenants/{id}/*` and `/api/v1/analytics/institution-cohort`:
   - **Seat & License Meter**: Displays `Total Contracted Seats`, `Assigned Seats`, `Unassigned Seats`, and `License Expiry Date`.
   - **CSV Roster Import & Role Manager**: Upload student/instructor CSV rosters with live preview, duplicate email detection, scoped role assignment (`STUDENT`, `INSTRUCTOR`, `TENANT_ADMIN`), invitation expiry/resend, and student offboarding.
   - **Cohort Performance & Outcome Gap Dashboard**: Visualizes theme participation, score distributions, and weakest learning outcomes across the cohort—enforcing the `N >= 5` minimum cohort privacy threshold and displaying the live Data Lake watermark (`"Lake Snapshot #SNAP-000042 • Mirrored at [Timestamp]"`).
   - **Audited Report Export**: Exporting a cohort report records an immutable entry in `audit_logs`.

### Task 2: Platform Operator Console & Direct Data Lake Mirror Explorer (`web/src/app/admin/`)
1. Build the Platform Operator Console (`SUPER_ADMIN` only, with all actions recorded in `audit_logs`):
   - **Direct Data Lake Mirror Explorer**: Connects to `GET /api/v1/analytics/lake-mirror/status` and triggers `POST /api/v1/analytics/lake-mirror/sync`. Displays a real-time **Mirror Health Badge** (`IN SYNC ✓` vs. `LAGGING`), exact `change_seq` watermark, per-table row counts and SHA-256 parquet checksums across `raw_mirror/` and `curated_analytics/`, and a read-only preview of mirrored analytical tables.
   - **Tenant, Curriculum & Webhook Reconciliation Console**: Approve institutional workspaces, manage global curriculum versions, and inspect `payment_events` / webhook exceptions.

### Day 25 Verification Gate
Write and run `backend/tests/test_day25_admin_and_institution_portals.py` + `web/` typecheck verifying CSV roster validation, seat allocation, `audit_logs` recording on report export, and Data Lake Mirror Explorer status.
```

---

## Day 26 Prompt — Mobile Profile (`MOB-23`), Storage Quota Guard (`MOB-27`), Devices & Security (`MOB-29`) & Notifications/Help (`MOB-30`)

Copy and paste this into Antigravity IDE for **Day 26**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 26 implementation of the final 4 mobile screens (`MOB-23`, `MOB-27`, `MOB-29`, `MOB-30`) in `mobile/src/features/profile/`:

### Task 1: `MOB-23` Profile Home & `MOB-27` Storage Settings (`StorageSettingsScreen.tsx`)
1. Upgrade `mobile/src/features/profile/ProfileScreen.tsx` (`MOB-23`):
   - Identity card (`Full Name`, `Email`, `Edit Profile`), Active Workspace card with `"Switch Workspace (MOB-04)"`, navigation rows to `MOB-24` (Plans & Access), `MOB-25` (Store), `MOB-12` (Download Manager), `MOB-28` (Sync Center), `MOB-27` (Storage Settings), `MOB-29` (Devices & Security), and `MOB-30` (Notifications, Language & Help).
   - **Sign Out Button with Unsynced Queue Guard**: If `storageGuardRepository.getProtectedCounts()` > 0, opens a high-contrast confirmation modal warning that unsynced exam submissions or active attempts exist (`"Sync Now First"` vs. `"Sign Out & Keep Encrypted Queue for My Account"`).
2. Build `mobile/src/features/profile/StorageSettingsScreen.tsx` (`MOB-27`):
   - `<StorageMeter />` visual breakdown bar: `Protected Unsynced Exam Data (Locked — Never Evicted)`, `Downloaded Course & Exam Packages`, and `Temporary Cache`.
   - Configurable storage quota selector (`500 MB`, `2 GB`, `Unlimited`) saved to `device_profile.storage_quota_mb`.
   - `Wi-Fi Only Downloads` toggle switch.
   - `"Clear Expired & Temporary Cache"` button calling `storageGuardRepository.evictEligibleCacheOnly()` (guaranteed never to touch active attempts or `sync_operations`).

### Task 2: `MOB-29` Devices & Security & `MOB-30` Notifications, Language & Offline Help
1. Build `mobile/src/features/profile/DevicesAndSecurityScreen.tsx` (`MOB-29`):
   - `Biometric Offline Unlock (Fingerprint / Face ID)` toggle switch and `App Lock Timeout` selector (`Immediately`, `After 5 minutes`, `On App Restart`).
   - **Current Device Card** (`Device Name • OS • App Version • Offline Grant Valid Until [Date]`) and **Other Active Devices List** with `"Revoke Device Session"` button (`DELETE /api/v1/devices/{id}`).
2. Build `mobile/src/features/profile/SettingsAndHelpScreen.tsx` (`MOB-30` combining `SAD MOB-23` & `SAD MOB-24`):
   - **Tab 1 — Notifications**: Filter pills (`All`, `Unread`, `Exams`, `Sync & Billing`), notification cards with deep-link routing (`MOB-08`, `MOB-18`, `MOB-28`), and `Mark All as Read`.
   - **Tab 2 — App Preferences**: UI Language selector (`English`, `Afaan Oromo`, `Amharic`), Theme selector (`System`, `Light`, `Dark`), and `Data Saver Mode` toggle.
   - **Tab 3 — Offline Help, FAQs & Diagnostics**: Bundled searchable offline FAQ accordion (covering offline provisional scores, expired grants, rejected sync items, and workspace switching) + **Submit Support Request Form** with `"Attach Non-PII Sync Diagnostics"` (`device_id`, `app_version`, `opaque_cursor`, `last_error` codes). Queues as `support_case.create` in `sync_operations` when submitted offline!

### Day 26 Verification Gate
Write and run `mobile/src/tests/profile_storage_security_help.test.ts` verifying that all 30 screens (`MOB-01` through `MOB-30`) are registered in the navigator, `MOB-27` protects unsynced exam data during cache cleanup, and `MOB-30` queues support requests offline.
```

---

## Day 27 Prompt — Low-End Android (`4GB/8GB RAM`) Performance Profiling, Cross-Tenant RLS Pen-Tests & Full Regression Suite

Copy and paste this into Antigravity IDE for **Day 27**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md @docs/Education_SaaS_Platform_System_Analysis_and_Design.docx

Execute the complete Day 27 security, tenant-isolation, and low-end mobile performance verification suite across `backend/`, `mobile/`, and `web/`:

### Task 1: Automated Cross-Tenant Penetration & IDOR/BOLA Test Matrix (`backend/tests/test_day27_security_and_rls_matrix.py`)
1. Write a comprehensive security test suite in `backend/tests/test_day27_security_and_rls_matrix.py` proving:
   - **Cross-Tenant Isolation (`NFR-02`)**: A student or instructor in Tenant A cannot read, download, submit to, or view analytics for Tenant B's private resources, exams, attempts, or cohort lake snapshots.
   - **Client Score Tampering Prevention (`FR-009`)**: Passing `"is_correct": true` or `"score_percent": 100` in any client request payload is ignored/rejected; only `public.grade_exam_attempt()` sets scores.
   - **Token Replay & Webhook Forgery**: Replaying a rotated refresh token invalidates the entire token family; unsigned/tampered payment webhooks are rejected with zero side effects.

### Task 2: Complete 30-Screen Mobile Audit & Memory/FPS Optimization (`mobile/src/tests/full_30_screen_audit.test.ts`)
1. Write `mobile/src/tests/full_30_screen_audit.test.ts` verifying:
   - Every single route from `MOB-01` through `MOB-30` in Section 3.2 is mounted, typed, and reachable.
   - All 13 SQLite tables and all 16 reusable components (`Section 7`) meet the `48dp` touch target and WCAG AA contrast tokens.
   - No secret (`access_token`, `refresh_token`, or `ephemeral_aes_key_b64`) is ever written to `AsyncStorage`.

### Day 27 Verification Gate
Run the full monorepo test suite (`pytest` in `backend/`, `npm run typecheck && npm test` in `mobile/`, and `tsc --noEmit` in `web/`) and confirm 100% pass with 0 warnings or errors.
```

---

## Day 28 Prompt — Supabase Cloud Production Push (`sbvyjbipchglzmttkowy`), Operational Runbook & Pilot Release (`v1.0.0-pilot`)

Copy and paste this into Antigravity IDE for **Day 28**:

```text
@docs/Education_SaaS_Platform_System_Analysis_and_Design.docx @docs/unified_education_saas_mobile_and_system_specification.md

Execute the final Day 28 pilot release preparation and operational sign-off for `SaaS_Learning_Exit_Exam_Platform`:

### Task 1: Production Supabase Cloud (`sbvyjbipchglzmttkowy`) & Storage Parity Verification
1. Create `scripts/verify_supabase_cloud_parity.py` that:
   - Verifies connection to `sbvyjbipchglzmttkowy` (`eu-west-1`) over both Transaction Pooler (`DATABASE_URL` port `6543` with `statement_cache_size=0`) and Session Pooler (`DIRECT_URL` port `5432`).
   - Confirms all migrations (`20261114000001` schema + `20261114000002` 5-theme/15-course curriculum) and the 100-question Haramaya University 2023 Model Exit Exam (`seed_hu_2023_model_exam.py`) are present and active.
   - Tests `StorageAdapter` against the `course-packages` bucket and verifies `DataLakeMirrorService` snapshot integrity.

### Task 2: Android Build Packaging (`eas.json` / Gradle) & Pilot Operational Runbook
1. Configure `mobile/eas.json` and `mobile/app.json` (package identifier `com.asladin.edusaas`, Android `FLAG_SECURE` permissions, biometric permissions, and production API URL configuration) so an installable Android APK/AAB can be built or run directly on Samsung Galaxy A05s/A04s over USB/`scrcpy`.
2. Write `docs/PILOT_OPERATIONAL_RUNBOOK.md` documenting:
   - Exact startup commands for Backend (`uvicorn`), Web (`next`), Mobile (`expo` + `adb reverse`), and Data Lake Mirror sync.
   - Database backup, Point-in-Time Recovery (PITR), and migration rollback procedures for `sbvyjbipchglzmttkowy`.
   - Pilot acceptance checklist sign-off covering all MVP, Mobile V1, and Growth V2 criteria from Section 10 of our unified specification.
3. Run the master verification suite across the entire repository and generate a final release readiness summary.
```

---

## Complete 28-Day Master Index (Where Every Screen & Endpoint Is Built)

| Days | Playbook File | Screens Built (`MOB-01` – `MOB-30`) | Backend Endpoints & Core Systems Built |
| :--- | :--- | :--- | :--- |
| **Days 1–7** | `Week_1_Day_1_to_7_AI_Agent_Master_Prompts.md` | `MOB-01`, `MOB-02`, `MOB-03`, `MOB-04`, `MOB-05`, `MOB-06`, `MOB-07`, `MOB-08` | Reconciled PostgreSQL 16 + `pgvector(384)` DDL, 15 IT Courses + 100-Q HU 2023 Model Exit Exam Seed, `/auth/*`, `/me/workspaces`, `/curriculum/*`, 13-Table SQLite/SQLCipher DB, `<ConnectionBanner />`. |
| **Days 8–16** | `Days_8_to_16_AI_Agent_Master_Prompts.md` | `MOB-09`, `MOB-10`, `MOB-11`, `MOB-12`, `MOB-13`, `MOB-14`, `MOB-15`, `MOB-16`, `MOB-17`, `MOB-18`, `MOB-19`, `MOB-20` | `StorageAdapter` (Range `206`), `/resources/{id}/download-grant`, Protected Reader (`<WatermarkOverlay />`), Immutable `question_snapshots`, Server Grading (`/attempts/*`), Opaque-Cursor `/sync/pull`, `/sync/push`, `/sync/status`. |
| **Days 17–28** | `Days_17_to_28_AI_Agent_Master_Prompts.md` | `MOB-21`, `MOB-22`, `MOB-23`, `MOB-24`, `MOB-25`, `MOB-26`, `MOB-27`, `MOB-28`, `MOB-29`, `MOB-30` + Next.js `web/` | Sync Center recovery, `/me/progress` (Bloom's mastery), PDF Ingestion + `pgvector(384)` `/ai/tutor/messages`, DuckDB/Parquet Data Lake Mirror, `/products`, `/orders`, `/webhooks/{provider}`, Next.js Portals, Security Pen-Tests & Pilot Release. |
