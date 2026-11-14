# SaaS Learning & Exam Platform — Implementation & Architecture Guide (Reconciled v2.1)

| Document Attribute | Approved Baseline Value |
| :--- | :--- |
| **Document Title** | SaaS Learning & Exam Platform — Implementation & Architecture Guide |
| **Companion Suite (4-File Baseline)** | **File 4 of 4** — Reconciled with:<br>1. `Education_SaaS_Platform_System_Analysis_and_Design.docx` (v2.1)<br>2. `SaaS_Database_Architecture_and_System_Specification.md` (v2.1, Phases 1–22)<br>3. `unified_education_saas_mobile_and_system_specification.md` (v2.1)<br>4. `SaaS_Learning_and_Exam_Platform_Implementation_and_Architecture_Guide.md` (v2.1) |
| **Version & Date** | Version 2.1 — 14 November 2026 |
| **Confirmed Implementation Stack** | Python 3.12 / FastAPI Modular Monolith, PostgreSQL 16 (`pgvector`), Next.js Web, React Native + TypeScript Mobile, Supabase Cloud + Local Docker Parity |

## 1. Executive Summary & Complete 5-Theme Curriculum Specification

This guide defines the end-to-end engineering strategy, reconciled technology stack, vertical-slice implementation sequence, and complete academic domain specification for the multi-tenant Education SaaS learning and national exit examination preparation platform.

Designed around the **Bachelor of Science Degree in Information Technology** national curriculum and test blueprint, the platform models **5 core themes, 15 required courses, and 45 credit hours**. All course codes and competency specifications below are synchronized across all four baseline specification documents.

### 1.1 Theme 1: Computer System (4 Credit Hours — 1 Course)

#### Course 1: Computer Maintenance and Technical Support (`IT-CMTS-101` — 4 Credits)
1. **General Concepts of PC Architecture & Technical Support**: Functional interplay between physical hardware (CPU, memory, storage chassis, power units), system operating systems (Linux, Windows, macOS), application software, device drivers, and embedded system firmware (BIOS/UEFI and POST startup diagnostics). Technical support workflows apply structured fault isolation, deductive troubleshooting, ticket logging, and clear user communication.
2. **Hardware Components, Form Factors & Internal Peripherals**: Desktop and tower enclosures aligned with ATX, Micro-ATX, and Mini-ITX motherboard form factors; Power Supply Units (PSU stepping AC wall power down to regulated `+3.3V`, `+5V`, and `+12V` DC rails); magnetic HDD and NVMe/SATA SSD storage; CPU thermal assemblies; DIMM memory channels; and PCIe expansion buses.
3. **Lab Procedures, Maintenance & Diagnostic Toolkits**: Categorized use of **ESD Tools** (antistatic wrist straps, grounding mats, shielding bags), **Hand Tools** (non-magnetic drivers, IC extractors, crimpers, punch-down tools), **Cleaning Tools** (compressed air, lint-free swabs, isopropyl alcohol), **Diagnostic Tools** (digital multimeters, loopback plugs, cable toner probes), and **Software Utilities** (`FDISK`/partitioning, `CHKDSK`/`fsck`, `SFC /scannow`, SMART monitoring, and host security tools).
4. **Electrostatic Discharge (ESD) Dynamics & Mitigation**: While human perception of static discharge begins near `3,000 V`, CMOS/DRAM components suffer latent or catastrophic gate-oxide breakdown at `30 V`. Mitigation requires relative humidity above 50%, grounded wrist straps clipped to unpainted chassis metal (never worn when servicing high-voltage CRT assemblies), and disconnecting AC standby power prior to board manipulation.
5. **Laboratory Safety & Preventive Maintenance Schedules**: Disconnecting AC power before chassis entry, never opening sealed high-capacitance PSU or CRT units without specialized high-voltage training, following MSDS chemical guidelines, and executing systematic OODA-loop troubleshooting (symptom gathering $\rightarrow$ POST/visual inspection $\rightarrow$ hypothesis isolation $\rightarrow$ verification and repair journal documentation).

