# Days 8–16 Comprehensive AI Code Agent Prompts (Slices 3, 4 & 5A)
**Project: `SaaS_Learning_Exit_Exam_Platform` | IDE: Antigravity (`Gemini 3.8 Flash High`) | Supabase: `sbvyjbipchglzmttkowy` (`eu-west-1`)**

These nine daily prompts (`Day 8` through `Day 16`) take your platform from curriculum browsing through **Encrypted Offline Resource Downloads & Protected Content Reader (`MOB-09`–`MOB-12`)**, **Immutable Exam Snapshots & Locked 100-Question Exam Runner (`MOB-13`–`MOB-16`, `MOB-18`–`MOB-20`)**, and the **Bidirectional Opaque-Cursor Delta Sync Engine (`/api/v1/sync/*`)**.

---

## Day 8 Prompt — FastAPI Content Delivery, `StorageAdapter` & Signed Download Grants (`/api/v1/resources/*`)

Copy and paste this into Antigravity IDE for **Day 8**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md @docs/SaaS_Database_Architecture_and_System_Specification.md

Execute the complete Day 8 backend engineering tasks in `backend/app/content/` and `backend/app/entitlements/` for Slice 3 (Protected Resource Delivery & Signed Offline Download Grants):

### Task 1: Entitlement Evaluator Service (`backend/app/entitlements/service.py`)
1. Implement `evaluate_resource_access(db, user_id, tenant_id, resource_id, action)`:
   - Checks `course_resources` publication state and tenant ownership (`tenant_id IS NULL` for global resources or `tenant_id == current_tenant_id` for institutional resources).
   - Evaluates active personal (`tenant_id IS NULL`) and institutional (`tenant_id == current_tenant_id`) rows in `feature_entitlements` where `revoked_at IS NULL AND (valid_until IS NULL OR valid_until > NOW())`.
   - Returns a structured decision object: `{ allowed: bool, source_type: str, offline_download_allowed: bool, storage_quota_mb: int, license_expires_at: datetime, reason_code: str | None }`.

### Task 2: Resumable Local/Supabase `StorageAdapter` & Download Grant Endpoint (`backend/app/content/`)
1. Upgrade `backend/app/content/storage_adapter.py`:
   - Support byte-range streaming (`Range: bytes=start-end` returning `206 Partial Content` and `Accept-Ranges: bytes`) on `/api/v1/dev-storage/{bucket}/{object_key:path}` when `STORAGE_DRIVER=local` so mobile resumable downloads work identically in local dev and Supabase Storage (`STORAGE_DRIVER=supabase`).
   - Generate a deterministic or per-package wrapped AES-256 content encryption key (`ephemeral_aes_key_b64`) bound to the user's `device_id` and `grant_id`.
2. Implement `POST /api/v1/resources/{id}/download-grant`:
   - Requires `Authorization: Bearer <JWT>`, optional `X-Tenant-ID`, `Idempotency-Key`, and body `{ "device_id": "<uuid>" }`.
   - Calls `evaluate_resource_access(..., action="DOWNLOAD")`. If denied, returns `403 Forbidden` with `{ "reason_code": "ENTITLEMENT_REQUIRED" | "OFFLINE_NOT_PERMITTED" }`.
   - If allowed, resolves `(storage_bucket, storage_object_key)` via `StorageAdapter`, records an audit/usage event, and returns:
     ```json
     {
       "grant_id": "uuid",
       "resource_id": "uuid",
       "package_id": "uuid",
       "version": 1,
       "download_url": "https://...",
       "file_size_bytes": 1482910,
       "sha256_checksum": "64-char-hex",
       "ephemeral_aes_key_b64": "base64-key",
       "license_expires_at": "2026-11-21T00:00:00Z"
     }
     ```

