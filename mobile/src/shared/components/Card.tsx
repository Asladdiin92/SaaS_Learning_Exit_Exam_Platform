import React from 'react';
import { View, TouchableOpacity, ViewStyle, TouchableOpacityProps } from 'react-native';
import { useTheme } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'default' | 'outlined' | 'elevated';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = 'default',
}) => {
  const { colors, spacing, borderRadius } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.cardRhythm,
    borderWidth: 1,
    borderColor: variant === 'outlined' ? colors.border.default : 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: variant === 'elevated' ? 0.08 : 0.03,
    shadowRadius: variant === 'elevated' ? 4 : 2,
    elevation: variant === 'elevated' ? 2 : 1,
    ...style,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};