### 1.2 Theme 2: System/Software Development (15 Credit Hours — 5 Courses)

#### Course 1: Object-Oriented Programming in Java (`IT-OOPJ-201` — 3 Credits)
1. **Core OOP Pillars & JVM Memory Model**: Contrast between procedural programming and modular object-oriented design across **Encapsulation** (`private`/`protected` access control), **Abstraction** (`abstract` classes and interfaces), **Inheritance** (`extends` / `implements`), and **Polymorphism** (compile-time method overloading and runtime dynamic dispatch via method overriding). Partitioning of JVM runtime memory into **Stack Memory** (thread frames, primitives, object references) and **Heap Memory** (object instances managed by G1/ZGC garbage collection).

#### Course 2: Advanced Programming (`IT-ADVP-202` — 3 Credits)
1. **Collections Framework, Multithreading & Exception Hierarchies**: Algorithmic complexity and usage of generic collections (`ArrayList` $O(1)$ random access vs. `LinkedList`, `HashSet` vs. Red-Black tree `TreeSet`, `HashMap` vs. thread-safe `ConcurrentHashMap`). Concurrent execution via `ExecutorService` thread pools, `synchronized` monitors, `ReentrantLock`, atomic variables, and deadlock prevention. Structured exception handling distinguishing checked (`Exception`) and unchecked (`RuntimeException`) exceptions with `try-with-resources`.

#### Course 3: Event-Driven Programming (`IT-EDPR-203` — 3 Credits)
1. **GUI Architectures, Event Dispatch Threads & Observer Pattern**: Interactive desktop and component event loops where CPU/IO-intensive operations are offloaded from the **Event Dispatch Thread (EDT)** to background workers to prevent UI freezes. Implementation of the **Observer Pattern** via event listeners (`ActionListener`, `MouseListener`, `KeyListener`), layout managers, and reactive property bindings.

#### Course 4: System Analysis and Design (`IT-SYAD-204` — 3 Credits)
1. **SDLC Methodologies & UML 2.5 Modeling**: Comparative selection of Waterfall, Spiral, V-Model, Scrum, and Kanban lifecycles. Object-Oriented System Analysis and Design (OOSAD) using **Structural UML Diagrams** (Class, Package, Component — modeling association, aggregation, composition, generalization) and **Behavioral UML Diagrams** (Use Case with `<<include>>`/`<<extend>>`, Sequence lifelines, Activity swimlanes, and State Machine guard transitions).

#### Course 5: IT Project Management (`IT-ITPM-301` — 3 Credits)
1. **Project Estimation, Risk Management & Software Quality Assurance**: Work Breakdown Structure (WBS) decomposition, three-point PERT estimation ($E = \frac{O + 4M + P}{6}$), Critical Path Method (CPM) slack analysis, and Earned Value Management (CPI/SPI). Quantitative/qualitative risk matrices and Software Quality Assurance (SQA) aligned with ISO 9000, CMMI, and automated CI/CD quality gates.

### 1.3 Theme 3: Database System and Information Management (6 Credit Hours — 2 Courses)

#### Course 1: Fundamentals of Database System (`IT-FDBS-201` — 3 Credits)
1. **ANSI-SPARC Architecture & ER/EER Modeling**: Transition from flat-file redundancy to the Three-Schema Architecture (External, Conceptual, Internal). Entity-Relationship and Enhanced ER modeling covering strong/weak entities, composite/multi-valued/derived attributes, cardinality (`1:1`, `1:N`, `N:M`), participation constraints, and specialization/generalization lattices.
2. **Relational Algebra, Normalization & SQL**: Unary and binary relational algebra operators ($\sigma, \pi, \rho, \cup, \cap, -, \times, \bowtie$). Functional dependency closures ($F^+$), lossless-join decomposition, and normal forms (`1NF`, `2NF`, `3NF`, `BCNF`). Full SQL mastery across `DDL`, `DML` (joins, correlated subqueries, window functions, aggregations), and `DCL`.

