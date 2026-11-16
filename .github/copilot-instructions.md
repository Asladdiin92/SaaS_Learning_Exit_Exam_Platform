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

## 3. Strict Zero-Placeholder & No-Demo-Data Policy (MANDATORY)
- NEVER hardcode mock arrays, demo cards, fake user names ("Hello, Student"), fake in-progress exams ("IT-EXAM: Practice Exam"), or static sample text inside UI screens (`mobile/src/features/**` or `web/src/app/**`).
- Every screen MUST read real records from the FastAPI backend (`/api/v1/*` connected to Supabase `sbvyjbipchglzmttkowy`) and the local 13-table SQLite database (`mobile/src/shared/database/`).
- If a table has 0 rows (e.g., no active exam attempt or 0 downloaded packages), render a clean, honest Empty State component—never invent fake progress numbers or phantom attempts.
