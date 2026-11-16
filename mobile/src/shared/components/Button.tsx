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

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'inverse';
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
  const { isDark, typography, spacing, borderRadius } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    let backgroundColor = '#2563EB'; // primary
    let borderColor = 'transparent';
    let borderWidth = 0;

    if (variant === 'inverse') {
      backgroundColor = '#FFFFFF';
    } else if (variant === 'secondary') {
      backgroundColor = isDark ? '#1E293B' : '#E2E8F0';
      borderColor = '#334155';
      borderWidth = 1;
    } else if (variant === 'outline') {
      backgroundColor = 'transparent';
      borderColor = '#3B82F6';
      borderWidth = 1.5;
    } else if (variant === 'danger') {
      backgroundColor = '#DC2626';
    }

    if (disabled) {
      backgroundColor = isDark ? '#334155' : '#CBD5E1';
      borderColor = 'transparent';
      borderWidth = 0;
    }

    const minHeight = size === 'sm' ? spacing.minTouchTarget : size === 'lg' ? 56 : 50;
    const paddingHorizontal = size === 'sm' ? 12 : size === 'lg' ? 24 : 20;

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
      opacity: disabled || loading ? 0.65 : 1,
    };
  };

  const getTextStyle = (): TextStyle => {
    let color = '#FFFFFF';
    let fontWeight: TextStyle['fontWeight'] = '700';

    if (variant === 'inverse') {
      color = '#1E3A8A'; // deep navy blue
      fontWeight = '700';
    } else if (variant === 'secondary') {
      color = isDark ? '#F8FAFC' : '#0F172A';
      fontWeight = '600';
    } else if (variant === 'outline') {
      color = isDark ? '#60A5FA' : '#1D4ED8';
      fontWeight = '600';
    } else if (variant === 'danger') {
      color = '#FFFFFF';
      fontWeight = '700';
    }

    if (disabled) {
      color = isDark ? '#94A3B8' : '#64748B';
    }

    return {
      ...typography.bodyLg,
      fontWeight,
      color,
      marginLeft: leftIcon ? 8 : 0,
    };
  };

  const getIndicatorColor = () => {
    if (variant === 'inverse') return '#1E3A8A';
    if (variant === 'outline') return isDark ? '#60A5FA' : '#1D4ED8';
    if (variant === 'secondary') return isDark ? '#F8FAFC' : '#0F172A';
    return '#FFFFFF';
  };

  return (
    <TouchableOpacity
      style={[getContainerStyle(), style as ViewStyle]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getIndicatorColor()} />
      ) : (
        <>
          {leftIcon}
          <Text style={getTextStyle()}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