#### Course 2: Advanced Database System (`IT-ADBS-301` — 3 Credits)
1. **Query Optimization & Indexing Structures**: Parsing SQL into relational algebra trees, heuristic optimization (selection/projection pushdown), and cost-based optimization using catalog histograms and B+ Tree / hash index selectivity.
2. **ACID Transactions, Concurrency Control & Recovery**: Preventing dirty reads, non-repeatable reads, phantom reads, and lost updates via Strict Two-Phase Locking (`2PL`), timestamp ordering, and Multi-Version Concurrency Control (`MVCC`). Crash recovery via Write-Ahead Logging (`WAL`), fuzzy checkpoints, and the 3-phase `ARIES` algorithm (`Analysis`, `Redo`, `Undo`).
3. **Distributed Databases & Security**: Horizontal/vertical fragmentation, replication, distributed query semi-joins, Two-Phase Commit (`2PC`), CAP trade-offs, and defense-in-depth RBAC/RLS security.

### 1.4 Theme 4: Mobile Application and Web Development (9 Credit Hours — 3 Courses)

#### Course 1: Internet Programming-I (`IT-IPRG-301` — 3 Credits)
1. **Web Protocols, Semantic HTML5, CSS3 & Client-Side JavaScript**: HTTP/HTTPS request/response lifecycle, status codes, headers, and REST semantics; accessible HTML5 DOM structure; responsive CSS3 Flexbox and Grid layouts; and ES6+ asynchronous JavaScript (`Promises`, `async/await`, `Fetch API`, event delegation, and client validation).

#### Course 2: Internet Programming-II (`IT-IPRG-302` — 3 Credits)
1. **Server-Side Engineering, Database Pooling & Web Security**: Server request lifecycles, stateful/stateless session management (cookies, JWTs), relational connection pooling, transactional e-commerce workflows, and mitigation of OWASP Top 10 vulnerabilities (`SQLi` prepared statements, `XSS` output encoding/CSP, `CSRF` tokens, and strict CORS).

#### Course 3: Mobile Application Development (`IT-MABD-401` — 3 Credits)
1. **Mobile Lifecycle, Offline Persistence & Background Execution**: Component lifecycles (`Activity`/`Fragment` and React Native bridge/JSI lifecycles), responsive mobile viewports, hardware sensor/biometric integration, encrypted on-device relational storage (`SQLite`/`SQLCipher`), and battery-aware background synchronization workers.

### 1.5 Theme 5: Networking and Information Security (11 Credit Hours — 4 Courses)

*(Reconciled: Adds the complete 4-course specification for Theme 5 omitted in earlier guide drafts.)*

#### Course 1: Data Communications and Computer Networks (`IT-DCCN-201` — 3 Credits)
1. **OSI & TCP/IP Layered Architecture, Framing & IP Subnetting**: Encapsulation and decapsulation across the 7-layer OSI model and 4-layer TCP/IP suite. Physical layer transmission media (UTP Cat6, fiber optics, wireless RF), Data Link framing, error detection (`CRC`), Ethernet MAC switching, ARP, IPv4/IPv6 addressing, Variable Length Subnet Masking (`VLSM`), CIDR route summarization, and Transport layer flow/congestion control (`TCP` 3-way handshake, sliding window vs. `UDP`).

#### Course 2: System & Network Administration (`IT-SNAD-301` — 3 Credits)
1. **Server OS Provisioning, Directory Services, Storage & Automation**: Enterprise Linux and Windows Server installation, user/group privilege management (`sudo`, POSIX ACLs, Active Directory/LDAP), disk partitioning (`LVM`, `RAID 0/1/5/10`), core network daemons (`DNS` BIND, `DHCP`, `SSH`, `NTP`, `Nginx`/`Apache`), automated backup rotation (`rsync`, snapshots), system log auditing (`journald`/`syslog`), and Bash/Python administrative automation.

