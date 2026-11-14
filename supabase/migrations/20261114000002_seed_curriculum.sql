-- ============================================================================
-- CANONICAL 5-THEME / 15-COURSE CURRICULUM SEED DATA
-- Ethiopian National Exit Exam Blueprint for B.Sc. in Information Technology
-- 5 Themes, 15 Courses, 45 Credit Hours + Initial Learning Outcomes
-- Migration: 20261114000002_seed_curriculum.sql
-- ============================================================================

-- 1. Curriculum Version
INSERT INTO curriculum_versions (version_id, version_code, title, is_active)
VALUES (1, 'ETH-BSC-IT-2026-V1', 'B.Sc. in Information Technology National Curriculum & Exit Exam Blueprint', TRUE)
ON CONFLICT (version_code) DO UPDATE
SET title = EXCLUDED.title,
    is_active = EXCLUDED.is_active;

-- 2. Themes (45 Total Credit Hours)
INSERT INTO themes (theme_id, curriculum_version_id, theme_number, title, description, total_credit_hours) VALUES
  (1, 1, 1, 'Computer System', 'Hardware diagnostics, computer maintenance, technical support, and component-level repair protocols.', 4),
  (2, 1, 2, 'System/Software Development', 'Object-oriented programming, data structures, event-driven GUI apps, UML system design, and IT project management.', 15),
  (3, 1, 3, 'Database System and Information Management', 'Relational modeling, normalization, SQL, query optimization, ACID transactions, and distributed databases.', 6),
  (4, 1, 4, 'Mobile Application and Web Development', 'Client/server web engineering, HTTP security, and offline-capable mobile application development.', 9),
  (5, 1, 5, 'Networking and Information Security', 'OSI/TCP-IP networking, system administration, router/switch CLI configuration, and cybersecurity.', 11)
ON CONFLICT (curriculum_version_id, theme_number) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    total_credit_hours = EXCLUDED.total_credit_hours;

-- 3. Courses (15 Canonical Courses)
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
  (15, 5, 'IT-IASC-401', 'Information Assurance and Security', 2, 'Assess cyber threats, apply symmetric/asymmetric cryptography, and enforce defense-in-depth security policies.')
ON CONFLICT (code) DO UPDATE
SET theme_id = EXCLUDED.theme_id,
    title = EXCLUDED.title,
    credit_hours = EXCLUDED.credit_hours,
    general_objective = EXCLUDED.general_objective;

-- 4. Initial Learning Outcomes mapped to Bloom's Taxonomy
INSERT INTO learning_outcomes (outcome_id, course_id, description, domain, level) VALUES
  -- Theme 1: IT-CMTS-101
  (1,  1, 'Diagnose hardware POST beep codes and motherboard power delivery faults using digital multimeters and diagnostic cards.', 'COGNITIVE', 'APPLY'),
  (2,  1, 'Execute preventive maintenance schedules and ESD-safe component replacement procedures for client desktops and workstations.', 'PSYCHOMOTOR', 'APPLY'),
  -- Theme 2: Software Development
  (3,  2, 'Implement object-oriented systems enforcing encapsulation, polymorphic dispatch, and custom interface hierarchies.', 'COGNITIVE', 'APPLY'),
  (4,  3, 'Design thread-safe concurrent tasks utilizing ExecutorService, thread pools, synchronized blocks, and atomic primitives.', 'COGNITIVE', 'CREATE'),
  (5,  4, 'Construct responsive graphical interfaces with non-blocking event-dispatch thread execution and background worker models.', 'COGNITIVE', 'CREATE'),
  (6,  5, 'Produce comprehensive UML 2.5 use-case specifications, sequence diagrams, and domain class models from business requirements.', 'COGNITIVE', 'ANALYSE'),
  (7,  6, 'Calculate project Critical Path, float schedules, and Earned Value Management metrics (CPI, SPI) for software deliverables.', 'COGNITIVE', 'EVALUATE'),
  -- Theme 3: Database Systems
  (8,  7, 'Transform conceptual ER diagrams into third normal form (3NF) and Boyce-Codd normal form (BCNF) relational schemas.', 'COGNITIVE', 'ANALYSE'),
  (9,  8, 'Formulate cost-optimized SQL execution plans using B+ Tree composite indexes and transaction isolation levels.', 'COGNITIVE', 'EVALUATE'),
  -- Theme 4: Web and Mobile
  (10, 9, 'Construct responsive and accessible multi-page UI layouts complying with W3C semantic HTML5 and CSS Grid standards.', 'COGNITIVE', 'APPLY'),
  (11, 10, 'Implement secure server-side REST APIs enforcing JWT authentication, parameter binding, and CSRF mitigation.', 'COGNITIVE', 'CREATE'),
  (12, 11, 'Develop offline-first mobile workflows using encrypted local SQLite storage and background synchronization hooks.', 'COGNITIVE', 'CREATE'),
  -- Theme 5: Networking and Security
  (13, 12, 'Compute variable-length subnet masks (VLSM) and design hierarchical IPv4/IPv6 address allocations across enterprise subnets.', 'COGNITIVE', 'APPLY'),
  (14, 13, 'Automate multi-user Linux authentication, systemd service management, LVM volume expansion, and automated rsync backups.', 'COGNITIVE', 'APPLY'),
  (15, 14, 'Configure Cisco IOS enterprise switches and routers with 802.1Q trunking, rapid spanning tree protocol, and OSPF area 0 routing.', 'COGNITIVE', 'APPLY'),
  (16, 15, 'Evaluate cryptographic defense architectures against MITM, replay, and side-channel threats across the CIA security triad.', 'COGNITIVE', 'EVALUATE')
ON CONFLICT (outcome_id) DO UPDATE
SET course_id = EXCLUDED.course_id,
    description = EXCLUDED.description,
    domain = EXCLUDED.domain,
    level = EXCLUDED.level;

-- Reset sequence counters to prevent key collisions on future insertions
SELECT setval('curriculum_versions_version_id_seq', (SELECT MAX(version_id) FROM curriculum_versions));
SELECT setval('themes_theme_id_seq', (SELECT MAX(theme_id) FROM themes));
SELECT setval('courses_course_id_seq', (SELECT MAX(course_id) FROM courses));
SELECT setval('learning_outcomes_outcome_id_seq', (SELECT MAX(outcome_id) FROM learning_outcomes));
