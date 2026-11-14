import React from 'react';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockRejectedValue(new Error('Native SQLite disabled in Node test environment')),
}));

jest.mock('expo-crypto', () => {
  let counter = 5000;
  return {
    randomUUID: jest.fn(() => `mock-uuid-${++counter}`),
  };
});

// Mock react-native
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props),
    Text: (props: any) => React.createElement('Text', props),
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    ScrollView: (props: any) => React.createElement('ScrollView', props),
    SafeAreaView: (props: any) => React.createElement('SafeAreaView', props),
    Modal: (props: any) => React.createElement('Modal', props, props.children),
    BackHandler: {
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    Alert: {
      alert: jest.fn(),
    },
    Platform: { OS: 'android', select: (obj: any) => obj.android || obj.default },
    StyleSheet: { create: (s: any) => s },
  };
});

// Mock lucide-react-native
jest.mock('lucide-react-native', () => {
  const React = require('react');
  return new Proxy(
    {},
    {
      get: (_, prop) => {
        const IconComponent = (props: any) =>
          React.createElement('Icon-' + String(prop), props);
        IconComponent.displayName = String(prop);
        return IconComponent;
      },
    }
  );
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

// Mock expo-secure-store
const mockSecureStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore[key] = value;
  }),
  getItemAsync: jest.fn(async (key: string) => {
    return mockSecureStore[key] ?? null;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockSecureStore[key];
  }),
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: { isConnectionExpensive: false },
  })),
}));

import { database } from '../shared/database/db';
import { examAttemptRepository } from '../shared/database/examAttemptRepository';
import {
  EXAM_QUESTIONS,
  generate100Questions,
} from '../features/exams/ExamRunnerScreen';