#### Course 3: Network Device & Configuration (`IT-NDVC-302` — 3 Credits)
1. **Enterprise Router & Switch CLI Configuration, VLANs & Routing Protocols**: Initial hardening of managed switches and routers via CLI; Virtual LAN (`VLAN`) segmentation, IEEE `802.1Q` inter-switch trunking, Router-on-a-Stick / Layer-3 SVI inter-VLAN routing, Spanning Tree Protocol (`STP`/`RSTP`) loop prevention, static/default routing, dynamic link-state routing (`OSPF`), Standard/Extended Access Control Lists (`ACLs`), and Network Address Translation (`Static NAT`, `Dynamic NAT`, `PAT`/overload).

#### Course 4: Information Assurance and Security (`IT-IASC-401` — 2 Credits)
1. **Cybersecurity Principles, Cryptography & Defense-in-Depth**: Confidentiality, Integrity, and Availability (`CIA Triad`), quantitative/qualitative threat and vulnerability risk assessment, symmetric encryption (`AES-256`), asymmetric public-key cryptography (`RSA`, `ECC`, Diffie-Hellman), cryptographic hashing (`SHA-256`, `Argon2id`), Digital Signatures and `PKI` X.509 certificates, perimeter and host defense (`Firewalls`, `IDS/IPS`, `VPN/IPsec`, `TLS 1.3`), security governance policies, and incident response playbooks.

## 2. Reconciled Technology Stack (`ADR-001` – `ADR-009`)

* **Backend API Framework (`ADR-001`)**: **Python 3.12 with FastAPI** structured as a modular monolith (`backend/app/`). Uses asynchronous SQLAlchemy 2.0 (`asyncpg`), Pydantic v2 strict validation, auto-generated OpenAPI 3.1 contracts, and native Python workers for PDF extraction and `pgvector` embeddings.
* **Database & Cloud Parity (`ADR-002`, `ADR-009`)**: **PostgreSQL 16 + `pgvector(384)`** with Row-Level Security (`RLS`) bound to `public.current_app_user_id()` and `public.current_app_tenant_id()`. Uses `supabase/migrations/` and `StorageAdapter` (`storage_bucket` + `storage_object_key`) so lightweight local Docker (`pgvector/pgvector:pg16`, `<150 MB RAM`) promotes to **Supabase Cloud Database and Supabase Storage** without code or schema changes.
* **Web Client (`Next.js + TypeScript`)**: Public catalog, student web workspace, instructor content/question authoring portal, institution administration dashboard, and platform operator console.
* **Mobile Client (`ADR-004`, `ADR-005`, `ADR-006`)**: **React Native + TypeScript** student application covering the 30-screen navigation map (`MOB-01`–`MOB-30`), backed by a **13-table AES-256 SQLCipher local database**, OS Keychain/Keystore secret storage, transactional `<16ms` local answer saves, and opaque server-cursor delta sync (`/api/v1/sync/pull` and `/api/v1/sync/push`).
* **Commerce & Entitlements (`ADR-003`, `ADR-008`)**: Provider-abstracted checkout and webhook verification adapter supporting **Chapa, Telebirr, Stripe, and Sandbox** modes, resolving into server-authoritative `feature_entitlements`.

## 3. Step-by-Step Implementation Sequence (Ordered Vertical Slices)

*(Reconciled: Fixes the earlier Step 2 / Step 3 ordering duplication and aligns with the Database → Backend → Frontend vertical-slice methodology.)*

### Step 1: Database Foundation, Identity & Multi-Tenant RLS (Slice 1)
1. Provision lightweight local PostgreSQL 16 (`pgvector/pgvector:pg16`) using `docker-compose.dev.yml` and apply `supabase/migrations/20261114000001_init_reconciled_schema.sql`.
2. Implement global `users`, `tenant_memberships`, `user_devices`, and unified RLS helper functions (`public.current_app_user_id()`, `public.current_app_tenant_id()`).
3. Stand up FastAPI authentication (`POST /api/v1/auth/register`, `/login`, `/refresh`, `/logout` with `Argon2id` password hashing and OIDC PKCE) and workspace discovery (`GET /api/v1/me/workspaces`).
4. Build React Native `MOB-01` (Welcome), `MOB-02` (Sign In & Biometric Unlock), `MOB-03` (Register), and `MOB-04` (Workspace Selection).

