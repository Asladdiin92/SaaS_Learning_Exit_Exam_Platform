import React from 'react';

// 0. Mock react-native for Node.js test environment
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props),
    Text: (props: any) => React.createElement('Text', props),
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    Touchable: {
      Mixin: {},
    },
    StyleSheet: {
      create: (styles: any) => styles,
    },
    Platform: {
      OS: 'android',
      select: (obj: any) => obj.android || obj.default,
    },
  };
});

// 0b. Mock lucide-react-native for Node.js test environment
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

// 1. Mock expo-secure-store with in-memory map
const mockSecureStorage: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStorage[key] = value;
  }),
  getItemAsync: jest.fn(async (key: string) => {
    return mockSecureStorage[key] ?? null;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockSecureStorage[key];
  }),
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

// 2. Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-device-uuid-1234'),
}));

// 3. Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: { isConnectionExpensive: false },
  })),
}));

// 4. Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// 5. Mock Theme and Network hooks for pure Node testing
jest.mock('../shared/theme', () => ({
  useTheme: () => ({
    colors: require('../shared/theme/tokens').lightColors,
    typography: require('../shared/theme/typography').typography,
    spacing: require('../shared/theme/tokens').spacing,
    borderRadius: require('../shared/theme/tokens').borderRadius,
    isDark: false,
  }),
}));

import { secureStorage } from '../shared/secure-storage';
import { api, ApiClient, API_BASE_URL } from '../shared/api/client';
import {
  computeConnectionBannerState,
  formatSyncedTimestamp,
} from '../shared/components/ConnectionBanner';
import { verifyBackendReachability } from '../shared/network/NetworkContext';

describe('Day 4 Verification: Network Reachability & ConnectionBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockSecureStorage)) {
      delete mockSecureStorage[key];
    }
  });

  test('verifyBackendReachability returns true when /healthz is 200 OK', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'healthy' }),
    } as any);

    const reachable = await verifyBackendReachability('http://127.0.0.1:8000/healthz', 1000);
    expect(reachable).toBe(true);

    global.fetch = originalFetch;
  });

  test('verifyBackendReachability returns false on network timeout or 500 error', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection timed out'));

    const reachable = await verifyBackendReachability('http://127.0.0.1:8000/healthz', 1000);
    expect(reachable).toBe(false);

    global.fetch = originalFetch;
  });

  test('ConnectionBanner state collapses to 0dp when online, reachable, and 0 sync items', () => {
    const state = computeConnectionBannerState({
      isOnline: true,
      isReachable: true,
      syncQueueCount: 0,
      failedSyncCount: 0,
      grantExpiring: false,
    });

    expect(state.variant).toBe('COLLAPSED');
    expect(state.testID).toBe('banner-collapsed');
    expect(state.message).toBe('');
    expect(state.icon).toBeNull();
  });

  test('ConnectionBanner state renders OFFLINE_WITH_CACHE when device or backend is unreachable', () => {
    const state = computeConnectionBannerState({
      isOnline: false,
      isReachable: false,
      lastSyncedAt: '2026-11-14T10:30:00Z',
    });

    expect(state.variant).toBe('OFFLINE_WITH_CACHE');
    expect(state.testID).toBe('banner-offline');
    expect(state.icon).toBe('OFFLINE');
    expect(state.message).toContain('Offline mode — Showing content synced on');
  });

  test('ConnectionBanner state renders SYNCING when items are queued or in-flight', () => {
    const state = computeConnectionBannerState({
      isOnline: true,
      isReachable: true,
      syncQueueCount: 5,
      isSyncing: true,
    });

    expect(state.variant).toBe('SYNCING');
    expect(state.testID).toBe('banner-syncing');
    expect(state.icon).toBe('SYNC');
    expect(state.message).toBe('Syncing 5 item(s) with server...');
  });

  test('ConnectionBanner state renders GRANT_EXPIRING when offline license window is <24h', () => {
    const state = computeConnectionBannerState({
      isOnline: true,
      isReachable: true,
      grantExpiring: true,
    });

    expect(state.variant).toBe('GRANT_EXPIRING');
    expect(state.testID).toBe('banner-grant-expiring');
    expect(state.icon).toBe('CLOCK');
    expect(state.message).toBe(
      'Offline access grant expires in <24h — Connect to refresh'
    );
  });

  test('ConnectionBanner state renders SYNC_FAILED with highest priority when failedSyncCount > 0', () => {
    const state = computeConnectionBannerState({
      isOnline: true,
      isReachable: true,
      failedSyncCount: 2,
      syncQueueCount: 5,
      grantExpiring: true,
    });

    expect(state.variant).toBe('SYNC_FAILED');
    expect(state.testID).toBe('banner-sync-failed');
    expect(state.icon).toBe('ALERT');
    expect(state.message).toContain('2 sync item(s) need attention — Tap to open Sync Center');
  });

  test('ConnectionBanner state renders METERED_DATA_SAVER when dataSaverEnabled is active', () => {
    const state = computeConnectionBannerState({
      isOnline: true,
      isReachable: true,
      dataSaverEnabled: true,
    });

    expect(state.variant).toBe('METERED_DATA_SAVER');
    expect(state.testID).toBe('banner-data-saver');
    expect(state.icon).toBe('METERED');
    expect(state.message).toContain('Data Saver active — Large downloads require confirmation');
  });
});

