import React, { createContext, useContext, useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { api } from '../../shared/api/client';
import { secureStorage, BiometricGrant } from '../../shared/secure-storage';
import { curriculumRepository } from '../../shared/database/curriculumRepository';
import { database } from '../../shared/database/db';

export interface UserSession {
  userId: string;
  email: string;
  fullName: string;
}

export interface WorkspaceContext {
  tenantId: string | null;
  organizationName: string;
  role: string;
  isPersonal: boolean;
  cohortName?: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isOfflineMode: boolean;
  user: UserSession | null;
  currentWorkspace: WorkspaceContext | null;
  workspaces: WorkspaceContext[];
  offlineGrant: BiometricGrant | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  switchWorkspace: (workspace: WorkspaceContext) => Promise<void>;
  logout: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
}

const AuthSessionContext = createContext<AuthContextType | undefined>(undefined);

export const AuthSessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [user, setUser] = useState<UserSession | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceContext | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceContext[]>([]);
  const [offlineGrant, setOfflineGrant] = useState<BiometricGrant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize SQLite database and check stored credentials
  useEffect(() => {
    const bootstrap = async () => {
      try {
        await database.init();
        const grant = await secureStorage.getBiometricGrant();
        setOfflineGrant(grant);

        const refreshToken = await secureStorage.getRefreshToken();
        const savedTenantId = await secureStorage.getActiveTenantId();

        if (refreshToken) {
          // Attempt silent online refresh
          try {
            const deviceId = await secureStorage.getDeviceId();
            const res = await api.post('/auth/refresh', {
              refresh_token: refreshToken,
              device_id: deviceId,
            });

            api.setAccessToken(res.access_token);
            await secureStorage.saveRefreshToken(res.refresh_token);

            const sessionUser: UserSession = {
              userId: res.user.user_id,
              email: res.user.email,
              fullName: res.user.full_name,
            };
            setUser(sessionUser);
            setIsAuthenticated(true);
            setIsOfflineMode(false);

            // Fetch and set workspaces
            await loadWorkspaces(savedTenantId, sessionUser);
            // Cache curriculum to SQLite in background
            await cacheCurriculumSilently();
          } catch (e) {
            console.log('Online token refresh failed, offline grant available:', !!grant);
          }
        }
      } catch (err) {
        console.warn('Auth bootstrap error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  const cacheCurriculumSilently = async () => {
    try {
      const themes = await api.get('/curriculum/themes');
      if (Array.isArray(themes)) {
        await curriculumRepository.saveThemes(themes);
      }
    } catch (e) {
      console.log('Curriculum sync skipped (offline or network error):', e);
    }
  };

  const loadWorkspaces = async (
    targetTenantId: string | null,
    sessionUser: UserSession
  ) => {
    try {
      const data = await api.get('/me/workspaces');
      const list: WorkspaceContext[] = [
        {
          tenantId: null,
          organizationName: data.personal_workspace.organization_name,
          role: 'OWNER',
          isPersonal: true,
        },
        ...data.institutional_workspaces.map((w: any) => ({
          tenantId: w.tenant_id,
          organizationName: w.organization_name,
          role: w.role,
          isPersonal: false,
          cohortName: w.cohort_name,
        })),
      ];
      setWorkspaces(list);

      const matched = list.find((w) => w.tenantId === targetTenantId) || list[0];
      setCurrentWorkspace(matched);
      api.setActiveTenantId(matched.tenantId);
      await secureStorage.setActiveTenantId(matched.tenantId);

      // Save offline grant (valid for 7 days)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const grant: BiometricGrant = {
        email: sessionUser.email,
        fullName: sessionUser.fullName,
        expiresAt,
        tenantId: matched.tenantId,
        tenantName: matched.organizationName,
      };
      await secureStorage.setBiometricGrant(grant);
      setOfflineGrant(grant);
    } catch (e) {
      console.warn('Could not load online workspaces:', e);
    }
  };

  const login = async (email: string, password: string) => {
    const deviceId = await secureStorage.getDeviceId();
    const res = await api.post('/auth/login', {
      email,
      password,
      device_id: deviceId,
    });

    api.setAccessToken(res.access_token);
    await secureStorage.saveRefreshToken(res.refresh_token);

    const sessionUser: UserSession = {
      userId: res.user.user_id,
      email: res.user.email,
      fullName: res.user.full_name,
    };
    setUser(sessionUser);
    setIsAuthenticated(true);
    setIsOfflineMode(false);

    await loadWorkspaces(null, sessionUser);
    await cacheCurriculumSilently();
  };

  const register = async (fullName: string, email: string, password: string) => {
    const deviceId = await secureStorage.getDeviceId();
    const res = await api.post('/auth/register', {
      full_name: fullName,
      email,
      password,
      device_id: deviceId,
    });

    api.setAccessToken(res.access_token);
    await secureStorage.saveRefreshToken(res.refresh_token);

    const sessionUser: UserSession = {
      userId: res.user.user_id,
      email: res.user.email,
      fullName: res.user.full_name,
    };
    setUser(sessionUser);
    setIsAuthenticated(true);
    setIsOfflineMode(false);

    await loadWorkspaces(null, sessionUser);
    await cacheCurriculumSilently();
  };

  const unlockWithBiometrics = async (): Promise<boolean> => {
    if (!offlineGrant) return false;

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    let authSuccess = false;
    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Offline Learning Library',
        fallbackLabel: 'Use Device Passcode',
      });
      authSuccess = result.success;
    } else {
      // Direct pass for dev emulator testing when hardware sensor is unconfigured
      authSuccess = true;
    }

    if (authSuccess) {
      setUser({
        userId: 'offline-cached-user',
        email: offlineGrant.email,
        fullName: offlineGrant.fullName,
      });
      setCurrentWorkspace({
        tenantId: offlineGrant.tenantId,
        organizationName: offlineGrant.tenantName || 'Offline Workspace',
        role: 'STUDENT',
        isPersonal: !offlineGrant.tenantId,
      });
      setIsAuthenticated(true);
      setIsOfflineMode(true);
      return true;
    }

    return false;
  };

  const switchWorkspace = async (workspace: WorkspaceContext) => {
    setCurrentWorkspace(workspace);
    api.setActiveTenantId(workspace.tenantId);
    await secureStorage.setActiveTenantId(workspace.tenantId);
  };

  const refreshWorkspaces = async () => {
    if (user && !isOfflineMode) {
      await loadWorkspaces(currentWorkspace?.tenantId || null, user);
    }
  };

  const logout = async () => {
    try {
      const deviceId = await secureStorage.getDeviceId();
      if (!isOfflineMode && api.getAccessToken()) {
        await api.post('/auth/logout', { device_id: deviceId });
      }
    } catch (_) {}

    api.setAccessToken(null);
    api.setActiveTenantId(null);
    await secureStorage.clearRefreshToken();
    setUser(null);
    setCurrentWorkspace(null);
    setIsAuthenticated(false);
    setIsOfflineMode(false);
  };

  return (
    <AuthSessionContext.Provider
      value={{
        isAuthenticated,
        isOfflineMode,
        user,
        currentWorkspace,
        workspaces,
        offlineGrant,
        isLoading,
        login,
        register,
        unlockWithBiometrics,
        switchWorkspace,
        logout,
        refreshWorkspaces,
      }}
    >
      {children}
    </AuthSessionContext.Provider>
  );
};

export const useAuthSession = (): AuthContextType => {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error('useAuthSession must be used within an AuthSessionProvider');
  }
  return context;
};
