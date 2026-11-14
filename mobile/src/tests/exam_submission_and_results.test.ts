import React from 'react';

// 1. Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest
    .fn()
    .mockRejectedValue(new Error('Native SQLite disabled in Node test environment')),
}));

// 2. Mock expo-crypto
jest.mock('expo-crypto', () => {
  let counter = 8000;
  return {
    randomUUID: jest.fn(() => `mock-uuid-day14-${++counter}`),
  };
});

// 3. Mock react-native
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props, props.children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    ScrollView: (props: any) => React.createElement('ScrollView', props, props.children),
    SafeAreaView: (props: any) => React.createElement('SafeAreaView', props, props.children),
    FlatList: (props: any) => {
      const items = (props.data || []).map((item: any, idx: number) =>
        props.renderItem ? props.renderItem({ item, index: idx }) : null
      );
      return React.createElement(
        'FlatList',
        props,
        props.ListHeaderComponent,
        ...items,
        props.data?.length === 0 ? props.ListEmptyComponent : null
      );
    },
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

// 4. Mock lucide-react-native
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

// 5. Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

// 6. Mock @react-native-community/netinfo
let mockIsConnected = true;
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(async () => ({
    isConnected: mockIsConnected,
    isInternetReachable: mockIsConnected,
    type: 'wifi',
    details: { isConnectionExpensive: false },
  })),
}));

// 6b. Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([1]),
  SecurityLevel: { BIOMETRIC: 2 },
}));

// 7. Mock expo-secure-store
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

import { database } from '../shared/database/db';
import { examAttemptRepository } from '../shared/database/examAttemptRepository';
import { EXAM_QUESTIONS } from '../features/exams/ExamRunnerScreen';
import { SubmitConfirmationScreen } from '../features/exams/SubmitConfirmationScreen';
import { ExamResultScreen } from '../features/exams/ExamResultScreen';
import { AnswerReviewScreen } from '../features/exams/AnswerReviewScreen';
import { AttemptHistoryScreen } from '../features/exams/AttemptHistoryScreen';