describe('Day 4 Verification: Zero-Secret Keychain/Keystore & Volatile Memory Tokens', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockSecureStorage)) {
      delete mockSecureStorage[key];
    }
    await secureStorage.wipeAllSecrets();
  });

  test('15-minute access token is kept in volatile memory and never saved to SecureStore', async () => {
    secureStorage.setInMemoryAccessToken('volatile-jwt-access-token-15m');
    expect(secureStorage.getInMemoryAccessToken()).toBe('volatile-jwt-access-token-15m');

    // SecureStore must not contain the access token
    expect(mockSecureStorage['sec_auth_refresh_token']).toBeUndefined();
    expect(mockSecureStorage['volatile-jwt-access-token-15m']).toBeUndefined();

    secureStorage.clearInMemoryAccessToken();
    expect(secureStorage.getInMemoryAccessToken()).toBeNull();
  });

  test('Device ID is generated once and persisted across subsequent calls', async () => {
    const id1 = await secureStorage.getDeviceId();
    expect(id1).toBe('test-device-uuid-1234');
    expect(mockSecureStorage['sec_device_uuid']).toBe('test-device-uuid-1234');

    const id2 = await secureStorage.getDeviceId();
    expect(id2).toBe(id1);
  });

  test('Offline biometric grant validity check returns valid identity only before expiration', async () => {
    // 1. Unexpired grant
    const futureExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
    await secureStorage.setBiometricGrant({
      email: 'student@example.edu.et',
      fullName: 'Abebe Bikila',
      expiresAt: futureExpiry,
      tenantId: 'tenant-haramaya-uuid',
      tenantName: 'Haramaya University',
      biometric_enabled: true,
    });

    const check1 = await secureStorage.isOfflineGrantValid();
    expect(check1.valid).toBe(true);
    expect(check1.identity?.email).toBe('student@example.edu.et');

    // 2. Expired grant
    const pastExpiry = new Date(Date.now() - 3600 * 1000).toISOString();
    await secureStorage.setBiometricGrant({
      email: 'student@example.edu.et',
      fullName: 'Abebe Bikila',
      expiresAt: pastExpiry,
      tenantId: 'tenant-haramaya-uuid',
      tenantName: 'Haramaya University',
      biometric_enabled: true,
    });

    const check2 = await secureStorage.isOfflineGrantValid();
    expect(check2.valid).toBe(false);
    expect(check2.identity).toBeNull();
  });

  test('Wrapped AES-256 package keys are saved and deleted in SecureStore', async () => {
    await secureStorage.savePackageKey('res_note_01', 'aes_wrapped_key_base64_data');
    expect(await secureStorage.getPackageKey('res_note_01')).toBe('aes_wrapped_key_base64_data');

    await secureStorage.deletePackageKey('res_note_01');
    expect(await secureStorage.getPackageKey('res_note_01')).toBeNull();
  });
});

