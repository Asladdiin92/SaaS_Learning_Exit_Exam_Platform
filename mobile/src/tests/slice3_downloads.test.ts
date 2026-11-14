jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock_docs/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  createDownloadResumable: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockResolvedValue('mock_hash_64'),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

jest.mock('../shared/database/db', () => ({
  database: {
    init: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../shared/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../shared/secure-storage', () => ({
  secureStorage: {
    getDeviceId: jest.fn().mockResolvedValue('device-123'),
  },
}));

import { downloadManager } from '../services/download-manager';

describe('Slice 3 — Download Manager & Protected Content DRM Invariants', () => {
  test('Active reading session registers lock on package', async () => {
    downloadManager.setCurrentlyReading('res_protected_123');
    // Attempting to delete the actively open resource must reject with safety error
    await expect(downloadManager.deleteLocalPackage('res_protected_123')).rejects.toThrow(
      /Cannot delete resource while it is actively open/
    );
    downloadManager.setCurrentlyReading(null);
  });

  test('Storage quota calculation initializes with 2GB default quota', async () => {
    const quota = await downloadManager.getStorageQuota();
    expect(quota.totalBytes).toBe(2048 * 1024 * 1024);
    expect(quota.freeBytes).toBeGreaterThanOrEqual(0);
  });
});