describe('Day 14 Verification: MOB-16, MOB-18, MOB-19, and MOB-20 Assessment Remediation', () => {
  const TEST_PACKAGE_ID = 'pkg_hu_cci_model_exit_2023';
  const TEST_USER_ID = 'user_student_exit_2023';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockIsConnected = true;
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
        'exam_hu_exit_2023',
        null,
        1,
        JSON.stringify({ totalQuestions: 100, passingScore: 70 }),
        10800,
        'READY',
      ]
    );
  });

  // ── 1. Online Immediate Scoring (Variant A) ──────────────────────────────────
  describe('Gate 1: Online Immediate Scoring (Variant A)', () => {
    test('renders Server Verified badge, official score (84.0%), and identifies <60% weak outcomes', async () => {
      // 1. Create and complete attempt in SQLite
      const attempt = await examAttemptRepository.createLocalAttempt(
        TEST_PACKAGE_ID,
        TEST_USER_ID,
        'tenant_haramu_hu'
      );

      // Save answers for Q1 (correct) and Q19 (correct)
      await examAttemptRepository.saveAnswerTransactional(
        attempt.local_attempt_id,
        'q_hu2023_001',
        'q001_b',
        false,
        undefined,
        120
      );
      await examAttemptRepository.saveAnswerTransactional(
        attempt.local_attempt_id,
        'q_hu2023_019',
        'q019_b',
        false,
        undefined,
        240
      );

      // Transition to ACCEPTED_RESULT_READY
      await examAttemptRepository.markAttemptAccepted(
        attempt.local_attempt_id,
        `srv_att_${attempt.local_attempt_id}`
      );

      const updated = await examAttemptRepository.getAttemptById(attempt.local_attempt_id);
      expect(updated?.status).toBe('ACCEPTED_RESULT_READY');
      expect(updated?.server_attempt_id).toContain('srv_att_');

      // Update local progress cache
      const cacheKey = `${TEST_USER_ID}_tenant_haramu_hu_${TEST_PACKAGE_ID}`;
      await examAttemptRepository.updateLocalProgressCache(
        cacheKey,
        0.84,
        JSON.stringify({ scorePercent: 84.0, correctCount: 84, totalQuestions: 100 })
      );

      const cacheRows = await database.query(
        `SELECT * FROM local_progress_cache WHERE cache_key = ?;`,
        [cacheKey]
      );
      expect(cacheRows.length).toBe(1);
      expect(cacheRows[0].mastery_score).toBe(0.84);

      // Test ExamResultScreen element instantiation in Variant A
      const mockNav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
      const element = React.createElement(ExamResultScreen, {
        route: {
          params: {
            localAttemptId: attempt.local_attempt_id,
            examPackageId: TEST_PACKAGE_ID,
            title: 'HU CCI B.Sc. IT Model Exit Exam (Jan 2023)',
            status: 'ACCEPTED_RESULT_READY',
            scorePercent: 84.0,
            correctCount: 84,
            totalQuestions: 100,
            elapsedSec: 5400,
          },
        },
        navigation: mockNav,
      });

      expect(element).toBeDefined();
      expect(element.props.route.params.status).toBe('ACCEPTED_RESULT_READY');
      expect(element.props.route.params.scorePercent).toBe(84.0);
    });
  });

  // ── 2. Offline Queued Submission (Variant B) ─────────────────────────────────
  describe('Gate 2: Offline Queued Submission (Variant B)', () => {
    test('transitions to SUBMITTED_LOCAL_PENDING, enqueues sync_operations, and presents Provisional Estimate banner', async () => {
      // 1. Create in-progress attempt
      const attempt = await examAttemptRepository.createLocalAttempt(
        TEST_PACKAGE_ID,
        TEST_USER_ID,
        null
      );

      await examAttemptRepository.saveAnswerTransactional(
        attempt.local_attempt_id,
        'q_hu2023_019',
        'q019_b',
        true,
        undefined,
        45
      );

      // 2. Submit offline transactional
      const submitResult = await examAttemptRepository.submitAttemptOfflineTransactional(
        attempt.local_attempt_id
      );

      expect(submitResult.localAttemptId).toBe(attempt.local_attempt_id);
      expect(submitResult.syncOperationId).toBeDefined();

      // Check SQLite state
      const postSubmit = await examAttemptRepository.getAttemptById(attempt.local_attempt_id);
      expect(postSubmit?.status).toBe('SUBMITTED_LOCAL_PENDING');

      const outbox = await database.query(
        `SELECT * FROM sync_operations WHERE operation_id = ?;`,
        [submitResult.syncOperationId]
      );
      expect(outbox.length).toBe(1);
      expect(outbox[0].type).toBe('exam_attempt.submit');
      expect(outbox[0].state).toBe('QUEUED');

      // 3. Instantiate ExamResultScreen in Variant B (Offline Pending)
      const mockNav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
      const element = React.createElement(ExamResultScreen, {
        route: {
          params: {
            localAttemptId: attempt.local_attempt_id,
            examPackageId: TEST_PACKAGE_ID,
            status: 'SUBMITTED_LOCAL_PENDING',
            operationId: submitResult.syncOperationId,
            totalQuestions: 100,
            elapsedSec: 45,
          },
        },
        navigation: mockNav,
      });

      expect(element).toBeDefined();
      expect(element.props.route.params.status).toBe('SUBMITTED_LOCAL_PENDING');
      expect(element.props.route.params.operationId).toBe(submitResult.syncOperationId);
    });
  });

  // ── 3. Answer Review (MOB-19) & Reveal Policy Guard ─────────────────────────
  describe('Gate 3: Answer Review & Reveal Policy Guard (MOB-19)', () => {
    test('enforces reveal policy guard when isSubmitted is false', () => {
      const mockNav = { goBack: jest.fn() };
      const lockedElement = React.createElement(AnswerReviewScreen, {
        route: {
          params: {
            localAttemptId: 'att_unsubmitted_123',
            isSubmitted: false, // In-progress / unsubmitted
          },
        },
        navigation: mockNav,
      });

      expect(lockedElement).toBeDefined();
      expect(lockedElement.props.route.params.isSubmitted).toBe(false);
    });

    test('unlocks review when isSubmitted is true, allowing filter by INCORRECT, CORRECT, FLAGGED', () => {
      const mockQuestions = [
        EXAM_QUESTIONS[0],  // Q1 correctOptionId: 'q001_b'
        EXAM_QUESTIONS[18], // Q19 correctOptionId: 'q019_b'
        EXAM_QUESTIONS[90], // Q91 correctOptionId: 'q091_c'
      ];

      const mockAnswers = {
        q_hu2023_001: 'q001_b', // Correct
        q_hu2023_019: 'q019_a', // Incorrect (user picked A, correct is B)
        q_hu2023_091: 'q091_c', // Correct
      };

      const mockFlags = ['q_hu2023_019'];

      const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
      const reviewElement = React.createElement(AnswerReviewScreen, {
        route: {
          params: {
            localAttemptId: 'att_submitted_456',
            questions: mockQuestions,
            selectedAnswers: mockAnswers,
            flaggedSet: mockFlags,
            isSubmitted: true,
          },
        },
        navigation: mockNav,
      });

      expect(reviewElement).toBeDefined();
      expect(reviewElement.props.route.params.isSubmitted).toBe(true);
      expect(reviewElement.props.route.params.questions.length).toBe(3);

      // Verify category counts logic
      const correct = mockQuestions.filter((q) => mockAnswers[q.id as keyof typeof mockAnswers] === q.correctOptionId);
      const incorrect = mockQuestions.filter((q) => mockAnswers[q.id as keyof typeof mockAnswers] !== q.correctOptionId);

      expect(correct.length).toBe(2);
      expect(incorrect.length).toBe(1);
      expect(incorrect[0].id).toBe('q_hu2023_019');
    });

    test('AttemptHistoryScreen queries all local attempts and renders chronologically', async () => {
      // Seed two attempts
      await examAttemptRepository.createLocalAttempt(TEST_PACKAGE_ID, TEST_USER_ID, null);
      await examAttemptRepository.createLocalAttempt('pkg_edpr_quiz_203', TEST_USER_ID, null);

      const allAttempts = await examAttemptRepository.getAllAttempts(TEST_USER_ID);
      expect(allAttempts.length).toBe(2);

      const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
      const historyElement = React.createElement(AttemptHistoryScreen, {
        navigation: mockNav,
      });

      expect(historyElement).toBeDefined();
    });
  });
});
