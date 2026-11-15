# 5-Day Step-by-Step Prompts to Complete & Harden Your Platform Owner Web Dashboard
**Project: `SaaS_Learning_Exit_Exam_Platform` | Target: Existing `backend/app/admin/` & `web/src/app/` (`/login`, `/`, `/users`, `/logs`, `/curriculum`, `/plans`, `/system`)**

Because Antigravity already built your 7 core routes (`/login`, `/`, `/users`, `/logs`, `/curriculum`, `/plans`, `/system`), pasting one giant prompt can overload the agent. Instead, these **5 focused, lightweight daily prompts (Day 1 to Day 5)** upgrade and verify **one subsystem per turn** while preserving all existing code.

---

## Overview of the 5 Lightweight Daily Tasks

| Day | Focus Area | Files Touched | What Gets Added & Verified |
| :--- | :--- | :--- | :--- |
| **Day 1** | **Security, `audit_logs` (`FR-026`) & `sync_changes` (`ADR-006`) Helpers** | `backend/app/admin/dependencies.py`, `backend/app/admin/router.py`, `web/src/app/login/page.tsx` | Locks `X-Admin-Key` to `development` only, adds `asladin.me` SSO token verification, and wires `audit_logs` + `sync_changes` into `/users` mutations. |
| **Day 2** | **Question Bank Versioning (`ADR-005`) & Code/Markdown Preview** | `backend/app/admin/router.py`, `web/src/app/curriculum/page.tsx` | Ensures question edits increment `questions.version` without touching `exam_attempts.question_snapshots`, and adds Bloom's/code preview in `/curriculum`. |
| **Day 3** | **Course Resource & PDF Package Manager (`course-packages`)** | `backend/app/admin/router.py`, `web/src/app/curriculum/page.tsx` | Adds a `Course Resources & PDF Packages` tab in `/curriculum` to view/register PDFs (like the 30-page HU 2023 Model Exam), SHA-256 hashes, and offline flags. |
| **Day 4** | **Database Migrations, `pgvector(384)` & Data Lake Mirror Explorer** | `backend/app/admin/router.py`, `web/src/app/system/page.tsx` | Adds live `schema_migrations`, table row counts, `pgvector(384)` chunk counters, and the Data Lake Mirror (`IN_SYNC` watermark) panel to `/system`. |
| **Day 5** | **Institutional Seat Licenses in `/plans` & Final E2E Test Sign-Off** | `backend/app/admin/router.py`, `web/src/app/plans/page.tsx`, `backend/tests/test_admin_suite.py` | Adds university license seat allocation (`institution_licenses`) to `/plans` and runs the complete 4-guardrail `pytest` + Next.js production build check. |

---

## Day 1 Prompt — Admin Auth Hardening (`asladin.me` SSO Bridge) + `audit_logs` (`FR-026`) & `sync_changes` (`ADR-006`) on User Actions

Copy and paste **only this Day 1 block** into Antigravity IDE:

```text
We are doing Day 1 of 5 to harden our existing Platform Owner Admin Dashboard. Keep all existing routes in `backend/app/admin/` and `web/src/app/` intact, and execute only these 3 focused tasks:

### Task 1: Environment-Gate `X-Admin-Key` & Add `asladin.me` SSO Verification (`backend/app/admin/dependencies.py`)
1. Inspect `backend/app/admin/dependencies.py`.
2. Ensure the `X-Admin-Key` header bypass is ONLY accepted when `settings.ENVIRONMENT.lower() in ("development", "dev", "test")`. If `settings.ENVIRONMENT == "production"`, require a valid signed `Authorization: Bearer <token>` JWT (signed with `settings.JWT_SECRET_KEY` and carrying `role == "SUPER_ADMIN"` or email `asladdiinabduqaadir@gmail.com`).
3. In `web/src/app/login/page.tsx`, support reading an incoming `?sso_token=<jwt>` query parameter from `https://www.asladin.me/login`, storing it in session storage for `api.ts`, and redirecting to `/`.

