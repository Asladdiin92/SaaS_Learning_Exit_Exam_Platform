# Unified Education SaaS Platform — React Native Mobile UI/UX, Offline Sync & Reconciled System Specification

| Document Attribute | Approved Baseline Value |
| :--- | :--- |
| **Document Title** | Unified React Native Mobile UI/UX & Reconciled System Specification |
| **Companion Suite (4-File Baseline)** | **File 3 of 4** — Reconciled with:<br>1. `Education_SaaS_Platform_System_Analysis_and_Design.docx` (v2.1)<br>2. `SaaS_Database_Architecture_and_System_Specification.md` (v2.1, Phases 1–22)<br>3. `unified_education_saas_mobile_and_system_specification.md` (v2.1)<br>4. `SaaS_Learning_and_Exam_Platform_Implementation_and_Architecture_Guide.md` (v2.1) |
| **Version & Status** | Version 2.1 — Reconciled Master Baseline with Supabase Cloud & Local Dev Parity |
| **Date** | 14 November 2026 |
| **Target Client Stack** | React Native + TypeScript (iOS & Android, optimized for 4GB–8GB RAM devices) |
| **Target Backend & Cloud Stack** | Python 3.12 / FastAPI Modular Monolith, PostgreSQL 16 (`pgvector`), Supabase Cloud Database & Supabase Storage (with Lightweight Local Docker Parity), Local SQLite/SQLCipher, OS Keychain/Keystore |
| **Primary Curriculum Baseline** | B.Sc. in Information Technology (5 Themes, 15 Courses, 45 Credit Hours) |

## 1. Executive Summary & Conflict Resolution Ledger

This master specification merges and reconciles all four project documents into a single implementation-ready source of truth. Every discrepancy between the System Analysis and Design (`SAD v2.1`), the 22-Phase Database Architecture (`DB v2.1`), the Implementation & Architecture Guide (`Guide v2.1`), and the React Native Mobile UI/UX Specification (`Mobile v2.1`)—including the **Local Dev to Supabase Cloud (Database + Storage) zero-conflict architecture**—has been resolved below so database, backend, web, and mobile engineering proceed without contradiction.

### 1.1 Master Conflict Resolution Matrix (Applied Across All 4 Files)

| Conflict Area | Legacy Contradiction in Earlier Drafts | Approved Unified Resolution (Enforced Across All 4 Files) |
| :--- | :--- | :--- |
| **1. Course Codes & Theme 5 Completeness** | The Implementation Guide used shortened codes (`IT-OOP-201`, `IT-DBS-301`, etc.) and placed Theme 5 out of order with its 4 courses omitted. | **Standardize all 15 Canonical Course Codes (`IT-CMTS-101` to `IT-IASC-401`)** and include full competency specifications for all 5 Themes (45 Credit Hours) in every document. |
| **2. Backend & Mobile Framework Drift** | Database Phase 9 used a Go Dockerfile, Phase 21 used a Node.js webhook, and the Implementation Guide listed FastAPI/NestJS and Flutter/React Native as open options. | **Lock Python 3.12 + FastAPI Modular Monolith (`ADR-001`)** and **React Native + TypeScript (`ADR-004`)** across all Dockerfiles, CI/CD pipelines, webhooks, and architecture guides. |
| **3. User & Tenant Relationship** | Early Phase 2 DDL placed a single `tenant_id` column directly on `users`. | **Global `users` + `tenant_memberships` (`ADR-002`)**. One global account can hold personal B2C purchases alongside 1..N institutional memberships. |
| **4. Subscription & Entitlement Model** | Early DDL tied access directly to `tenants.subscription_tier` and Stripe-only columns. | **Server-Authoritative `feature_entitlements` + Provider-Abstracted Payments (`ADR-003`, `ADR-008`)** supporting Chapa, Telebirr, Stripe, and Sandbox webhooks. |
| **5. Exam Scoring & Attempt Mutability** | Early Phase 2 accepted client `is_correct` booleans on insert; Phase 22 mentioned Last-Write-Wins (LWW). | **Immutable `question_snapshots` & Server-Only Scoring (`ADR-005`, `FR-009`)**. Clients submit selected option IDs with a UUID idempotency key; offline completions show **Provisional / Awaiting Sync** until server verification. |
| **6. Offline Delta Sync Mechanism** | Early Phase 22 used client timestamp watermarks (`last_pulled_at`) or vector clocks. | **Opaque Monotonic Server Cursor (`sync_changes.change_seq`) + Tombstones (`ADR-006`)**. Protects offline students whose device clock or timezone is skewed. |
| **7. Mobile Screen Count & Local SQLite Schema** | SAD v1.0 listed 24 screens (`MOB-01..24`) and 11 local tables; extended mobile flow had 30 routes (`MOB-01..30`). | **Adopt the 30-Screen Route Inventory (`MOB-01` to `MOB-30`) mapped explicitly to `SAD MOB-01..24`**, backed by the **Unified 13-Table Local SQLCipher Schema** and **27 Concrete `/api/v1/*` Endpoints**. |
| **8. Vector Embedding Dimension** | Early Phase 4 DDL specified `vector(1536)` while the Python ingestion worker used `all-MiniLM-L6-v2` (384-d). | **Standardize MVP migrations on `extensions.vector(384)` for `all-MiniLM-L6-v2`** (with documented migration parameter `EMBEDDING_DIM=1536` when using hosted OpenAI/Voyage models). |
| **9. Local Dev vs. Supabase Cloud & Storage** | Early DDL used raw `file_url TEXT` and session settings that differed from Supabase Cloud `auth.uid()`. | **Supabase Migration Parity + `StorageAdapter` (`ADR-009`)**. Store relative `(storage_bucket, storage_object_key)`, include an `auth.uid()` compatibility shim, and run lightweight `pgvector:pg16` locally (`<150 MB RAM`). |

### 1.2 Approved Architecture Decision Records (`ADR-001` – `ADR-009`)

| ADR ID | Decision Summary | Architectural Enforcement | Status |
| :--- | :--- | :--- | :--- |
| **ADR-001** | Modular monolith backend (`Python/FastAPI`) | Single deployable FastAPI service divided into 15 strict domain modules (`core`, `identity`, `tenants`, `curriculum`, `content`, `assessments`, `learning`, `commerce`, `entitlements`, `mobile_sync`, `ai`, `analytics`, `notifications`, `audit`, `workers`). Defer microservices, Kubernetes HPA, and cross-region sharding until post-pilot scale. | **Approved** |
| **ADR-002** | Global user identity + scoped `tenant_memberships` | Users authenticate once globally and switch active context via `WorkspaceSwitcher` (`X-Tenant-ID` header; `NULL` for Personal Workspace). | **Approved** |
| **ADR-003** | Server-authoritative entitlements | All protected reads, downloads, exam starts, and AI calls evaluate active personal and institutional grants via `/api/v1/me/entitlements`. | **Approved** |
| **ADR-004** | React Native + TypeScript mobile client | Shared iOS/Android student app; instructor authoring and institutional administration remain web-first (`Next.js`). | **Approved** |
| **ADR-005** | Append-only, idempotent offline exam attempts | Local answers write transactionally to `local_answer_events` before UI state settles; offline submissions queue `exam_attempt.submit` with a stable UUIDv4 `operation_id`. | **Approved** |
| **ADR-006** | Opaque server-issued sync cursors & tombstones | `GET /api/v1/sync/pull` advances `sync_state.cursor` only after the full batch commits in a single local SQLite transaction. | **Approved** |
| **ADR-007** | Staged enterprise infrastructure | Start with single-primary PostgreSQL + Redis + S3/Supabase object storage; stage multi-region read replicas and sharding for later phases. | **Approved** |
| **ADR-008** | Payment-provider adapter pattern | Orders and checkout sessions use a provider-agnostic webhook interface supporting Ethiopian gateways (Chapa, Telebirr) and international gateways (Stripe) without schema changes. | **Approved** |
| **ADR-009** | Zero-conflict Local Dev to Supabase Cloud & Storage parity | Keep all DDL inside `supabase/migrations/` with an `auth.uid()` compatibility shim and relative `(storage_bucket, storage_object_key)` columns so local Docker PostgreSQL (`pgvector:pg16`) and local disk storage promote to Supabase Cloud Database and Supabase Storage via environment variables with zero schema or code rewrites. | **Approved** |

## 2. Product Experience Principles, User Types & Curriculum Baseline

### 2.1 Target Mobile User Types

| User Type | Mobile Experience | Commercial & Access Relationship |
| :--- | :--- | :--- |
| **Individual Student (B2C)** | Discovers courses, studies, downloads eligible resources, takes practice exams, tracks outcome mastery, and manages personal purchases. | Free tier, recurring Student Premium subscription (monthly/annual), or one-time course/exam preparation bundle. |
| **Institution-Sponsored Student (B2B)** | Uses the same learning interface within an institution workspace context with assigned cohort courses and assessments. | Institution license/seat grants access; learner and payer are separate entities. |
| **Dual-Context Student (B2C + B2B)** | Switches cleanly between **Personal Workspace** and **1..N Institution Workspaces** via the Workspace Switcher. | Personal purchases and institutional seats coexist without overwriting or leaking data across contexts. |

### 2.2 Canonical B.Sc. in Information Technology Curriculum (5 Themes, 15 Courses, 45 Credits)

| Theme ID & Title | Total Credits | Course Code | Course Title | Credits | Core Competencies & Domains |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Theme 1: Computer System** | **4 Cr** | `IT-CMTS-101` | Computer Maintenance and Technical Support | 4 | Hardware/software failure diagnostics, fault isolation, preventive maintenance, repair protocols (`COGNITIVE`, `PSYCHOMOTOR`). |
| **Theme 2: System/Software Development** | **15 Cr** | `IT-OOPJ-201` | Object-Oriented Programming in Java | 3 | Classes, inheritance, polymorphism, debugging, rapid application development. |
| | | `IT-ADVP-202` | Advanced Programming | 3 | Collections framework, multithreading, concurrency, exception handling. |
| | | `IT-EDPR-203` | Event-Driven Programming | 3 | Visual development environments, GUI layouts, event listeners and handlers. |
| | | `IT-SYAD-204` | System Analysis and Design | 3 | SDLC methodologies, object-oriented system analysis, UML modeling (Use Case, Class, Sequence). |
| | | `IT-ITPM-301` | IT Project Management | 3 | Software quality assurance, risk management plans, project scheduling and governance. |
| **Theme 3: Database System & Information Management** | **6 Cr** | `IT-FDBS-201` | Fundamentals of Database System | 3 | Relational models, ER diagramming, normalization, schema design, DDL/DML, SQL queries. |
| | | `IT-ADBS-301` | Advanced Database System | 3 | Query optimization, transaction management (ACID), distributed databases, recovery methods. |
| **Theme 4: Mobile Application & Web Development** | **9 Cr** | `IT-IPRG-301` | Internet Programming-I | 3 | Client-side web development (HTML5, CSS3, JavaScript, HTTP/web protocols). |
| | | `IT-IPRG-302` | Internet Programming-II | 3 | Server-side scripting (PHP, JSP, Servlets, Node.js), web-database integration, e-commerce forms. |
| | | `IT-MABD-401` | Mobile Application Development | 3 | Mobile SDKs, application lifecycle, offline storage, event handling, mobile GUI layouts. |
| **Theme 5: Networking & Information Security** | **11 Cr** | `IT-DCCN-201` | Data Communications and Computer Networks | 3 | OSI 7-layer model, TCP/IP suite, subnetting/VLSM, physical transmission media & protocols. |
| | | `IT-SNAD-301` | System & Network Administration | 3 | Network OS installation, user/group administration, disk/file systems, backups, remote admin. |
| | | `IT-NDVC-302` | Network Device & Configuration | 3 | Router & switch CLI configuration, VLAN creation, routing protocols, bandwidth prioritization. |
| | | `IT-IASC-401` | Information Assurance and Security | 2 | Risk & threat assessment, security policies, symmetric/asymmetric cryptography, secure architecture. |

