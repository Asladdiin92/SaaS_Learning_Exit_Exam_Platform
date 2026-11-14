// 1. Mock react-native
jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (obj: any) => obj.android || obj.default },
}));

// 2. Mock expo-sqlite to use in-memory SQLite emulator
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest
    .fn()
    .mockRejectedValue(new Error('Native SQLite disabled in Node test environment')),
}));

// 3. Mock expo-secure-store
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

// 4. Mock expo-crypto
jest.mock('expo-crypto', () => {
  let counter = 5000;
  return {
    digestStringAsync: jest.fn().mockImplementation(async (_algo: any, text: string) => {
      if (text.includes('corrupted_content')) {
        return 'bad_checksum_hash_' + '0'.repeat(46);
      }
      return 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef';
    }),
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    randomUUID: jest.fn(() => `mock-uuid-${++counter}`),
  };
});

// 5. Mock expo-file-system
let mockDownloadProgressCb: ((p: any) => void) | null = null;
const mockDownloadAsync = jest.fn();
const mockPauseAsync = jest.fn();
const mockResumeAsync = jest.fn();
const mockDeleteAsync = jest.fn().mockResolvedValue(undefined);
const mockReadAsStringAsync = jest.fn().mockResolvedValue('valid_package_payload_base64');

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock_storage/',
  EncodingType: { Base64: 'base64' },
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: (...args: any[]) => mockDeleteAsync(...args),
  readAsStringAsync: (...args: any[]) => mockReadAsStringAsync(...args),
  createDownloadResumable: jest.fn((url: string, path: string, options: any, onProgress: any) => {
    mockDownloadProgressCb = onProgress;
    return {
      downloadAsync: () => mockDownloadAsync(),
      pauseAsync: () => mockPauseAsync(),
      resumeAsync: () => mockResumeAsync(),
    };
  }),
}));

