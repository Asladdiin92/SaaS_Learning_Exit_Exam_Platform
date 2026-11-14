import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Clock,
  Database,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '../theme';
import { useNetwork, NetworkState } from '../network/NetworkContext';

export type BannerVariant =
  | 'COLLAPSED'
  | 'OFFLINE_WITH_CACHE'
  | 'METERED_DATA_SAVER'
  | 'SYNCING'
  | 'SYNC_FAILED'
  | 'GRANT_EXPIRING';

export interface ConnectionBannerProps {
  syncQueueCount?: number;
  failedSyncCount?: number;
  isSyncing?: boolean;
  lastSyncedAt?: string | number | null;
  grantExpiring?: boolean;
  grantExpiresAt?: string | number | null;

  // Direct override props (for unit tests / explicit overrides)
  isOnline?: boolean;
  isReachable?: boolean;
  isMetered?: boolean;
  dataSaverEnabled?: boolean;

  onPressSyncCenter?: () => void;
  onPressRefreshGrant?: () => void;
  onPressDataSaver?: () => void;
}

export interface ComputedBannerState {
  variant: BannerVariant;
  message: string;
  icon: 'ALERT' | 'OFFLINE' | 'CLOCK' | 'SYNC' | 'METERED' | null;
  onPress?: () => void;
  testID: string;
}

export const formatSyncedTimestamp = (ts?: string | number | null): string => {
  if (!ts) return '';
  try {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(ts);
  }
};

/**
 * Pure state machine evaluator for ConnectionBanner (Section 6.2 & Section 7)
 */
export const computeConnectionBannerState = (
  props: ConnectionBannerProps,
  netInfo?: NetworkState
): ComputedBannerState => {
  const isOnline =
    props.isOnline !== undefined
      ? props.isOnline
      : (netInfo?.isOnline ?? true);

  const isReachable =
    props.isReachable !== undefined
      ? props.isReachable
      : (netInfo?.isReachable ?? true);

  const isMetered =
    props.isMetered !== undefined
      ? props.isMetered
      : (netInfo?.isMetered ?? false);

  const dataSaverEnabled =
    props.dataSaverEnabled !== undefined
      ? props.dataSaverEnabled
      : (netInfo?.dataSaverEnabled ?? false);

  const failedSyncCount = props.failedSyncCount ?? 0;
  const syncQueueCount = props.syncQueueCount ?? 0;
  const isSyncing = props.isSyncing ?? false;
  const grantExpiring = props.grantExpiring ?? false;

  // 1. Sync Failed / Needs Attention (Highest Severity)
  if (failedSyncCount > 0) {
    return {
      variant: 'SYNC_FAILED',
      message: `${failedSyncCount} sync item(s) need attention — Tap to open Sync Center`,
      icon: 'ALERT',
      onPress: props.onPressSyncCenter,
      testID: 'banner-sync-failed',
    };
  }

  // 2. Offline With Cache
  if (!isOnline || !isReachable) {
    const formatted = formatSyncedTimestamp(props.lastSyncedAt);
    const text = formatted
      ? `Offline mode — Showing content synced on ${formatted}`
      : 'Offline mode — Showing cached content';
    return {
      variant: 'OFFLINE_WITH_CACHE',
      message: text,
      icon: 'OFFLINE',
      onPress: undefined,
      testID: 'banner-offline',
    };
  }

  // 3. Grant Expiring Notice (<24h)
  if (grantExpiring) {
    return {
      variant: 'GRANT_EXPIRING',
      message: 'Offline access grant expires in <24h — Connect to refresh',
      icon: 'CLOCK',
      onPress: props.onPressRefreshGrant,
      testID: 'banner-grant-expiring',
    };
  }

  // 4. Syncing
  if (isSyncing || syncQueueCount > 0) {
    const count = syncQueueCount > 0 ? syncQueueCount : 1;
    return {
      variant: 'SYNCING',
      message: `Syncing ${count} item(s) with server...`,
      icon: 'SYNC',
      onPress: props.onPressSyncCenter,
      testID: 'banner-syncing',
    };
  }

  // 5. Metered / Data Saver Active
  if (dataSaverEnabled || isMetered) {
    return {
      variant: 'METERED_DATA_SAVER',
      message: 'Data Saver active — Large downloads require confirmation',
      icon: 'METERED',
      onPress: props.onPressDataSaver,
      testID: 'banner-data-saver',
    };
  }

  // 6. Online, reachable, 0 pending, no grant expiration -> Collapsed 0dp
  return {
    variant: 'COLLAPSED',
    message: '',
    icon: null,
    onPress: undefined,
    testID: 'banner-collapsed',
  };
};

export const ConnectionBanner: React.FC<ConnectionBannerProps> = (props) => {
  const theme = useTheme();
  const netInfo = useNetwork();

  const isDark = theme?.isDark ?? false;
  const typography = theme?.typography;
  const spacing = theme?.spacing ?? { md: 16, sm: 8 };

  const { variant, message, icon, onPress, testID } = useMemo(
    () => computeConnectionBannerState(props, netInfo),
    [props, netInfo]
  );

  if (variant === 'COLLAPSED') {
    return <View testID="banner-collapsed" style={styles.collapsed} />;
  }

  // Theme-aware WCAG AA colors
  const getBannerColors = () => {
    switch (variant) {
      case 'SYNC_FAILED':
        return isDark
          ? { bg: '#450A0A', text: '#FECACA', border: '#DC2626', icon: '#F87171' }
          : { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444', icon: '#DC2626' };
      case 'OFFLINE_WITH_CACHE':
      case 'GRANT_EXPIRING':
        return isDark
          ? { bg: '#451A03', text: '#FDE68A', border: '#B45309', icon: '#FBBF24' }
          : { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', icon: '#D97706' };
      case 'SYNCING':
      case 'METERED_DATA_SAVER':
      default:
        return isDark
          ? { bg: '#172554', text: '#BFDBFE', border: '#2563EB', icon: '#60A5FA' }
          : { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', icon: '#2563EB' };
    }
  };

  const colors = getBannerColors();

  const renderIcon = () => {
    switch (icon) {
      case 'ALERT':
        return <AlertTriangle size={18} color={colors.icon} style={styles.icon} />;
      case 'OFFLINE':
        return <WifiOff size={18} color={colors.icon} style={styles.icon} />;
      case 'CLOCK':
        return <Clock size={18} color={colors.icon} style={styles.icon} />;
      case 'SYNC':
        return props.isSyncing ? (
          <ActivityIndicator size="small" color={colors.icon} style={styles.icon} />
        ) : (
          <RefreshCw size={18} color={colors.icon} style={styles.icon} />
        );
      case 'METERED':
        return <Database size={18} color={colors.icon} style={styles.icon} />;
      default:
        return null;
    }
  };

  const content = (
    <View
      testID={testID}
      style={[
        styles.banner,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
      ]}
    >
      <View style={styles.textContainer}>
        {renderIcon()}
        <Text
          style={[
            typography?.labelSm,
            styles.message,
            { color: colors.text, fontWeight: '600' },
          ]}
          numberOfLines={2}
        >
          {message}
        </Text>
      </View>
      {onPress && (
        <View style={styles.arrowContainer}>
          <ChevronRight size={16} color={colors.icon} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={message}
        style={styles.touchable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  collapsed: {
    height: 0,
    overflow: 'hidden',
  },
  touchable: {
    minHeight: 48, // Minimum 48dp touch target
    justifyContent: 'center',
  },
  banner: {
    minHeight: 48,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  message: {
    flex: 1,
    lineHeight: 18,
  },
  arrowContainer: {
    marginLeft: 8,
    minWidth: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
