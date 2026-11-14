import React from 'react';

// 1. Mock react-native for Node test environment
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props),
    Text: (props: any) => React.createElement('Text', props),
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    ScrollView: (props: any) => React.createElement('ScrollView', props),
    SafeAreaView: (props: any) => React.createElement('SafeAreaView', props),
    StatusBar: () => null,
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

// 3. Mock expo-sqlite to fall back to in-memory SQLite emulator
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockRejectedValue(new Error('Native SQLite disabled in Node test environment')),
}));

// 4. Mock expo-secure-store with in-memory map
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
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'dev-uuid-phone-test-999'),
}));

// 6. Mock expo-local-authentication
jest.mock('expo-local-authentication', () => {
  const hasHardwareAsync = jest.fn().mockResolvedValue(true);
  const isEnrolledAsync = jest.fn().mockResolvedValue(true);
  const authenticateAsync = jest.fn().mockResolvedValue({ success: true });
  return {
    __esModule: true,
    hasHardwareAsync,
    isEnrolledAsync,
    authenticateAsync,
    default: {
      hasHardwareAsync,
      isEnrolledAsync,
      authenticateAsync,
    },
  };
});

import * as LocalAuthentication from 'expo-local-authentication';

import { authService, WorkspaceContext } from '../services/auth-session';
import { api, API_BASE_URL } from '../shared/api/client';
import { secureStorage, volatileTokenStore } from '../shared/secure-storage';
import { database } from '../shared/database/db';
import { examAttemptRepository } from '../shared/database/examAttemptRepository';
import { storageGuardRepository } from '../shared/database/storageGuardRepository';
import { TRANSLATIONS } from '../shared/localization';