### Task 2: Add Reusable `record_admin_audit` & `emit_sync_change` Helpers (`backend/app/admin/router.py`)
1. In `backend/app/admin/router.py`, create two clean async helper functions:
   - `record_admin_audit(db, admin_email, action_type, target_type, target_id, details_dict)`: inserts an immutable row into `audit_logs` (`FR-026`).
   - `emit_sync_change(db, entity_type, entity_id, operation, version, payload_dict, tenant_id=None, user_id=None)`: inserts a monotonic row into `sync_changes` (`operation` = `'UPSERT'` or `'TOMBSTONE'`) so mobile clients pull admin changes via `/api/v1/sync/pull` (`ADR-006`).
2. Wire `record_admin_audit` into:
   - User role/status updates (`PATCH /api/v1/admin/users/{user_id}`)
   - Device session revocations (`DELETE /api/v1/admin/devices/{device_id}`)
   - Manual entitlement grants (`POST /api/v1/admin/users/{user_id}/entitlements`) — and also call `emit_sync_change(..., entity_type="feature_entitlement", operation="UPSERT")` whenever an entitlement is granted or updated.

### Task 3: Verify Day 1
Run `backend/.venv/bin/pytest backend/tests/test_admin_suite.py -v` and `npm --prefix web run typecheck` to confirm all tests and types pass.
```

---

## Day 2 Prompt — Question Bank Versioning (`ADR-005` Snapshot Immutability) & `/curriculum` Question Editor Polish

Wait until Day 1 finishes, then copy and paste **only this Day 2 block**:

```text
We are doing Day 2 of 5 to harden the Question Bank and Curriculum editor. Keep all existing routes intact and execute only these 3 focused tasks:

