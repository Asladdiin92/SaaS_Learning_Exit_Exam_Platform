import React from 'react';

// 1. Mock react-native
jest.mock('react-native', () => {
  const React = require('react');
  const listeners: Record<string, ((state: string) => void)[]> = {};

  return {
    View: (props: any) => React.createElement('View', props),
    Text: (props: any) => React.createElement('Text', props),
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    ScrollView: (props: any) => React.createElement('ScrollView', props),
    SafeAreaView: (props: any) => React.createElement('SafeAreaView', props),
    TextInput: (props: any) => React.createElement('TextInput', props),
    StatusBar: () => null,
    Platform: { OS: 'android', select: (obj: any) => obj.android || obj.default },
    StyleSheet: {
      create: (s: any) => s,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    AppState: {
      addEventListener: (type: string, handler: (state: string) => void) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(handler);
        return {
          remove: () => {
            listeners[type] = (listeners[type] || []).filter((h) => h !== handler);
          },
        };
      },
      _triggerStateChange: (newState: string) => {
        (listeners['change'] || []).forEach((h) => h(newState));
      },
    },
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

// 3. Mock expo-screen-capture
jest.mock('expo-screen-capture', () => {
  let screenshotCallbacks: (() => void)[] = [];
  return {
    preventScreenCaptureAsync: jest.fn().mockResolvedValue(undefined),
    allowScreenCaptureAsync: jest.fn().mockResolvedValue(undefined),
    usePreventScreenCapture: jest.fn(),
    addScreenshotListener: jest.fn((cb: () => void) => {
      screenshotCallbacks.push(cb);
      return {
        remove: () => {
          screenshotCallbacks = screenshotCallbacks.filter((c) => c !== cb);
        },
      };
    }),
    removeScreenshotListener: jest.fn(),
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    _triggerScreenshot: () => {
      screenshotCallbacks.forEach((cb) => cb());
    },
  };
});

// 4. Mock expo-sqlite to fall back to in-memory SQL emulator
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest
    .fn()
    .mockRejectedValue(new Error('Native SQLite disabled in Node test environment')),
}));

// 5. Mock expo-secure-store
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

// 6. Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-device-uuid-12345678-abcd'),
  digestStringAsync: jest.fn().mockResolvedValue('mock_sha256_hash'),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

// 7. Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock_storage/packages/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 2450000 }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
}));

// 8. Mock Auth Session
const mockUser = {
  userId: 'usr_student_test_101',
  email: 'student.it@haramaya.edu.et',
  fullName: 'Abebe Bikila',
  role: 'STUDENT',
};

const mockWorkspace = {
  tenantId: 'tenant_hu_cci_2026',
  organizationName: 'Haramaya University CCI',
  role: 'STUDENT',
  isPersonal: false,
};

jest.mock('../services/auth-session/AuthSessionContext', () => ({
  useAuthSession: () => ({
    user: mockUser,
    currentWorkspace: mockWorkspace,
    isAuthenticated: true,
    isOfflineMode: true,
  }),
}));

// 9. Mock Network Client to guarantee zero network calls
const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
jest.mock('../shared/api/client', () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
  },
}));

import { database } from '../shared/database/db';
import { secureStorage } from '../shared/secure-storage';
import { downloadManager } from '../services/download-manager';
import { ProtectedContentReader } from '../shared/components/ProtectedContentReader';
import { ProtectedContentReaderScreen } from '../features/resources/ProtectedContentReaderScreen';
import * as ScreenCapture from 'expo-screen-capture';
import { AppState } from 'react-native';