### Day 8 Verification Gate
Write and run `backend/tests/test_day8_download_grants_and_range.py` verifying:
1. Authorized users receive a valid signed download grant with `sha256_checksum` and `ephemeral_aes_key_b64` for the seeded `IT Model Exam.pdf` resource.
2. Byte-range requests (`Range: bytes=0-1023`) return `206 Partial Content` with exact byte slices.
3. Unauthorized cross-tenant requests return `403`.
```

---

## Day 9 Prompt — React Native Resumable Download Manager Engine, SHA-256 Checksum Verifier & LRU Quota Guard

Copy and paste this into Antigravity IDE for **Day 9**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 9 mobile engineering tasks in `mobile/src/services/download-manager/`:

### Task 1: Deterministic Package Download State Machine (`DownloadManagerService.ts`)
1. Create `mobile/src/services/download-manager/DownloadManagerService.ts` implementing the Section 6.1 state machine across `download_packages` and `local_exam_packages`:
   `NOT_DOWNLOADED -> QUEUED -> DOWNLOADING -> VERIFYING_CHECKSUM -> AVAILABLE_OFFLINE` (plus `PAUSED`, `FAILED`, `EXPIRED`, `REMOVED`).
2. Before queuing or starting a download, enforce 3 pre-flight checks:
   - **Storage Quota Check (`MOB-27`)**: Compare `used_bytes + resource.file_size_bytes` against `device_profile.storage_quota_mb`. If exceeded, emit `STORAGE_FULL` error with exact MB needed.
   - **Wi-Fi Only / Data Saver Check (`NFR-06`)**: If `device_profile.wifi_only_downloads` or `isMetered` is active, keep state as `QUEUED_WAITING_FOR_WIFI` unless the user explicitly confirms metered transfer.
   - **Entitlement Grant Request**: Call `POST /api/v1/resources/{id}/download-grant` to obtain the signed URL, expected `sha256_checksum`, `license_expires_at`, and `ephemeral_aes_key_b64`. Store `ephemeral_aes_key_b64` in `expo-secure-store` keyed by `package_id` (never in plaintext SQLite).

### Task 2: Resumable Chunked Transfer & SHA-256 Verification
1. Implement resumable file downloading into private sandbox storage (`FileSystem.documentDirectory + 'packages/'`):
   - Track downloaded bytes and emit real-time progress events (`{ packageId, bytesWritten, totalBytes, percent, state }`) for `<PackageDownloadButton />` and `MOB-12`.
   - Support `pauseDownload(packageId)`, `resumeDownload(packageId)` (using HTTP `Range` headers / `FileSystem.createDownloadResumable`), `retryDownload(packageId)`, and `cancelDownload(packageId)`.
2. Upon download completion, transition to `VERIFYING_CHECKSUM`:
   - Compute the SHA-256 digest of the downloaded file and compare it against the server manifest's `sha256_checksum`.
   - If the hash matches, commit `state = 'AVAILABLE_OFFLINE'` in SQLite.
   - If the hash mismatches, delete the corrupted file immediately, set `state = 'FAILED'`, and record `last_error = 'CHECKSUM_MISMATCH'` (never mark an unverified file as available).

### Task 3: Active-Session Deletion & Eviction Guard
1. In `removeLocalPackage(packageId)` and `evictExpiredOrLeastRecentlyUsed()`:
   - Block deletion if the package is currently open in `MOB-11` or referenced by an `IN_PROGRESS` or `SUBMITTED_LOCAL_PENDING` row in `local_exam_attempts`.

### Day 9 Verification Gate
Write and run `mobile/src/tests/download_manager_service.test.ts` verifying:
1. Full state progression `NOT_DOWNLOADED -> QUEUED -> DOWNLOADING -> VERIFYING_CHECKSUM -> AVAILABLE_OFFLINE`.
2. Checksum mismatch discards the file and transitions to `FAILED`.
3. Pause/resume preserves partial progress and storage-full pre-flight blocks oversized downloads cleanly.
```

---

## Day 10 Prompt — Resource Library (`MOB-09`), Resource Detail (`MOB-10`) & Download Manager (`MOB-12`)

Copy and paste this into Antigravity IDE for **Day 10**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 10 UI/UX implementation for `MOB-09`, `MOB-10`, and `MOB-12` in `mobile/src/features/resources/` and `mobile/src/features/downloads/`:

### Task 1: `MOB-09` — Resource Library Screen (`ResourceLibraryScreen.tsx`)
1. Build `mobile/src/features/resources/ResourceLibraryScreen.tsx`:
   - Search bar (`Search lecture notes, past exams, lab guides...`) and horizontal filter chips by `resource_type`: `All`, `Lecture Notes`, `Past Exams`, `Reference Books`, `Lab Content`, `Project Specs`, `External Links`.
   - Virtualized list of `<ResourceCard />` items displaying:
     - Format icon (`PDF`, `Markdown/Notes`, `Lab/Code`, `Video`, `URL`), title, author/department tag from JSONB `metadata`, file size in MB, version badge (`v1`), `<EntitlementBadge />`, and `<PackageDownloadButton />`.
   - Offline behavior: Downloaded items (`AVAILABLE_OFFLINE`) open immediately; uncached items when offline show a muted state `"Not downloaded — Connect to download (X.X MB)"` with a `Queue for Later` option.

