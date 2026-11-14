import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  authService,
  UserSession,
  WorkspaceContext,
  LogoutResult,
  AuthState,
} from './authService';
import { BiometricGrant } from '../../shared/secure-storage';

export {
  authService,
  UserSession,
  WorkspaceContext,
  LogoutResult,
  AuthState,
};

export interface AuthContextType {
  isAuthenticated: boolean;
  isOfflineMode: boolean;
  user: UserSession | null;
  currentWorkspace: WorkspaceContext | null;
  workspaces: WorkspaceContext[];
  offlineGrant: BiometricGrant | null;
  isLoading: boolean;
  hasValidOfflineGrant: boolean;
  login: (email: string, password: string) => Promise<{ hasMultipleWorkspaces: boolean }>;
  signIn: (email: string, password: string) => Promise<{ hasMultipleWorkspaces: boolean }>;
  register: (fullName: string, email: string, password: string) => Promise<{ hasMultipleWorkspaces: boolean }>;
  unlockWithBiometrics: () => Promise<boolean>;
  unlockOfflineWithBiometrics: () => Promise<boolean>;
  switchWorkspace: (workspace: WorkspaceContext) => Promise<void>;
  logout: (force?: boolean) => Promise<LogoutResult>;
  refreshWorkspaces: () => Promise<void>;
}

const AuthSessionContext = createContext<AuthContextType | undefined>(undefined);

export const AuthSessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AuthState>(authService.getState());

  useEffect(() => {
    const unsubscribe = authService.subscribe((newState) => {
      setState(newState);
    });
    authService.init();

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ hasMultipleWorkspaces: boolean }> => {
    return authService.login(email, password);
  };

  const register = async (
    fullName: string,
    email: string,
    password: string
  ): Promise<{ hasMultipleWorkspaces: boolean }> => {
    return authService.register(fullName, email, password);
  };

  const unlockWithBiometrics = async (): Promise<boolean> => {
    return authService.unlockWithBiometrics();
  };

  const switchWorkspace = async (workspace: WorkspaceContext) => {
    return authService.switchWorkspace(workspace);
  };

  const refreshWorkspaces = async () => {
    return authService.refreshWorkspaces();
  };

  const logout = async (force = false): Promise<LogoutResult> => {
    return authService.logout(force);
  };

  return (
    <AuthSessionContext.Provider
      value={{
        isAuthenticated: state.isAuthenticated,
        isOfflineMode: state.isOfflineMode,
        user: state.user,
        currentWorkspace: state.currentWorkspace,
        workspaces: state.workspaces,
        offlineGrant: state.offlineGrant,
        isLoading: state.isLoading,
        hasValidOfflineGrant: state.hasValidOfflineGrant,
        login,
        signIn: login,
        register,
        unlockWithBiometrics,
        unlockOfflineWithBiometrics: unlockWithBiometrics,
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
