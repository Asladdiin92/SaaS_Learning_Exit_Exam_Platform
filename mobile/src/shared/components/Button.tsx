import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  style,
  ...props
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    let backgroundColor = colors.brand.primary;
    let borderColor = 'transparent';
    let borderWidth = 0;

    if (variant === 'secondary') {
      backgroundColor = colors.surface.secondary;
    } else if (variant === 'outline') {
      backgroundColor = 'transparent';
      borderColor = colors.border.default;
      borderWidth = 1.5;
    } else if (variant === 'danger') {
      backgroundColor = colors.status.error;
    }

    if (disabled) {
      backgroundColor = colors.status.locked;
      borderColor = 'transparent';
    }

    const minHeight = size === 'sm' ? spacing.minTouchTarget : 52;
    const paddingHorizontal = size === 'sm' ? 12 : 20;

    return {
      backgroundColor,
      borderColor,
      borderWidth,
      minHeight,
      paddingHorizontal,
      borderRadius: borderRadius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled || loading ? 0.7 : 1,
    };
  };

  const getTextStyle = (): TextStyle => {
    let color = '#FFFFFF';
    if (variant === 'secondary') {
      color = colors.text.primary;
    } else if (variant === 'outline') {
      color = colors.brand.primary;
    }

    return {
      ...typography.bodyLg,
      fontWeight: '600',
      color,
      marginLeft: leftIcon ? 8 : 0,
    };
  };

  return (
    <TouchableOpacity
      style={[getContainerStyle(), style as ViewStyle]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.brand.primary : '#FFFFFF'} />
      ) : (
        <>
          {leftIcon}
          <Text style={getTextStyle()}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
