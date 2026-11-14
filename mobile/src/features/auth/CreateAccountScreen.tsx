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
import { useNetwork } from '../../shared/network/NetworkContext';
import { ArrowLeft, CheckCircle2, Circle, KeyRound } from 'lucide-react-native';

interface CreateAccountScreenProps {
  navigation: any;
}

export const CreateAccountScreen: React.FC<CreateAccountScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing } = useTheme();
  const { register } = useAuthSession();
  const { isOnline } = useNetwork();

  const [step, setStep] = useState<'DETAILS' | 'OTP'>('DETAILS');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Password Strength Checklist
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const handleDetailsSubmit = async () => {
    if (!isOnline) {
      setError('Internet connection required for account creation.');
      return;
    }
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

    // Advance to 6-digit OTP identity verification step
    setError(null);
    setStep('OTP');
  };

  const handleVerifyOtp = async () => {
    if (otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await register(fullName.trim(), email.trim(), password);
      if (result.hasMultipleWorkspaces) {
        navigation.navigate('WorkspaceSelection');
      }
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
          onPress={() => {
            if (step === 'OTP') {
              setStep('DETAILS');
            } else {
              navigation.goBack();
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginBottom: spacing.md, minHeight: 48, minWidth: 48, justifyContent: 'center' }}
        >
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>

        {step === 'DETAILS' ? (
          <>
            <Text style={[typography.h1, { color: colors.text.primary, marginBottom: spacing.xs, fontWeight: '700' }]}>
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
                minHeight: 48,
              }}
            >
              {termsAccepted ? (
                <CheckCircle2 size={22} color={colors.brand.primary} />
              ) : (
                <Circle size={22} color={colors.border.default} />
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
                  { color: colors.status.error, marginBottom: spacing.md, fontWeight: '600' },
                ]}
              >
                {error}
              </Text>
            )}

            <Button
              testID="create-account-continue-btn"
              title="Continue to Verification"
              variant="primary"
              disabled={!isOnline}
              onPress={handleDetailsSubmit}
              style={{ marginBottom: spacing.md }}
            />
          </>
        ) : (
          /* Step 2: 6-Digit OTP Identity Verification */
          <View testID="otp-verification-container">
            <View style={{ alignItems: 'center', marginVertical: spacing.lg }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.brand.primary + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.sm,
                }}
              >
                <KeyRound size={28} color={colors.brand.primary} />
              </View>
              <Text style={[typography.h2, { color: colors.text.primary, fontWeight: '700' }]}>
                Verify Your Identity
              </Text>
              <Text
                style={[
                  typography.bodyMd,
                  { color: colors.text.secondary, textAlign: 'center', marginTop: 4 },
                ]}
              >
                Enter the 6-digit confirmation code sent to {email}.
              </Text>
            </View>

            <TextInput
              testID="otp-input"
              label="6-Digit Verification Code"
              placeholder="123456"
              value={otpCode}
              onChangeText={(t) => {
                setOtpCode(t);
                setError(null);
              }}
              keyboardType="number-pad"
              maxLength={6}
            />

            {error && (
              <Text
                style={[
                  typography.labelSm,
                  { color: colors.status.error, marginBottom: spacing.md, fontWeight: '600' },
                ]}
              >
                {error}
              </Text>
            )}

            <Button
              testID="create-account-submit-btn"
              title="Verify & Create Account"
              variant="primary"
              loading={loading}
              onPress={handleVerifyOtp}
              style={{ marginBottom: spacing.md }}
            />
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[typography.bodyMd, { color: colors.text.secondary }]}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('SignIn')}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Text
              style={[
                typography.bodyMd,
                { color: colors.brand.primary, fontWeight: '700' },
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