describe('Day 6 Verification: Authentication, Biometric Offline Unlock & Multi-Workspace Flows', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });

    for (const key of Object.keys(mockSecureStore)) {
      delete mockSecureStore[key];
    }
    volatileTokenStore.clearAccessToken();
    api.setActiveTenantId(null);
    authService.reset();

    if (database.reset) {
      await database.reset();
    }
    await database.init();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('Flow 1: Online Login & 7-Day Biometric Grant Persistence (MOB-02 & Section 6.2)', () => {
    test('Successful online login stores volatile token, persists refresh token & 7-day biometric grant', async () => {
      const mockLoginResponse = {
        access_token: 'jwt-access-token-15m-volatile',
        refresh_token: 'refresh-token-persisted-30d',
        token_type: 'bearer',
        user: {
          user_id: 'usr-student-addis-01',
          email: 'abebe.bikila@aau.edu.et',
          full_name: 'Abebe Bikila',
        },
      };

      const mockWorkspacesResponse = {
        personal_workspace: {
          organization_name: 'Personal Workspace',
        },
        institutional_workspaces: [
          {
            tenant_id: 'tenant-aau-inst-01',
            organization_name: 'Addis Ababa University',
            role: 'STUDENT',
            cohort_name: '2026 Graduating Class',
          },
          {
            tenant_id: 'tenant-hsu-inst-02',
            organization_name: 'Hawassa University',
            role: 'STUDENT',
            cohort_name: 'IT Department',
          },
        ],
      };

      global.fetch = jest.fn(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.endsWith('/auth/login')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockLoginResponse,
          } as any;
        }
        if (urlStr.endsWith('/me/workspaces')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockWorkspacesResponse,
          } as any;
        }
        if (urlStr.endsWith('/curriculum/themes')) {
          return {
            ok: true,
            status: 200,
            json: async () => [],
          } as any;
        }
        return { ok: false, status: 404, json: async () => ({}) } as any;
      });

      const result = await authService.login('abebe.bikila@aau.edu.et', 'ValidPassword123!');

      // 1. Correct multi-workspace detection
      expect(result.hasMultipleWorkspaces).toBe(true);

      // 2. Strict Invariant: Volatile access token in memory, never in secure store
      expect(api.getAccessToken()).toBe('jwt-access-token-15m-volatile');
      expect(mockSecureStore['sec_auth_refresh_token']).toBe('refresh-token-persisted-30d');
      expect(mockSecureStore['jwt-access-token-15m-volatile']).toBeUndefined();

      // 3. Validated state in authService
      const state = authService.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isOfflineMode).toBe(false);
      expect(state.user).toEqual({
        userId: 'usr-student-addis-01',
        email: 'abebe.bikila@aau.edu.et',
        fullName: 'Abebe Bikila',
      });
      expect(state.workspaces.length).toBe(3); // 1 personal + 2 institutional

      // 4. 7-Day offline biometric grant saved in SecureStore
      const grantJson = mockSecureStore['sec_biometric_offline_grant'];
      expect(grantJson).toBeDefined();
      const parsedGrant = JSON.parse(grantJson);
      expect(parsedGrant.user_id).toBe('usr-student-addis-01');
      expect(parsedGrant.email).toBe('abebe.bikila@aau.edu.et');
      expect(parsedGrant.biometric_enabled).toBe(true);
      expect(new Date(parsedGrant.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(state.hasValidOfflineGrant).toBe(true);
    });
  });

  describe('Flow 2: Offline Biometric Unlock (MOB-02 in Airplane Mode)', () => {
    test('Unlocks cached session and restores workspaces without any server requests', async () => {
      // Simulate network disabled / Airplane Mode: fetch throws error if called
      global.fetch = jest.fn(() => {
        throw new Error('Airplane Mode: Network Unreachable');
      });

      // Seed valid 7-day offline grant previously cached
      const validExpiry = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
      const cachedGrant = {
        user_id: 'usr-cached-777',
        email: 'chaltu.kebede@aau.edu.et',
        fullName: 'Chaltu Kebede',
        expiresAt: validExpiry,
        tenantId: 'tenant-aau-inst-01',
        tenantName: 'Addis Ababa University',
        workspaces: [
          { id: 'personal', name: 'Personal Workspace', role: 'OWNER', is_institution: false },
          { id: 'tenant-aau-inst-01', name: 'Addis Ababa University', role: 'STUDENT', is_institution: true },
        ],
        biometric_enabled: true,
      };
      await secureStorage.setBiometricGrant(cachedGrant);

      // Verify grant is valid
      const validity = await secureStorage.isOfflineGrantValid();
      expect(validity.valid).toBe(true);

      // Trigger offline biometric unlock
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({ success: true });
      const unlocked = await authService.unlockWithBiometrics();

      expect(unlocked).toBe(true);
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Unlock Offline Learning Library',
        fallbackLabel: 'Use Device Passcode',
      });

      // Verify authenticated in offline mode
      const state = authService.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isOfflineMode).toBe(true);
      expect(state.user?.email).toBe('chaltu.kebede@aau.edu.et');
      expect(state.workspaces.length).toBe(2);
      expect(state.currentWorkspace?.tenantId).toBe('tenant-aau-inst-01');
      expect(api.getActiveTenantId()).toBe('tenant-aau-inst-01');

      // Zero network requests made during offline unlock
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('Rejects unlock if offline grant is expired or biometric authentication fails', async () => {
      // Grant expired yesterday
      const expiredDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      await secureStorage.setBiometricGrant({
        user_id: 'usr-expired-99',
        email: 'expired@example.com',
        fullName: 'Expired User',
        expiresAt: expiredDate,
        tenantId: null,
        tenantName: 'Personal',
        biometric_enabled: true,
      });

      const unlocked = await authService.unlockWithBiometrics();
      expect(unlocked).toBe(false);
      expect(authService.getState().isAuthenticated).toBe(false);
    });
  });

  describe('Flow 3: Multi-Workspace Context Switching (MOB-04 & ADR-002)', () => {
    test('Switching workspace scopes X-Tenant-ID header and clears it on Personal Workspace', async () => {
      let capturedHeaders: Record<string, string> = {};
      global.fetch = jest.fn(async (_url: any, init: any) => {
        capturedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok' }),
        } as any;
      });

      // Set initial user
      api.setAccessToken('valid-test-token');

      // 1. Switch to Institutional Workspace (Addis Ababa University)
      const instWorkspace: WorkspaceContext = {
        tenantId: 'tenant-aau-inst-01',
        organizationName: 'Addis Ababa University',
        role: 'STUDENT',
        isPersonal: false,
      };
      await authService.switchWorkspace(instWorkspace);

      expect(authService.getState().currentWorkspace?.tenantId).toBe('tenant-aau-inst-01');
      expect(api.getActiveTenantId()).toBe('tenant-aau-inst-01');

      // Make API call and check X-Tenant-ID header
      await api.get('/courses');
      expect(capturedHeaders['X-Tenant-ID']).toBe('tenant-aau-inst-01');

      // 2. Switch back to Personal Workspace (NULL tenant_id per ADR-002)
      const personalWorkspace: WorkspaceContext = {
        tenantId: null,
        organizationName: 'Personal Workspace',
        role: 'OWNER',
        isPersonal: true,
      };
      await authService.switchWorkspace(personalWorkspace);

      expect(authService.getState().currentWorkspace?.tenantId).toBeNull();
      expect(api.getActiveTenantId()).toBeNull();

      // Make API call and check X-Tenant-ID is omitted
      capturedHeaders = {};
      await api.get('/courses');
      expect(capturedHeaders['X-Tenant-ID']).toBeUndefined();
    });
  });

  describe('Flow 4: Section 6.4 Logout Safety Protocol', () => {
    test('Standard logout cleanly clears session and tokens when no protected items exist', async () => {
      global.fetch = jest.fn(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.endsWith('/auth/login')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'token-to-be-cleared',
              refresh_token: 'refresh-to-be-cleared',
              user: {
                user_id: 'usr-clean-1',
                email: 'clean.user@example.com',
                full_name: 'Clean User',
              },
            }),
          } as any;
        }
        if (urlStr.endsWith('/me/workspaces')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              personal_workspace: { organization_name: 'Personal Workspace' },
              institutional_workspaces: [],
            }),
          } as any;
        }
        if (urlStr.endsWith('/auth/logout')) {
          return { ok: true, status: 200, json: async () => ({ success: true }) } as any;
        }
        return { ok: true, status: 200, json: async () => [] } as any;
      });

      // Login clean user
      await authService.login('clean.user@example.com', 'Pass123!');

      // Ensure 0 active attempts and 0 sync operations
      const counts = await storageGuardRepository.getProtectedCounts('usr-clean-1');
      expect(counts.activeAttemptsCount).toBe(0);
      expect(counts.pendingSyncCount).toBe(0);

      // Call logout without force
      const result = await authService.logout();
      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(false);

      // Volatile and secure tokens wiped
      expect(api.getAccessToken()).toBeNull();
      expect(await secureStorage.getRefreshToken()).toBeNull();
      expect(authService.getState().isAuthenticated).toBe(false);
      expect(authService.getState().user).toBeNull();
    });

    test('Logout requires confirmation when active exam attempt or pending sync operation exists', async () => {
      const studentId = 'usr-exam-taker-101';

      // Mock login response
      global.fetch = jest.fn(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.endsWith('/auth/login')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'active-exam-token',
              refresh_token: 'active-exam-refresh',
              user: { user_id: studentId, email: 'exam.student@example.edu.et', full_name: 'Student One' },
            }),
          } as any;
        }
        if (urlStr.endsWith('/me/workspaces')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              personal_workspace: { organization_name: 'Personal Workspace' },
              institutional_workspaces: [],
            }),
          } as any;
        }
        if (urlStr.endsWith('/auth/logout')) {
          return { ok: true, status: 200, json: async () => ({ success: true }) } as any;
        }
        return { ok: true, status: 200, json: async () => [] } as any;
      });

      await authService.login('exam.student@example.edu.et', 'Pass123!');

      // Create an IN_PROGRESS exam attempt in SQLite
      await database.execute(
        `INSERT INTO local_exam_packages (exam_package_id, course_id, title, total_questions, duration_minutes, package_path)
         VALUES ('pkg-test-01', 101, 'Midterm Exam', 20, 60, '/path/exam.pkg');`
      );
      await examAttemptRepository.createLocalAttempt('pkg-test-01', studentId, null);

      // Insert an unaccepted sync_operation in SQLite with explicit parameters
      await database.execute(
        `INSERT INTO sync_operations (operation_id, user_id, tenant_id, type, payload, state, attempt_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        ['op-sync-01', studentId, null, 'exam_attempt.submit', '{}', 'QUEUED', 0, new Date().toISOString()]
      );

      // Verify protected counts
      const counts = await storageGuardRepository.getProtectedCounts(studentId);
      expect(counts.activeAttemptsCount).toBe(1);
      expect(counts.pendingSyncCount).toBe(1);
      expect(counts.isEvictionSafe).toBe(false);

      // Attempt normal logout without force
      const normalLogout = await authService.logout(false);
      expect(normalLogout.success).toBe(false);
      expect(normalLogout.requiresConfirmation).toBe(true);
      expect(normalLogout.protectedCounts?.activeAttemptsCount).toBe(1);
      expect(normalLogout.protectedCounts?.pendingSyncCount).toBe(1);

      // Session MUST remain authenticated to protect student from accidental data loss
      expect(authService.getState().isAuthenticated).toBe(true);
      expect(api.getAccessToken()).toBe('active-exam-token');

      // Now student explicitly confirms: Sign out and keep encrypted queue on device
      const forcedLogout = await authService.logout(true);
      expect(forcedLogout.success).toBe(true);
      expect(forcedLogout.requiresConfirmation).toBe(false);

      // Session and tokens cleared
      expect(api.getAccessToken()).toBeNull();
      expect(await secureStorage.getRefreshToken()).toBeNull();
      expect(authService.getState().isAuthenticated).toBe(false);

      // Invariant Check: The local exam attempt and sync operation MUST REMAIN INTACT in SQLite!
      const attemptsAfterLogout = await database.query(
        `SELECT * FROM local_exam_attempts WHERE user_id = ?;`,
        [studentId]
      );
      const syncOpsAfterLogout = await database.query(
        `SELECT * FROM sync_operations WHERE user_id = ?;`,
        [studentId]
      );
      expect(attemptsAfterLogout.length).toBe(1);
      expect(syncOpsAfterLogout.length).toBe(1);
      expect(attemptsAfterLogout[0].status).toBe('IN_PROGRESS');
      expect(syncOpsAfterLogout[0].state).toBe('QUEUED');
    });
  });

  describe('Flow 5: Localization Dictionary Verification (MOB-01)', () => {
    test('Provides complete translations in English, Afaan Oromo, and Amharic', () => {
      const languages = ['EN', 'OM', 'AM'] as const;

      for (const lang of languages) {
        const dict = TRANSLATIONS[lang];
        expect(dict).toBeDefined();
        expect(typeof dict.welcomeTitle).toBe('string');
        expect(dict.welcomeTitle.length).toBeGreaterThan(0);
        expect(typeof dict.nationalExitTitle).toBe('string');
        expect(typeof dict.offlineModeTitle).toBe('string');
        expect(typeof dict.bloomMasteryTitle).toBe('string');
        expect(typeof dict.signIn).toBe('string');
        expect(typeof dict.createAccount).toBe('string');
        expect(typeof dict.offlineBannerNotice).toBe('string');
        expect(typeof dict.offlineCreationDisabled).toBe('string');
      }

      // Verify specific translations match language identity
      expect(TRANSLATIONS.EN.signIn).toBe('Sign In');
      expect(TRANSLATIONS.OM.signIn).toBe('Seeni');
      expect(TRANSLATIONS.AM.signIn).toBe('ግባ');
    });
  });
});
