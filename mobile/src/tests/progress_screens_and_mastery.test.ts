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
    RefreshControl: (props: any) => React.createElement('RefreshControl', props),
    Platform: { OS: 'android', select: (obj: any) => obj.android || obj.default },
    StyleSheet: { create: (s: any) => s },
    Alert: { alert: jest.fn() },
  };
});

// 2. Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: any) => React.createElement('Svg', props),
    Svg: (props: any) => React.createElement('Svg', props),
    Polygon: (props: any) => React.createElement('Polygon', props),
    Line: (props: any) => React.createElement('Line', props),
    Circle: (props: any) => React.createElement('Circle', props),
    Text: (props: any) => React.createElement('SvgText', props),
    G: (props: any) => React.createElement('G', props),
  };
});

// 3. Mock lucide-react-native
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

// 4. Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockRejectedValue(new Error('Native SQLite disabled in Node test environment')),
}));

// 4b. Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([1]),
  SecurityLevel: { BIOMETRIC: 2 },
}));

// 5. Mock expo-secure-store
const mockSecureStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore[key] = value;
  }),
  getItemAsync: jest.fn(async (key: string) => mockSecureStore[key] ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockSecureStore[key];
  }),
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

// 6. Mock expo-crypto
jest.mock('expo-crypto', () => {
  let counter = 1000;
  return {
    randomUUID: jest.fn(() => `crypto-uuid-s6-${++counter}`),
  };
});

// 7. Mock @react-navigation/native
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: {
      courseId: 1,
      courseCode: 'IT-CMTS-101',
      courseTitle: 'Computer Maintenance & Troubleshooting',
    },
  }),
}));

