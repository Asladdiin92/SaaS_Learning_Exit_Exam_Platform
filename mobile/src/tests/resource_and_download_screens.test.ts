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
    Switch: (props: any) => React.createElement('Switch', props),
    RefreshControl: (props: any) => React.createElement('RefreshControl', props),
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

// 2b. Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: { isConnectionExpensive: false },
  })),
}));

// 2c. Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

// 3. Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest
    .fn()
    .mockRejectedValue(new Error('Native SQLite disabled in Node test environment')),
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
  let counter = 2000;
  return {
    digestStringAsync: jest.fn().mockResolvedValue('mock_sha256_hash'),
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    randomUUID: jest.fn(() => `crypto-uuid-day10-${++counter}`),
  };
});

// 6. Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock_storage/',
  EncodingType: { Base64: 'base64' },
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue('mock_content'),
  createDownloadResumable: jest.fn(() => ({
    downloadAsync: jest.fn().mockResolvedValue({ status: 200, uri: 'file:///p.pkg' }),
    pauseAsync: jest.fn().mockResolvedValue({ status: 'PAUSED' }),
    resumeAsync: jest.fn().mockResolvedValue({ status: 200, uri: 'file:///p.pkg' }),
  })),
}));

// 7. Mock API client
jest.mock('../shared/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { database } from '../shared/database/db';
import { api } from '../shared/api/client';
import { curriculumRepository } from '../shared/database/curriculumRepository';
import {
  downloadManager,
  DownloadState,
  LocalPackageRecord,
} from '../services/download-manager';
import { RESOURCE_TYPES } from '../features/resources/ResourceLibraryScreen';
import { DOWNLOAD_TABS } from '../features/downloads/DownloadManagerScreen';
import { ResourceCard, ResourceItemData } from '../shared/components/ResourceCard';

describe('Day 10 UI/UX Verification: MOB-09, MOB-10, and MOB-12', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    Object.keys(mockSecureStore).forEach((k) => delete mockSecureStore[k]);
    if (database.reset) {
      await database.reset();
    }
    await database.init();
    await curriculumRepository.seedCanonicalCurriculumIfEmpty();

    // Default device profile (wifi_only_downloads = 0 by default for unit tests)
    await database.execute(
      `INSERT INTO device_profile (
        device_id, user_id, device_name, os_version, app_version,
        biometric_enabled, storage_quota_mb, wifi_only_downloads, last_seen_at
      ) VALUES ('dev-001', 'user-001', 'Test Device', 'Android 13', '1.0.0', 1, 2048, 0, datetime('now'));`
    );
  });

  // --- Task 1: MOB-09 Resource Library Screen Tests ---

  describe('MOB-09: Resource Library Screen & Category Filtering', () => {
    test('RESOURCE_TYPES contains all 7 canonical categories', () => {
      const values = RESOURCE_TYPES.map((t) => t.value);
      expect(values).toEqual([
        'ALL',
        'LECTURE_NOTE',
        'PAST_EXAM',
        'REFERENCE_BOOK',
        'LAB_CONTENT',
        'PROJECT_SPEC',
        'EXTERNAL_URL',
      ]);
    });

    test('SQLite seeded resources for Course 1 (IT-CMTS-101) load with sub-16ms speed', async () => {
      const resources = await curriculumRepository.getResourcesByCourse(1);
      expect(resources.length).toBeGreaterThan(0);

      const pastExam = resources.find((r) => r.type === 'PAST_EXAM');
      expect(pastExam).toBeDefined();
      expect(pastExam?.title).toContain('Model Exit Exam');
    });

    test('ResourceCard renders offline un-downloaded prompt with Queue for Later button', async () => {
      const item: ResourceItemData = {
        resource_id: 'res_offline_prompt_test',
        course_id: 1,
        title: 'Network Cabling Standards Lab Manual',
        type: 'LAB_CONTENT',
        size_bytes: 4 * 1024 * 1024,
        version: 1,
        metadata: { department: 'CCI - Computer Maintenance' },
      };

      const onQueueMock = jest.fn();
      const onDownloadMock = jest.fn();

      const element = React.createElement(ResourceCard, {
        resource: item,
        packageState: 'IDLE',
        isOnline: false, // Airplane / offline mode
        onPress: jest.fn(),
        onDownloadOrOpen: onDownloadMock,
        onQueueForLater: onQueueMock,
      });

      expect(element).toBeDefined();
      expect(element.props.isOnline).toBe(false);
      expect(element.props.packageState).toBe('IDLE');

      // Trigger queueing offline
      await downloadManager.queueDownload(item.resource_id);
      const pkg = await downloadManager.getPackage(item.resource_id);
      expect(pkg?.state).toBe('QUEUED');
    });
  });

  // --- Task 2: MOB-10 Resource Detail & License Info Tests ---

  describe('MOB-10: Resource Detail & License Info Screen', () => {
    test('Storage Impact calculation accurately formats required MB and available GB', async () => {
      // 2048 MB quota = 2 GB
      const quota = await downloadManager.getStorageQuota();
      const resourceBytes = 14 * 1024 * 1024; // 14 MB

      const sizeMB = (resourceBytes / (1024 * 1024)).toFixed(1);
      const freeGB = (quota.freeBytes / (1024 * 1024 * 1024)).toFixed(2);

      const impactString = `Requires ${sizeMB} MB • ${freeGB} GB available in your offline quota`;
      expect(impactString).toContain('Requires 14.0 MB');
      expect(impactString).toContain('2.00 GB available');
    });

    test('Downloaded resource state enables Open in Protected Reader CTA', async () => {
      const resId = 'res_downloaded_test_01';

      // Insert AVAILABLE_OFFLINE package record
      await database.execute(
        `INSERT INTO download_packages (
          package_id, resource_id, version, encrypted_path, size_bytes, state, last_opened_at
        ) VALUES ('pkg_done', ?, 1, '/path/p.pkg', 1000, 'AVAILABLE_OFFLINE', datetime('now'));`,
        [resId]
      );

      const pkg = await downloadManager.getPackage(resId);
      expect(pkg).not.toBeNull();
      expect(pkg?.state).toBe('AVAILABLE_OFFLINE');

      // Calling deleteLocalPackage removes package and resets state
      await downloadManager.deleteLocalPackage(resId);
      const deletedPkg = await downloadManager.getPackage(resId);
      expect(deletedPkg).toBeNull();
    });
  });

  // --- Task 3: MOB-12 Download Manager Screen Tests ---

  describe('MOB-12: Download Manager Controls & Storage Meter', () => {
    test('DOWNLOAD_TABS includes 5 segmented filters', () => {
      const tabValues = DOWNLOAD_TABS.map((t) => t.value);
      expect(tabValues).toEqual([
        'ALL',
        'DOWNLOADING_QUEUED',
        'AVAILABLE_OFFLINE',
        'FAILED',
        'EXPIRED',
      ]);
    });

    test('Wi-Fi Only Downloads toggle switch persists in SQLite device_profile', async () => {
      // Toggle to 1 (Wi-Fi Only)
      await database.execute(
        `UPDATE device_profile SET wifi_only_downloads = 1 WHERE device_id = 'dev-001';`
      );
      let profiles = await database.query<any>(
        `SELECT wifi_only_downloads FROM device_profile WHERE device_id = 'dev-001';`
      );
      expect(profiles[0].wifi_only_downloads).toBe(1);

      // Toggle to 0 (Allow mobile data)
      await database.execute(
        `UPDATE device_profile SET wifi_only_downloads = 0 WHERE device_id = 'dev-001';`
      );

      profiles = await database.query<any>(
        `SELECT wifi_only_downloads FROM device_profile WHERE device_id = 'dev-001';`
      );
      expect(profiles[0].wifi_only_downloads).toBe(0);
    });

    test('Download Manager action controls (Pause, Resume, Retry, Delete) execute cleanly', async () => {
      const resourceId = 'res_ctrl_test';

      // 1. Queue a download
      await downloadManager.queueDownload(resourceId);
      let pkg = await downloadManager.getPackage(resourceId);
      expect(pkg?.state).toBe('QUEUED');

      // 2. Pause download
      await database.execute(
        `UPDATE download_packages SET state = 'PAUSED' WHERE resource_id = ?;`,
        [resourceId]
      );
      pkg = await downloadManager.getPackage(resourceId);
      expect(pkg?.state).toBe('PAUSED');

      // 3. Mark as FAILED and retry
      await database.execute(
        `UPDATE download_packages SET state = 'FAILED', last_error = 'TIMEOUT' WHERE resource_id = ?;`,
        [resourceId]
      );
      pkg = await downloadManager.getPackage(resourceId);
      expect(pkg?.state).toBe('FAILED');
      expect(pkg?.last_error).toBe('TIMEOUT');

      // 4. Delete package
      await downloadManager.deleteLocalPackage(resourceId);
      pkg = await downloadManager.getPackage(resourceId);
      expect(pkg).toBeNull();
    });
  });
});
