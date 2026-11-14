import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  canGoBack?: boolean;
  onGoBack?: () => void;
  workspaceSwitcher?: React.ReactNode;
  rightActions?: React.ReactNode;
  testID?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  canGoBack = false,
  onGoBack,
  workspaceSwitcher,
  rightActions,
  testID = 'app-header',
}) => {
  const insets = useSafeAreaInsets();
  const { colors, typography, spacing } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, spacing.xs),
          backgroundColor: colors.surface.card,
          borderBottomColor: colors.border.subtle,
        },
      ]}
    >
      <View style={styles.contentRow}>
        {/* Left Section: Back Button or Workspace Switcher */}
        <View style={styles.leftSection}>
          {canGoBack ? (
            <TouchableOpacity
              onPress={onGoBack}
              accessibilityRole="button"
              accessibilityLabel="Navigate back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.backButton}
            >
              <ArrowLeft size={22} color={colors.text.primary} />
            </TouchableOpacity>
          ) : workspaceSwitcher ? (
            workspaceSwitcher
          ) : null}
        </View>

        {/* Center Section: Screen Title / Subtitle */}
        {title && (
          <View style={styles.centerSection} pointerEvents="none">
            <Text
              numberOfLines={1}
              style={[
                typography.h2,
                styles.titleText,
                { color: colors.text.primary },
              ]}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                numberOfLines={1}
                style={[
                  typography.labelSm,
                  styles.subtitleText,
                  { color: colors.text.secondary },
                ]}
              >
                {subtitle}
              </Text>
            )}
          </View>
        )}

        {/* Right Section: Sync Chip, Notifications, or Custom Actions */}
        <View style={styles.rightSection}>{rightActions}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    zIndex: 10,
  },
  contentRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  backButton: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSection: {
    position: 'absolute',
    left: 72,
    right: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    textAlign: 'center',
    fontWeight: '700',
  },
  subtitleText: {
    textAlign: 'center',
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'flex-end',
  },
});
