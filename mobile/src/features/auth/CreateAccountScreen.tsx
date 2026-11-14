import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Button, TextInput } from '../../shared/components';
import { useAuthSession } from '../../services/auth-session/AuthSessionContext';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react-native';

interface CreateAccountScreenProps {
  navigation: any;
}

export const CreateAccountScreen: React.FC<CreateAccountScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing } = useTheme();
  const { register } = useAuthSession();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Password Strength Checklist
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!hasMinLength || !hasLetter || !hasNumber) {
      setError('Please satisfy all password complexity rules.');
      return;
    }
    if (!termsAccepted) {
      setError('You must accept the terms of service and privacy policy.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await register(fullName.trim(), email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Email may already be in use.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.screenPadding,
          paddingVertical: spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginBottom: spacing.md }}
        >
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>

        <Text style={[typography.h1, { color: colors.text.primary, marginBottom: spacing.xs }]}>
          Create Account
        </Text>
        <Text
          style={[
            typography.bodyMd,
            { color: colors.text.secondary, marginBottom: spacing.lg },
          ]}
        >
          Join your university cohort and access national exit exam preparation.
        </Text>

        <TextInput
          label="Full Name"
          placeholder="Abebe Kebede"
          value={fullName}
          onChangeText={(t) => {
            setFullName(t);
            setError(null);
          }}
        />

        <TextInput
          label="Email Address"
          placeholder="student@university.edu.et"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError(null);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          label="Password"
          placeholder="Minimum 8 characters"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
          isPassword
        />

        {/* Live Password Strength Checklist */}
        <View
          style={{
            backgroundColor: colors.surface.secondary,
            padding: spacing.sm,
            borderRadius: 8,
            marginBottom: spacing.md,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {hasMinLength ? (
              <CheckCircle2 size={16} color={colors.status.online} />
            ) : (
              <Circle size={16} color={colors.text.muted} />
            )}
            <Text
              style={[
                typography.labelSm,
                {
                  color: hasMinLength ? colors.status.online : colors.text.secondary,
                  marginLeft: 6,
                },
              ]}
            >
              At least 8 characters
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {hasLetter ? (
              <CheckCircle2 size={16} color={colors.status.online} />
            ) : (
              <Circle size={16} color={colors.text.muted} />
            )}
            <Text
              style={[
                typography.labelSm,
                {
                  color: hasLetter ? colors.status.online : colors.text.secondary,
                  marginLeft: 6,
                },
              ]}
            >
              Contains letters
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {hasNumber ? (
              <CheckCircle2 size={16} color={colors.status.online} />
            ) : (
              <Circle size={16} color={colors.text.muted} />
            )}
            <Text
              style={[
                typography.labelSm,
                {
                  color: hasNumber ? colors.status.online : colors.text.secondary,
                  marginLeft: 6,
                },
              ]}
            >
              Contains at least one number
            </Text>
          </View>
        </View>

        {/* Terms Consent Checkbox */}
        <TouchableOpacity
          onPress={() => setTermsAccepted(!termsAccepted)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}
        >
          {termsAccepted ? (
            <CheckCircle2 size={20} color={colors.brand.primary} />
          ) : (
            <Circle size={20} color={colors.border.default} />
          )}
          <Text
            style={[
              typography.bodySm,
              { color: colors.text.secondary, marginLeft: spacing.xs, flex: 1 },
            ]}
          >
            I agree to the Terms of Service and Institutional Privacy Policy.
          </Text>
        </TouchableOpacity>

        {error && (
          <Text
            style={[
              typography.labelSm,
              { color: colors.status.error, marginBottom: spacing.md },
            ]}
          >
            {error}
          </Text>
        )}

        <Button
          title="Create Free Account"
          variant="primary"
          loading={loading}
          onPress={handleRegister}
          style={{ marginBottom: spacing.md }}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={[typography.bodyMd, { color: colors.text.secondary }]}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text
              style={[
                typography.bodyMd,
                { color: colors.brand.primary, fontWeight: '600' },
              ]}
            >
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