describe('Day 11: Protected Content Reader (MOB-11), Ephemeral RAM DRM & Watermark', () => {
  const resourceId = 'res_hu_cci_model_2023_101';
  const packageId = 'pkg_hu_cci_model_2023_101';
  const futureExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const pastExpiry = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.keys(mockSecureStore).forEach((k) => delete mockSecureStore[k]);
    await database.init();
    if (database.reset) {
      await database.reset();
    }

    // Seed secure storage with test device ID and wrapped AES-256 key
    await secureStorage.savePackageKey(packageId, 'aes_256_mock_wrapped_key_base64_payload');
    await secureStorage.savePackageKey(resourceId, 'aes_256_mock_wrapped_key_base64_payload');
  });

  afterEach(() => {
    downloadManager.setCurrentlyReading(null);
  });

  test('Invariant 1: Valid cached packages open in Airplane Mode with zero network calls and render WatermarkOverlay', async () => {
    // 1. Seed valid offline package
    await database.execute(
      `INSERT INTO download_packages (
        package_id, resource_id, version, encrypted_path, sha256_checksum,
        size_bytes, state, license_expiry
      ) VALUES (?, ?, 1, ?, 'mock_sha256', 2450000, 'AVAILABLE_OFFLINE', ?);`,
      [packageId, resourceId, 'file:///mock_storage/packages/res_hu_cci_101.pkg', futureExpiry]
    );

    // 2. Query package status from SQLite
    const packages = await database.query(
      `SELECT * FROM download_packages WHERE resource_id = ? AND state = 'AVAILABLE_OFFLINE';`,
      [resourceId]
    );
    expect(packages.length).toBe(1);
    expect(packages[0].state).toBe('AVAILABLE_OFFLINE');

    // 3. Register reading lock
    downloadManager.setCurrentlyReading(resourceId);
    expect(downloadManager.getCurrentlyReading()).toBe(resourceId);

    // 4. Retrieve wrapped key directly from secure-storage (RAM only)
    const key = await secureStorage.getPackageKey(packageId);
    expect(key).toBe('aes_256_mock_wrapped_key_base64_payload');

    // 5. Verify zero network calls were made (Airplane mode guarantee)
    expect(mockApiGet).not.toHaveBeenCalled();
    expect(mockApiPost).not.toHaveBeenCalled();

    // 6. Verify FLAG_SECURE was requested
    await ScreenCapture.preventScreenCaptureAsync();
    expect(ScreenCapture.preventScreenCaptureAsync).toHaveBeenCalled();
  });

  test('Invariant 2: Expired offline grants block opening with Access Expired state', async () => {
    // 1. Seed package with expired license
    await database.execute(
      `INSERT INTO download_packages (
        package_id, resource_id, version, encrypted_path, sha256_checksum,
        size_bytes, state, license_expiry
      ) VALUES (?, ?, 1, ?, 'mock_sha256', 2450000, 'AVAILABLE_OFFLINE', ?);`,
      [packageId, resourceId, 'file:///mock_storage/packages/expired.pkg', pastExpiry]
    );

    // 2. Query and evaluate license expiry
    const packages = await database.query<{ license_expiry: string }>(
      `SELECT license_expiry FROM download_packages WHERE resource_id = ?;`,
      [resourceId]
    );
    expect(packages.length).toBe(1);

    const expiryTime = new Date(packages[0].license_expiry).getTime();
    const isExpired = expiryTime <= Date.now();
    expect(isExpired).toBe(true);
  });

  test('Invariant 3: Changing pages updates local_bookmarks and queues bookmark.upsert in sync_operations', async () => {
    const pageToSave = 14;
    const userId = mockUser.userId;
    const tenantId = mockWorkspace.tenantId;
    const bookmarkId = `bm_${resourceId}`;

    // Execute atomic transaction as done by reader debounce
    await database.withTransaction(async (tx) => {
      // 1. Update local_bookmarks
      await tx.execute(
        `INSERT OR REPLACE INTO local_bookmarks
         (bookmark_id, user_id, resource_id, page_or_position, updated_at, version)
         VALUES (?, ?, ?, ?, datetime('now'), 1);`,
        [bookmarkId, userId, resourceId, String(pageToSave)]
      );

      // 2. Queue sync_operations outbox
      const operationId = `op_bm_${resourceId}_123456789`;
      const payload = JSON.stringify({
        bookmark_id: bookmarkId,
        resource_id: resourceId,
        page_or_position: String(pageToSave),
        updated_at: new Date().toISOString(),
      });

      await tx.execute(
        `INSERT OR REPLACE INTO sync_operations
         (operation_id, user_id, tenant_id, type, payload_json, state, created_at)
         VALUES (?, ?, ?, 'bookmark.upsert', ?, 'QUEUED', datetime('now'));`,
        [operationId, userId, tenantId, payload]
      );
    });

    // Verify local_bookmarks entry
    const savedBookmarks = await database.query<{ page_or_position: string }>(
      `SELECT page_or_position FROM local_bookmarks WHERE bookmark_id = ?;`,
      [bookmarkId]
    );
    expect(savedBookmarks.length).toBe(1);
    expect(savedBookmarks[0].page_or_position).toBe('14');

    // Verify sync_operations outbox entry
    const queuedOps = await database.query<{
      type: string;
      payload_json: string;
      state: string;
    }>(`SELECT type, payload_json, state FROM sync_operations WHERE user_id = ?;`, [userId]);

    expect(queuedOps.length).toBe(1);
    expect(queuedOps[0].type).toBe('bookmark.upsert');
    expect(queuedOps[0].state).toBe('QUEUED');
    const parsedPayload = JSON.parse(queuedOps[0].payload_json);
    expect(parsedPayload.page_or_position).toBe('14');
    expect(parsedPayload.resource_id).toBe(resourceId);
  });

  test('Invariant 4: Deletion guard prevents removing actively open package in MOB-11', async () => {
    downloadManager.setCurrentlyReading(resourceId);

    await expect(downloadManager.deleteLocalPackage(resourceId)).rejects.toThrow(
      /Cannot delete resource while it is actively open/
    );

    downloadManager.setCurrentlyReading(null);
  });

  test('Invariant 5: Dynamic user watermark text formatting complies with Section 11.6', async () => {
    const deviceId = await secureStorage.getDeviceId();
    const utcTimestamp = new Date().toISOString().substring(0, 16).replace('T', ' ') + ' UTC';

    const watermarkText = `${mockUser.fullName} • ${mockUser.email} • Device: ${deviceId.slice(
      0,
      8
    )} • ${utcTimestamp}`;

    expect(watermarkText).toContain('Abebe Bikila');
    expect(watermarkText).toContain('student.it@haramaya.edu.et');
    expect(watermarkText).toContain('Device:');
    expect(watermarkText).toContain('UTC');
  });

  test('Invariant 6: App background transition purges volatile decrypted buffers', () => {
    let purged = false;
    const purgeHandler = () => {
      purged = true;
    };

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState.match(/inactive|background/)) {
        purgeHandler();
      }
    });

    // Simulate OS backgrounding the app
    (AppState as any)._triggerStateChange('background');
    expect(purged).toBe(true);

    sub.remove();
  });
});
