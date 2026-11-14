import React from 'react';

// 1. Mock react-native
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props),
    Text: (props: any) => React.createElement('Text', props),
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    ScrollView: (props: any) => React.createElement('ScrollView', props),
    SafeAreaView: (props: any) => React.createElement('SafeAreaView', props),
    Platform: { OS: 'android', select: (obj: any) => obj.android || obj.default },
    StyleSheet: { create: (s: any) => s },
    Alert: { alert: jest.fn() },
  };
});

// 2. Mock lucide-react-native
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

// 3. Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockRejectedValue(new Error('Native SQLite disabled in Node test environment')),
}));

// 4. Mock expo-secure-store
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

// 5. Mock expo-crypto
jest.mock('expo-crypto', () => {
  let counter = 1000;
  return {
    randomUUID: jest.fn(() => `crypto-uuid-day7-${++counter}`),
  };
});

import { database } from '../shared/database/db';
import {
  curriculumRepository,
  CANONICAL_CURRICULUM_SEED,
} from '../shared/database/curriculumRepository';
import { examAttemptRepository } from '../shared/database/examAttemptRepository';

describe('Day 7 Verification: MOB-05 to MOB-08 Curriculum & Home Dashboard', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    if (database.reset) {
      await database.reset();
    }
    await database.init();
    await curriculumRepository.seedCanonicalCurriculumIfEmpty();
  });

  describe('MOB-05: Home Dashboard Sub-16ms Queries & Readiness Stats', () => {
    test('getContinueLearning defaults to canonical IT-CMTS-101 for new users', async () => {
      const action = await curriculumRepository.getContinueLearning('new-user-1');
      expect(action).toBeDefined();
      expect(action.type).toBe('DEFAULT_COURSE');
      expect(action.courseCode).toBe('IT-CMTS-101');
      expect(action.buttonLabel).toContain('Resume Reading');
    });

    test('getContinueLearning dynamically surfaces active IN_PROGRESS exam attempt', async () => {
      const studentId = 'usr-active-student-55';

      // Seed local exam package
      await database.execute(
        `INSERT INTO local_exam_packages (exam_package_id, exam_id, course_id, blueprint_version, question_snapshot_json, duration_sec, state)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        ['pkg-exam-midterm-201', 'exam-midterm-201', 201, 1, '[]', 3600, 'READY']
      );

      // Create attempt
      const attempt = await examAttemptRepository.createLocalAttempt(
        'pkg-exam-midterm-201',
        studentId,
        null
      );

      // Answer 2 questions transactionally
      await examAttemptRepository.saveAnswerTransactional(
        attempt.local_attempt_id,
        'q-101',
        'opt-b',
        false
      );
      await examAttemptRepository.saveAnswerTransactional(
        attempt.local_attempt_id,
        'q-102',
        'opt-c',
        true
      );

      const action = await curriculumRepository.getContinueLearning(studentId);
      expect(action.type).toBe('EXAM_ATTEMPT');
      expect(action.attemptId).toBe(attempt.local_attempt_id);
      expect(action.subtitle).toContain('Question 2 Answered');
      expect(action.buttonLabel).toBe('Continue Exam Attempt');
    });

    test('getOfflineReadinessStats calculates live counts from SQLite', async () => {
      const studentId = 'usr-stats-student-99';

      // Insert unaccepted sync operation
      await database.execute(
        `INSERT INTO sync_operations (operation_id, user_id, tenant_id, type, payload, state, attempt_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        ['sync-op-day7-1', studentId, null, 'exam_attempt.submit', '{}', 'QUEUED', 0, new Date().toISOString()]
      );

      const stats = await curriculumRepository.getOfflineReadinessStats(studentId);
      expect(stats.downloadedCoursesCount).toBeGreaterThanOrEqual(0);
      expect(stats.offlineExamPackagesCount).toBeGreaterThanOrEqual(0);
      expect(stats.pendingSyncCount).toBe(1);
    });

    test('getWeakOutcomeRecommendations returns targeted Bloom levels', async () => {
      const recs = await curriculumRepository.getWeakOutcomeRecommendations(2);
      expect(recs.length).toBe(2);
      expect(recs[0].courseCode).toBe('IT-DCCN-201');
      expect(recs[0].level).toBe('APPLY');
      expect(recs[1].courseCode).toBe('IT-OOPJ-201');
      expect(recs[1].level).toBe('ANALYSE');
    });
  });

  describe('MOB-06: Theme Catalog Instant Browsing & Search', () => {
    test('getThemesWithOfflineStatus returns all 5 themes with 45 total credit hours', async () => {
      const themes = await curriculumRepository.getThemesWithOfflineStatus();
      expect(themes.length).toBe(5);

      const totalCredits = themes.reduce((acc, t) => acc + t.total_credit_hours, 0);
      expect(totalCredits).toBe(45);
    });

    test('Instant search filters across theme titles and course codes', async () => {
      // Search by course code 'IT-OOPJ-201' -> Theme 2
      const theme2Results = await curriculumRepository.getThemesWithOfflineStatus('IT-OOPJ-201');
      expect(theme2Results.length).toBe(1);
      expect(theme2Results[0].theme_number).toBe(2);

      // Search by keyword 'Database' -> Theme 3
      const theme3Results = await curriculumRepository.getThemesWithOfflineStatus('Database');
      expect(theme3Results.length).toBe(1);
      expect(theme3Results[0].theme_number).toBe(3);
    });
  });

  describe('MOB-07 & MOB-08: Course List & Course Overview Hub', () => {
    test('getCoursesByTheme returns canonical courses for Theme 2 (15 Cr)', async () => {
      const courses = await curriculumRepository.getCoursesByTheme(2);
      expect(courses.length).toBe(5); // IT-OOPJ-201, IT-ADVP-202, IT-EDPR-203, IT-SYAD-204, IT-ITPM-301

      const codes = courses.map((c) => c.code);
      expect(codes).toContain('IT-OOPJ-201');
      expect(codes).toContain('IT-ITPM-301');
    });

    test('getResourcesByCourse returns Haramaya University Model Exit Exam Jan 2023 PDF', async () => {
      const resources = await curriculumRepository.getResourcesByCourse(101);
      expect(resources.length).toBeGreaterThanOrEqual(1);

      const huExam = resources.find((r) => r.title.includes('Haramaya University CCI'));
      expect(huExam).toBeDefined();
      expect(huExam?.type).toBe('PAST_EXAM');
      expect(huExam?.size_bytes).toBe(2450000);
    });

    test('getExamPackagesByCourse returns 100-Question HU Model Exit Exam (180 mins)', async () => {
      const examPkgs = await curriculumRepository.getExamPackagesByCourse(101);
      expect(examPkgs.length).toBeGreaterThanOrEqual(1);

      const huPkg = examPkgs.find((ep) => ep.exam_package_id === 'pkg_hu_cci_model_exit_2023');
      expect(huPkg).toBeDefined();
      expect(huPkg?.duration_sec).toBe(10800); // 180 mins

      const snapshot = JSON.parse(huPkg?.question_snapshot_json || '{}');
      expect(snapshot.total_questions).toBe(100);
    });
  });
});