### Step 2: Curriculum Catalog, Resource Packages & Protected Reader (Slices 2 & 3)
1. Seed the 5 Themes, 15 B.Sc. IT Courses (`IT-CMTS-101` to `IT-IASC-401`), and `learning_outcomes`.
2. Implement `StorageAdapter` (Local Disk ↔ Supabase Storage) and signed package download grants (`POST /api/v1/resources/{id}/download-grant`) with SHA-256 checksum manifests and AES-256 envelope keys.
3. Build React Native SQLCipher 13-table persistence and screens `MOB-05` (Home), `MOB-06` (Themes), `MOB-07` (Courses), `MOB-08` (Course Overview), `MOB-09`–`10` (Resource Library & Detail), `MOB-11` (Protected Content Reader with dynamic watermark & `FLAG_SECURE`), and `MOB-12` (Download Manager).

### Step 3: Assessment Engine, Immutable Snapshots & Server-Side Grading (Slice 4)
1. Implement `questions`, `question_options`, `exam_blueprints`, and `exam_attempts` with immutable `question_snapshots` JSONB locked at attempt creation.
2. Deploy `public.grade_exam_attempt()` and `POST /api/v1/attempts/{id}/submit` so scoring is computed strictly on the server (`FR-009`).
3. Build React Native `MOB-13` (Practice Catalog), `MOB-14` (Instructions), `MOB-15` (Locked Exam Runner with transactional SQLite answer persistence), `MOB-16` (Submit Confirmation), and `MOB-18`–`20` (Result, Review, and Attempt History).

### Step 4: Opaque-Cursor Offline Sync Engine & Conflict Recovery (Slice 5)
1. Implement `sync_changes` (`BIGSERIAL change_seq` with `UPSERT` and `TOMBSTONE` operations) and `sync_operations_log` (`operation_id` UUID idempotency).
2. Expose `GET /api/v1/sync/pull`, `POST /api/v1/sync/push`, and `GET /api/v1/sync/status`.
3. Build React Native `MOB-17` (Submission Status stepper) and `MOB-28` (Sync Center with Pending, Needs Attention/Rejected, and Synced History tabs).

### Step 5: Outcome Mastery Analytics, Controlled Data Lake Mirror & RAG AI Tutor (Slice 6)
1. Build the Python PDF ingestion worker (`PyPDF2` + `pdfplumber` + `all-MiniLM-L6-v2` 384-d embeddings) populating `resource_embeddings` with HNSW cosine indexes.
2. Implement `GET /api/v1/me/progress` (theme mastery and Bloom's cognitive breakdown), `POST /api/v1/ai/tutor/messages` (grounded RAG tutor with source citations and quota metering), and the S3/Parquet + DuckDB analytical mirror for institutional reporting.
3. Build React Native `MOB-21` (Progress Overview) and `MOB-22` (Course Progress & Outcome Mastery).

### Step 6: Provider-Abstracted Commerce, Institutional Licensing & Hardening (Slices 7 & 8)
1. Implement `products`, `orders`, `payment_events`, `institution_licenses`, `seat_assignments`, and `/api/v1/me/entitlements` with webhook adapters for Chapa, Telebirr, Stripe, and Sandbox.
2. Build React Native `MOB-23` (Profile), `MOB-24` (Plans & Access), `MOB-25` (Store), `MOB-26` (Checkout Status), `MOB-27` (Storage Settings with locked exam-queue protection), `MOB-29` (Devices & Security), and `MOB-30` (Notifications, Language & Offline Help).
3. Execute automated cross-tenant RLS tests, airplane-mode recovery tests, and `npx supabase db push` production deployment verification.