## 3. Information Architecture & Reconciled 30-Screen Navigation Map

### 3.1 Root Navigator Topology

1. **`SplashGate` (Startup Bootstrapper)**: Runs SQLCipher database migrations, checks OS Keychain/Keystore for rotating refresh secret and biometric lock policy, initializes `NetInfo` connectivity listener, and routes to `AuthStack` or `StudentTabs`.
2. **`AuthStack` (Authentication & Onboarding)**: Handles welcome, sign-in, account registration, password recovery, identity verification, biometric unlock, and initial workspace selection (`MOB-01` to `MOB-04`).
3. **`StudentTabs` (5-Tab Primary Bottom Navigator)**: Persistent bottom tab bar (`Home`, `Learn`, `Practice`, `Progress`, `Profile`) visible on root screens; preserves independent stack history per tab and hides automatically on full-screen readers, exam runners, and checkout flows.
4. **`ExamSessionStack` (Locked Full-Screen Assessment Stack)**: Houses `MOB-15` (Exam Runner) and `MOB-16` (Submit Confirmation). Intercepts hardware back presses and OS gestures so students never accidentally abandon an active attempt.
5. **`GlobalModals` (Overlay & Sheet Stack)**: Houses quick Workspace Switcher bottom sheet, contextual Paywall/Access sheet, and AI Course Tutor grounded drawer (Growth V2).

### 3.2 Complete 30-Screen Route & Traceability Table (`MOB-01` – `MOB-30`)

| Unified ID | SAD Appendix A ID | Screen Name | Route Path / Key | Navigator Stack | Tab Bar Visible |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`MOB-01`** | `SAD MOB-01` | Welcome & Onboarding | `/auth/welcome` | `AuthStack` | No |
| **`MOB-02`** | `SAD MOB-02` | Sign In & Biometric Unlock | `/auth/sign-in` | `AuthStack` | No |
| **`MOB-03`** | `SAD MOB-01/02` | Create Account & Verify Identity | `/auth/register` | `AuthStack` | No |
| **`MOB-04`** | `SAD MOB-02` | Workspace Selection | `/auth/workspaces` | `AuthStack` / Modal | No |
| **`MOB-05`** | `SAD MOB-03` | Home Dashboard | `/home` | `HomeStack` (Root) | Yes |
| **`MOB-06`** | `SAD MOB-04` | Theme Catalog | `/learn/themes` | `LearnStack` (Root) | Yes |
| **`MOB-07`** | `SAD MOB-05` | Course List | `/learn/themes/:themeId/courses` | `LearnStack` | Yes |
| **`MOB-08`** | `SAD MOB-06` | Course Overview | `/learn/courses/:courseId` | `LearnStack` | No |
| **`MOB-09`** | `SAD MOB-07` | Resource Library | `/learn/courses/:courseId/resources` | `LearnStack` | No |
| **`MOB-10`** | `SAD MOB-07` | Resource Detail & License Info | `/learn/resources/:resourceId` | `LearnStack` | No |
| **`MOB-11`** | `SAD MOB-08` | Protected Content Reader | `/learn/resources/:resourceId/read` | `LearnStack` (Full) | No |
| **`MOB-12`** | `SAD MOB-09` | Download Manager | `/downloads` | `LearnStack` / `ProfileStack` | No |
| **`MOB-13`** | `SAD MOB-10` | Practice Catalog | `/practice` | `PracticeStack` (Root) | Yes |
| **`MOB-14`** | `SAD MOB-11` | Exam Details & Instructions | `/practice/exams/:examId/intro` | `PracticeStack` | No |
| **`MOB-15`** | `SAD MOB-12` | Exam Runner (Locked Assessment) | `/practice/attempts/:attemptId/run` | `ExamSessionStack` | No |
| **`MOB-16`** | `SAD MOB-13` | Submit Confirmation | `/practice/attempts/:attemptId/confirm` | `ExamSessionStack` | No |
| **`MOB-17`** | `SAD MOB-13/14` | Submission Status (Queue/Sync Tracker) | `/practice/attempts/:attemptId/status` | `PracticeStack` | No |
| **`MOB-18`** | `SAD MOB-14` | Exam Result (Validated & Provisional) | `/practice/attempts/:attemptId/result` | `PracticeStack` | No |
| **`MOB-19`** | `SAD MOB-15` | Answer Review & AI Remediation | `/practice/attempts/:attemptId/review` | `PracticeStack` | No |
| **`MOB-20`** | `SAD MOB-10/16` | Attempt History | `/practice/history` | `PracticeStack` / `ProgressStack` | No |
| **`MOB-21`** | `SAD MOB-16` | Progress Overview Dashboard | `/progress` | `ProgressStack` (Root) | Yes |
| **`MOB-22`** | `SAD MOB-16` | Course Progress & Outcome Mastery | `/progress/courses/:courseId` | `ProgressStack` | No |
| **`MOB-23`** | `SAD MOB-19` | Profile Home | `/profile` | `ProfileStack` (Root) | Yes |
| **`MOB-24`** | `SAD MOB-18` | Plans & Access (Entitlement Summary) | `/profile/access` | `ProfileStack` | No |
| **`MOB-25`** | `SAD MOB-17` | Store & Product Details | `/profile/store` | `ProfileStack` | No |
| **`MOB-26`** | `SAD MOB-17` | Checkout & Purchase Status | `/profile/checkout/:orderId` | `ProfileStack` | No |
| **`MOB-27`** | `SAD MOB-22` | Storage Settings & Cache Control | `/profile/storage` | `ProfileStack` | No |
| **`MOB-28`** | `SAD MOB-21` | Sync Center | `/sync-center` | `HomeStack` / `ProfileStack` | No |
| **`MOB-29`** | `SAD MOB-20` | Devices & Security | `/profile/security` | `ProfileStack` | No |
| **`MOB-30`** | `SAD MOB-23/24` | Notifications, Settings, Language & Help | `/profile/settings-help` | `ProfileStack` / `HomeStack` | No |

## 4. Design System, Semantic Tokens & Low-Bandwidth Grid

### 4.1 Viewport Grid, Safe Areas & Low-End Device Rules (`NFR-05`, `NFR-07`)

* **Fluid Grid & Spacing**: 4-column portrait grid with `16dp` horizontal margins on compact phones (`360dp–430dp` width) and `24dp` margins on tablets (`>600dp`), `12dp` vertical card rhythm, and `8dp` base spatial unit.
* **Touch Targets**: Minimum `48dp × 48dp` (`44pt × 44pt` iOS) interactive hit area on all buttons, option rows, question palette cells, and download icons.
* **Scroll & Memory Discipline**: Single primary vertical scroll container per screen (zero nested scroll traps). Use `@shopify/flash-list` with deterministic item heights for 120-question palettes and resource lists, skeleton shimmer placeholders instead of layout-shifting spinners, and hardware-accelerated opacity/transform transitions only so entry-level Android devices (e.g., 4GB/8GB RAM) maintain 60fps.

### 4.2 Semantic Color Tokens (WCAG AA/AAA Compliant)

| Semantic Token | Light Mode Hex | Dark Mode Hex | Usage Context |
| :--- | :--- | :--- | :--- |
| `surface.primary` | `#F8FAFC` | `#0F172A` | Primary screen canvas background |
| `surface.card` | `#FFFFFF` | `#1E293B` | Course cards, question containers, bottom sheets |
| `text.primary` | `#0F172A` | `#F8FAFC` | Headings, question stems, body copy (contrast ≥ 7:1) |
| `text.secondary` | `#475569` | `#94A3B8` | Metadata, credit hours, timestamps, course codes |
| `brand.primary` | `#1D4ED8` | `#3B82F6` | Primary CTAs, active tab indicator, selected option border |
| `status.online` | `#15803D` | `#22C55E` | Synced state, server-verified correct answer, active grant |
| `status.offline` | `#B45309` | `#F59E0B` | Offline cached badge, pending sync queue, provisional score |
| `status.error` | `#B91C1C` | `#EF4444` | Sync failure, rejected operation, expired grant, wrong answer |
| `status.locked` | `#64748B` | `#64748B` | Unentitled resource/exam, expired offline package |

### 4.3 Typographic Scale

* **Screen Title (`H1`)**: `22sp` Bold, line-height `28sp`
* **Section Header (`H2`)**: `18sp` SemiBold, line-height `24sp`
* **Card Title / Question Stem (`H3` / `Body-Lg`)**: `16sp` Medium/Regular, line-height `24sp` (with horizontal-scroll monospace `14sp` code blocks for Java, C++, SQL, PHP, and network CLI snippets)
* **Standard Body (`Body-Md`)**: `14sp` Regular, line-height `20sp`
* **Caption / Status Pill (`Label-Sm`)**: `12sp` Medium, line-height `16sp` (supports dynamic OS font scaling without text clipping)

## 5. Comprehensive Screen-by-Screen Specifications (`MOB-01` – `MOB-30`)

### 5.1 Authentication & Workspace Setup (`MOB-01` – `MOB-04`)