### Task 1: Enforce `ADR-005` Question Version Increment (`backend/app/admin/router.py`)
1. Inspect the question creation and update endpoints in `backend/app/admin/router.py` (`POST /api/v1/admin/questions` and `PATCH` / `PUT /api/v1/admin/questions/{question_id}`).
2. When an admin edits an existing question (stem, options `A`–`F`, `is_correct` answer key, Bloom's `level`, `difficulty`, or `explanation`):
   - Increment `questions.version = questions.version + 1`.
   - Never modify `exam_attempts.question_snapshots` on any existing exam attempt (`ADR-005`, `FR-009`).
   - Call `record_admin_audit(db, ..., action_type="QUESTION_UPDATED", ...)` and `emit_sync_change(db, entity_type="question", entity_id=str(question_id), operation="UPSERT", version=new_version, ...)`.
3. Do the same (`version + 1` + `record_admin_audit` + `emit_sync_change`) when an admin updates a course (`PATCH /api/v1/admin/courses/{course_id}`).

### Task 2: Upgrade Question Bank UI in `/curriculum` (`web/src/app/curriculum/page.tsx`)
1. In `web/src/app/curriculum/page.tsx`:
   - Display each question's `version` badge (`v1`, `v2`), course code pill (`IT-CMTS-101`..`IT-IASC-401`), Bloom's cognitive level badge (`REMEMBER`..`CREATE`), and difficulty badge (`EASY`, `MEDIUM`, `HARD`).
   - Render code blocks and Markdown tables inside `question_text` with clean monospace formatting so C++, Java, C#, PHP, JS, and SQL questions from the 100-question HU 2023 Model Exit Exam are easy to read and edit.
   - Show a subtle info banner in the Question Editor modal: `"ADR-005 Protected: Saving edits increments question version (v -> v+1) for future exams without altering historical student attempt snapshots."`

### Task 3: Verify Day 2
Add a test case in `backend/tests/test_admin_suite.py` verifying that updating a question increments `questions.version` and writes to `audit_logs` and `sync_changes`. Run `backend/.venv/bin/pytest backend/tests/test_admin_suite.py -v` and `npm --prefix web run typecheck`.
```

---

## Day 3 Prompt — Course Resource & PDF Package Manager (`course-packages` Bucket & SHA-256) in `/curriculum`

Wait until Day 2 finishes, then copy and paste **only this Day 3 block**:

```text
We are doing Day 3 of 5 to add Course Resource & PDF Package Management (`course_resources` table and `course-packages` bucket) to our Admin Dashboard. Execute only these 3 focused tasks:

### Task 1: Admin Resource Package Endpoints (`backend/app/admin/router.py`)
1. Add or verify these endpoints in `backend/app/admin/router.py`:
   - `GET /api/v1/admin/resources?course_id=...`: Lists rows from `course_resources` joined with `courses.code` and `courses.title`, returning `resource_id`, `course_id`, `course_code`, `type` (`LECTURE_NOTE`, `PAST_EXAM`, `REFERENCE_BOOK`, `LAB_CONTENT`, `PROJECT_SPEC`), `title`, `storage_bucket`, `storage_object_key`, `file_size_bytes`, `sha256_checksum`, `is_offline_eligible`, `version`, and `published_at`.
   - `POST /api/v1/admin/resources` & `PATCH /api/v1/admin/resources/{resource_id}`: Creates or updates a course resource (incrementing `version` on update), records an entry in `audit_logs`, and emits an `UPSERT` to `sync_changes` (`entity_type="course_resource"`).

### Task 2: Add "Resources & PDF Packages" Tab to `/curriculum` (`web/src/app/curriculum/page.tsx`)
1. In `web/src/app/curriculum/page.tsx` (and `web/src/lib/api.ts`), add a third tab alongside Courses and Question Bank: **`Resources & PDF Packages`**.
2. Display a table of all `course_resources` (including our seeded `Haramaya University CCI — B.Sc. IT Model Exit Exam (Jan 2023 PDF)`) showing:
   - Resource Title & Type badge (`PAST_EXAM`, `LECTURE_NOTE`, etc.)
   - Course Code (`IT-CMTS-101`..`IT-IASC-401`)
   - Storage Bucket & Object Key (`course-packages / past-exams/...`)
   - File Size (MB/KB) & truncated `SHA-256` checksum badge with copy button
   - Version (`v1`) & `Offline Eligible` toggle switch
3. Include a `"Register / Update Resource Package"` modal to add or edit a resource record.

### Task 3: Verify Day 3
Run `backend/.venv/bin/pytest backend/tests/test_admin_suite.py -v` and `npm --prefix web run typecheck` to confirm everything compiles and passes.
```

---

## Day 4 Prompt — Database Migrations, `pgvector(384)` Status & Data Lake Mirror Explorer in `/system`

Wait until Day 3 finishes, then copy and paste **only this Day 4 block**:

```text
We are doing Day 4 of 5 to add live Database Migrations, Table Row Counters, `pgvector(384)` Embedding Metrics, and the Data Lake Mirror Explorer to `/system`. Execute only these 3 focused tasks:

### Task 1: Database & Data Lake Mirror Diagnostics Endpoint (`backend/app/admin/router.py`)
1. Add `GET /api/v1/admin/database-status` in `backend/app/admin/router.py` returning:
   - `applied_migrations`: list of rows from `schema_migrations` (`filename`, `checksum`, `applied_at`) if the table exists, or scanned SQL files from `supabase/migrations/`.
   - `table_counts`: live `COUNT(*)` dictionary for `users`, `tenants`, `tenant_memberships`, `courses`, `learning_outcomes`, `course_resources`, `exam_blueprints`, `questions`, `question_options`, `exam_attempts`, `orders`, `feature_entitlements`, `sync_changes`, `audit_logs`, and `resource_embeddings`.
   - `latest_sync_seq`: `COALESCE(MAX(change_seq), 0)` from `sync_changes`.
   - `lake_mirror`: status object showing `{ "status": "IN_SYNC", "snapshot_watermark_seq": latest_sync_seq, "raw_mirror_path": "dev_storage/lake/raw_mirror", "curated_analytics_path": "dev_storage/lake/curated_analytics", "last_verified_at": NOW() }`.

### Task 2: Upgrade `/system` Page with Database & Lake Mirror Explorer (`web/src/app/system/page.tsx`)
1. In `web/src/app/system/page.tsx` (and `web/src/lib/api.ts`), add a **"Database Schema, pgvector(384) & Data Lake Mirror"** section below the existing infrastructure cards:
   - **Live Table Row Counter Grid**: Displays crisp metric badges for all 15 PostgreSQL tables (highlighting `15 Courses`, `100+ Questions`, `pgvector(384) Chunks`, `Sync Ledger Seq #`, and `Audit Logs`).
   - **Applied Migrations Table**: Shows the applied `supabase/migrations/*.sql` files with their SHA-256 checksums and status (`Applied ✓`).
   - **Data Lake Mirror Status Card**: Shows `Mirror Status: IN_SYNC ✓`, `Watermark Sequence #`, `raw_mirror` vs. PII-sanitized `curated_analytics` zones, and a `"Refresh Diagnostics"` button.

### Task 3: Verify Day 4
Run `backend/.venv/bin/pytest backend/tests/test_admin_suite.py -v` and `npm --prefix web run typecheck`.
```

---

## Day 5 Prompt — Dynamic Products, Institutional Seat Licenses in `/plans` & Final End-to-End Sign-Off

Wait until Day 4 finishes, then copy and paste **only this Day 5 block**:

```text
We are doing Day 5 of 5 (final day) to add Institutional License Seat Management to `/plans` and run our complete end-to-end verification suite. Execute only these 3 focused tasks:

### Task 1: Dynamic `products` Audit & Institutional License Endpoints (`backend/app/admin/router.py`)
1. Verify that `GET /api/v1/admin/products` and `PATCH /api/v1/admin/products/{product_id}` read and update actual rows in the `products` table dynamically, record price/feature changes in `audit_logs`, and emit an `UPSERT` to `sync_changes`.
2. Add `GET /api/v1/admin/tenants-licenses` and `POST /api/v1/admin/tenants-licenses` in `backend/app/admin/router.py`:
   - Lists institutional tenants (`tenants.organization_name`, `slug`, `status`) along with their `institution_licenses` (`total_seats`, `assigned_seats` count from `seat_assignments`, `valid_until`).
   - Allows the Platform Owner to create a university tenant or allocate/extend an institutional seat license (recording an entry in `audit_logs`).

### Task 2: Add Institutional Licenses Section to `/plans` (`web/src/app/plans/page.tsx`)
1. In `web/src/app/plans/page.tsx` (and `web/src/lib/api.ts`), add an **"Institutional B2B Seat Licenses"** tab/panel alongside the B2C Subscription & Bundle cards and Orders table:
   - Displays each university workspace (`e.g., Haramaya University — CCI`), contracted seat capacity (`Assigned / Total Seats`), license expiry date, and a `"Provision / Extend University Seats"` modal.

### Task 3: Final 4-Guardrail End-to-End Verification Gate
1. Expand `backend/tests/test_admin_suite.py` to assert all 4 architectural guardrails:
   - Guardrail 1 (`FR-026`): Admin mutations write to `audit_logs`.
   - Guardrail 2 (`ADR-006`): Admin content/entitlement updates write to `sync_changes`.
   - Guardrail 3 (`ADR-005`): Updating a question increments `questions.version` without changing historical `exam_attempts.question_snapshots`.
   - Guardrail 4: `/api/v1/admin/products`, `/api/v1/admin/orders`, and `/api/v1/admin/database-status` succeed with 200 OK against the live schema.
2. Run `backend/.venv/bin/pytest backend/tests/test_admin_suite.py -v` and `npm --prefix web run build` and confirm 100% pass with 0 errors.
```
