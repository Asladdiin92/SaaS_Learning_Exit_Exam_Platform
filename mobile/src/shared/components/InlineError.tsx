import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../theme';

export interface InlineErrorProps {
  message?: string;
  errorCode?: string;
  onRetry?: () => void;
  retryLabel?: string;
  testID?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({
  message = 'An unexpected error occurred. Your local data remains safe.',
  errorCode,
  onRetry,
  retryLabel = 'Try Again',
  testID = 'inline-error',
}) => {
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();

  // Strip raw SQL errors or internal server stack traces to protect security (ADR-009)
  const sanitizeMessage = (msg: string): string => {
    if (
      msg.toLowerCase().includes('select') ||
      msg.toLowerCase().includes('syntax error') ||
      msg.toLowerCase().includes('pg_') ||
      msg.toLowerCase().includes('traceback')
    ) {
      return 'A temporary system error occurred. Please retry in a moment.';
    }
    return msg;
  };

  const displayMessage = sanitizeMessage(message);

  const containerBg = isDark ? '#450A0A' : '#FEF2F2';
  const borderColor = isDark ? '#DC2626' : '#FCA5A5';
  const textColor = isDark ? '#FECACA' : '#991B1B';
  const iconColor = isDark ? '#F87171' : '#DC2626';

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: containerBg,
          borderColor,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <AlertCircle size={20} color={iconColor} style={styles.icon} />
        <View style={styles.textContainer}>
          <Text
            style={[
              typography.bodyMd,
              styles.messageText,
              { color: textColor, fontWeight: '600' },
            ]}
          >
            {displayMessage}
          </Text>
          {errorCode && (
            <Text
              style={[
                typography.labelSm,
                { color: isDark ? '#F87171' : '#B91C1C', marginTop: 2 },
              ]}
            >
              Ref Code: {errorCode}
            </Text>
          )}
        </View>
      </View>

      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          style={[
            styles.retryButton,
            {
              backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2',
              borderColor: isDark ? '#DC2626' : '#EF4444',
            },
          ]}
        >
          <RefreshCw size={16} color={iconColor} style={styles.retryIcon} />
          <Text
            style={[
              typography.labelSm,
              { color: textColor, fontWeight: '700' },
            ]}
          >
            {retryLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    marginRight: 10,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  messageText: {
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48, // 48dp minimum touch target invariant
    minWidth: 48,
    paddingHorizontal: 16,
  },
  retryIcon: {
    marginRight: 8,
  },
});