#### `MOB-01` — Welcome & Onboarding (`SAD MOB-01`)
* **Purpose**: Explain platform value (national B.Sc. IT curriculum alignment, exam practice, controlled offline study), allow immediate UI language selection, and disclose network/storage requirements.
* **Layout**: Top bar with brand mark and language picker pill (`English`, localization-ready for `Afaan Oromo` and `Amharic`). Center 3-card value carousel (5 Themes / 15 Courses / 45 Credits; Wi-Fi package downloads for offline study; Bloom's Taxonomy mastery tracking). Bottom data/terms disclosure box and sticky dual CTAs: `Create Free Account` (`MOB-03`) and `Sign In` (`MOB-02`).
* **Offline & Edge Cases**: Welcome slides render offline; account creation and first-time login display an explicit inline notice (`"Internet connection required for first-time sign-in or registration"`) and disable network CTAs while offline.

#### `MOB-02` — Sign In & Biometric Unlock (`SAD MOB-02`)
* **Purpose**: Authenticate existing student (`POST /api/v1/auth/login` or enterprise OIDC PKCE), restore personal/institutional memberships, or unlock a valid cached offline session via biometrics.
* **Layout**: Email/Institutional ID input, Password input with visibility toggle, `Forgot Password?` action, primary `Sign In` CTA, and `Sign In with Institution SSO` (OIDC + S256 PKCE). When offline with a valid local offline grant in Keychain/Keystore, renders the **Offline Biometric Unlock Card** showing cached user name, grant expiry timestamp, and `Unlock Offline Library with Fingerprint / Face ID`.
* **Validation & Security**: Never reveal whether an email exists on failed login. Store 15-minute access JWTs in memory only and rotating refresh secrets strictly in iOS Keychain / Android Keystore (`shared/secure-storage`).

#### `MOB-03` — Create Account & Verify Identity (`SAD MOB-01/02`)
* **Purpose**: Register a global student account (`POST /api/v1/auth/register`) and complete email/OTP identity verification (`VerifyIdentity` sub-step) or accept an institution invitation deep link.
* **Layout**: Full Name, Email (or verified phone), Password with live strength checklist, Terms/Privacy consent checkbox, and `Create Account` CTA, followed by a 6-digit verification code screen. If launched from an institutional invite link, pre-fills the sponsoring organization banner.
* **Offline & Edge Cases**: Strict online-only flow; handles duplicate email, weak password, and expired invitation tokens cleanly.

#### `MOB-04` — Workspace Selection (`SAD MOB-02`)
* **Purpose**: Allow students with multiple memberships (`GET /api/v1/me/workspaces`) to select their active context (`Personal Student Workspace` vs. `1..N Institution Workspaces` such as *Haramaya University — CCI*).
* **Layout**: List of workspace cards displaying Workspace Name, Role (`STUDENT`), Access Summary (`Personal Plan` vs. `Institution Seat • Active`), and `Continue in Selected Workspace` CTA.
* **Offline & Security**: Switching workspace updates the active tenant context (`X-Tenant-ID` header) and refreshes tenant-scoped courses/resources without merging institutional data into personal records. Offline mode allows switching only to workspaces whose local entitlement grant is cached and unexpired.

### 5.2 Home & Curriculum Discovery (`MOB-05` – `MOB-08`)

#### `MOB-05` — Home Dashboard (`SAD MOB-03`)
* **Purpose**: Surface the single most relevant next learning action, active workspace context, sync/download health, and study streak.
* **Layout**:
  * **Top AppHeader**: Left `<WorkspaceSwitcherChip />`; Right `<SyncStatusChip />` (links to `MOB-28`) and Notification Bell (links to `MOB-30`).
  * **ConnectionBanner**: Collapses to `0dp` when online and synced; expands when offline, metered, or when sync items need attention.
  * **Zone 1 — Continue Learning Hero Card**: Last opened resource (`Resume Reading p. 14` in `MOB-11`) or active practice attempt (`Continue Quiz • Q8/20` in `MOB-15`).
  * **Zone 2 — Offline Readiness Strip**: Quick counters for `Downloaded Courses`, `Offline Exam Packages`, and `Pending Sync Items`.
  * **Zone 3 — Weak-Outcome Practice Recommendations**: 2–3 cards targeting low-mastery learning outcomes with one-tap practice launch.
  * **Zone 4 — Recent Courses & Streak Pill**: Horizontal course cards + daily study streak indicator.
* **Offline Behavior**: Renders in `<16ms` from local SQLite (`local_courses`, `local_exam_attempts`, `local_bookmarks`). Marks cached subscription/entitlement status as `"Last verified: [Timestamp]"`.

#### `MOB-06` — Theme Catalog (`SAD MOB-04`)
* **Purpose**: Browse the 5 curriculum themes, inspect credit weights, search topics, and filter by offline readiness.
* **Layout**: Search bar (`Search themes, courses, or outcomes...`), filter chips (`All Themes` | `Available Offline`), and 5 Theme Cards showing Theme Number, Title, Credit Hours (`4 Cr` to `15 Cr`), Course Count, Mastery Progress Bar, and `Offline Ready` badge.
* **Offline Behavior**: Fully browsable and searchable offline via `local_themes` and `local_courses` with a cached version timestamp.

#### `MOB-07` — Course List (`SAD MOB-05`)
* **Purpose**: List all courses inside a selected theme with course code, credit hours, entitlement badge, mastery progress, and package download trigger.
* **Layout**: Theme breadcrumb header + Course Cards displaying Course Code (`e.g., IT-FDBS-201`), Credit Hours (`3 Cr`), `<EntitlementBadge />` (`Free`, `Included`, `Institution Seat`, `Locked`), 2-line general objective, mastery count (`3/6 Outcomes`), and `<PackageDownloadButton />` showing exact MB size.
* **Offline Behavior**: Reads from `local_courses` and `download_packages`. Tapping download while offline queues the request or prompts to connect.

#### `MOB-08` — Course Overview (`SAD MOB-06`)
* **Purpose**: Unified course hub presenting objectives, learning outcomes mapped to Bloom's Taxonomy, course resources, practice assessments, and course package download management.
* **Layout**:
  * **Course Header Card**: Code, Title, Credit Hours, General Objective, and **Course Package Bar** (`Package v4 • 18.4 MB • Updated 10 Nov 2026` + `Download / Update` or `Available Offline`).
  * **Segmented Tabs**:
    1. `Outcomes`: Lists `local_outcomes` grouped by domain (`COGNITIVE`, `AFFECTIVE`, `PSYCHOMOTOR`) and Bloom's level (`REMEMBER` $\rightarrow$ `CREATE`) with mastery bars.
    2. `Resources`: Links to or embeds `MOB-09` filtered to the course.
    3. `Practice`: Lists eligible course quizzes and exams.
  * **Secondary Action (Growth V2)**: `Ask AI Course Tutor` (online-only with active AI entitlement quota).

### 5.3 Resources, Content Reader & Download Manager (`MOB-09` – `MOB-12`)

#### `MOB-09` — Resource Library (`SAD MOB-07`)
* **Purpose**: Search and filter course learning resources (`LECTURE_NOTE`, `PAST_EXAM`, `REFERENCE_BOOK`, `LAB_CONTENT`, `PROJECT_SPEC`, `SOFTWARE_LINK`, `EXTERNAL_URL`).
* **Layout**: Search input, horizontal filter chips by `resource_type`, and `<ResourceCard />` rows displaying format icon (`PDF`, `Text/Markdown`, `Video`, `Lab/Code`, `URL`), title, file size (`2.0 MB`), `<EntitlementBadge />`, and offline state (`Available Offline`, `Download 2.0 MB`, `Update Available`, or `Online Only`).
* **Offline Behavior**: Downloaded items open immediately; uncached items show a clear `"Not downloaded — Connect to download (2.0 MB)"` state.

#### `MOB-10` — Resource Detail & License Info (`SAD MOB-07`)
* **Purpose**: Inspect resource description, author/department metadata, software prerequisites (e.g., `JDK 17`, `XAMPP`), file size, storage impact, and content license terms before opening or downloading.
* **Layout**: Resource metadata panel, access source explanation (`Granted via Haramaya University Seat` or `Included in Student Premium`), storage check (`Requires 2.0 MB • 4.2 GB free`), primary CTA (`Open in Reader` or `Download for Offline Use`), and secondary `Report Content Issue` action.
* **Validation**: Checks publication state, free storage quota, and `POST /api/v1/resources/{id}/download-grant` authorization before starting download.

#### `MOB-11` — Protected Content Reader (`SAD MOB-08`)
* **Purpose**: Render encrypted PDFs, structured Markdown/text notes, syntax-highlighted code/lab manuals, diagrams, and instructional videos while preserving reading position and enforcing content protection.
* **Layout**:
  * **Auto-Hiding Toolbar**: Back button, Title, Page/Position indicator (`Page 12 of 48`), Bookmark toggle (`local_bookmarks`), Find-in-page, and typography/theme controls (`Light`, `Sepia`, `Dark`).
  * **Protected Viewport**: Streams AES-256 decrypted chunks into ephemeral memory (never writes decrypted files to shared disk). Overlays a semi-transparent diagonal `<WatermarkOverlay />` (`Full Name • User/Email ID • Device ID • UTC Timestamp`) and enables OS screen-capture deterrence (`FLAG_SECURE` on Android, screen-recording observer on iOS).
  * **Bottom Scrubber Bar**: Page slider, `Resume Last Position` chip, and `Practice This Topic` shortcut.
* **Offline & Version Safety**: Opens verified local packages (`download_packages.state == 'AVAILABLE_OFFLINE'` and `license_expiry > now()`) with zero network calls. Saves reading position locally every 3 seconds (debounced). Never swaps a resource version mid-reading session without prompting.

#### `MOB-12` — Download Manager (`SAD MOB-09`)
* **Purpose**: Inspect and control all offline course and exam packages (`download_packages` & `local_exam_packages`).
* **Layout**:
  * **Top `<StorageMeter />`**: Visual bar showing `Downloads (340 MB)`, `Protected Exam Queue (1.2 MB)`, and `Free Quota`, plus `Wi-Fi Only Downloads` switch and link to `MOB-27`.
  * **Segmented Filter Tabs**: `All` | `Downloading / Queued` | `Downloaded` | `Failed` | `Expired`.
  * **Package Rows**: Title, course code, version (`v3`), byte progress (`8.4 / 14.2 MB • 59%`), license expiry date, and idempotent controls (`Pause ⏸`, `Resume ▶`, `Retry ↻`, `Remove Local Copy 🗑`).
* **Safety Rule**: Blocks deletion of any package currently open in `MOB-11` or referenced by an `IN_PROGRESS` / `SUBMITTED_LOCAL_PENDING` exam attempt.

### 5.4 Practice Examinations & Assessment Engine (`MOB-13` – `MOB-20`)

#### `MOB-13` — Practice Catalog (`SAD MOB-10`)
* **Purpose**: Discover and filter practice quizzes (`PRACTICE_QUIZ`), course exams (`COURSE_EXAM`), and 120-question national exit exam simulations (`NATIONAL_EXIT_SIMULATION`).
* **Layout**: Filter chips (`Theme`, `Course`, `Difficulty: Easy/Medium/Hard`, `Type`, `Offline Ready`), pinned **Resume Active Attempt Banner** (if an `IN_PROGRESS` attempt exists in `local_exam_attempts`), and Exam Blueprint Cards showing question count, duration, access source, and offline package state (`Ready Offline` vs. `Download Exam Package 1.8 MB`).
* **Validation**: Explicitly labels practice simulations as educational preparation rather than official government examinations.

#### `MOB-14` — Exam Details & Instructions (`SAD MOB-11`)
* **Purpose**: Disclose exam blueprint, timing policy, question count, attempt allowance, offline grant validity, and server scoring rules before starting an attempt.
* **Layout**: 2×2 Summary Grid (`Questions`, `Allowed Duration`, `Question Formats`, `Scoring Mode`), Pre-Flight Readiness Checklist (`Entitlement Verified`, `Package SHA-256 Verified`, `Submission Policy Disclosure`), and sticky bottom `Begin Exam Now` CTA.
* **Offline Start Validation**: Offline start succeeds only when `local_exam_packages` has a verified checksum, valid `grant_id`, unexpired window, and remaining attempt allowance. Creates a durable `local_exam_attempts` row transactionally before navigating to `MOB-15`.

#### `MOB-15` — Exam Runner (`SAD MOB-12`)
* **Purpose**: Distraction-free, crash-resilient single-question assessment interface with transactional local persistence.
* **Layout**:
  * **Locked Top Bar**: `Pause / Exit` button (opens confirmation sheet assuring answers are saved locally), `<ExamTimer />` pill (monotonic elapsed timer reconciled against server policy; turns amber at `<5:00` and red at `<1:00`), `Saved Locally ✓` indicator, `<QuestionPalette />` trigger (`12 / 30`), and `Flag ⚑` toggle.
  * **Question Viewport (`<QuestionRenderer />`)**: Question number, Course Code, Bloom's level badge (`APPLY`), Difficulty pill, stem text with scrollable syntax-highlighted code snippets or zoomable diagrams, and `<AnswerControl />` (`MULTIPLE_CHOICE`, `TRUE_FALSE`, or `CODING`/`ESSAY` where enabled).
  * **Expandable `<QuestionPaletteSheet />`**: Filter tabs (`All`, `Unanswered`, `Flagged`) + 5-column virtualized grid (Filled Blue = Answered, Amber Ring = Flagged, Outlined = Unanswered, Bold Border = Current).
  * **Sticky Bottom Navigation**: `← Previous` | `Saved to device` | `Next →` (or `Review & Submit` on final item).
* **Transactional Persistence Guarantee (`NFR-03`)**: Tapping an option executes a single SQLite transaction inserting an append-only row into `local_answer_events` and updating `local_exam_attempts` *before* the UI renders `"Saved Locally ✓"` (`<16ms`). Survives app force-close, OS memory kill, or battery drain without losing the current question index, timer checkpoint, flags, or answers.

#### `MOB-16` — Submit Confirmation (`SAD MOB-13`)
* **Purpose**: Prevent accidental submission, highlight unanswered/flagged items, and clearly distinguish **Online Immediate Submission** from **Offline Queued Submission**.
* **Layout**: Summary counters (`Answered: 27/30`, `Unanswered: 3` with tap-to-jump links, `Flagged: 2`, `Time Remaining: 11:42`), connection-aware notice, primary `<SubmitButton />` (`Submit Online & Score Now` when online vs. `Lock & Queue Offline Submission` when offline), and `Return to Exam` secondary button.
* **Idempotency**: Generates a deterministic UUIDv4 `operation_id` (`type = 'exam_attempt.submit'`), transitions `local_exam_attempts.status` to `SUBMITTED_LOCAL_PENDING`, and disables duplicate taps.

#### `MOB-17` — Submission Status (`SAD MOB-13/14`)
* **Purpose**: Provide transparent, step-by-step tracking of an attempt's lifecycle from local lock through server scoring (`MOB-17` in the 30-screen flow).
* **Layout**: Visual stepper tracking 6 deterministic states:
  1. `Saved & Locked on Device`
  2. `Waiting for Internet Connection`
  3. `Uploading Attempt (Operation ID)`
  4. `Received by Server — Scoring in Progress`
  5. `Server Verified — Result Ready` (auto-routes or links to `MOB-18`)
  6. `Needs Attention / Rejected` (displays human-readable reason code such as `GRANT_EXPIRED` and links to `MOB-28` resolution actions while preserving local evidence).
* **Validation**: Never describes a locally queued attempt as `"Submitted Successfully to Server"` until the server returns `accepted` in `POST /api/v1/sync/push` or `POST /api/v1/attempts/{id}/submit`.

#### `MOB-18` — Exam Result (`SAD MOB-14`)
* **Purpose**: Present server-validated scores, correct/incorrect breakdowns, and outcome mastery updates—or a clearly badged provisional state when offline.
* **Layout**:
  * **Online / Server-Validated State**: Circular score gauge (`83.3% • 25/30 Correct`), `Server Verified ✓` badge, time spent, Learning Outcome breakdown bars (highlighting weak outcomes `<60%`), and CTAs for `Review Answers & Explanations (MOB-19)` and `Practice Weak Outcomes`.
  * **Offline Pending / Provisional State**: High-contrast amber banner **`Submitted Offline — Awaiting Server Validation`**. If the offline practice package policy permits local self-check estimates, badges the number strictly as **`Provisional Local Estimate — Official Score Updates After Sync`**; otherwise hides final score until server acceptance.

#### `MOB-19` — Answer Review & AI Remediation (`SAD MOB-15`)
* **Purpose**: Step through completed questions comparing the student's selected option against the server-verified correct option, instructor explanation, linked course resource, and optional RAG AI Tutor walkthrough.
* **Layout**: Filter pills (`All`, `Incorrect`, `Correct`, `Flagged`), question stem, option cards (`Your Answer` vs. `Correct Answer`), `Official Explanation` box, deep link to the source lecture note (`Open in Reader MOB-11`), and `Ask AI Tutor to Explain Step-by-Step` button (online + Growth V2 AI quota).
* **Reveal Policy Guard**: Answer keys (`is_correct` and `explanation`) are only displayed after server acceptance and when the exam blueprint's reveal policy permits review.

#### `MOB-20` — Attempt History (`SAD MOB-10/16`)
* **Purpose**: Chronological log of all past and pending practice attempts across courses and simulations.
* **Layout**: Filter by `Course`, `Exam Type`, and `Status` (`Server Verified`, `Pending Sync`, `Needs Attention`). Each row shows Exam Title, Date/Time, Score (or `Pending Sync` pill), Duration, and tap-through to `MOB-18` (completed) or `MOB-17` (pending/rejected).

### 5.5 Progress, Profile, Commerce & System Controls (`MOB-21` – `MOB-30`)

#### `MOB-21` — Progress Overview Dashboard (`SAD MOB-16`)
* **Purpose**: Summarize study activity, theme-level readiness, and Bloom's cognitive distribution with explicit data freshness labels.
* **Layout**: **Freshness Strip** (`"Last synced & calculated: [Timestamp] • 1 offline attempt awaiting sync"`), Period Selector (`7 Days`, `30 Days`, `All Time`), 3 KPI cards (`Overall Readiness %`, `Active Courses`, `Validated Attempts`), **5 Theme Mastery Progress Bars** (tap to open `MOB-22`), and **6-Level Bloom's Taxonomy Distribution Chart** (`Remember` $\rightarrow$ `Create`) with footnote: *"Mastery scores are rolling estimates based on validated practice evidence, not official university grades."*

#### `MOB-22` — Course Progress & Outcome Mastery (`SAD MOB-16`)
* **Purpose**: Drill down into a specific course's learning outcomes, evidence window, and study history.
* **Layout**: Course header with credit hours and overall mastery %, list of `local_outcomes` grouped by domain (`COGNITIVE`, `AFFECTIVE`, `PSYCHOMOTOR`) showing attempted item count, rolling mastery score, `"Not yet synced"` indicator for local pending activity, and a `Practice This Outcome` button.

#### `MOB-23` — Profile Home (`SAD MOB-19`)
* **Purpose**: Central hub for user identity, active workspace switching, commercial access, offline downloads, security, and support.
* **Layout**: Identity Card (`Full Name`, `Verified Email`, `Edit Profile` action), Active Workspace Card (`Switch Workspace` $\rightarrow$ `MOB-04`), grouped navigation rows (`Plans & Access MOB-24`, `Store MOB-25`, `Download Manager MOB-12`, `Sync Center MOB-28`, `Storage Settings MOB-27`, `Devices & Security MOB-29`, `Settings & Help MOB-30`), and `Sign Out` button with unsynced-work safety check.

#### `MOB-24` — Plans & Access (`SAD MOB-18`)
* **Purpose**: Explain the student's current effective entitlements and clearly separate **Personal Subscriptions**, **One-Time Packages**, and **Institution-Sponsored Seats**.
* **Layout**:
  * **Effective Access Header**: Offline download allowance, storage quota, and remaining monthly AI Tutor queries.
  * **Section A — Institutional License Seats**: Sponsoring institution name, cohort, seat status (`Active` / `Expired`), and validity window.
  * **Section B — Personal Subscriptions & One-Time Bundles**: Plan name, renewal/expiry date, status (`Active`, `Payment Pending`, `Cancelled`), and `Refresh Access from Server` (`GET /api/v1/me/entitlements`).
* **Rule**: Personal plan expiry never revokes an active institutional seat, and institutional seat expiry never deletes personal purchases or historical attempts.

#### `MOB-25` — Store & Product Details (`SAD MOB-17`)
* **Purpose**: Browse and compare purchasable Student Premium subscriptions and one-time course/exit-exam preparation bundles (`GET /api/v1/products`).
* **Layout**: Category tabs (`Subscriptions` vs. `One-Time Exam & Course Bundles`), Product Detail cards listing included courses/resources, practice attempt limits, offline download rights, license duration, server-fetched price/currency, cancellation/refund terms, and `<PurchaseCTA />` (`Continue to Checkout`).
* **Offline Rule**: Cached catalog can be browsed offline, but price and availability must be revalidated online before opening `MOB-26`.

#### `MOB-26` — Checkout & Purchase Status (`SAD MOB-17`)
* **Purpose**: Create a server order (`POST /api/v1/orders`), hand off to the payment provider (`POST /api/v1/checkout-sessions`), and track webhook-verified entitlement activation.
* **Layout**: Order Summary Card, Payment Provider Handoff button, and **Return Status View** with 4 explicit states:
  1. `Payment Verification Pending` (polls `/api/v1/me/entitlements`; warns *"Do not pay again while verification is in progress"*)
  2. `Payment Confirmed — Access Activated ✓`
  3. `Payment Failed / Cancelled` (`Try Again` with idempotent order check)
  4. `Connection Lost During Checkout` (`Check Payment Status` button).
* **Security**: Never collects or stores raw card/bank credentials inside the mobile app; client redirect alone never unlocks content without a verified server webhook/event.

#### `MOB-27` — Storage Settings & Cache Control (`SAD MOB-22`)
* **Purpose**: Manage offline disk usage, storage quota (`500 MB`, `2 GB`, `Unlimited`), Wi-Fi-only preferences, and safe LRU cache cleanup.
* **Layout**: `<StorageMeter />` segmented by `Protected Unsynced Exam Data (Locked)`, `Downloaded Course/Exam Packages`, and `Temporary Media Cache`; Quota radio selector; `Wi-Fi Only Downloads` switch; `Clear Expired & Re-downloadable Cache` CTA; and package list sorted by size.
* **Hard Guardrail**: LRU eviction and manual cache clear **never** delete `local_exam_attempts`, `local_answer_events`, or `sync_operations`.

#### `MOB-28` — Sync Center (`SAD MOB-21`)
* **Purpose**: Full visibility and recovery controls for delta pull/push synchronization (`FR-021`, `FR-022`).
* **Layout**:
  * **Sync Health Header**: Connection status, `Last Successful Sync Timestamp`, `Committed Cursor Sequence`, and primary `Sync Now` button (`POST /api/v1/sync/push` then `GET /api/v1/sync/pull`).
  * **Tab 1 — Pending Queue (`QUEUED`, `UPLOADING`, `RETRYABLE_FAILURE`)**: Chronological list of local mutations (`exam_attempt.submit`, `bookmark.upsert`, `support_case.create`) with retry counters.
  * **Tab 2 — Needs Attention / Rejected (`REJECTED`)**: Displays safe server reason code (`GRANT_EXPIRED`, `PACKAGE_SUPERSEDED`, `VALIDATION_ERROR`) and recovery actions (`Refresh Access & Retry`, `Keep Local Evidence & Contact Support`).
  * **Tab 3 — Recently Synced**: Confirmed `operation_id` $\rightarrow$ `server_id` audit log.

#### `MOB-29` — Devices & Security (`SAD MOB-20`)
* **Purpose**: Manage registered devices (`POST /api/v1/devices/register`), configure local biometric app lock, and revoke lost/secondary device sessions (`DELETE /api/v1/devices/{id}`).
* **Layout**: Biometric Unlock switch (`Fingerprint / Face ID`), App Lock timeout selector, **Current Device Card** (`Device Model • App Version • Offline Grant Expiry`), and **Other Signed-In Devices List** with `Revoke Session` button (online required).

#### `MOB-30` — Notifications, Settings, Language & Help (`SAD MOB-23/24`)
* **Purpose**: Combine in-app notifications (`SAD MOB-23`), language/theme/data-saver settings, and offline troubleshooting FAQs + support ticket submission (`SAD MOB-24`).
* **Layout**:
  * **Segmented View 1 — Notifications**: Filter pills (`All`, `Unread`, `Exams`, `Sync & Billing`), notification cards with deep-link routing, and `Mark All Read`.
  * **Segmented View 2 — App Preferences**: UI Language selector, Theme (`System`, `Light`, `Dark`), Data Saver toggle (low-bandwidth image variants, defer large media).
  * **Segmented View 3 — Offline Help & Diagnostics**: Bundled searchable FAQ accordion (offline exams, expired grants, workspace switching) + `Submit Support Ticket` form with `Attach Non-PII Sync Diagnostics` (`device_id`, `app_version`, `cursor`, `last_error_code`). Queues in `sync_operations` if submitted offline.

## 6. Offline-First State Models, Sync Protocol & User Journeys

### 6.1 Deterministic Per-Record State Machines

```
1. DOWNLOAD PACKAGE STATE MACHINE (download_packages & local_exam_packages)
   NOT_DOWNLOADED ──► QUEUED ──► DOWNLOADING ──► VERIFYING_CHECKSUM ──► AVAILABLE_OFFLINE
                                      │                  │                      │
                                      ▼                  ▼                      ▼
                                   PAUSED             FAILED           EXPIRED / REVOKED / REMOVED

2. OFFLINE MUTATION QUEUE STATE MACHINE (sync_operations)
   LOCAL_SAVED ──► QUEUED ──► UPLOADING ──► SERVER_ACCEPTED
                                  │
                                  ├──► RETRYABLE_FAILURE (exponential backoff + jitter)
                                  └──► REJECTED_NEEDS_RESOLUTION (preserved locally; surfaced in MOB-28)

3. EXAM ATTEMPT STATE MACHINE (local_exam_attempts)
   CREATED_LOCALLY ──► IN_PROGRESS ──► SUBMITTED_LOCAL_PENDING ──► UPLOADED_PROCESSING ──► ACCEPTED_RESULT_READY
                                                                          │
                                                                          └──► REJECTED_NEEDS_ATTENTION
```

### 6.2 Global 12-State UI Feedback & Recovery Matrix

| State | Visual Indicator | Standard User-Facing Copy | Permitted Action |
| :--- | :--- | :--- | :--- |
| **1. First Load** | Shimmer skeleton cards | `"Loading your courses..."` (only if `>300ms`) | Navigate back or switch tabs |
| **2. Empty Library** | Neutral illustration card | `"Your learning library is empty."` | `Browse Curriculum Themes (MOB-06)` |
| **3. Offline (With Cache)** | Amber `Offline • Cached` banner | `"You're offline. Showing saved content from [Timestamp]."` | Read cached resources, take cached practice exams |
| **4. Offline (No Cache)** | Muted card + cloud-slash icon | `"This item hasn't been downloaded to your device yet."` | `Queue Download for Later` or `View Downloaded Content` |
| **5. Metered / Data Saver** | Blue `Data Saver` pill | `"Metered connection — Large files require confirmation."` | Confirm MB size before transfer or toggle `Wi-Fi Only` |
| **6. Downloading** | Progress bar (`%` + `MB/MB`) | `"Downloading package v4 (8.2 MB / 14.0 MB)..."` | `Pause`, `Cancel`, or continue browsing |
| **7. Download Interrupted** | Amber paused badge | `"Download paused at 58%. Verified chunks are saved."` | `Resume Download` or `Remove Partial File` |
| **8. Sync Pending** | Badge with queue count `(N)` | `"N item(s) saved on device and waiting to upload."` | `Sync Now` (when online) or inspect in `MOB-28` |
| **9. Sync Failed (Retryable)** | Warning banner in `MOB-28` | `"Connection timed out while syncing. Your work is safe on this device."` | `Retry Sync Now` |
| **10. Conflict / Rejected** | Red attention card in `MOB-28` | `"This item needs attention ([Reason]). Local answers are preserved."` | `Refresh Access & Retry` or `Send Diagnostic Report` |
| **11. Grant / Package Expired** | Lock banner on item | `"Offline access for this package expired on [Date]."` | `Connect to Refresh Access` or `View Plans (MOB-24)` |
| **12. Payment Pending** | Amber verification card (`MOB-26`) | `"We haven't confirmed this payment yet. Don't pay again until status is checked."` | `Check Payment Status` (`GET /api/v1/me/entitlements`) |

### 6.3 Bidirectional Opaque-Cursor Sync Protocol (`ADR-006`)

1. **Pull Phase (`GET /api/v1/sync/pull?cursor=<opaque_cursor>&limit=100`)**:
   * Server queries `sync_changes` and `tombstones` ordered by monotonic `change_seq > decoded_cursor` scoped to the authenticated user and active workspace.
   * Client validates the batch and applies all upserts and tombstone deletions inside **one atomic SQLite transaction**.
   * Only after the transaction commits does the client update `sync_state.cursor = next_cursor`. If the app crashes mid-batch, it safely replays from the prior cursor.
2. **Push Phase (`POST /api/v1/sync/push`)**:
   * Client sends ordered `sync_operations` (`operation_id`, `type`, `created_at`, `payload`).
   * Server checks `sync_operations_log` by unique `operation_id` for idempotency. Duplicate pushes of an already accepted `exam_attempt.submit` return the existing `server_id` and score without re-inserting answers.
   * If network drops before the HTTP response arrives, the client calls `GET /api/v1/sync/status?operation_ids=...` on reconnect before retrying.

### 6.4 Logout & Account-Switch Safety Protocol

When a user taps `Sign Out` (`MOB-23`), the client queries `SELECT COUNT(*) FROM sync_operations WHERE state != 'SERVER_ACCEPTED'` and `SELECT COUNT(*) FROM local_exam_attempts WHERE status IN ('IN_PROGRESS', 'SUBMITTED_LOCAL_PENDING')`.
* If `count > 0`, a modal warns: *"You have [N] unsynced exam submission(s) or an active attempt on this device. Syncing before sign-out is strongly recommended."* Actions: `Sync Now First` (Primary) | `Cancel` | `Sign Out & Keep Encrypted Queue for My Account`.
* On confirmed sign-out, in-memory JWTs, Keychain/Keystore refresh tokens, and ephemeral AES-256 content keys are wiped immediately, while unsynced `local_exam_attempts` and `sync_operations` remain encrypted and scoped by `user_id` until that user re-authenticates.

## 7. Reusable Component Contracts (16 Core Components)

| Component Name | Screens Used | Props & State Inputs | Behavioral & Interaction Contract |
| :--- | :--- | :--- | :--- |
| `<AppHeader />` | All screens | `title`, `canGoBack`, `workspace`, `rightActions` | Renders safe-area top bar, back navigation, and `<WorkspaceSwitcherChip />` on root screens. |
| `<WorkspaceSwitcherChip />` | `MOB-04`, `MOB-05`, `MOB-23` | `activeWorkspace`, `memberships[]`, `isOffline` | Opens modal sheet to switch between `Personal` and `Institution` workspaces; updates `X-Tenant-ID` and isolates tenant cache. |
| `<ConnectionBanner />` | All non-runner screens | `netState`, `reachability`, `syncQueueCount` | Reflects verified API reachability (not just Wi-Fi link up); collapses to `0dp` when online & synced. |
| `<SyncStatusChip />` | `MOB-05`, `MOB-23`, `MOB-28` | `pendingCount`, `failedCount`, `lastSyncAt` | Displays live count from `sync_operations`; tapping navigates to `MOB-28` Sync Center. |
| `<EntitlementBadge />` | `MOB-07`–`10`, `MOB-13`, `MOB-24` | `grantSource`, `status`, `expiresAt`, `isStale` | Shows `Free`, `Personal Plan`, `Purchased Bundle`, `Institution Seat`, `Expired`, or `Locked` (marks `"Last verified"` when offline). |
| `<PackageDownloadButton />` | `MOB-07`–`10`, `MOB-12`–`14` | `packageId`, `sizeBytes`, `grantState`, `dlState` | Displays exact MB size before transfer; transitions deterministically across `LOCKED`, `ELIGIBLE`, `QUEUED`, `DOWNLOADING`, `PAUSED`, `AVAILABLE_OFFLINE`, `EXPIRED`. |
| `<ResourceCard />` | `MOB-08`, `MOB-09` | `resource`, `packageState`, `entitlement` | Shows file type icon, size, version, and offline badge; never triggers a hidden background download without user tap. |
| `<CourseProgressCard />` | `MOB-05`, `MOB-21`, `MOB-22` | `serverMastery`, `pendingLocalCount`, `syncedAt` | Visually separates server-validated mastery % from unsynced local practice activity. |
| `<ProtectedContentReader />` | `MOB-11` | `packagePath`, `ephemeralKey`, `watermarkText` | Streams AES-256 decrypted pages in RAM, renders `<WatermarkOverlay />`, enforces `FLAG_SECURE`, and purges buffers on background/logout. |
| `<QuestionRenderer />` | `MOB-15`, `MOB-19` | `questionSnapshot`, `mode` (`RUN` vs `REVIEW`) | Pure component rendering Markdown + syntax-highlighted code blocks; disables text copy in `RUN` mode; shows citations/explanations in `REVIEW` mode. |
| `<AnswerControl />` | `MOB-15`, `MOB-19` | `questionType`, `options[]`, `selectedId`, `isSaving` | Emits selection change; displays `"Saved Locally ✓"` strictly *after* the SQLite transaction commits (`<16ms`). |
| `<ExamTimer />` | `MOB-15`, `MOB-16` | `durationSec`, `elapsedMonotonicSec`, `policy` | Uses monotonic elapsed clock checkpoints reconciled with server policy so changing the phone's wall clock cannot grant extra time. |
| `<QuestionPaletteSheet />` | `MOB-15`, `MOB-16`, `MOB-19` | `totalItems`, `answeredMap`, `flaggedMap`, `currentIdx` | Virtualized 5-column grid supporting 120-question exit simulations at 60fps; jumping questions never drops an in-flight save. |
| `<SubmitButton />` | `MOB-16`, `MOB-17` | `attemptStatus`, `isOnline`, `isPendingWrite` | Waits for any in-flight SQLite write, opens confirmation, and locks against duplicate taps using `operation_id`. |
| `<PurchaseCTA />` | `MOB-24`, `MOB-25`, `MOB-26` | `product`, `priceFreshness`, `orderState` | Revalidates price/availability online, creates server order, and prevents duplicate payment attempts while status is `PENDING`. |
| `<StorageMeter />` & `<InlineError />` | `MOB-12`, `MOB-27`, All forms | `usedBytes`, `lockedBytes`, `quotaBytes` / `errorCode` | Visualizes storage with locked exam-queue protection; renders non-technical, actionable error copy without stack traces or SQL leaks. |

## 8. Reconciled Data, API, Persistence & Supabase Cloud Parity Architecture

### 8.1 React Native Modular Directory Structure (`mobile/src/`)

```
mobile/
  src/
    app/                  # Root navigation (AuthStack, StudentTabs, ExamSessionStack), providers, SplashGate
    features/
      auth/               # MOB-01..04 screens, biometric unlock hook, OIDC PKCE handler
      home/               # MOB-05 HomeDashboard, continue-learning selector
      curriculum/         # MOB-06..08 ThemeCatalog, CourseList, CourseOverview
      resources/          # MOB-09..11 ResourceLibrary, ResourceDetail, ProtectedContentReader
      downloads/          # MOB-12 DownloadManager, chunk verifier, LRU cache cleaner
      exams/              # MOB-13..20 PracticeCatalog, ExamRunner, SubmitConfirmation, Result, Review
      progress/           # MOB-21..22 ProgressOverview, CourseProgress & Bloom's mastery charts
      commerce/           # MOB-24..26 PlansAndAccess, Store, Checkout & webhook status poller
      profile/            # MOB-23, MOB-27, MOB-29, MOB-30 Profile, Storage, Devices, Settings/Help
      sync/               # MOB-28 SyncCenter UI & conflict resolution actions
    shared/
      api/                # Typed HTTP client, X-Tenant-ID interceptor, idempotency header generator
      database/           # SQLCipher adapter, 13-table schema, transactional repositories, migrations
      secure-storage/     # iOS Keychain / Android Keystore wrapper for refresh tokens & AES keys
      network/            # NetInfo + API reachability observer
      components/         # 16 reusable shell & domain UI components
      theme/              # Light/Dark semantic tokens & typography scale
      localization/       # i18n string catalogs (en, om, am)
    services/
      auth-session/       # Token rotation, workspace context state, logout safety guard
      download-manager/   # Resumable byte-range fetcher, SHA-256 verifier, AES-256 envelope decryptor
      sync-engine/        # Opaque cursor pull transaction & idempotent operation push worker
      entitlement-cache/  # Signed grant verifier & offline expiry evaluator
      notification-service/
    tests/                # Unit, SQLite transaction, airplane-mode E2E, and tenant-isolation suites
```

### 8.2 Reconciled 13-Table Local SQLite / SQLCipher Schema (Mobile Client)

| Local Table | Primary Key & Core Columns | Sync & Eviction Policy |
| :--- | :--- | :--- |
| **`local_themes`** | `theme_id PK`, `title`, `description`, `total_credit_hours`, `version`, `updated_sequence` | Server-to-device delta pull; replaceable metadata. |
| **`local_courses`** | `course_id PK`, `theme_id FK`, `code`, `title`, `credit_hours`, `general_objective`, `version`, `updated_sequence` | Server-to-device delta pull; replaceable metadata. |
| **`local_outcomes`** | `outcome_id PK`, `course_id FK`, `description`, `domain`, `level`, `version` | Server-to-device delta pull; linked to courses and questions. |
| **`local_resources`** | `resource_id PK`, `course_id FK`, `tenant_id`, `type`, `title`, `size_bytes`, `package_id`, `access_state`, `version`, `content_markdown` | Server-to-device delta pull; scoped by `tenant_id` (`NULL` = global); structured study notes are cached locally with their stable note anchors. |
| **`download_packages`** | `package_id PK`, `resource_id FK`, `version`, `encrypted_path`, `sha256_checksum`, `size_bytes`, `state`, `grant_id`, `license_expiry`, `last_opened_at` | Resumable chunked download; LRU evictable **only** when expired/unpinned and not in use. |
| **`local_exam_packages`** | `exam_package_id PK`, `exam_id`, `course_id`, `blueprint_version`, `question_snapshot_json`, `duration_sec`, `grant_id`, `license_expiry`, `state` | Authorized offline exam snapshot (excludes `is_correct` answer keys unless open self-check drill). |
| **`local_exam_attempts`** | `local_attempt_id PK (UUID)`, `user_id`, `tenant_id`, `exam_package_id FK`, `status`, `started_at`, `elapsed_monotonic_sec`, `submitted_at`, `server_attempt_id` | Transactional write; **NEVER evicted** while `IN_PROGRESS` or `SUBMITTED_LOCAL_PENDING`. |
| **`local_answer_events`** | `event_id PK (UUID)`, `local_attempt_id FK`, `question_id`, `selected_option_id`, `text_or_code_answer`, `is_flagged`, `sequence_no`, `created_at` | Append-only transactional log committed before UI shows `"Saved Locally ✓"`. |
| **`sync_operations`** | `operation_id PK (UUID)`, `user_id`, `tenant_id`, `type`, `payload_json`, `state`, `retry_count`, `reason_code`, `last_error`, `created_at` | Durable outbox queue; **NEVER evicted** until `SERVER_ACCEPTED` or user-resolved. |
| **`sync_state`** | `scope_key PK` (`user_id + tenant_id`), `opaque_cursor`, `last_pull_at`, `last_push_at` | Cursor advances strictly inside the same SQLite transaction as the applied pull batch. |
| **`local_bookmarks`** | `bookmark_id PK`, `user_id`, `resource_id FK`, `page_or_position`, `updated_at`, `version` | Field-level merge on sync (`bookmark.upsert`). |
| **`local_progress_cache`** | `cache_key PK` (`user_id + tenant_id + course_id`), `mastery_json`, `last_calculated_at`, `pending_local_attempts_count` | Derived read cache; displays freshness timestamp and pending local delta badge. |
| **`device_profile`** | `device_id PK`, `user_id`, `device_name`, `os_version`, `app_version`, `biometric_enabled`, `storage_quota_mb`, `wifi_only_downloads`, `last_seen_at` | Synced via `/api/v1/devices/register`; controls local quota and security policy. |

### 8.3 Complete 27-Endpoint REST API Contract (`/api/v1/*`)

| Domain | Method & Concrete Route | Request / Header Contract | Expected Client & Server Behavior |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST /api/v1/auth/register` | `{full_name, email, password, invite_token?}` | Creates global `users` record; sends verification OTP. |
| **Auth** | `POST /api/v1/auth/login` | `{email, password, device_info}` | Returns 15m `access_token` (RAM) + rotating `refresh_token` (Keychain/Keystore). |
| **Auth** | `POST /api/v1/auth/refresh` | `{refresh_token, device_id}` | Rotates refresh token; reuse of revoked token invalidates token family. |
| **Auth** | `POST /api/v1/auth/logout` | `Authorization: Bearer <JWT>` | Revokes server session; client wipes Keychain/Keystore secrets after queue check. |
| **Workspaces** | `GET /api/v1/me/workspaces` | `Authorization: Bearer <JWT>` | Lists Personal workspace + active `tenant_memberships` (`MOB-04`). |
| **Workspaces** | `POST /api/v1/tenants` | `{organization_name, domain?}` | Requests/provisions a new institution tenant workspace (Web/Admin). |
| **Workspaces** | `POST /api/v1/tenants/{id}/invitations` | `{email, role, cohort_id?}` | Sends scoped institutional invitation (`STUDENT`, `INSTRUCTOR`, `TENANT_ADMIN`). |
| **Curriculum** | `GET /api/v1/curriculum/themes` | `X-Tenant-ID` (optional) | Returns the 5 IT themes, credit hours, and nested course summaries (`MOB-06`). |
| **Curriculum** | `GET /api/v1/courses/{id}` | `X-Tenant-ID` (optional) | Returns course details, `learning_outcomes`, and package manifest version (`MOB-08`). |
| **Resources** | `GET /api/v1/courses/{id}/resources` | `X-Tenant-ID`, `chapter_id?`, `academic_year_label?`, `semester?`, `category?` | Lists authorized course resources with chapter placement, categories, metadata, and offline eligibility (`MOB-09`). |
| **Resources** | `POST /api/v1/resources/{id}/download-grant` | `{device_id}` + `Idempotency-Key` | Evaluates entitlement; resolves `(storage_bucket, storage_object_key)` via `StorageAdapter` to return signed manifest, SHA-256 hash, resumable URL, and wrapped AES-256 key (`MOB-10`). |
| **Exams** | `GET /api/v1/exams` | `course_id?`, `type?`, `difficulty?` | Lists eligible course practice quizzes and the 100-question HU CCI Model Exit Exam (`MOB-13`). |
| **Exams** | `POST /api/v1/exams/{id}/attempts` | `{device_id, mode}` + `Idempotency-Key` | Checks exam entitlement and registered device, locks the authoritative `question_snapshots`, and returns a client-safe copy without `is_correct` or `explanation` (`MOB-14`). |
| **Exams** | `POST /api/v1/attempts/{id}/answers` | `{question_id, selected_option_id, response_time_seconds?, sequence_no}` | Upserts a sequence-numbered answer for an in-progress attempt; rejects client-supplied correctness (`MOB-15`). |
| **Exams** | `POST /api/v1/attempts/{id}/submit` | `{operation_id?, answers[]}` | Idempotently grades against the locked snapshot via `public.grade_exam_attempt()`, recomputes mastery from the ten most recent scored attempts, and reveals answer details only when the blueprint permits (`MOB-16`–`18`). |
| **Progress** | `GET /api/v1/me/progress` | `X-Tenant-ID` (optional) | Returns server-validated theme/course mastery, Bloom's breakdown, and attempt history (`MOB-21`–`22`). |
| **Commerce** | `GET /api/v1/products` | `X-Tenant-ID` (optional) | Returns server-managed plans and one-time exam/course bundles with regional pricing (`MOB-25`). |
| **Commerce** | `POST /api/v1/orders` | `{product_id, currency}` + `Idempotency-Key` | Creates `PENDING` order record on server (`MOB-26`). |
| **Commerce** | `POST /api/v1/checkout-sessions` | `{order_id, provider, return_url}` | Initializes provider adapter session (Chapa, Telebirr, Stripe, or Sandbox). |
| **Commerce** | `POST /api/v1/webhooks/{provider}` | Provider signature header | Verifies signature + amount + currency idempotently (`provider_event_id` unique); activates grant. |
| **Entitlements** | `GET /api/v1/me/entitlements` | `X-Tenant-ID`, `device_id` | Returns normalized personal + institutional `feature_entitlements` and signed offline grants (`MOB-24`). |
| **Sync** | `GET /api/v1/sync/pull` | `?cursor=<HMAC-signed opaque>&limit=100` | Returns change-sequence ordered `UPSERT` `changes[]`, `TOMBSTONE` `tombstones[]`, `has_more`, and a scope-bound `next_cursor` (`MOB-28`). |
| **Sync** | `POST /api/v1/sync/push` | `{device_id, operations[]}` | Savepoint-isolated `exam_attempt.submit`, `bookmark.upsert`, and `support_case.create`; accepted operation results are cached by UUID `operation_id` (`MOB-28`). |
| **Sync** | `GET /api/v1/sync/status` | `?operation_ids=uuid1,uuid2` | Returns each operation's `ACCEPTED`, `REJECTED`, or `NOT_FOUND` status and cached result before a client retries (`MOB-17`, `MOB-28`). |
| **Devices** | `POST /api/v1/devices/register` | `{device_id, name, os, app_version}` | Registers/updates device metadata and enforces per-license device limits (`MOB-29`). |
| **Devices** | `DELETE /api/v1/devices/{id}` | `Authorization: Bearer <JWT>` | Revokes target device session and invalidates its refresh token family (`MOB-29`). |
| **AI Tutor** | `POST /api/v1/ai/tutor/messages` | `{course_id, question_id?, prompt}` | Verifies AI quota, retrieves authorized course chunks via `pgvector`, returns grounded explanation + citations (`MOB-08`, `MOB-19`). |

### 8.4 Reconciled Production PostgreSQL DDL (With Supabase Cloud & Local Docker Shim)

Save this baseline migration as `supabase/migrations/20261114000001_init_reconciled_schema.sql`. It includes the **Supabase Auth & Extensions Compatibility Shim** at the top so the exact same SQL file runs without conflict in both lightweight local Docker (`pgvector/pgvector:pg16`) and **Supabase Cloud** (`npx supabase db push`).

```sql
-- ============================================================================
-- RECONCILED POSTGRESQL SCHEMA BASELINE (LOCAL DOCKER + SUPABASE CLOUD READY)
-- Fixes SAD §2.3 & §14.3: Global Users + Tenant Memberships, Normalized
-- Entitlements, Immutable Question Snapshots, Server-Only Scoring, Opaque Sync,
-- and Supabase Cloud Database + Supabase Storage Bucket/Key Parity (ADR-009)
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

-- 2. Global Identity & Multi-Tenant Workspaces (Fixes ADR-002)
CREATE TABLE tenants (
    tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status tenant_status NOT NULL DEFAULT 'TRIAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Note: user_id UUID matches auth.users(id) when Supabase Auth is enabled
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE user_devices (
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
CREATE TABLE curriculum_versions (
    version_id SERIAL PRIMARY KEY,
    version_code VARCHAR(64) UNIQUE NOT NULL, -- e.g., 'ETH-BSC-IT-2026-V1'
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
    outcome_code VARCHAR(64),
    description TEXT NOT NULL,
    domain domain_type NOT NULL DEFAULT 'COGNITIVE',
    level cognitive_level NOT NULL DEFAULT 'REMEMBER',
    version INT NOT NULL DEFAULT 1
);

-- Stores relative (storage_bucket, storage_object_key) for seamless Local Disk <-> Supabase Storage parity
CREATE TABLE course_resources (
    resource_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = Global Curriculum Resource
    type resource_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    storage_bucket VARCHAR(64) NOT NULL DEFAULT 'course-packages',
    storage_object_key TEXT NOT NULL, -- e.g., 'themes/theme-1/IT-CMTS-101/lecture-01.enc'
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    sha256_checksum VARCHAR(64),
    is_offline_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Versioned Question Bank, Blueprints & Immutable Exam Attempts (Fixes ADR-005 & FR-009)
CREATE TABLE questions (
    question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    outcome_id INT REFERENCES learning_outcomes(outcome_id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = Global Pool
    question_text TEXT NOT NULL,
    type question_type NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    level cognitive_level NOT NULL DEFAULT 'REMEMBER',
    difficulty difficulty_level NOT NULL DEFAULT 'MEDIUM',
    explanation TEXT,
    option_explanations JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INT NOT NULL DEFAULT 1,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE question_options (
    option_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    option_label CHAR(1) NOT NULL, -- 'A', 'B', 'C', 'D'
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE exam_blueprints (
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

CREATE TABLE exam_attempts (
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

-- 5. Provider-Abstracted Commerce & Server-Authoritative Entitlements (Fixes ADR-003 & ADR-008)
CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) UNIQUE NOT NULL, -- e.g., 'STUDENT_PREMIUM_MONTHLY', 'EXIT_EXAM_BUNDLE_2026'
    title VARCHAR(255) NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    billing_interval_days INT, -- NULL for one-time bundles
    price_amount NUMERIC(10,2) NOT NULL CHECK (price_amount >= 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'ETB',
    entitlement_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key UUID UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(8) NOT NULL,
    status order_status NOT NULL DEFAULT 'PENDING',
    payment_provider VARCHAR(64), -- 'CHAPA', 'TELEBIRR', 'STRIPE', 'SANDBOX'
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_events (
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

CREATE TABLE feature_entitlements (
    entitlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = Personal Entitlement
    source_type grant_source_type NOT NULL,
    source_reference_id UUID, -- order_id or seat_assignment_id
    scope_type VARCHAR(64) NOT NULL, -- 'ALL_COURSES', 'COURSE', 'EXAM_BUNDLE'
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
CREATE TABLE sync_changes (
    change_seq BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = Global Curriculum Change
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,       -- NULL = Shared/Broadcast Change
    entity_type VARCHAR(64) NOT NULL, -- 'theme', 'course', 'outcome', 'resource', 'exam_blueprint', 'entitlement'
    entity_id VARCHAR(128) NOT NULL,
    operation VARCHAR(16) NOT NULL CHECK (operation IN ('UPSERT', 'TOMBSTONE')),
    version INT NOT NULL DEFAULT 1,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sync_operations_log (
    operation_id UUID PRIMARY KEY, -- Client-generated UUIDv4 idempotency key
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES user_devices(device_id) ON DELETE RESTRICT,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    operation_type VARCHAR(64) NOT NULL, -- 'exam_attempt.submit', 'bookmark.upsert', 'support_case.create'
    status VARCHAR(32) NOT NULL CHECK (status IN ('ACCEPTED', 'REJECTED')),
    reason_code VARCHAR(64),
    server_entity_id UUID,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Vector Embeddings (Matched 384-d for all-MiniLM-L6-v2 per SAD §2.3)
CREATE TABLE resource_embeddings (
    embedding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES course_resources(resource_id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_content TEXT NOT NULL,
    embedding extensions.vector(384) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sync_changes_seq_scope ON sync_changes(change_seq, tenant_id, user_id);
CREATE INDEX idx_entitlements_user_active ON feature_entitlements(user_id, tenant_id, valid_until);
CREATE INDEX idx_resource_embeddings_hnsw ON resource_embeddings USING hnsw (embedding extensions.vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 8. Row-Level Security (RLS) Using Unified Dev/Supabase Helper Functions
ALTER TABLE course_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_resources_tenant_isolation ON course_resources
    FOR ALL
    USING (
        tenant_id IS NULL
        OR tenant_id = public.current_app_tenant_id()
    );

CREATE POLICY rls_attempts_owner_and_tenant ON exam_attempts
    FOR ALL
    USING (
        user_id = public.current_app_user_id()
        AND (
            tenant_id IS NULL
            OR tenant_id = public.current_app_tenant_id()
        )
    );

CREATE POLICY rls_entitlements_owner_and_tenant ON feature_entitlements
    FOR ALL
    USING (
        user_id = public.current_app_user_id()
        AND (
            tenant_id IS NULL
            OR tenant_id = public.current_app_tenant_id()
        )
    );
```

**ITec4133 question-bank import:** The requested source code `IT-SEC-401` is retained as a source/blueprint alias and maps to the canonical Theme 5 course `IT-IASC-401`, preserving the approved 15-course curriculum. Import the verified 80-question canonical JSON (`data/exam_packs/itec4133_information_assurance_parsed.json`); the current raw source file contains only Question 1. Stable outcome codes and per-option explanations are stored in `learning_outcomes.outcome_code` and `questions.option_explanations`. Mobile chapter/master notes are stored in `local_resources.content_markdown` so `NOTE-CHX-XXX` anchors remain available offline.

### 8.5 Zero-Conflict Local Dev to Supabase Cloud (Database & Storage) Architecture (`ADR-009`)

To develop efficiently on an 8GB RAM Linux machine while guaranteeing **zero schema, authentication, or file-storage conflicts** when promoting to **Supabase Cloud (PostgreSQL + Supabase Storage)**, enforce the following four rules and adapter configuration from Day 1:

#### 1. Four Golden Rules for Dev-to-Supabase Cloud Parity
* **Never use MySQL/MariaDB, SQLite, or MongoDB as the backend dev database:** Supabase Cloud runs PostgreSQL 15/16. Running a single `pgvector/pgvector:pg16` container in local dev consumes `<150 MB RAM` (compared to `~4 GB RAM` for the full 10-container Supabase CLI stack) while preserving 100% compatibility with `UUID`, `JSONB`, `TIMESTAMPTZ`, custom `ENUM`s, `pgvector(384)`, and PostgreSQL `RLS`.
* **Store relative `(storage_bucket, storage_object_key)` columns, never hardcoded localhost URLs:** In `course_resources`, store `storage_bucket = 'course-packages'` and `storage_object_key = 'themes/theme-1/IT-CMTS-101/lecture-01.enc'`. In local dev, `StorageAdapter` serves files from `./dev_storage/course-packages/...`; in production, setting `STORAGE_DRIVER=supabase` resolves the exact same database row via `supabase.storage.from_(bucket).create_signed_url(object_key, 900)`.
* **Bridge `auth.uid()` and `public.users(user_id)` from the first migration:** The compatibility shim at the top of Section 8.4 defines `public.current_app_user_id()` using `COALESCE(auth.uid(), NULLIF(current_setting('app.current_user_id', true), '')::uuid)`. This allows RLS policies to work identically whether requests come through FastAPI database sessions in local dev or Supabase JWT claims in cloud production.
* **Keep all SQL migrations in `supabase/migrations/`:** Naming every migration `supabase/migrations/YYYYMMDDHHMMSS_name.sql` allows local initialization via Docker entrypoint (`psql`) and one-command cloud deployment via `npx supabase db push`.

#### 2. Environment & Connection Mapping (Local Dev vs. Supabase Cloud)

| Environment Variable | Local Dev (`docker-compose.dev.yml`) | Production (Supabase Cloud) |
| :--- | :--- | :--- |
| **`DATABASE_URL` (App / Pooler)** | `postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres` | `postgresql+asyncpg://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres` |
| **`DIRECT_URL` (Migrations)** | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | `postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:5432/postgres` |
| **`STORAGE_DRIVER`** | `local` (reads/writes `./dev_storage/course-packages/`) | `supabase` (calls Supabase Storage Signed URL API) |
| **`STORAGE_BUCKET`** | `course-packages` (local subfolder) | `course-packages` (private Supabase Storage bucket) |

#### 3. Lightweight Local Dev Docker Compose (`docker-compose.dev.yml`)

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    container_name: edu_saas_dev_db
    restart: unless-stopped
    ports:
      - "54322:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    volumes:
      - edu_pgdata:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d:ro

volumes:
  edu_pgdata:
```

*(Note: If you ever want to test the local Supabase Storage container directly via the Supabase CLI on an 8GB RAM machine, run `npx supabase start --exclude studio,imgproxy,vector,logflare,edge-runtime` to keep memory usage under ~900 MB.)*

#### 4. FastAPI `StorageAdapter` (Local Disk ↔ Supabase Cloud Storage)

```python
import os
from pathlib import Path
from supabase import create_client, Client

class StorageAdapter:
    """
    Resolves (storage_bucket, storage_object_key) from course_resources
    to a local dev URL during offline/LAN development or a signed
    Supabase Storage URL in cloud production with zero DB changes.
    """
    def __init__(self) -> None:
        self.driver = os.getenv("STORAGE_DRIVER", "local")  # 'local' or 'supabase'
        self.local_root = Path(os.getenv("LOCAL_STORAGE_PATH", "./dev_storage"))
        if self.driver == "supabase":
            self.supabase: Client = create_client(
                os.environ["SUPABASE_URL"],
                os.environ["SUPABASE_SERVICE_ROLE_KEY"],  # Backend server only; never expose to mobile client
            )

    def create_signed_download_url(self, bucket: str, object_key: str, expires_in: int = 900) -> str:
        if self.driver == "supabase":
            res = self.supabase.storage.from_(bucket).create_signed_url(object_key, expires_in)
            return res["signedURL"]
        # Local dev fallback (10.0.2.2 for Android emulator or LAN IP over ADB/USB)
        base_url = os.getenv("API_PUBLIC_BASE_URL", "http://127.0.0.1:8000")
        return f"{base_url}/api/v1/dev-storage/{bucket}/{object_key}?ttl={expires_in}"

    def upload_encrypted_package(self, bucket: str, object_key: str, data: bytes) -> None:
        if self.driver == "supabase":
            self.supabase.storage.from_(bucket).upload(
                path=object_key,
                file=data,
                file_options={"content-type": "application/octet-stream", "upsert": "true"},
            )
            return
        target_path = self.local_root / bucket / object_key
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(data)
```

## 9. Security, Privacy & Honest Content Protection Rules

1. **Token & Secret Isolation**: Short-lived JWT access tokens (`15-minute TTL`) live exclusively in volatile memory; single-use rotating refresh tokens and AES-256 package decryption keys live strictly inside iOS Keychain / Android Keystore (`shared/secure-storage`), never in `AsyncStorage` or plaintext SQLite rows.
2. **Honest DRM & Deterrence Posture**: Downloaded binary assets are encrypted at rest with AES-256 envelope keys and rendered with a dynamic user identity `<WatermarkOverlay />` plus best-effort OS screen-capture protection (`FLAG_SECURE` on Android, screen-recording observer on iOS). The specification explicitly acknowledges that rooted devices or external cameras cannot be prevented with 100% certainty; security relies on short-lived offline grants (`7-day default`), watermark traceability, server-side scoring, and online revocation on reconnect.
3. **Jurisdiction-Appropriate Privacy Governance**: Avoid claiming US-specific FERPA compliance automatically applies in Ethiopia; enforce strict role-based (`RBAC`) and row-level (`RLS`) student record privacy, minimum cohort-size aggregation thresholds (`N >= 5`) on institutional reports, and clear user data export/deletion workflows aligned with local higher-education and privacy requirements.

## 10. QA Acceptance Criteria & Unified Delivery Roadmap

### 10.1 Mandatory Pre-Release Acceptance Matrix

* **Navigation & Multi-Workspace Isolation**: All 5 bottom tabs preserve independent navigation history; switching between Personal and Institution workspaces refreshes `X-Tenant-ID` and never leaks institution resources into personal views.
* **Airplane-Mode Reading & Exam Durability**: A downloaded course package and an eligible practice exam package open in Airplane Mode with zero blocking network calls; every selected answer is committed to `local_answer_events` before the UI shows `"Saved Locally ✓"` and survives forced app termination.
* **Idempotent Reconnection Sync**: Reconnecting after an offline exam submission uploads `exam_attempt.submit` once; repeating the push request with the same `operation_id` never creates duplicate attempts; crashes mid-pull never advance `sync_state.cursor`.
* **Zero Silent Data Loss**: LRU storage eviction (`MOB-27`), expired offline grants, and sign-out warnings never delete `IN_PROGRESS` attempts or `QUEUED`/`REJECTED` sync operations.
* **Payment & Entitlement Integrity**: Paid packages never unlock from client redirects alone; only a signature-verified webhook event (`payment_events`) activates `feature_entitlements`.

### 10.2 Unified Vertical-Slice Implementation Roadmap (`Mobile M0–M8` ↔ `System M1–M12`)

| Unified Slice | Backend & DB Focus (`SAD M1–M12`) | Mobile UI/UX Focus (`MOB-01` – `MOB-30`) | Exit Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Slice 1 (`M0/M1` ↔ `M1/M2`)** | FastAPI modular monolith setup, reconciled PostgreSQL DDL migration (`supabase/migrations/`), JWT + OIDC PKCE auth, `tenant_memberships`, RLS tests. | Design tokens, App Shell, 5-tab navigator, `MOB-01` Welcome, `MOB-02` Sign In, `MOB-03` Register, `MOB-04` Workspace Selection. | Cross-tenant isolation tests pass; mobile app authenticates and switches workspaces. |
| **Slice 2 (`M2` ↔ `M4`)** | Seed 5 Themes / 15 B.Sc. IT Courses / 45 Credit Hours and `learning_outcomes`; implement `/curriculum/themes` and `/courses/{id}`. | SQLCipher 13-table initialization, `MOB-05` Home Dashboard, `MOB-06` Theme Catalog, `MOB-07` Course List, `MOB-08` Course Overview. | Student browses all 15 IT courses online and from cached SQLite in Airplane Mode. |
| **Slice 3 (`M3` ↔ `M5`)** | Resource upload/versioning, `StorageAdapter` (Local Disk ↔ Supabase Storage signed download grants `/resources/{id}/download-grant`), SHA-256 manifest signing. | `MOB-09` Resource Library, `MOB-10` Resource Detail, `MOB-11` Protected Content Reader (with watermark & `FLAG_SECURE`), `MOB-12` Download Manager. | Resumable download, checksum verification, and encrypted offline PDF/note reading pass. |
| **Slice 4 (`M4` ↔ `M6`)** | Question bank, `exam_blueprints`, immutable `question_snapshots`, server-side grading procedure (`/attempts/{id}/submit`). | `MOB-13` Practice Catalog, `MOB-14` Instructions, `MOB-15` Locked Exam Runner, `MOB-16` Submit Confirmation, `MOB-18`–`20` Results, Review & History. | Transactional `<16ms` local answer saves survive force-close; server scores attempt accurately. |
| **Slice 5 (`M5` ↔ `M11`)** | `sync_changes` monotonic sequence ledger, `tombstones`, `/sync/pull`, `/sync/push`, and `/sync/status` idempotency. | `MOB-17` Submission Status stepper, `MOB-28` Sync Center (Pending, Rejected, History tabs), background/foreground sync triggers. | Airplane-mode exam completion queues as Provisional and reconciles idempotently on reconnect. |
| **Slice 6 (`M6` ↔ `M7/M8`)** | `outcome_mastery` aggregation queries, Bloom's taxonomy analytics (`/me/progress`), `pgvector(384)` RAG AI Tutor (`/ai/tutor/messages`). | `MOB-21` Progress Overview, `MOB-22` Course Progress & Outcome Mastery, contextual AI Tutor sheet in `MOB-08` and `MOB-19`. | Mastery charts reflect server-validated evidence with freshness timestamps; AI Tutor cites course chunks. |
| **Slice 7 (`M7` ↔ `M3/M9`)** | `products`, `orders`, provider-abstracted `/checkout-sessions` & `/webhooks/{provider}`, `/me/entitlements` resolver. | `MOB-24` Plans & Access, `MOB-25` Store & Product Details, `MOB-26` Checkout & Purchase Status polling view. | Webhook-verified test payment activates entitlement once; personal & institutional grants coexist. |
| **Slice 8 (`M8` ↔ `M12`)** | Device registry (`/devices/*`), audit logs, rate limiting, Supabase Cloud `db push` & backup verification, pilot telemetry dashboards. | `MOB-23` Profile Home, `MOB-27` Storage Settings (LRU guard), `MOB-29` Devices & Security, `MOB-30` Notifications, Language & Offline Help. | Low-end Android (`4GB/8GB RAM`) profiling, storage-full recovery, and logout safety checks pass. |
