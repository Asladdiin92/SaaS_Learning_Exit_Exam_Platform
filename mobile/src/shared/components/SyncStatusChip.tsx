import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Cloud, CloudOff, AlertCircle } from 'lucide-react-native';

export type SyncState = 'online' | 'offline' | 'pending' | 'error';

interface SyncStatusChipProps {
  state: SyncState;
  pendingCount?: number;
  onPress?: () => void;
  testID?: string;
}

export const SyncStatusChip: React.FC<SyncStatusChipProps> = ({
  state,
  pendingCount = 0,
  onPress,
  testID = 'sync-status-chip',
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();

  const getStatusConfig = () => {
    switch (state) {
      case 'online':
        return {
          color: colors.status.online,
          label: 'Synced',
          icon: <Cloud size={16} color={colors.status.online} />,
        };
      case 'offline':
        return {
          color: colors.status.offline,
          label: pendingCount > 0 ? `${pendingCount} Queued` : 'Offline Mode',
          icon: <CloudOff size={16} color={colors.status.offline} />,
        };
      case 'error':
        return {
          color: colors.status.error,
          label: 'Sync Alert',
          icon: <AlertCircle size={16} color={colors.status.error} />,
        };
      default:
        return {
          color: colors.text.muted,
          label: 'Unknown',
          icon: <Cloud size={16} color={colors.text.muted} />,
        };
    }
  };

  const { color, label, icon } = getStatusConfig();

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${label}`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        styles.chipContainer,
        {
          backgroundColor: colors.surface.secondary,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.full,
        },
      ]}
    >
      <View style={styles.content}>
        {icon}
        <Text
          style={[
            typography.labelSm,
            { color, marginLeft: spacing.xxs + 2, fontWeight: '600' },
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chipContainer: {
    minHeight: 48, // 48dp minimum touch target invariant
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
});
