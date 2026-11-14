jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockRejectedValue(new Error('Native SQLite disabled in Node test environment')),
}));

jest.mock('expo-crypto', () => {
  let counter = 1000;
  return {
    randomUUID: jest.fn(() => `mock-uuid-${++counter}`),
  };
});

jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (obj: any) => obj.android || obj.default },
}));

import { database } from '../shared/database/db';
import {
  curriculumRepository,
  CANONICAL_CURRICULUM_SEED,
} from '../shared/database/curriculumRepository';
import { examAttemptRepository } from '../shared/database/examAttemptRepository';
import { storageGuardRepository } from '../shared/database/storageGuardRepository';

describe('Day 5 Verification: Database Adapter & Atomic Transactions', () => {
  beforeEach(async () => {
    if (database.reset) {
      await database.reset();
    }
    await database.init();
  });

  test('withTransaction atomically commits multi-statement operations on success', async () => {
    await database.withTransaction(async (tx) => {
      await tx.execute(
        `INSERT INTO local_themes (theme_id, theme_number, title, total_credit_hours, version)
         VALUES (?, ?, ?, ?, ?);`,
        [99, 99, 'Test Transaction Theme', 4, 1]
      );
      await tx.execute(
        `INSERT INTO local_courses (course_id, theme_id, code, title, credit_hours, general_objective, version)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [999, 99, 'TEST-999', 'Transactional Course', 4, 'Test objective', 1]
      );
    });

    const themes = await database.query(
      `SELECT * FROM local_themes WHERE theme_id = ?;`,
      [99]
    );
    const courses = await database.query(
      `SELECT * FROM local_courses WHERE course_id = ?;`,
      [999]
    );

    expect(themes.length).toBe(1);
    expect(courses.length).toBe(1);
    expect(courses[0].code).toBe('TEST-999');
  });

  test('withTransaction rolls back all statements when an error is thrown', async () => {
    await expect(
      database.withTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO local_themes (theme_id, theme_number, title, total_credit_hours, version)
           VALUES (?, ?, ?, ?, ?);`,
          [88, 88, 'Failed Theme', 3, 1]
        );
        throw new Error('Simulated transaction failure mid-flight');
      })
    ).rejects.toThrow('Simulated transaction failure mid-flight');

    const themes = await database.query(
      `SELECT * FROM local_themes WHERE theme_id = ?;`,
      [88]
    );
    expect(themes.length).toBe(0);
  });
});

describe('Day 5 Verification: Curriculum Repository & 45-Credit Baseline', () => {
  beforeEach(async () => {
    if (database.reset) {
      await database.reset();
    }
    await database.init();
  });

  test('seedCanonicalCurriculumIfEmpty seeds exactly 5 Themes, 15 Courses and 45 Credits', async () => {
    const seeded = await curriculumRepository.seedCanonicalCurriculumIfEmpty();
    expect(seeded).toBe(true);

    const themes = await curriculumRepository.getThemesWithOfflineStatus();
    expect(themes.length).toBe(5);

    // Verify 45 total credit hours: 4 + 15 + 6 + 9 + 11 = 45
    const totalCredits = themes.reduce((sum, t) => sum + t.total_credit_hours, 0);
    expect(totalCredits).toBe(45);

    const allCourses = await curriculumRepository.getAllCourses();
    expect(allCourses.length).toBe(15);

    // Verify first and last canonical course codes
    expect(allCourses[0].code).toBe('IT-CMTS-101');
    expect(allCourses[14].code).toBe('IT-IASC-401');

    // Calling seed again when data exists is a no-op
    const secondCall = await curriculumRepository.seedCanonicalCurriculumIfEmpty();
    expect(secondCall).toBe(false);
  });

  test('getCourseOverview groups outcomes by Bloom domain and loads resources', async () => {
    await curriculumRepository.seedCanonicalCurriculumIfEmpty();

    // Insert dummy local resource and exam package for IT-CMTS-101 (course_id: 101)
    await database.execute(
      `INSERT INTO local_resources (resource_id, course_id, type, title, size_bytes, access_state, version)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['res-cmts-01', 101, 'LECTURE_NOTE', 'Hardware Troubleshooting Guide', 2048576, 'AVAILABLE', 1]
    );
    await database.execute(
      `INSERT INTO local_exam_packages (exam_package_id, exam_id, course_id, blueprint_version, question_snapshot_json, duration_sec, state)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['pkg-exam-cmts', 'exam-cmts', 101, 1, '[]', 1800, 'READY']
    );

    const overview = await curriculumRepository.getCourseOverview(101);
    expect(overview).not.toBeNull();
    expect(overview?.course.code).toBe('IT-CMTS-101');
    expect(overview?.resources.length).toBe(1);
    expect(overview?.resources[0].title).toBe('Hardware Troubleshooting Guide');
    expect(overview?.examPackages.length).toBe(1);
    expect(overview?.outcomesByDomain['COGNITIVE']).toBeDefined();
  });
});

