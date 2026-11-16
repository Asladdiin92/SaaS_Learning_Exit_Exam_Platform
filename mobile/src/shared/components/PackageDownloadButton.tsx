import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme';
import { DownloadState } from '../../services/download-manager/types';
import {
  Download,
  CheckCircle2,
  Play,
  Pause,
  AlertCircle,
  Lock,
  Clock,
  AlertTriangle,
} from 'lucide-react-native';

export type DeterministicPackageState =
  | 'LOCKED'
  | 'ELIGIBLE'
  | 'QUEUED'
  | 'DOWNLOADING'
  | 'PAUSED'
  | 'AVAILABLE_OFFLINE'
  | 'EXPIRED'
  | 'FAILED'
  | 'IDLE';

interface PackageDownloadButtonProps {
  state: DeterministicPackageState | DownloadState;
  sizeBytes: number;
  progress?: number; // 0.0 to 1.0
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

export const PackageDownloadButton: React.FC<PackageDownloadButtonProps> = ({
  state,
  sizeBytes,
  progress = 0,
  onPress,
  disabled = false,
  testID = 'package-download-button',
  variant = 'primary',
}) => {
  const { colors, typography, isDark } = useTheme();

  const toMB = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0.0';
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  // 1. LOCKED
  if (state === 'LOCKED') {
    return (
      <View
        testID={testID}
        style={[
          styles.container,
          {
            backgroundColor: colors.surface.secondary,
            borderColor: colors.border.default,
            opacity: 0.8,
          },
        ]}
      >
        <Lock size={16} color={colors.text.muted} />
        <Text
          style={[
            typography.labelSm,
            { color: colors.text.muted, marginLeft: 8, fontWeight: '600' },
          ]}
        >
          Locked — Access Required
        </Text>
      </View>
    );
  }

  // 2. AVAILABLE_OFFLINE
  if (state === 'AVAILABLE_OFFLINE') {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Downloaded package, ${toMB(sizeBytes)} MB. Tap to manage.`}
        style={[
          styles.container,
          {
            backgroundColor: colors.status.online + '15',
            borderColor: colors.status.online,
          },
        ]}
      >
        <CheckCircle2 size={16} color={colors.status.online} />
        <Text
          style={[
            typography.labelSm,
            { color: colors.status.online, marginLeft: 8, fontWeight: '700' },
          ]}
        >
          Downloaded ({toMB(sizeBytes)} MB)
        </Text>
      </TouchableOpacity>
    );
  }

  // 3. QUEUED
  if (state === 'QUEUED') {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Download queued. Tap to cancel."
        style={[
          styles.container,
          {
            backgroundColor: colors.surface.secondary,
            borderColor: colors.border.focused,
          },
        ]}
      >
        <Clock size={16} color={colors.brand.primary} />
        <Text
          style={[
            typography.labelSm,
            { color: colors.brand.primary, marginLeft: 8, fontWeight: '600' },
          ]}
        >
          Queued for Download ({toMB(sizeBytes)} MB)
        </Text>
      </TouchableOpacity>
    );
  }

  // 4. DOWNLOADING
  if (state === 'DOWNLOADING') {
    const downloadedBytes = sizeBytes * progress;
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Downloading ${Math.round(progress * 100)} percent. Tap to pause.`}
        style={[
          styles.container,
          {
            backgroundColor: colors.brand.primary + '15',
            borderColor: colors.brand.primary,
          },
        ]}
      >
        <ActivityIndicator size="small" color={colors.brand.primary} />
        <Text
          style={[
            typography.labelSm,
            { color: colors.brand.primary, marginLeft: 8, fontWeight: '600' },
          ]}
        >
          {Math.round(progress * 100)}% ({toMB(downloadedBytes)} / {toMB(sizeBytes)} MB)
        </Text>
      </TouchableOpacity>
    );
  }

  // 5. PAUSED
  if (state === 'PAUSED') {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Download paused at ${toMB(sizeBytes * progress)} MB. Tap to resume.`}
        style={[
          styles.container,
          {
            backgroundColor: colors.surface.secondary,
            borderColor: colors.border.default,
          },
        ]}
      >
        <Play size={16} color={colors.text.primary} />
        <Text
          style={[
            typography.labelSm,
            { color: colors.text.primary, marginLeft: 8, fontWeight: '600' },
          ]}
        >
          Resume Download ({toMB(sizeBytes)} MB)
        </Text>
      </TouchableOpacity>
    );
  }

  // 6. EXPIRED
  if (state === 'EXPIRED') {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Offline license expired. Tap to refresh grant."
        style={[
          styles.container,
          {
            backgroundColor: colors.status.error + '15',
            borderColor: colors.status.error,
          },
        ]}
      >
        <AlertTriangle size={16} color={colors.status.error} />
        <Text
          style={[
            typography.labelSm,
            { color: colors.status.error, marginLeft: 8, fontWeight: '700' },
          ]}
        >
          Expired — Connect to Renew
        </Text>
      </TouchableOpacity>
    );
  }

  // 7. FAILED
  if (state === 'FAILED') {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Download failed. Tap to retry."
        style={[
          styles.container,
          {
            backgroundColor: colors.status.error + '15',
            borderColor: colors.status.error,
          },
        ]}
      >
        <AlertCircle size={16} color={colors.status.error} />
        <Text
          style={[
            typography.labelSm,
            { color: colors.status.error, marginLeft: 8, fontWeight: '700' },
          ]}
        >
          Download Failed — Tap to Retry
        </Text>
      </TouchableOpacity>
    );
  }

  // 8. ELIGIBLE / IDLE (Default CTA)
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const textColor = isSecondary
    ? isDark
      ? '#93C5FD'
      : '#2563EB'
    : isOutline
      ? isDark
        ? '#60A5FA'
        : '#1D4ED8'
      : '#FFFFFF';

  const containerBg = isSecondary
    ? isDark
      ? '#1E293B'
      : '#F1F5F9'
    : isOutline
      ? 'transparent'
      : colors.brand.primary;

  const containerBorder = isSecondary
    ? isDark
      ? '#334155'
      : '#CBD5E1'
    : isOutline
      ? '#3B82F6'
      : colors.brand.primary;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Download package, ${toMB(sizeBytes)} megabytes.`}
      style={[
        styles.container,
        {
          backgroundColor: containerBg,
          borderColor: containerBorder,
        },
      ]}
    >
      <Download size={16} color={textColor} />
      <Text
        style={[
          typography.labelSm,
          { color: textColor, marginLeft: 8, fontWeight: '700' },
        ]}
      >
        Download ({toMB(sizeBytes)} MB)
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 48, // 48dp minimum touch target invariant
    minWidth: 48,
  },
});
