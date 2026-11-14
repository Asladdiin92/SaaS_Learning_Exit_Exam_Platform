import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Building2, ChevronDown, User } from 'lucide-react-native';

interface WorkspaceSwitcherChipProps {
  organizationName: string;
  isPersonal: boolean;
  onPress: () => void;
  testID?: string;
}

export const WorkspaceSwitcherChip: React.FC<WorkspaceSwitcherChipProps> = ({
  organizationName,
  isPersonal,
  onPress,
  testID = 'workspace-switcher-chip',
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Active workspace: ${organizationName}. Tap to switch.`}
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
        {isPersonal ? (
          <User size={16} color={colors.brand.primary} />
        ) : (
          <Building2 size={16} color={colors.brand.primary} />
        )}
        <Text
          numberOfLines={1}
          style={[
            typography.labelSm,
            {
              color: colors.text.primary,
              marginHorizontal: spacing.xxs + 4,
              fontWeight: '600',
              maxWidth: 140,
            },
          ]}
        >
          {organizationName}
        </Text>
        <ChevronDown size={14} color={colors.text.secondary} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chipContainer: {
    minHeight: 48, // 48dp interactive touch target invariant
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