### Task 2: `MOB-10` — Resource Detail & License Info Screen (`ResourceDetailScreen.tsx`)
1. Build `mobile/src/features/resources/ResourceDetailScreen.tsx`:
   - Displays full resource title, course code breadcrumb (`e.g., IT-CMTS-101`), resource type, version, publication date, and JSONB metadata (`institution`, `exam_date`, `external_software_reqs` like `JDK 17`).
   - **Entitlement & License Panel**: Shows exact access source (`Included in Personal Plan`, `Haramaya University Seat`, or `Free Public Catalog`) and offline license expiry date.
   - **Storage Impact Check Bar**: Displays `"Requires X.X MB • Y.Y GB available in your offline quota"`.
   - Sticky bottom CTAs: Primary `Open in Protected Reader (MOB-11)` (when `AVAILABLE_OFFLINE` or online streamable) and `Download for Offline Use` / `Remove Local Copy`.

### Task 3: `MOB-12` — Download Manager Screen (`DownloadManagerScreen.tsx`)
1. Build `mobile/src/features/downloads/DownloadManagerScreen.tsx`:
   - Top `<StorageMeter />` segmented visual bar showing `Downloads (MB)`, `Protected Unsynced Exam Queue (Locked MB)`, and `Free Quota (MB)`, plus a `Wi-Fi Only Downloads` toggle switch and quick link to `MOB-27` (Storage Settings).
   - Segmented filter tabs: `All` | `Downloading / Queued` | `Downloaded` | `Failed` | `Expired`.
   - Package rows with live byte progress (`8.4 / 14.2 MB • 59%`), version, license expiry badge (`"Valid offline until [Date]"`), and idempotent action buttons (`Pause ⏸`, `Resume ▶`, `Retry ↻`, `Open`, `Remove 🗑`).
2. Wire `MOB-09`, `MOB-10`, and `MOB-12` into `LearnStack` and `ProfileStack`.

### Day 10 Verification Gate
Write and run `mobile/src/tests/resource_and_download_screens.test.ts` verifying filter chip behavior on `MOB-09`, storage impact display on `MOB-10`, and pause/resume/delete controls on `MOB-12`.
```

---

## Day 11 Prompt — Protected Content Reader (`MOB-11`) with Dynamic Watermark, `FLAG_SECURE` & Bookmark Queueing

Copy and paste this into Antigravity IDE for **Day 11**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 11 implementation of `MOB-11` (`ProtectedContentReaderScreen.tsx`) in `mobile/src/features/resources/`:

### Task 1: Protected Content Reader Viewport & Ephemeral Decryption (`MOB-11`)
1. Build `mobile/src/features/resources/ProtectedContentReaderScreen.tsx` and reusable `<ProtectedContentReader />` (Component #9 in Section 7):
   - **Offline-First Startup**: Opens any package where `download_packages.state === 'AVAILABLE_OFFLINE'` and `license_expiry > Date.now()` with **zero network calls** (`NFR-05`). If `license_expiry <= Date.now()`, blocks opening with the State 11 banner: `"Offline access for this package expired on [Date] — Connect to refresh access."`
   - **Ephemeral Memory Decryption**: Fetches the package's `ephemeral_aes_key_b64` from `secure-storage`, decrypts content chunks in volatile memory only (never writing decrypted files to shared external storage), and purges buffers when the screen unmounts or the app backgrounds.
   - **Multi-Format Rendering**:
     - Renders structured Markdown lecture notes, takeaway callouts, relational tables, and syntax-highlighted code blocks (`C++`, `Java`, `C#`, `PHP`, `JavaScript`, `SQL`).
     - Renders PDF documents / paged exam papers (including our seeded 30-page `Haramaya University CCI — B.Sc. IT Model Exit Exam (Jan 2023 PDF)`) with page navigation (`Page X of 30`) and zoom controls.

### Task 2: Dynamic User Watermark Overlay & Screen Capture Deterrence (`Section 11.6`)
1. Create `<WatermarkOverlay />` rendered over the reader viewport (`pointerEvents="none"`, `opacity: 0.08`, diagonal `-30deg` tiled pattern):
   - Displays `${user.fullName} • ${user.email} • Device: ${deviceId.slice(0, 8)} • ${utcTimestamp}`.
2. Enable OS screen-capture protection while `MOB-11` is mounted:
   - Activate Android `FLAG_SECURE` / `expo-screen-capture` (`usePreventScreenCapture()`), and on iOS listen for screen recording to blur the viewport and show `"Screen recording is disabled for protected course materials."`

### Task 3: Auto-Hiding Reader Toolbar, Typography Controls & Debounced Bookmarks
1. Top Auto-Hiding Toolbar: Back button, Resource Title, `Page X of Y` counter, Bookmark toggle icon (`★`), Find-in-Document search bar, and Reader Appearance sheet (`Light`, `Sepia`, `Dark` canvas + font size `- / +`).
2. Bottom Scrubber Bar: Page slider, `"Jump to Last Read Position"` pill, and contextual `"Practice Questions for This Course"` CTA (navigates to `MOB-13` filtered to the course).
3. Persist reading position (`page_or_position`) to `local_bookmarks` every 3 seconds (debounced) inside a SQLite transaction and enqueue a `bookmark.upsert` operation in `sync_operations`.

