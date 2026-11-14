import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { API_BASE_URL } from '../api/client';

export interface NetworkState {
  isOnline: boolean;
  isReachable: boolean;
  isMetered: boolean;
  dataSaverEnabled: boolean;
  lastVerifiedOnlineAt: number | null;
  checkReachabilityNow: () => Promise<boolean>;
  setDataSaverEnabled?: (enabled: boolean) => void;
}

export const defaultNetworkState: NetworkState = {
  isOnline: true,
  isReachable: true,
  isMetered: false,
  dataSaverEnabled: false,
  lastVerifiedOnlineAt: null,
  checkReachabilityNow: async () => true,
};

const NetworkContext = createContext<NetworkState>(defaultNetworkState);

export const getHealthzUrl = (): string => {
  if (process.env.EXPO_PUBLIC_HEALTH_URL) {
    return process.env.EXPO_PUBLIC_HEALTH_URL;
  }
  // Strip trailing /api/v1 to hit root /healthz
  const root = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${root}/healthz`;
};

export const verifyBackendReachability = async (
  healthUrl = getHealthzUrl(),
  timeoutMs = 3000
): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response.ok;
  } catch (error) {
    clearTimeout(timer);
    return false;
  }
};

interface NetworkProviderProps {
  children: React.ReactNode;
  initialState?: Partial<NetworkState>;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({
  children,
  initialState,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    initialState?.isOnline ?? true
  );
  const [isReachable, setIsReachable] = useState<boolean>(
    initialState?.isReachable ?? true
  );
  const [isMetered, setIsMetered] = useState<boolean>(
    initialState?.isMetered ?? false
  );
  const [dataSaverEnabled, setDataSaverEnabled] = useState<boolean>(
    initialState?.dataSaverEnabled ?? false
  );
  const [lastVerifiedOnlineAt, setLastVerifiedOnlineAt] = useState<number | null>(
    initialState?.lastVerifiedOnlineAt ?? null
  );

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkReachabilityNow = useCallback(async (): Promise<boolean> => {
    // If device has no local network connection, immediately fail reachability
    const netState = await NetInfo.fetch();
    const linkUp = Boolean(netState.isConnected && netState.isInternetReachable !== false);

    if (!linkUp) {
      if (isMountedRef.current) {
        setIsOnline(false);
        setIsReachable(false);
      }
      return false;
    }

    const reachable = await verifyBackendReachability();
    if (isMountedRef.current) {
      setIsOnline(true);
      setIsReachable(reachable);
      if (reachable) {
        setLastVerifiedOnlineAt(Date.now());
      }
    }
    return reachable;
  }, []);

  useEffect(() => {
    const handleNetStateChange = async (state: NetInfoState) => {
      const linkUp = Boolean(state.isConnected && state.isInternetReachable !== false);
      const metered = Boolean(
        state.type === 'cellular' ||
          (state.details && (state.details as { isConnectionExpensive?: boolean }).isConnectionExpensive)
      );

      if (!isMountedRef.current) return;

      setIsOnline(linkUp);
      setIsMetered(metered);

      if (!linkUp) {
        setIsReachable(false);
        return;
      }

      // Link is up -> verify actual FastAPI backend reachability with 3s timeout
      const reachable = await verifyBackendReachability();
      if (!isMountedRef.current) return;

      setIsReachable(reachable);
      if (reachable) {
        setLastVerifiedOnlineAt(Date.now());
      }
    };

    const unsubscribe = NetInfo.addEventListener(handleNetStateChange);

    // Initial check
    checkReachabilityNow();

    return () => {
      unsubscribe();
    };
  }, [checkReachabilityNow]);

  const value: NetworkState = {
    isOnline,
    isReachable,
    isMetered,
    dataSaverEnabled: dataSaverEnabled || isMetered,
    lastVerifiedOnlineAt,
    checkReachabilityNow,
    setDataSaverEnabled,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkState => {
  return useContext(NetworkContext);
};