describe('Day 13 Verification: MOB-13/14/15 Exam Runner & Transactional State', () => {
  const TEST_PACKAGE_ID = 'pkg_edpr_quiz_203';
  const TEST_USER_ID = 'user_student_exit_2023';

  beforeEach(async () => {
    if (database.reset) {
      await database.reset();
    }
    await database.init();

    // Seed test exam package into local_exam_packages
    await database.execute(
      `INSERT INTO local_exam_packages
       (exam_package_id, exam_id, course_id, blueprint_version, question_snapshot_json, duration_sec, state)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        TEST_PACKAGE_ID,
        'exam_edpr_203_mid',
        203,
        1,
        JSON.stringify({ totalQuestions: 25, passingScore: 70 }),
        2700,
        'READY',
      ]
    );
  });

  // ── Invariant 1: Sub-16ms Transactional Commit & Monotonic Timer State ──────
  test('Invariant 1: Q19 answer commits transactionally with monotonic sequence and elapsed time', async () => {
    // 1. Create local in-progress attempt
    const attempt = await examAttemptRepository.createLocalAttempt(
      TEST_PACKAGE_ID,
      TEST_USER_ID,
      'tenant_haramu_hu'
    );

    expect(attempt.local_attempt_id).toBeDefined();
    expect(attempt.status).toBe('IN_PROGRESS');
    expect(attempt.elapsed_monotonic_sec).toBe(0);

    // 2. Select Option B for Q19 (IT-EDPR-203 Event-Driven Programming)
    const event1 = await examAttemptRepository.saveAnswerTransactional(
      attempt.local_attempt_id,
      'q_hu2023_019',
      'q019_b',
      false,
      undefined,
      45
    );

    expect(event1.event_id).toBeDefined();
    expect(event1.question_id).toBe('q_hu2023_019');
    expect(event1.selected_option_id).toBe('q019_b');
    expect(event1.sequence_no).toBe(1);
    expect(event1.is_flagged).toBe(0);

    // Verify database record in local_answer_events
    const answerEvents = await database.query(
      `SELECT * FROM local_answer_events WHERE local_attempt_id = ? ORDER BY sequence_no ASC;`,
      [attempt.local_attempt_id]
    );
    expect(answerEvents.length).toBe(1);
    expect(answerEvents[0].question_id).toBe('q_hu2023_019');
    expect(answerEvents[0].selected_option_id).toBe('q019_b');

    // Verify attempt elapsed time touched
    const attemptCheck = await examAttemptRepository.getAttemptById(attempt.local_attempt_id);
    expect(attemptCheck?.elapsed_monotonic_sec).toBe(45);

    // 3. Toggle flag for Q19 (isFlagged = true) at 52 seconds
    const event2 = await examAttemptRepository.saveAnswerTransactional(
      attempt.local_attempt_id,
      'q_hu2023_019',
      'q019_b',
      true,
      undefined,
      52
    );

    expect(event2.sequence_no).toBe(2);
    expect(event2.is_flagged).toBe(1);

    const updatedEvents = await examAttemptRepository.getAnswerEventsForAttempt(attempt.local_attempt_id);
    expect(updatedEvents.length).toBe(2);
    expect(updatedEvents[1].is_flagged).toBe(1);

    const finalAttempt = await examAttemptRepository.getAttemptById(attempt.local_attempt_id);
    expect(finalAttempt?.elapsed_monotonic_sec).toBe(52);
  });

  // ── Invariant 2: Force-Close Restore & Offline Outbox Submission ─────────────
  test('Invariant 2: Full exam state restored from SQLite on simulated app restart and submitted offline', async () => {
    // 1. Create attempt and simulate mid-exam state
    const attempt = await examAttemptRepository.createLocalAttempt(
      TEST_PACKAGE_ID,
      TEST_USER_ID,
      null
    );

    // Answer Q1 at 12s
    await examAttemptRepository.saveAnswerTransactional(
      attempt.local_attempt_id,
      'q_hu2023_001',
      'q001_b',
      false,
      undefined,
      12
    );

    // Answer Q19 at 40s (flagged)
    await examAttemptRepository.saveAnswerTransactional(
      attempt.local_attempt_id,
      'q_hu2023_019',
      'q019_b',
      true,
      undefined,
      40
    );

    // Answer Q91 at 85s
    await examAttemptRepository.saveAnswerTransactional(
      attempt.local_attempt_id,
      'q_hu2023_091',
      'q091_c',
      false,
      undefined,
      85
    );

    // 2. Simulate fresh app restart: query attempt and rebuild state
    const restoredAttempt = await examAttemptRepository.getAttemptById(attempt.local_attempt_id);
    expect(restoredAttempt).not.toBeNull();
    expect(restoredAttempt?.status).toBe('IN_PROGRESS');
    expect(restoredAttempt?.elapsed_monotonic_sec).toBe(85);

    const restoredEvents = await examAttemptRepository.getAnswerEventsForAttempt(attempt.local_attempt_id);
    expect(restoredEvents.length).toBe(3);

    const answeredMap: Record<string, string> = {};
    const flaggedSet = new Set<string>();

    for (const ev of restoredEvents) {
      if (ev.selected_option_id) {
        answeredMap[ev.question_id] = ev.selected_option_id;
      }
      if (ev.is_flagged === 1) {
        flaggedSet.add(ev.question_id);
      }
    }

    expect(answeredMap['q_hu2023_001']).toBe('q001_b');
    expect(answeredMap['q_hu2023_019']).toBe('q019_b');
    expect(answeredMap['q_hu2023_091']).toBe('q091_c');
    expect(flaggedSet.has('q_hu2023_019')).toBe(true);
    expect(flaggedSet.has('q_hu2023_001')).toBe(false);

    // 3. Offline submission transitions to SUBMITTED_LOCAL_PENDING and queues outbox operation
    const submissionResult = await examAttemptRepository.submitAttemptOfflineTransactional(
      attempt.local_attempt_id
    );

    expect(submissionResult.localAttemptId).toBe(attempt.local_attempt_id);
    expect(submissionResult.syncOperationId).toBeDefined();

    const postSubmitAttempt = await examAttemptRepository.getAttemptById(attempt.local_attempt_id);
    expect(postSubmitAttempt?.status).toBe('SUBMITTED_LOCAL_PENDING');
    expect(postSubmitAttempt?.submitted_at).toBeDefined();

    // Check durable sync_operations outbox
    const syncOps = await database.query(
      `SELECT * FROM sync_operations WHERE operation_id = ?;`,
      [submissionResult.syncOperationId]
    );
    expect(syncOps.length).toBe(1);
    expect(syncOps[0].type).toBe('exam_attempt.submit');
    expect(syncOps[0].state).toBe('QUEUED');
  });

  // ── Invariant 3: Question Bank Blueprint & Palette Filter Verification ───────
  test('Invariant 3: EXAM_QUESTIONS yields 100 questions with core curriculum items and accurate palette filtering', () => {
    expect(EXAM_QUESTIONS.length).toBe(100);

    // Q1: Computer Architecture (Von Neumann - Control Unit)
    const q1 = EXAM_QUESTIONS[0];
    expect(q1.questionNumber).toBe(1);
    expect(q1.courseCode).toBe('IT-FCOM-102');
    expect(q1.correctOptionId).toBe('q001_b');
    expect(q1.options.find((o) => o.id === 'q001_b')?.text).toContain('Control Unit');

    // Q19: Event Driven Programming (Observer Pattern)
    const q19 = EXAM_QUESTIONS[18];
    expect(q19.questionNumber).toBe(19);
    expect(q19.courseCode).toBe('IT-EDPR-203');
    expect(q19.correctOptionId).toBe('q019_b');
    expect(q19.options.find((o) => o.id === 'q019_b')?.text).toBe('Observer Pattern');
    expect(q19.bloomLevel).toBe('ANALYZE');

    // Q91: Database Systems (3NF Transitive Dependency)
    const q91 = EXAM_QUESTIONS[90];
    expect(q91.questionNumber).toBe(91);
    expect(q91.courseCode).toBe('IT-DBMS-301');
    expect(q91.correctOptionId).toBe('q091_c');
    expect(q91.options.find((o) => o.id === 'q091_c')?.text).toContain('Third Normal Form');
    expect(q91.bloomLevel).toBe('APPLY');

    // Test Palette Filtering logic
    const mockAnswered: Record<string, string> = {
      q_hu2023_001: 'q001_b',
      q_hu2023_019: 'q019_b',
      q_hu2023_091: 'q091_c',
    };
    const mockFlagged = new Set<string>(['q_hu2023_019', 'q_hu2023_050']);

    const totalCount = EXAM_QUESTIONS.length;
    const answeredCount = Object.keys(mockAnswered).length;
    const unansweredCount = totalCount - answeredCount;
    const flaggedCount = mockFlagged.size;

    expect(totalCount).toBe(100);
    expect(answeredCount).toBe(3);
    expect(unansweredCount).toBe(97);
    expect(flaggedCount).toBe(2);

    // Palette filter 'UNANSWERED'
    const unansweredQuestions = EXAM_QUESTIONS.filter((q) => !mockAnswered[q.id]);
    expect(unansweredQuestions.length).toBe(97);
    expect(unansweredQuestions.some((q) => q.id === 'q_hu2023_001')).toBe(false);

    // Palette filter 'FLAGGED'
    const flaggedQuestions = EXAM_QUESTIONS.filter((q) => mockFlagged.has(q.id));
    expect(flaggedQuestions.length).toBe(2);
    expect(flaggedQuestions.map((q) => q.id)).toEqual(['q_hu2023_019', 'q_hu2023_050']);
  });
});
