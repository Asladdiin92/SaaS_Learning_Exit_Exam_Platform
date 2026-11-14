import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme';
import { Eye, EyeOff } from 'lucide-react-native';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  isPassword = false,
  containerStyle,
  style,
  ...props
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!isPassword);

  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label && (
        <Text
          style={[
            typography.labelSm,
            { color: colors.text.secondary, marginBottom: spacing.xxs },
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface.card,
          borderWidth: 1.5,
          borderColor: error
            ? colors.status.error
            : isFocused
            ? colors.brand.primary
            : colors.border.default,
          borderRadius: borderRadius.md,
          minHeight: spacing.minTouchTarget,
          paddingHorizontal: spacing.md,
        }}
      >
        <RNTextInput
          style={[
            typography.bodyMd,
            {
              flex: 1,
              color: colors.text.primary,
              minHeight: spacing.minTouchTarget,
            },
            style,
          ]}
          placeholderTextColor={colors.text.muted}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ padding: spacing.xxs }}
          >
            {showPassword ? (
              <EyeOff size={20} color={colors.text.secondary} />
            ) : (
              <Eye size={20} color={colors.text.secondary} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text
          style={[
            typography.labelSm,
            { color: colors.status.error, marginTop: spacing.xxs },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};