### Day 11 Verification Gate
Write and run `mobile/src/tests/protected_content_reader.test.ts` verifying:
1. Valid cached packages open in Airplane Mode with zero network calls and render `<WatermarkOverlay />`.
2. Expired offline grants block opening with the `Access Expired` recovery action.
3. Changing pages updates `local_bookmarks` and queues `bookmark.upsert` in `sync_operations`.
```

---

## Day 12 Prompt — FastAPI Assessment Engine, Immutable Question Snapshots & Server-Only Grading (`/api/v1/exams/*`, `/api/v1/attempts/*`)

Copy and paste this into Antigravity IDE for **Day 12**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md @docs/SaaS_Database_Architecture_and_System_Specification.md

Execute the complete Day 12 backend assessment engine tasks in `backend/app/assessments/` and `backend/app/learning/`:

### Task 1: Immutable Question Snapshot Serialization (`POST /api/v1/exams/{id}/attempts`)
1. Implement `POST /api/v1/exams/{id}/attempts`:
   - Accepts `{ "device_id": "uuid", "mode": "ONLINE" | "OFFLINE_PACKAGE" }` and `Idempotency-Key` (`client_operation_id`).
   - Checks `feature_entitlements` for exam access.
   - Queries the questions for the `exam_blueprint` (for the 100-question HU CCI Model Exit Exam, selects Q1–Q100 in canonical order; for course practice quizzes, selects questions matching `course_id` and blueprint rules).
   - Builds the full authoritative `question_snapshots` JSONB array (including `question_id`, `course_id`, `outcome_id`, `question_text`, `type`, `level`, `difficulty`, `explanation`, and `options: [{ option_id, option_label, option_text, is_correct }]`) and locks it into `exam_attempts.question_snapshots` on the server (`ADR-005`).
   - **Critical Security Rule (`FR-009` & `MOB-15`/`MOB-19` Reveal Policy)**:
     - The payload returned to the client before submission **strips `is_correct` and `explanation`** from `question_snapshots` so client apps never hold raw answer keys during an active attempt.

### Task 2: Online Answer Logging & Deterministic Server-Side Grading (`POST /api/v1/attempts/{id}/submit`)
1. Implement `POST /api/v1/attempts/{id}/answers`:
   - Appends/upserts the student's selected option (`question_id`, `selected_option_id`, `response_time_seconds`, `sequence_no`) into `attempt_answers` for an `IN_PROGRESS` attempt. Rejects any client payload attempting to set `is_correct` directly.
2. Implement `POST /api/v1/attempts/{id}/submit`:
   - Idempotent on `operation_id` / `attempt_id`: if `exam_attempts.status == 'SCORED'`, immediately returns the existing scored result without re-running grading.
   - Accepts batch `answers[]` (for offline or final batch submissions), inserts them into `attempt_answers`, and invokes `SELECT * FROM public.grade_exam_attempt(:attempt_id)`.
   - Recomputes sliding-window `outcome_mastery` for all `outcome_id`s covered by the attempt.
   - Returns the complete validated result payload: `{ attempt_id, status: "SCORED", score_percent, correct_count, total_questions, scored_at, outcome_breakdown: [...], review_items: [...] }` (now including `is_correct` and `explanation` where `reveal_answers_immediately == TRUE`).

### Day 12 Verification Gate
Write and run `backend/tests/test_day12_exam_snapshots_and_grading.py` verifying:
1. Starting an attempt on the 100-question HU Model Exit Exam locks 100 items in `exam_attempts.question_snapshots` while stripping `is_correct` from the client start response.
2. Editing a question in the `questions` table *after* an attempt starts does NOT alter the locked snapshot or score of that attempt.
3. Submitting the same `operation_id` twice is 100% idempotent and returns the exact same server-computed score.
```

---

## Day 13 Prompt — Practice Catalog (`MOB-13`), Instructions (`MOB-14`) & Locked 100-Question Exam Runner (`MOB-15`)

Copy and paste this into Antigravity IDE for **Day 13**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 13 React Native implementation of `MOB-13`, `MOB-14`, and the locked full-screen Exam Runner `MOB-15` in `mobile/src/features/exams/`:

### Task 1: `MOB-13` Practice Catalog & `MOB-14` Exam Instructions
1. Build `mobile/src/features/exams/PracticeCatalogScreen.tsx` (`MOB-13`):
   - **Pinned Resume Banner**: Queries `local_exam_attempts` for any `IN_PROGRESS` session; if found, pins a high-contrast card at the top: `"In-Progress Exam: [Title] ([Answered]/[Total] answered) — Resume Attempt"`.
   - Filter chips: `Theme`, `Course`, `Exam Type` (`Practice Quiz`, `Course Exam`, `National Exit Simulation`), `Difficulty`, and `Offline Ready` toggle.
   - Renders blueprint cards (including the 100-question `HU CCI B.Sc. IT Graduating Class Model Exit Exam (Jan 2023)` and course quizzes) with question count, allowed duration (`180 mins`), `<EntitlementBadge />`, and `<PackageDownloadButton />` (`Ready Offline` vs. `Download Exam Package`).
2. Build `mobile/src/features/exams/ExamInstructionsScreen.tsx` (`MOB-14`):
   - 2×2 Summary Grid (`100 Questions`, `180:00 Duration`, `Multiple Choice (A–F)`, `Offline-Capable Practice`).
   - **Pre-Flight Readiness Checklist**: Verifies local package checksum, entitlement grant validity, and discloses submission behavior (answers save to SQLite on every tap; server computes official score).
   - Sticky bottom `Begin Exam Now` CTA: creates the `local_exam_attempts` row (`status = 'IN_PROGRESS'`) and navigates into `ExamSessionStack` (`MOB-15`).

### Task 2: `MOB-15` Locked Full-Screen Exam Runner (`ExamRunnerScreen.tsx`)
1. Build `mobile/src/features/exams/ExamRunnerScreen.tsx` inside `ExamSessionStack` (bottom tab bar hidden):
   - **Navigation & Hardware Back Lock**: Intercept Android hardware back button (`BackHandler`) and iOS swipe-back gesture to show a confirmation modal: `"Your answers are saved on this device. Pause exam and return to catalog?"`
   - **Locked Top Bar**:
     - `Pause / Exit` button
     - `<ExamTimer />` using monotonic elapsed time checkpoints persisted to `local_exam_attempts.elapsed_monotonic_sec` every 5 seconds so changing the device's wall clock cannot add extra exam time (turns amber at `<5:00` and pulsing red at `<1:00`).
     - `"Saved Locally ✓"` transactional indicator
     - `<QuestionPaletteSheet />` trigger button (`12 / 100`) and `Flag for Review ⚑` toggle.
   - **Question Viewport (`<QuestionRenderer />` & `<AnswerControl />`)**:
     - Displays Question number (`Question 19 of 100`), Course code (`IT-EDPR-203`), section tag (`Event Driven Programming`), Bloom's level pill (`APPLY`), and difficulty badge.
     - Renders Markdown stems including syntax-highlighted code blocks (`C++`, `Java`, `C#`, `PHP`, `JS`, `SQL`) and Markdown tables (such as the Question 91 `Student` table). Disables text copy during active run.
     - **Transactional Save-Before-ACK (`NFR-03`)**: When a student taps an option (`A`–`F`), execute `examAttemptRepository.saveAnswerTransactional(...)` inside SQLite *first*, and only after the transaction commits (`<16ms`), transition the option card to `"Saved Locally ✓"`.
   - **Virtualized 100/120-Question Palette Bottom Sheet (`<QuestionPaletteSheet />`)**:
     - Filter tabs: `All (100)` | `Unanswered (N)` | `Flagged (M)`.
     - 5-column virtualized grid (`Filled Blue` = Answered, `Amber Ring + ⚑` = Flagged, `Outlined` = Unanswered, `Bold Border` = Current) + `"Review & Submit Exam (MOB-16)"` CTA.

### Day 13 Verification Gate
Write and run `mobile/src/tests/exam_runner_transactional.test.ts` verifying:
1. Tapping an option on Q19 commits to `local_answer_events` and `local_exam_attempts` before UI state settles.
2. Simulating an app force-close and reopening `MOB-15` restores the exact question index, monotonic timer offset, flags, and all saved answers.
3. `<QuestionPaletteSheet />` renders 100 items and filters Unanswered and Flagged questions accurately.
```

---

## Day 14 Prompt — Submit Confirmation (`MOB-16`), Exam Result (`MOB-18`), Answer Review (`MOB-19`) & Attempt History (`MOB-20`)

Copy and paste this into Antigravity IDE for **Day 14**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 14 implementation of `MOB-16`, `MOB-18`, `MOB-19`, and `MOB-20` in `mobile/src/features/exams/`:

### Task 1: `MOB-16` Submit Confirmation (`SubmitConfirmationScreen.tsx`)
1. Build `mobile/src/features/exams/SubmitConfirmationScreen.tsx`:
   - Summary Card showing `AnsweredCount`, `UnansweredCount` (amber warning pill — tapping jumps back to the first unanswered question in `MOB-15`), `FlaggedCount`, and `TimeRemaining`.
   - **Connection-Aware Submission Disclosure**:
     - When `isOnline && isReachable`: `"You are online. Submitting now will upload your answers and calculate your official score immediately."` (`Primary CTA: Submit Online & View Score`)
     - When `!isOnline`: `"You are offline. Submitting now locks your attempt safely on this device and queues it (sync_operations) for automatic server scoring as soon as you reconnect."` (`Primary CTA: Lock & Queue Offline Submission`)
   - `<SubmitButton />`: Waits for any in-flight SQLite write, generates a deterministic UUIDv4 `operation_id`, transitions `local_exam_attempts.status = 'SUBMITTED_LOCAL_PENDING'`, enqueues `exam_attempt.submit` in `sync_operations`, and prevents duplicate taps.

### Task 2: `MOB-18` Exam Result (`ExamResultScreen.tsx` — Validated vs. Offline Provisional)
1. Build `mobile/src/features/exams/ExamResultScreen.tsx`:
   - **Variant A — Server-Validated Result (`status === 'ACCEPTED_RESULT_READY'`)**:
     - Circular score gauge (`e.g., 84.0% • 84/100 Correct`), `Server Verified ✓` green badge, total time spent, and completion timestamp.
     - **Theme & Course Outcome Breakdown**: Progress bars for each course/section tested (highlighting weak areas `<60%` for targeted review).
     - Primary CTA: `Review Answers & Explanations (MOB-19)` + Secondary CTA: `Practice Weak Outcomes` / `View Attempt History (MOB-20)`.
   - **Variant B — Offline Queued / Awaiting Server Validation (`status === 'SUBMITTED_LOCAL_PENDING'`)**:
     - High-contrast amber banner **`Submitted Offline — Awaiting Server Validation`**.
     - Displays `"100/100 Answers Locked Safely on Device"`, local submission timestamp, and `Operation ID`.
     - If local practice self-check estimate is enabled on the package, badges it strictly as **`Provisional Local Estimate — Official Score & Mastery Update After Server Sync`** (`ADR-005`, `FR-009`).
     - CTAs: `Sync Now` (when connection returns), `Track Submission Status (MOB-17)`, or `Back to Practice Catalog`.

### Task 3: `MOB-19` Answer Review & `MOB-20` Attempt History
1. Build `mobile/src/features/exams/AnswerReviewScreen.tsx` (`MOB-19`):
   - Filter pills: `All (100)` | `Incorrect` | `Correct` | `Flagged`.
   - Renders each question with `<QuestionRenderer mode="REVIEW" />`, highlighting `Your Answer` (red tint if incorrect) vs. `Correct Answer (✓)` (green tint), the instructor's step-by-step `Explanation` box, a deep link to the course resource (`Open in Reader MOB-11`), and an `"Ask AI Tutor to Explain Step-by-Step"` button.
   - Enforces the reveal policy guard: only unlocks answer keys after the attempt is submitted/accepted per blueprint rules.
2. Build `mobile/src/features/exams/AttemptHistoryScreen.tsx` (`MOB-20`):
   - Filterable list of all attempts (`Server Verified`, `Pending Sync`, `Needs Attention`) with score badge, date, duration, and tap-through to `MOB-18` or `MOB-17`.

### Day 14 Verification Gate
Write and run `mobile/src/tests/exam_submission_and_results.test.ts` verifying online immediate scoring (Variant A), offline queued submission with Provisional/Awaiting Sync labeling (Variant B), and Answer Review filtering on `MOB-19`.
```

---

## Day 15 Prompt — FastAPI Opaque-Cursor Delta Sync Engine & Tombstones (`/api/v1/sync/pull`, `/push`, `/status`)

Copy and paste this into Antigravity IDE for **Day 15**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md @docs/SaaS_Database_Architecture_and_System_Specification.md

Execute the complete Day 15 backend synchronization engine tasks in `backend/app/mobile_sync/` (`ADR-005` & `ADR-006`):

### Task 1: Opaque Monotonic Cursor Encoding & `GET /api/v1/sync/pull`
1. Implement opaque cursor encoding/decoding (`base64url` encoding `{ "seq": int, "scope": str }` with HMAC integrity signature so clients treat cursors as opaque tokens and never rely on device wall-clock timestamps).
2. Implement `GET /api/v1/sync/pull?cursor=<opaque_cursor>&limit=100`:
   - Queries `sync_changes` where `change_seq > decoded_seq` and `(tenant_id IS NULL OR tenant_id = current_tenant_id)` and `(user_id IS NULL OR user_id = current_user_id)` ordered by `change_seq ASC LIMIT :limit`.
   - Separates `UPSERT` records into `changes[]` and `TOMBSTONE` records into `tombstones[]`.
   - Returns `{ "next_cursor": "<opaque_cursor>", "has_more": bool, "changes": [...], "tombstones": [...] }`.
3. Add a helper/trigger so creating or updating a course, resource, exam blueprint, or entitlement (or deleting/unpublishing a resource) automatically appends an `UPSERT` or `TOMBSTONE` row to `sync_changes`.

### Task 2: Idempotent Batch Operation Push (`POST /api/v1/sync/push`) & Status Check (`GET /api/v1/sync/status`)
1. Implement `POST /api/v1/sync/push`:
   - Accepts `{ "device_id": "uuid", "operations": [{ "operation_id": "uuid", "type": "exam_attempt.submit" | "bookmark.upsert" | "support_case.create", "created_at": "iso8601", "payload": {...} }] }`.
   - Processes each operation inside a savepoint (`db.begin_nested()`):
     - **Idempotency Check**: First checks `sync_operations_log` for `operation_id`. If already processed with `status = 'ACCEPTED'`, returns `{ "operation_id": op.id, "server_id": existing.server_entity_id, "result": cached_score_summary }` in `accepted[]` without duplicating work!
     - **`exam_attempt.submit`**: Verifies that the user's entitlement/offline grant was valid (within `offline_grace_days`), creates/updates the `exam_attempts` and `attempt_answers` rows, calls `public.grade_exam_attempt()`, updates `outcome_mastery`, records `ACCEPTED` in `sync_operations_log`, and returns the authoritative score in `accepted[]`. If the grant was revoked or invalid, logs `REJECTED` with `reason_code` (`GRANT_EXPIRED`, `BLUEPRINT_SUPERSEDED`, `VALIDATION_ERROR`) and returns it in `rejected[]`.
     - **`bookmark.upsert`**: Applies field-level Last-Write-Wins merge by version/receipt and records `ACCEPTED`.
     - **`support_case.create`**: Persists the support ticket and records `ACCEPTED`.
2. Implement `GET /api/v1/sync/status?operation_ids=uuid1,uuid2`:
   - Returns the current server status (`ACCEPTED`, `REJECTED`, or `NOT_FOUND`) for each queried `operation_id` so mobile clients recovering from a dropped HTTP response check status before re-uploading.

### Day 15 Verification Gate
Write and run `backend/tests/test_day15_opaque_sync_engine.py` verifying:
1. `/api/v1/sync/pull` streams incremental `UPSERT` and `TOMBSTONE` changes strictly ordered by `change_seq`.
2. Pushing an offline `exam_attempt.submit` operation grades the attempt server-side and returns the official score.
3. Re-pushing the exact same `operation_id` 3 times in a row returns `accepted` idempotently without creating duplicate `exam_attempts` rows.
```

---

## Day 16 Prompt — React Native Bidirectional Sync Engine, Atomic Pull Transactions & Submission Status Tracker (`MOB-17`)

Copy and paste this into Antigravity IDE for **Day 16**:

```text
@docs/unified_education_saas_mobile_and_system_specification.md

Execute the complete Day 16 mobile synchronization engine and submission status tracking tasks in `mobile/src/services/sync-engine/` and `mobile/src/features/exams/SubmissionStatusScreen.tsx` (`MOB-17`):

### Task 1: Bidirectional Mobile Sync Engine (`SyncEngineService.ts`)
1. Create `mobile/src/services/sync-engine/SyncEngineService.ts`:
   - **Step A — Pre-Retry Status Reconciliation**: If any row in `sync_operations` has `state === 'UPLOADING'` (indicating the app crashed or lost connection mid-request on a previous pass), call `GET /api/v1/sync/status?operation_ids=...` first to reconcile already-accepted items before pushing.
   - **Step B — Idempotent Push Pass (`pushPendingOperations`)**:
     - Batch queued rows from `sync_operations` (`state IN ('QUEUED', 'RETRYABLE_FAILURE')` ordered by `created_at ASC`) and send `POST /api/v1/sync/push`.
     - For each item in `response.accepted`:
       - Inside a single SQLite transaction, mark `sync_operations.state = 'SERVER_ACCEPTED'`, and if `type === 'exam_attempt.submit'`, transition `local_exam_attempts.status = 'ACCEPTED_RESULT_READY'`, store `server_attempt_id`, official `score_percent`, `correct_count`, and unlocked explanations, and update `local_progress_cache`.
     - For each item in `response.rejected`:
       - Mark `sync_operations.state = 'REJECTED_NEEDS_RESOLUTION'` and store `reason_code` (`GRANT_EXPIRED`, etc.). **Never delete the local attempt or answers (`ADR-005`).**
     - On network timeout / `5xx` error, increment `retry_count`, set `state = 'RETRYABLE_FAILURE'`, and schedule exponential backoff with random jitter (`min(300s, 2^retry * 5s + jitter)`).
   - **Step C — Atomic Opaque-Cursor Pull Pass (`pullServerChanges`)**:
     - Read `opaque_cursor` for the active scope (`user_id + tenant_id`) from `sync_state`.
     - Loop `GET /api/v1/sync/pull?cursor=<opaque_cursor>&limit=100` while `has_more` is true:
       - Apply all `changes[]` (upserts to `local_themes`, `local_courses`, `local_outcomes`, `local_resources`, `local_exam_packages`) and `tombstones[]` (marking removed records) **AND update `sync_state.opaque_cursor = next_cursor` inside ONE atomic `withTransaction()` block**.
       - If an error occurs mid-batch, roll back the SQLite transaction so `opaque_cursor` remains at the previous watermark.
2. Wire `SyncEngineService` to trigger automatically when `NetworkContext` transitions from offline to online/reachable, on app foregrounding, and when the user taps `Sync Now`.

### Task 2: `MOB-17` Submission Status Stepper Screen (`SubmissionStatusScreen.tsx`)
1. Build `mobile/src/features/exams/SubmissionStatusScreen.tsx` (`MOB-17`):
   - Displays a 6-step visual progress tracker for any exam attempt:
     1. `Saved & Locked on Device` (with local timestamp & answer count `100/100`)
     2. `Waiting for Internet Connection`
     3. `Uploading Attempt (Operation ID)`
     4. `Received by Server — Scoring in Progress`
     5. `Server Verified — Official Result Ready` (auto-enables primary CTA `View Official Score & Explanations (MOB-18)`)
     6. `Needs Attention / Rejected` (conditional error step displaying human-readable reason code, reassuring the student that their local answers are safely preserved, and linking to `Sync Center MOB-28` recovery actions).
   - Includes a live `Sync Now / Check Status` button.

### Day 16 Verification Gate
Write and run `mobile/src/tests/sync_engine_and_submission_status.test.ts` verifying:
1. Full offline-to-online lifecycle: completing an exam in Airplane Mode creates a `QUEUED` operation -> reconnecting runs `SyncEngineService` -> transitions attempt to `ACCEPTED_RESULT_READY` and updates `MOB-17` & `MOB-18` to `Server Verified ✓`.
2. Simulated mid-batch crash during `pullServerChanges` rolls back cleanly without advancing `sync_state.opaque_cursor`.
3. Server rejection (`GRANT_EXPIRED`) transitions the operation to `REJECTED_NEEDS_RESOLUTION` while keeping `local_exam_attempts` and `local_answer_events` intact.
```

---

## Quick Verification Summary for Days 8–16

| Day | Core Milestone | Verification Command |
| :--- | :--- | :--- |
| **Day 8** | FastAPI `StorageAdapter` (Range `206`) & `/resources/{id}/download-grant` | `cd backend && pytest tests/test_day8_download_grants_and_range.py` |
| **Day 9** | Mobile Resumable Downloader, SHA-256 Verifier & LRU Quota Guard | `cd mobile && npx jest src/tests/download_manager_service.test.ts` |
| **Day 10** | `MOB-09` Resource Library, `MOB-10` Resource Detail & `MOB-12` Download Manager | `cd mobile && npx jest src/tests/resource_and_download_screens.test.ts` |
| **Day 11** | `MOB-11` Protected Content Reader (`<WatermarkOverlay />`, `FLAG_SECURE`) | `cd mobile && npx jest src/tests/protected_content_reader.test.ts` |
| **Day 12** | FastAPI Immutable `question_snapshots` & Server-Only Grading (`/attempts/*`) | `cd backend && pytest tests/test_day12_exam_snapshots_and_grading.py` |
| **Day 13** | `MOB-13` Catalog, `MOB-14` Intro & `MOB-15` Locked 100-Q Exam Runner (`<16ms` save) | `cd mobile && npx jest src/tests/exam_runner_transactional.test.ts` |
| **Day 14** | `MOB-16` Confirm, `MOB-18` Result (Verified vs. Provisional), `MOB-19` Review, `MOB-20` History | `cd mobile && npx jest src/tests/exam_submission_and_results.test.ts` |
| **Day 15** | FastAPI Opaque-Cursor `/sync/pull`, Idempotent `/sync/push` & `/sync/status` | `cd backend && pytest tests/test_day15_opaque_sync_engine.py` |
| **Day 16** | Mobile `SyncEngineService` (Atomic Pull + Push) & `MOB-17` Submission Status Stepper | `cd mobile && npx jest src/tests/sync_engine_and_submission_status.test.ts` |