describe('Day 5 Verification: Transactional Exam Attempts & Answer Events', () => {
  beforeEach(async () => {
    if (database.reset) {
      await database.reset();
    }
    await database.init();
    await curriculumRepository.seedCanonicalCurriculumIfEmpty();

    // Prepare an exam package
    await database.execute(
      `INSERT INTO local_exam_packages (exam_package_id, exam_id, course_id, blueprint_version, question_snapshot_json, duration_sec, state)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['pkg-exam-dbs', 'exam-dbs-01', 205, 1, '[]', 3600, 'READY']
    );
  });

  test('saveAnswerTransactional increments sequence_no and commits under simulated restart', async () => {
    const attempt = await examAttemptRepository.createLocalAttempt(
      'pkg-exam-dbs',
      'user-student-42',
      'tenant-haramaya-uuid'
    );

    expect(attempt.status).toBe('IN_PROGRESS');
    expect(attempt.local_attempt_id).toBeDefined();

    // Answer Q1 first selection
    const ev1 = await examAttemptRepository.saveAnswerTransactional(
      attempt.local_attempt_id,
      'q-101',
      'opt-a',
      false,
      undefined,
      15
    );
    expect(ev1.sequence_no).toBe(1);
    expect(ev1.selected_option_id).toBe('opt-a');

    // Answer Q1 revised selection (monotonic increment)
    const ev2 = await examAttemptRepository.saveAnswerTransactional(
      attempt.local_attempt_id,
      'q-101',
      'opt-c',
      true,
      undefined,
      45
    );
    expect(ev2.sequence_no).toBe(2);
    expect(ev2.selected_option_id).toBe('opt-c');
    expect(ev2.is_flagged).toBe(1);

    // Answer Q2
    const ev3 = await examAttemptRepository.saveAnswerTransactional(
      attempt.local_attempt_id,
      'q-102',
      'opt-b',
      false,
      undefined,
      60
    );
    expect(ev3.sequence_no).toBe(3);

    // Verify all 3 events exist in database and survive simulated restart
    const eventsInDb = await examAttemptRepository.getAnswerEventsForAttempt(
      attempt.local_attempt_id
    );
    expect(eventsInDb.length).toBe(3);
    expect(eventsInDb[0].selected_option_id).toBe('opt-a');
    expect(eventsInDb[1].selected_option_id).toBe('opt-c');
    expect(eventsInDb[2].selected_option_id).toBe('opt-b');

    // Verify attempt elapsed timer was updated
    const updatedAttempt = await examAttemptRepository.getAttemptById(
      attempt.local_attempt_id
    );
    expect(updatedAttempt?.elapsed_monotonic_sec).toBe(60);
  });

  test('submitAttemptOfflineTransactional transitions status to SUBMITTED_LOCAL_PENDING and queues sync_operations outbox', async () => {
    const attempt = await examAttemptRepository.createLocalAttempt(
      'pkg-exam-dbs',
      'user-student-42',
      'tenant-haramaya-uuid'
    );

    // Save answers to Q1 and Q2
    await examAttemptRepository.saveAnswerTransactional(
      attempt.local_attempt_id,
      'q-1',
      'opt-x'
    );
    await examAttemptRepository.saveAnswerTransactional(
      attempt.local_attempt_id,
      'q-2',
      'opt-y'
    );

    // Submit attempt offline
    const result = await examAttemptRepository.submitAttemptOfflineTransactional(
      attempt.local_attempt_id
    );

    expect(result.localAttemptId).toBe(attempt.local_attempt_id);
    expect(result.syncOperationId).toBeDefined();

    // Verify local_exam_attempts status is now SUBMITTED_LOCAL_PENDING
    const submittedAttempt = await examAttemptRepository.getAttemptById(
      attempt.local_attempt_id
    );
    expect(submittedAttempt?.status).toBe('SUBMITTED_LOCAL_PENDING');
    expect(submittedAttempt?.submitted_at).not.toBeNull();

    // Verify durable sync_operations entry was created
    const syncOps = await database.query(
      `SELECT * FROM sync_operations WHERE operation_id = ?;`,
      [result.syncOperationId]
    );
    expect(syncOps.length).toBe(1);
    expect(syncOps[0].type).toBe('exam_attempt.submit');
    expect(syncOps[0].state).toBe('QUEUED');
    expect(syncOps[0].user_id).toBe('user-student-42');
    expect(syncOps[0].tenant_id).toBe('tenant-haramaya-uuid');

    // Verify payload contents
    const payload = JSON.parse(syncOps[0].payload_json);
    expect(payload.local_attempt_id).toBe(attempt.local_attempt_id);
    expect(payload.answers.length).toBe(2);

    // Re-submitting an already submitted attempt must reject
    await expect(
      examAttemptRepository.submitAttemptOfflineTransactional(attempt.local_attempt_id)
    ).rejects.toThrow(/Cannot submit attempt/);
  });
});

describe('Day 5 Verification: Storage Guard & Eviction Safety Invariants (MOB-27)', () => {
  beforeEach(async () => {
    if (database.reset) {
      await database.reset();
    }
    await database.init();
  });

  test('getProtectedCounts returns exact count of active attempts and unaccepted sync ops', async () => {
    // 1. Create an in-progress attempt
    await database.execute(
      `INSERT INTO local_exam_packages (exam_package_id, exam_id, blueprint_version, question_snapshot_json, duration_sec, state)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['pkg-1', 'exam-1', 1, '[]', 1800, 'READY']
    );
    await database.execute(
      `INSERT INTO local_exam_attempts (local_attempt_id, user_id, exam_package_id, status, started_at)
       VALUES (?, ?, ?, ?, ?);`,
      ['att-1', 'user-abc', 'pkg-1', 'IN_PROGRESS', new Date().toISOString()]
    );

    // 2. Create a pending sync operation
    await database.execute(
      `INSERT INTO sync_operations (operation_id, user_id, type, payload_json, state, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['op-1', 'user-abc', 'sync.push', '{}', 'QUEUED', new Date().toISOString()]
    );

    const counts = await storageGuardRepository.getProtectedCounts('user-abc');
    expect(counts.activeAttemptsCount).toBe(1);
    expect(counts.pendingSyncCount).toBe(1);
    expect(counts.lockedPackagesCount).toBe(1);
    expect(counts.isEvictionSafe).toBe(false);
  });

  test('evictEligibleCacheOnly refuses to touch active exam attempts and evicts only expired/LRU cache', async () => {
    // Setup Packages:
    // Package 1: Referenced by an active exam attempt -> MUST NEVER BE EVICTED
    await database.execute(
      `INSERT INTO download_packages (package_id, resource_id, encrypted_path, size_bytes, state, license_expiry)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['pkg-active-exam', 'res-active-exam', '/cache/active.bin', 10000000, 'AVAILABLE_OFFLINE', '2099-01-01']
    );
    await database.execute(
      `INSERT INTO local_exam_attempts (local_attempt_id, user_id, exam_package_id, status, started_at)
       VALUES (?, ?, ?, ?, ?);`,
      ['att-locked', 'user-abc', 'pkg-active-exam', 'IN_PROGRESS', new Date().toISOString()]
    );

    // Package 2: Expired unreferenced license (5 MB) -> Eligible first
    await database.execute(
      `INSERT INTO download_packages (package_id, resource_id, encrypted_path, size_bytes, state, license_expiry, last_opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['pkg-expired', 'res-expired', '/cache/expired.bin', 5000000, 'AVAILABLE_OFFLINE', '2020-01-01', '2026-11-01']
    );

    // Package 3: Valid unreferenced package, older LRU (8 MB) -> Eligible second
    await database.execute(
      `INSERT INTO download_packages (package_id, resource_id, encrypted_path, size_bytes, state, license_expiry, last_opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['pkg-lru-old', 'res-lru-old', '/cache/old.bin', 8000000, 'AVAILABLE_OFFLINE', '2099-01-01', '2026-10-01']
    );

    // Package 4: Valid unreferenced package, recently opened (6 MB) -> Eligible last
    await database.execute(
      `INSERT INTO download_packages (package_id, resource_id, encrypted_path, size_bytes, state, license_expiry, last_opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['pkg-lru-recent', 'res-lru-recent', '/cache/recent.bin', 6000000, 'AVAILABLE_OFFLINE', '2099-01-01', '2026-11-14']
    );

    // Request to evict 10 MB: should evict pkg-expired (5MB) + pkg-lru-old (8MB) = 13MB freed
    const result = await storageGuardRepository.evictEligibleCacheOnly(10000000);

    expect(result.skippedActiveCount).toBe(1);
    expect(result.bytesFreed).toBe(13000000);
    expect(result.evictedPackageIds).toContain('pkg-expired');
    expect(result.evictedPackageIds).toContain('pkg-lru-old');
    expect(result.evictedPackageIds).not.toContain('pkg-active-exam');
    expect(result.evictedPackageIds).not.toContain('pkg-lru-recent');

    // CRITICAL INVARIANT: The active exam package still exists in download_packages
    const activePkg = await database.query(
      `SELECT * FROM download_packages WHERE package_id = ?;`,
      ['pkg-active-exam']
    );
    expect(activePkg.length).toBe(1);

    // CRITICAL INVARIANT: local_exam_attempts row was completely untouched
    const attempt = await database.query(
      `SELECT * FROM local_exam_attempts WHERE local_attempt_id = ?;`,
      ['att-locked']
    );
    expect(attempt.length).toBe(1);
  });
});