describe('Day 4 Verification: Typed API Client, Workspace Scoping & Single-Flight 401', () => {
  let client: ApiClient;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    originalFetch = global.fetch;
    for (const key of Object.keys(mockSecureStorage)) {
      delete mockSecureStorage[key];
    }
    client = new ApiClient();
    await secureStorage.saveRefreshToken('initial_valid_refresh_token');
    client.setAccessToken('expired_access_token');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('Workspace scoping attaches X-Tenant-ID header when set, omits it in Personal Workspace', async () => {
    let capturedHeaders: Record<string, string> = {};

    global.fetch = jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any;
    });

    // 1. Institutional Workspace Scoping
    client.setActiveTenantId('tenant-aau-uuid-456');
    await client.get('/curriculum/themes');
    expect(capturedHeaders['X-Tenant-ID']).toBe('tenant-aau-uuid-456');

    // 2. Personal Workspace Scoping (NULL activeTenantId -> header omitted)
    client.setActiveTenantId(null);
    await client.get('/curriculum/themes');
    expect(capturedHeaders['X-Tenant-ID']).toBeUndefined();
  });

  test('Mutating requests attach Idempotency-Key and X-Device-ID headers', async () => {
    let capturedHeaders: Record<string, string> = {};

    global.fetch = jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'new_attempt_id' }),
      } as any;
    });

    await client.post('/exams/exam-123/attempts', { answers: [] });
    expect(capturedHeaders['Idempotency-Key']).toBeDefined();
    expect(capturedHeaders['X-Device-ID']).toBe('test-device-uuid-1234');
  });

  test('Single-flight 401 interceptor rotates token once and replays concurrent in-flight requests', async () => {
    let refreshCallCount = 0;
    const requestAttempts: Record<string, number> = {
      req1: 0,
      req2: 0,
      req3: 0,
    };

    global.fetch = jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      // Refresh Endpoint
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        // Small delay to simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'new_refreshed_access_token_jwt',
            refresh_token: 'new_rotated_refresh_token_jwt',
          }),
        } as any;
      }

      // Protected Resource Endpoint
      const authHeader = (init?.headers as Record<string, string>)?.['Authorization'];
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const reqId = body.requestId || 'req1';
      requestAttempts[reqId] = (requestAttempts[reqId] || 0) + 1;

      if (authHeader === 'Bearer expired_access_token') {
        // Return 401 Unauthorized
        return {
          ok: false,
          status: 401,
          json: async () => ({ detail: 'Token expired' }),
        } as any;
      }

      if (authHeader === 'Bearer new_refreshed_access_token_jwt') {
        // Replayed request succeeds with new token!
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: `success for ${reqId}` }),
        } as any;
      }

      return {
        ok: false,
        status: 403,
        json: async () => ({ detail: 'Forbidden' }),
      } as any;
    });

    // Fire 3 simultaneous requests with the expired token
    const [res1, res2, res3] = await Promise.all([
      client.post('/protected-data', { requestId: 'req1' }),
      client.post('/protected-data', { requestId: 'req2' }),
      client.post('/protected-data', { requestId: 'req3' }),
    ]);

    expect(res1).toEqual({ data: 'success for req1' });
    expect(res2).toEqual({ data: 'success for req2' });
    expect(res3).toEqual({ data: 'success for req3' });

    // CRITICAL INVARIANT: Token refresh endpoint was called EXACTLY ONCE despite 3 concurrent 401s
    expect(refreshCallCount).toBe(1);

    // In-memory token updated to the new token
    expect(client.getAccessToken()).toBe('new_refreshed_access_token_jwt');

    // Rotated refresh token persisted to SecureStore
    expect(mockSecureStorage['sec_auth_refresh_token']).toBe('new_rotated_refresh_token_jwt');
  });
});