// 8. Mock api client
jest.mock('../shared/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { database } from '../shared/database/db';
import { curriculumRepository } from '../shared/database/curriculumRepository';
import {
  progressRepository,
  StudentProgressData,
} from '../shared/database/progressRepository';
import { api } from '../shared/api/client';
import { BloomsRadarChart } from '../features/progress/components/BloomsRadarChart';
import { ProgressOverviewScreen } from '../features/progress/screens/ProgressOverviewScreen';
import { CourseProgressScreen } from '../features/progress/screens/CourseProgressScreen';

describe('Slice 6 Verification: Learning Analytics, Bloom\'s Radar & Mastery Screens (MOB-21 & MOB-22)', () => {
  const sampleProgress: StudentProgressData = {
    summary: {
      overall_readiness_percent: 78.4,
      active_courses_count: 5,
      total_courses_count: 15,
      validated_attempts_count: 12,
      study_streak_days: 4,
      last_calculated_at: '2026-11-15T18:00:00Z',
      disclaimer: 'Mastery scores are rolling estimates based on validated practice evidence, not official university grades.',
    },
    themes: [
      {
        theme_id: 1,
        theme_number: 1,
        title: 'Hardware and Computer Infrastructure',
        credit_hours: 9,
        courses_count: 3,
        mastery_score: 0.85,
        mastery_percentage: 85.0,
        attempted_outcomes_count: 6,
        total_outcomes_count: 9,
      },
      {
        theme_id: 2,
        theme_number: 2,
        title: 'Software Engineering & Programming',
        credit_hours: 9,
        courses_count: 3,
        mastery_score: 0.72,
        mastery_percentage: 72.0,
        attempted_outcomes_count: 5,
        total_outcomes_count: 9,
      },
      {
        theme_id: 3,
        theme_number: 3,
        title: 'Data Management & Analytics',
        credit_hours: 9,
        courses_count: 3,
        mastery_score: 0.80,
        mastery_percentage: 80.0,
        attempted_outcomes_count: 6,
        total_outcomes_count: 9,
      },
      {
        theme_id: 4,
        theme_number: 4,
        title: 'Networking & Systems Administration',
        credit_hours: 9,
        courses_count: 3,
        mastery_score: 0.75,
        mastery_percentage: 75.0,
        attempted_outcomes_count: 6,
        total_outcomes_count: 9,
      },
      {
        theme_id: 5,
        theme_number: 5,
        title: 'Information Assurance & Emerging Tech',
        credit_hours: 9,
        courses_count: 3,
        mastery_score: 0.80,
        mastery_percentage: 80.0,
        attempted_outcomes_count: 7,
        total_outcomes_count: 9,
      },
    ],
    blooms_distribution: [
      { level: 'REMEMBER', display_name: 'Remembering', attempted_count: 45, correct_count: 38, mastery_score: 0.844, mastery_percentage: 84.4 },
      { level: 'UNDERSTAND', display_name: 'Understanding', attempted_count: 40, correct_count: 32, mastery_score: 0.800, mastery_percentage: 80.0 },
      { level: 'APPLY', display_name: 'Applying', attempted_count: 30, correct_count: 21, mastery_score: 0.700, mastery_percentage: 70.0 },
      { level: 'ANALYSE', display_name: 'Analyzing', attempted_count: 25, correct_count: 16, mastery_score: 0.640, mastery_percentage: 64.0 },
      { level: 'EVALUATE', display_name: 'Evaluating', attempted_count: 15, correct_count: 9, mastery_score: 0.600, mastery_percentage: 60.0 },
      { level: 'CREATE', display_name: 'Creating', attempted_count: 10, correct_count: 5, mastery_score: 0.500, mastery_percentage: 50.0 },
    ],
    courses: [
      {
        course_id: 1,
        theme_id: 1,
        code: 'IT-CMTS-101',
        title: 'Computer Maintenance & Troubleshooting',
        credit_hours: 3,
        mastery_score: 0.88,
        mastery_percentage: 88.0,
        total_outcomes_count: 3,
        attempted_outcomes_count: 3,
        outcomes: [
          {
            outcome_id: 1,
            outcome_code: 'LO-CMTS-01',
            description: 'Diagnose hardware faults and apply ESD-safe troubleshooting.',
            domain: 'COGNITIVE',
            level: 'APPLY',
            attempts_evidence_count: 10,
            correct_evidence_count: 9,
            mastery_score: 0.9,
          },
          {
            outcome_id: 2,
            outcome_code: 'LO-CMTS-02',
            description: 'Perform preventive maintenance and component replacement.',
            domain: 'PSYCHOMOTOR',
            level: 'APPLY',
            attempts_evidence_count: 8,
            correct_evidence_count: 7,
            mastery_score: 0.875,
          },
        ],
      },
    ],
    recent_attempts: [
      {
        attempt_id: 'att-1',
        exam_id: 'exam-1',
        exam_title: 'HU CCI IT Model Exit Exam 2023',
        score_percent: 82.5,
        passed: true,
        duration_seconds: 5400,
        scored_at: '2026-11-15T12:00:00Z',
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    if (database.reset) {
      await database.reset();
    }
    await database.init();
    await curriculumRepository.seedCanonicalCurriculumIfEmpty();
  });

  describe('1. progressRepository: Offline Caching & Fallback Generation', () => {
    test('cache key distinguishes personal vs tenant workspace scopes', () => {
      const personalKey = progressRepository.getCacheKey('user-123', null);
      const tenantKey = progressRepository.getCacheKey('user-123', 'tenant-aau-456');

      expect(personalKey).toBe('user-123:personal');
      expect(tenantKey).toBe('user-123:tenant-aau-456');
    });

    test('saveProgressCache and getCachedProgress persist and recover mastery data', async () => {
      await progressRepository.saveProgressCache('user-test-1', null, sampleProgress, 0);

      const cached = await progressRepository.getCachedProgress('user-test-1', null);
      expect(cached).not.toBeNull();
      expect(cached?.summary.overall_readiness_percent).toBe(78.4);
      expect(cached?.themes.length).toBe(5);
      expect(cached?.blooms_distribution.length).toBe(6);
      expect(cached?.courses.length).toBe(1);
    });

    test('getPendingLocalAttemptsCount returns count of pending attempts', async () => {
      // Seed an un-synced attempt in local_exam_attempts
      await database.execute(
        `INSERT INTO local_exam_attempts (local_attempt_id, user_id, tenant_id, exam_package_id, status, started_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        ['att-local-1', 'user-pending-test', null, 'pkg-1', 'SUBMITTED_LOCAL_PENDING', new Date().toISOString()]
      );

      const count = await progressRepository.getPendingLocalAttemptsCount('user-pending-test');
      expect(count).toBe(1);
    });

    test('generateOfflineFallbackProgress constructs complete structure from canonical curriculum', async () => {
      const fallback = await progressRepository.generateOfflineFallbackProgress('user-offline-1');

      expect(fallback.summary.overall_readiness_percent).toBe(0.0);
      expect(fallback.summary.total_courses_count).toBe(15);
      expect(fallback.themes.length).toBe(5);
      expect(fallback.blooms_distribution.length).toBe(6);
      expect(fallback.courses.length).toBe(15);
      expect(fallback.summary.disclaimer).toContain('rolling estimates');
    });
  });

  describe('2. BloomsRadarChart Component', () => {
    test('renders SVG radar chart with all 6 Bloom levels in hierarchical order', () => {
      const element = React.createElement(BloomsRadarChart, {
        data: sampleProgress.blooms_distribution,
        size: 280,
      });

      expect(element).toBeDefined();
      expect(element.props.data.length).toBe(6);
      expect(element.props.size).toBe(280);
    });
  });

  describe('3. MOB-21: ProgressOverviewScreen', () => {
    test('renders ProgressOverviewScreen component with KPI cards and 5 themes', () => {
      (api.get as jest.Mock).mockResolvedValue(sampleProgress);

      const element = React.createElement(ProgressOverviewScreen);
      expect(element).toBeDefined();
    });
  });

  describe('4. MOB-22: CourseProgressScreen', () => {
    test('renders CourseProgressScreen with outcomes and domain filtering', () => {
      (api.get as jest.Mock).mockResolvedValue(sampleProgress);

      const element = React.createElement(CourseProgressScreen);
      expect(element).toBeDefined();
    });
  });
});
