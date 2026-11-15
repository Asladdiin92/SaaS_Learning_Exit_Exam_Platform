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
    TextInput: (props: any) => React.createElement('TextInput', props),
    Platform: { OS: 'android', select: (obj: any) => obj.android || obj.default },
    StyleSheet: { create: (s: any) => s },
    Alert: { alert: jest.fn() },
    StatusBar: { setBarStyle: jest.fn() },
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
  openDatabaseAsync: jest.fn().mockRejectedValue(new Error('Native SQLite disabled in test environment')),
}));

// 4. Mock expo-crypto
jest.mock('expo-crypto', () => {
  let counter = 5000;
  return {
    randomUUID: jest.fn(() => `study-uuid-${++counter}`),
  };
});

import { database } from '../shared/database/db';
import {
  CANONICAL_STUDY_MATERIALS,
  CourseMaterialItem,
} from '../shared/database/courseStudyMaterials';

describe('Study Workspace & Digital Library (Offline Manuscripts & Distraction-Free Reader)', () => {
  beforeEach(async () => {
    if (database.reset) {
      await database.reset();
    }
    await database.init();
  });

  describe('Curriculum Study Manuscripts Baseline', () => {
    test('contains comprehensive manuscripts covering key exit exam courses', () => {
      expect(CANONICAL_STUDY_MATERIALS.length).toBeGreaterThanOrEqual(6);

      const codes = CANONICAL_STUDY_MATERIALS.map((m) => m.courseCode);
      expect(codes).toContain('IT-CMTS-101');
      expect(codes).toContain('IT-OOPR-202');
      expect(codes).toContain('IT-DSTR-204');
      expect(codes).toContain('IT-DBMS-301');
      expect(codes).toContain('IT-DCOM-205');
      expect(codes).toContain('IT-IASC-401');
    });

    test('each manuscript includes structured chapters, estimated read time, and diagnostic notes', () => {
      for (const item of CANONICAL_STUDY_MATERIALS) {
        expect(item.id).toMatch(/^mat_/);
        expect(item.readTimeMin).toBeGreaterThan(10);
        expect(item.chapters.length).toBeGreaterThanOrEqual(3);
        expect(item.markdown.length).toBeGreaterThan(500);

        for (const ch of item.chapters) {
          expect(ch.title).toBeTruthy();
          expect(ch.anchor).toBeTruthy();
        }
      }
    });

    test('IT-IASC-401 contains cryptography formulas and exit exam diagnostic tables', () => {
      const iasc = CANONICAL_STUDY_MATERIALS.find((m) => m.courseCode === 'IT-IASC-401');
      expect(iasc).toBeDefined();
      expect(iasc?.markdown).toContain('RSA Algorithm Mechanics');
      expect(iasc?.markdown).toContain('Feistel Network Architecture');
      expect(iasc?.chapters.length).toBe(5);
    });
  });

  describe('Search & Filter Engine', () => {
    test('filters manuscripts by theme number accurately', () => {
      const theme5Materials = CANONICAL_STUDY_MATERIALS.filter((m) => m.themeNumber === 5);
      expect(theme5Materials.length).toBe(2);
      expect(theme5Materials.map((m) => m.courseCode)).toEqual(
        expect.arrayContaining(['IT-DCOM-205', 'IT-IASC-401'])
      );
    });

    test('searches manuscripts across title, subtitle, and course code', () => {
      const query = 'cryptographic';
      const results = CANONICAL_STUDY_MATERIALS.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.subtitle.toLowerCase().includes(query) ||
          m.courseCode.toLowerCase().includes(query)
      );
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].courseCode).toBe('IT-IASC-401');
    });
  });

  describe('SQLite Bookmarking & Progress Persistence', () => {
    test('persists and retrieves study bookmarks in local_bookmarks', async () => {
      const materialId = 'mat_iasc_401';
      const userId = 'usr_student_test_1';
      const position = 'ch4';

      await database.execute(
        `INSERT OR REPLACE INTO local_bookmarks
         (bookmark_id, user_id, resource_id, page_or_position, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?);`,
        ['bmk_001', userId, materialId, position, new Date().toISOString(), 1]
      );

      const rows = await database.query<{ resource_id: string; page_or_position: string }>(
        `SELECT resource_id, page_or_position FROM local_bookmarks WHERE user_id = ?;`,
        [userId]
      );

      expect(rows.length).toBe(1);
      expect(rows[0].resource_id).toBe(materialId);
      expect(rows[0].page_or_position).toBe('ch4');
    });

    test('allows toggling bookmarks off idempotently', async () => {
      const materialId = 'mat_cmts_101';
      const userId = 'usr_student_test_1';

      await database.execute(
        `INSERT OR REPLACE INTO local_bookmarks
         (bookmark_id, user_id, resource_id, page_or_position, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?);`,
        ['bmk_002', userId, materialId, 'ch1', new Date().toISOString(), 1]
      );

      // Delete bookmark
      await database.execute(
        `DELETE FROM local_bookmarks WHERE user_id = ? AND resource_id = ?;`,
        [userId, materialId]
      );

      const rows = await database.query(
        `SELECT * FROM local_bookmarks WHERE user_id = ? AND resource_id = ?;`,
        [userId, materialId]
      );
      expect(rows.length).toBe(0);
    });
  });
});
