-- ============================================================================
-- Day 2 Curriculum Completion + RLS Enforcement Fix
-- Ensures 45+ learning outcomes and RLS on tenant_memberships
-- ============================================================================

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS rls_memberships_user_scope ON tenant_memberships;
    CREATE POLICY rls_memberships_user_scope ON tenant_memberships
        FOR ALL
        USING (user_id = public.current_app_user_id());
END $$;

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Diagnose hardware faults and apply ESD-safe troubleshooting and repair procedures.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-CMTS-101'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Diagnose hardware faults and apply ESD-safe troubleshooting and repair procedures.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Perform preventive maintenance, component replacement, and service documentation for client workstations.', 'PSYCHOMOTOR', 'APPLY'
FROM courses c
WHERE c.code = 'IT-CMTS-101'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Perform preventive maintenance, component replacement, and service documentation for client workstations.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Recommend upgrades and repair actions based on diagnostics, risk, and maintenance history.', 'COGNITIVE', 'EVALUATE'
FROM courses c
WHERE c.code = 'IT-CMTS-101'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Recommend upgrades and repair actions based on diagnostics, risk, and maintenance history.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Design classes that enforce encapsulation, inheritance, and polymorphic behavior in object-oriented programs.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-OOPJ-201'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Design classes that enforce encapsulation, inheritance, and polymorphic behavior in object-oriented programs.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Implement reusable methods and exception handling strategies for robust Java application logic.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-OOPJ-201'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Implement reusable methods and exception handling strategies for robust Java application logic.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Test and debug object-oriented designs to validate behavior, reliability, and maintainability.', 'COGNITIVE', 'EVALUATE'
FROM courses c
WHERE c.code = 'IT-OOPJ-201'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Test and debug object-oriented designs to validate behavior, reliability, and maintainability.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Use the Java Collections Framework to model and manipulate complex data structures efficiently.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-ADVP-202'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Use the Java Collections Framework to model and manipulate complex data structures efficiently.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Develop thread-safe concurrent programs using synchronization, executors, and coordination primitives.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-ADVP-202'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Develop thread-safe concurrent programs using synchronization, executors, and coordination primitives.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Apply exception-handling and resilience patterns to recover from runtime and I/O failures.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-ADVP-202'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Apply exception-handling and resilience patterns to recover from runtime and I/O failures.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Design event-driven GUI components using layouts, listeners, and state transitions.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-EDPR-203'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Design event-driven GUI components using layouts, listeners, and state transitions.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Manage asynchronous tasks and background workers without blocking the user interface.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-EDPR-203'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Manage asynchronous tasks and background workers without blocking the user interface.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Validate event flows and user interactions to ensure responsive and reliable application behavior.', 'COGNITIVE', 'EVALUATE'
FROM courses c
WHERE c.code = 'IT-EDPR-203'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Validate event flows and user interactions to ensure responsive and reliable application behavior.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Elicit stakeholder requirements and model business processes as domain entities and constraints.', 'COGNITIVE', 'ANALYSE'
FROM courses c
WHERE c.code = 'IT-SYAD-204'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Elicit stakeholder requirements and model business processes as domain entities and constraints.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Produce UML use-case, sequence, and class diagrams to document system architecture.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-SYAD-204'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Produce UML use-case, sequence, and class diagrams to document system architecture.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Evaluate design choices against feasibility, constraints, and software quality objectives.', 'COGNITIVE', 'EVALUATE'
FROM courses c
WHERE c.code = 'IT-SYAD-204'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Evaluate design choices against feasibility, constraints, and software quality objectives.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Estimate project scope, schedule, effort, and resource requirements for software delivery.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-ITPM-301'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Estimate project scope, schedule, effort, and resource requirements for software delivery.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Plan risk mitigation, quality assurance, and stakeholder communication for project execution.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-ITPM-301'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Plan risk mitigation, quality assurance, and stakeholder communication for project execution.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Track schedule and budget performance using CPM, PERT, and earned value measures.', 'COGNITIVE', 'EVALUATE'
FROM courses c
WHERE c.code = 'IT-ITPM-301'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Track schedule and budget performance using CPM, PERT, and earned value measures.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Model entities and relationships into normalized relational schemas with integrity constraints.', 'COGNITIVE', 'ANALYSE'
FROM courses c
WHERE c.code = 'IT-FDBS-201'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Model entities and relationships into normalized relational schemas with integrity constraints.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Apply normal forms to remove redundancy and preserve data consistency in database design.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-FDBS-201'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Apply normal forms to remove redundancy and preserve data consistency in database design.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Write DDL, DML, and advanced SQL queries to manage and retrieve relational data.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-FDBS-201'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Write DDL, DML, and advanced SQL queries to manage and retrieve relational data.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Create execution plans and indexing strategies to optimize relational query performance.', 'COGNITIVE', 'EVALUATE'
FROM courses c
WHERE c.code = 'IT-ADBS-301'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Create execution plans and indexing strategies to optimize relational query performance.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Enforce transaction isolation and concurrency control to maintain consistency under load.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-ADBS-301'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Enforce transaction isolation and concurrency control to maintain consistency under load.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Design database recovery and distributed data strategies for high-availability systems.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-ADBS-301'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Design database recovery and distributed data strategies for high-availability systems.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Build semantic, accessible HTML and CSS layouts that respond across device sizes.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-IPRG-301'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Build semantic, accessible HTML and CSS layouts that respond across device sizes.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Use JavaScript and DOM APIs to manage event-driven client-side behavior securely.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-IPRG-301'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Use JavaScript and DOM APIs to manage event-driven client-side behavior securely.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Evaluate responsive web design patterns against usability, accessibility, and performance goals.', 'COGNITIVE', 'EVALUATE'
FROM courses c
WHERE c.code = 'IT-IPRG-301'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Evaluate responsive web design patterns against usability, accessibility, and performance goals.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Implement secure REST APIs with validation, authentication, and session handling.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-IPRG-302'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Implement secure REST APIs with validation, authentication, and session handling.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Enforce authorization and input-sanitization controls for safe server-side interactions.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-IPRG-302'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Enforce authorization and input-sanitization controls for safe server-side interactions.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Integrate database-backed web applications with secure, maintainable service layers.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-IPRG-302'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Integrate database-backed web applications with secure, maintainable service layers.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Design mobile application state flows and lifecycle-aware user interfaces for real devices.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-MABD-401'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Design mobile application state flows and lifecycle-aware user interfaces for real devices.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Persist user data locally with secure storage and synchronization strategies for offline use.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-MABD-401'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Persist user data locally with secure storage and synchronization strategies for offline use.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Evaluate mobile app reliability, offline sync, and device constraints to improve UX quality.', 'COGNITIVE', 'EVALUATE'
FROM courses c
WHERE c.code = 'IT-MABD-401'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Evaluate mobile app reliability, offline sync, and device constraints to improve UX quality.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Analyze networking layers, protocols, and addressing schemes for enterprise communication design.', 'COGNITIVE', 'ANALYSE'
FROM courses c
WHERE c.code = 'IT-DCCN-201'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Analyze networking layers, protocols, and addressing schemes for enterprise communication design.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Compare transmission media and topologies for reliable and efficient network performance.', 'COGNITIVE', 'EVALUATE'
FROM courses c
WHERE c.code = 'IT-DCCN-201'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Compare transmission media and topologies for reliable and efficient network performance.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Design subnetting and routing solutions for scalable IPv4 and IPv6 networks.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-DCCN-201'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Design subnetting and routing solutions for scalable IPv4 and IPv6 networks.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Configure Linux and Windows system services, permissions, and authentication for enterprise users.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-SNAD-301'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Configure Linux and Windows system services, permissions, and authentication for enterprise users.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Manage storage, backups, and automated administration tasks to preserve business continuity.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-SNAD-301'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Manage storage, backups, and automated administration tasks to preserve business continuity.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Harden network services and monitor operations to reduce administration and security risks.', 'COGNITIVE', 'EVALUATE'
FROM courses c
WHERE c.code = 'IT-SNAD-301'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Harden network services and monitor operations to reduce administration and security risks.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Configure VLANs, trunks, STP, and Layer 3 routing for resilient enterprise switching.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-NDVC-302'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Configure VLANs, trunks, STP, and Layer 3 routing for resilient enterprise switching.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Implement ACLs and NAT policies to enforce segmentation and address translation requirements.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-NDVC-302'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Implement ACLs and NAT policies to enforce segmentation and address translation requirements.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Troubleshoot enterprise router and switch faults using protocol and log analysis.', 'COGNITIVE', 'EVALUATE'
FROM courses c
WHERE c.code = 'IT-NDVC-302'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Troubleshoot enterprise router and switch faults using protocol and log analysis.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Assess cyber threats and map them to confidentiality, integrity, and availability risks.', 'COGNITIVE', 'EVALUATE'
FROM courses c
WHERE c.code = 'IT-IASC-401'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Assess cyber threats and map them to confidentiality, integrity, and availability risks.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Apply symmetric and asymmetric cryptographic controls to protect information in transit and at rest.', 'COGNITIVE', 'APPLY'
FROM courses c
WHERE c.code = 'IT-IASC-401'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Apply symmetric and asymmetric cryptographic controls to protect information in transit and at rest.'
  );

INSERT INTO learning_outcomes (course_id, description, domain, level)
SELECT c.course_id, 'Design defensive security controls and incident-response procedures to contain and recover from attacks.', 'COGNITIVE', 'CREATE'
FROM courses c
WHERE c.code = 'IT-IASC-401'
  AND NOT EXISTS (
      SELECT 1 FROM learning_outcomes lo WHERE lo.course_id = c.course_id AND lo.description = 'Design defensive security controls and incident-response procedures to contain and recover from attacks.'
  );