// 6. Mock API client
jest.mock('../shared/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { database } from '../shared/database/db';
import { api } from '../shared/api/client';
import { secureStorage } from '../shared/secure-storage';
import {
  downloadManager,
  DownloadState,
  DownloadGrant,
} from '../services/download-manager';

describe('Day 9 Mobile Verification: DownloadManagerService & DRM Invariants', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    Object.keys(mockSecureStore).forEach((k) => delete mockSecureStore[k]);
    if (database.reset) {
      await database.reset();
    }
    await database.init();
    downloadManager.setCurrentlyReading(null);

    // Default download mocks
    mockDownloadAsync.mockImplementation(async () => {
      if (mockDownloadProgressCb) {
        mockDownloadProgressCb({
          totalBytesWritten: 10 * 1024 * 1024,
          totalBytesExpectedToWrite: 10 * 1024 * 1024,
        });
      }
      return { status: 200, uri: 'file:///mock_storage/downloaded.pkg' };
    });
    mockPauseAsync.mockResolvedValue({
      status: 'PAUSED',
      resumeData: 'mock_resume_token',
    });
    mockResumeAsync.mockImplementation(async () => {
      if (mockDownloadProgressCb) {
        mockDownloadProgressCb({
          totalBytesWritten: 10 * 1024 * 1024,
          totalBytesExpectedToWrite: 10 * 1024 * 1024,
        });
      }
      return { status: 200, uri: 'file:///mock_storage/downloaded.pkg' };
    });

    // Default device profile: 2048 MB quota, Wi-Fi only disabled for normal tests
    await database.execute(
      `INSERT INTO device_profile (
        device_id, user_id, device_name, os_version, app_version,
        biometric_enabled, storage_quota_mb, wifi_only_downloads, last_seen_at
      ) VALUES ('dev-001', 'user-001', 'Galaxy A04s', 'Android 13', '1.0.0', 1, 2048, 0, datetime('now'));`
    );
  });

  // --- Task 1 & Task 2: State Machine & Checksum Verification ---

  test('Full state machine progression: NOT_DOWNLOADED -> QUEUED -> DOWNLOADING -> VERIFYING_CHECKSUM -> AVAILABLE_OFFLINE', async () => {
    const resourceId = 'res_hu_model_exam_pdf';
    const expectedSha256 =
      'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef';
    const secretAesKey = 'aes-256-mock-secret-key-bytes-strictly-in-keychain';

    // Mock API grant response matching backend DownloadGrantResponse
    (api.post as jest.Mock).mockResolvedValueOnce({
      grant_id: 'grant_99182',
      resource_id: resourceId,
      package_id: 'pkg_hu_exit_exam',
      course_id: 1,
      version: 2,
      title: 'Haramaya University Model Exit Exam 2026',
      type: 'PAST_EXAM',
      storage_bucket: 'course-packages',
      storage_object_key: `resources/${resourceId}/v2.pkg`,
      download_url: `https://storage.example.com/packages/${resourceId}.pkg`,
      file_size_bytes: 10 * 1024 * 1024,
      sha256_checksum: expectedSha256,
      ephemeral_aes_key_b64: secretAesKey,
      wrapped_aes_key: secretAesKey,
      license_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      license_expiry: new Date(Date.now() + 7 * 86400000).toISOString(),
      watermark: {
        user_id: 'user-001',
        email: 'student@example.edu.et',
        full_name: 'Student Exit Candidate',
        tenant_id: null,
        device_id: 'dev-001',
        issued_at: new Date().toISOString(),
        formatted_watermark: 'Student Candidate • dev-001',
      },
    } as DownloadGrant);

    // Track state transitions observed by listeners
    const recordedStates: DownloadState[] = [];
    const unsub = downloadManager.onStateChange((resId, state) => {
      if (resId === resourceId) {
        recordedStates.push(state);
      }
    });

    // Execute download
    await downloadManager.startDownload(resourceId);
    unsub();

    // Verify state progression sequence
    expect(recordedStates).toEqual(
      expect.arrayContaining(['QUEUED', 'DOWNLOADING', 'VERIFYING_CHECKSUM', 'AVAILABLE_OFFLINE'])
    );

    // Verify SQLite local record
    const pkg = await downloadManager.getPackage(resourceId);
    expect(pkg).not.toBeNull();
    expect(pkg?.state).toBe('AVAILABLE_OFFLINE');
    expect(pkg?.size_bytes).toBe(10 * 1024 * 1024);
    expect(pkg?.version).toBe(2);
    expect(pkg?.last_error).toBeNull();

    // Verify DRM Invariant: Secret AES key was stored in SecureStore and NEVER written to SQLite
    const storedKey = await secureStorage.getPackageKey('pkg_hu_exit_exam');
    expect(storedKey).toBe(secretAesKey);

    const rawRows = await database.query<any>(
      `SELECT * FROM download_packages WHERE resource_id = ?`,
      [resourceId]
    );
    expect(rawRows.length).toBe(1);
    expect(JSON.stringify(rawRows[0])).not.toContain(secretAesKey);
  });

  test('Checksum failure triggers file deletion, sets state = FAILED, and records last_error = CHECKSUM_MISMATCH', async () => {
    const resourceId = 'res_corrupt_payload';
    const expectedHash = '1111111111111111111111111111111111111111111111111111111111111111';

    // Mock API grant expecting hash 11111111...
    (api.post as jest.Mock).mockResolvedValueOnce({
      grant_id: 'grant_corrupt',
      resource_id: resourceId,
      package_id: 'pkg_corrupt',
      course_id: 1,
      version: 1,
      title: 'Corrupted Package',
      type: 'LECTURE_NOTE',
      storage_bucket: 'course-packages',
      storage_object_key: `resources/${resourceId}/v1.pkg`,
      download_url: 'https://storage.example.com/corrupt.pkg',
      file_size_bytes: 4 * 1024 * 1024,
      sha256_checksum: expectedHash,
      ephemeral_aes_key_b64: 'some-key',
      wrapped_aes_key: 'some-key',
      license_expiry: new Date().toISOString(),
      watermark: {} as any,
    });

    // Mock file content that triggers mismatched computed hash
    mockReadAsStringAsync.mockResolvedValueOnce('corrupted_content_bytes');

    const states: DownloadState[] = [];
    downloadManager.onStateChange((resId, state) => {
      if (resId === resourceId) states.push(state);
    });

    // Start download must reject with checksum mismatch
    await expect(downloadManager.startDownload(resourceId)).rejects.toThrow(
      /CHECKSUM_MISMATCH/
    );

    // Corrupt file must have been deleted immediately from sandbox storage
    expect(mockDeleteAsync).toHaveBeenCalledWith(
      expect.stringContaining(`${resourceId}_v1.pkg`),
      { idempotent: true }
    );

    // Database state must be FAILED with last_error = 'CHECKSUM_MISMATCH'
    const pkg = await downloadManager.getPackage(resourceId);
    expect(pkg?.state).toBe('FAILED');
    expect(pkg?.last_error).toBe('CHECKSUM_MISMATCH');
    expect(states).toContain('FAILED');
  });

  test('Pause and resume preserves download state and transitions to DOWNLOADING', async () => {
    const resourceId = 'res_pausable_video';

    (api.post as jest.Mock).mockResolvedValue({
      grant_id: 'grant_pause',
      resource_id: resourceId,
      package_id: 'pkg_pausable',
      course_id: 2,
      version: 1,
      title: 'Pausable Resource',
      type: 'LECTURE_NOTE',
      storage_bucket: 'course-packages',
      storage_object_key: 'p.pkg',
      download_url: 'https://storage.example.com/p.pkg',
      file_size_bytes: 12 * 1024 * 1024,
      sha256_checksum: null,
      ephemeral_aes_key_b64: 'key-p',
      wrapped_aes_key: 'key-p',
      license_expiry: new Date().toISOString(),
      watermark: {} as any,
    });

    let triggerPause: (() => void) | null = null;
    mockDownloadAsync.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        triggerPause = resolve;
      });
      return { status: 200, uri: 'https://storage.example.com/p.pkg' };
    });

    // Start download
    const dlPromise = downloadManager.startDownload(resourceId);
    // Yield to allow startDownload to proceed past initial grant API call into activeDownloads
    await new Promise((r) => setTimeout(r, 10));
    // Pause while in flight
    await downloadManager.pauseDownload(resourceId);

    expect(mockPauseAsync).toHaveBeenCalled();
    const pausedPkg = await downloadManager.getPackage(resourceId);
    expect(pausedPkg?.state).toBe('PAUSED');

    // Unblock the initial promise and handle pause
    if (triggerPause) (triggerPause as any)();
    await dlPromise.catch(() => {});

    // Resume download
    await downloadManager.resumeDownload(resourceId);
    expect(mockResumeAsync).toHaveBeenCalled();
  });

  // --- Task 1: Pre-flight Quota & Wi-Fi Checks ---

  test('Storage quota pre-flight rejects oversized downloads and emits STORAGE_FULL with exact MB needed', async () => {
    // Set device quota to 100 MB
    await database.execute(
      `UPDATE device_profile SET storage_quota_mb = 100 WHERE device_id = 'dev-001';`
    );

    // Seed existing downloaded packages using 90 MB
    await database.execute(
      `INSERT INTO download_packages (
        package_id, resource_id, version, encrypted_path, size_bytes, state, last_opened_at
      ) VALUES ('pkg_existing', 'res_existing', 1, '/storage/e.pkg', ?, 'AVAILABLE_OFFLINE', datetime('now'));`,
      [90 * 1024 * 1024]
    );

    // Seed target resource metadata in local_resources
    await database.execute(
      `INSERT INTO local_resources (
        resource_id, course_id, type, title, size_bytes, access_state, version
      ) VALUES ('res_huge', 1, 'LECTURE_NOTE', 'Huge Package', ?, 'AVAILABLE', 1);`,
      [25 * 1024 * 1024]
    );

    // Target resource requires 25 MB. 90 MB + 25 MB = 115 MB > 100 MB (15 MB over quota)
    const checkResult = await downloadManager.checkPreflight(
      'res_huge',
      25 * 1024 * 1024
    );

    expect(checkResult.allowed).toBe(false);
    expect(checkResult.reason).toBe('STORAGE_FULL');
    expect(checkResult.mbNeeded).toBe(15);
    expect(checkResult.errorMessage).toContain('Free up at least 15 MB to continue');

    // Attempting startDownload must throw STORAGE_FULL error
    await expect(
      downloadManager.startDownload('res_huge')
    ).rejects.toThrow(/STORAGE_FULL/);
  });

  test('Wi-Fi only / Data Saver pre-flight blocks metered transfer unless explicitly permitted', async () => {
    // Enable Wi-Fi only downloads on device profile
    await database.execute(
      `UPDATE device_profile SET wifi_only_downloads = 1 WHERE device_id = 'dev-001';`
    );

    // 1. Without allowMetered on metered link: must return WAITING_FOR_WIFI
    const meteredCheck = await downloadManager.checkPreflight(
      'res_metered_test',
      5 * 1024 * 1024,
      { isMetered: true, allowMetered: false }
    );
    expect(meteredCheck.allowed).toBe(false);
    expect(meteredCheck.reason).toBe('WAITING_FOR_WIFI');

    // 2. queueDownload queues in QUEUED_WAITING_FOR_WIFI state
    const queuedState = await downloadManager.queueDownload('res_metered_test', {
      isMetered: true,
      allowMetered: false,
    });
    expect(queuedState).toBe('QUEUED_WAITING_FOR_WIFI');

    const pkg = await downloadManager.getPackage('res_metered_test');
    expect(pkg?.state).toBe('QUEUED_WAITING_FOR_WIFI');

    // 3. User explicitly confirms metered transfer: must be allowed
    const allowedCheck = await downloadManager.checkPreflight(
      'res_metered_test',
      5 * 1024 * 1024,
      { isMetered: true, allowMetered: true }
    );
    expect(allowedCheck.allowed).toBe(true);
  });

  // --- Task 3: Deletion & Eviction Guards ---

  test('Active-Session Deletion Guard blocks deleting resource open in reader (MOB-11)', async () => {
    const resourceId = 'res_reading_in_progress';
    await database.execute(
      `INSERT INTO download_packages (
        package_id, resource_id, version, encrypted_path, size_bytes, state, last_opened_at
      ) VALUES ('pkg_read', ?, 1, '/storage/r.pkg', 1000, 'AVAILABLE_OFFLINE', datetime('now'));`,
      [resourceId]
    );

    // Mark as open in reader
    downloadManager.setCurrentlyReading(resourceId);

    await expect(downloadManager.deleteLocalPackage(resourceId)).rejects.toThrow(
      /Cannot delete resource while it is actively open in the Protected Content Reader/
    );

    // LRU eviction must also skip this actively open package
    const freed = await downloadManager.cleanLruCache();
    expect(freed).toBe(0);

    // Close reader: deletion now succeeds
    downloadManager.setCurrentlyReading(null);
    await expect(downloadManager.deleteLocalPackage(resourceId)).resolves.not.toThrow();
  });

  test('Protected Exam Invariant (ADR-005) blocks deletion of package referenced by IN_PROGRESS attempt', async () => {
    const examResourceId = 'exam_hu_exit_simulation_100q';
    const examPackageId = 'lep_hu_exit_pkg_001';

    // 1. Seed exam package & active attempt
    await database.execute(
      `INSERT INTO local_exam_packages (
        exam_package_id, exam_id, course_id, blueprint_version, question_snapshot_json, duration_sec, state
      ) VALUES (?, ?, 1, 1, '[]', 7200, 'READY');`,
      [examPackageId, examResourceId]
    );

    await database.execute(
      `INSERT INTO local_exam_attempts (
        local_attempt_id, user_id, exam_package_id, status, started_at
      ) VALUES ('attempt-active-001', 'user-001', ?, 'IN_PROGRESS', datetime('now'));`,
      [examPackageId]
    );

    await database.execute(
      `INSERT INTO download_packages (
        package_id, resource_id, version, encrypted_path, size_bytes, state, last_opened_at
      ) VALUES ('pkg_exam', ?, 1, '/storage/exam.pkg', 5000000, 'AVAILABLE_OFFLINE', datetime('now'));`,
      [examResourceId]
    );

    // 2. Direct deletion must reject with Protected Exam Invariant error
    await expect(
      downloadManager.deleteLocalPackage(examResourceId)
    ).rejects.toThrow(
      /Protected Exam Invariant: Cannot remove package referenced by an in-progress or unsynced exam attempt/
    );

    // 3. LRU cleanup must protect and skip active exam package
    const freed = await downloadManager.cleanLruCache();
    expect(freed).toBe(0);

    const remainingPkg = await downloadManager.getPackage(examResourceId);
    expect(remainingPkg).not.toBeNull();
    expect(remainingPkg?.state).toBe('AVAILABLE_OFFLINE');
  });

  test('Storage quota calculation reports downloaded, queued, and free bytes accurately', async () => {
    // 2048 MB quota = 2,147,483,648 bytes
    await database.execute(
      `INSERT INTO download_packages (package_id, resource_id, version, encrypted_path, size_bytes, state)
       VALUES ('pkg_done', 'res_done', 1, '/p1', 50000000, 'AVAILABLE_OFFLINE');`
    );
    await database.execute(
      `INSERT INTO download_packages (package_id, resource_id, version, encrypted_path, size_bytes, state)
       VALUES ('pkg_q', 'res_q', 1, '/p2', 20000000, 'QUEUED');`
    );

    const quota = await downloadManager.getStorageQuota();
    expect(quota.downloadedBytes).toBe(50000000);
    expect(quota.protectedExamQueueBytes).toBe(20000000);
    expect(quota.totalBytes).toBe(2048 * 1024 * 1024);
    expect(quota.freeBytes).toBe(2048 * 1024 * 1024 - 70000000);
  });
});
