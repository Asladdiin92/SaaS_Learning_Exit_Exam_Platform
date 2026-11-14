import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Button, TextInput, Card } from '../../shared/components';
import { useAuthSession } from '../../services/auth-session/AuthSessionContext';
import { Fingerprint, Building2, ShieldCheck, ArrowLeft } from 'lucide-react-native';

interface SignInScreenProps {
  navigation: any;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing } = useTheme();
  const { login, offlineGrant, unlockWithBiometrics } = useAuthSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
    try {
      const success = await unlockWithBiometrics();
      if (!success) {
        Alert.alert('Authentication Failed', 'Biometric verification was not recognized.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not complete biometric authentication.');
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
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginBottom: spacing.md }}
        >
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>

        <Text style={[typography.h1, { color: colors.text.primary, marginBottom: spacing.xs }]}>
          Welcome Back
        </Text>
        <Text
          style={[
            typography.bodyMd,
            { color: colors.text.secondary, marginBottom: spacing.lg },
          ]}
        >
          Sign in to synchronize study materials and verified exam scores.
        </Text>

        {/* ============================================================ */}
        {/* OFFLINE BIOMETRIC UNLOCK CARD (Rendered if cached grant exists) */}
        {/* ============================================================ */}
        {offlineGrant && (
          <Card
            variant="elevated"
            style={{
              borderColor: colors.brand.primary,
              borderWidth: 1.5,
              backgroundColor: colors.surface.card,
              marginBottom: spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <ShieldCheck size={20} color={colors.status.online} />
              <Text
                style={[
                  typography.labelSm,
                  { color: colors.status.online, fontWeight: '700', marginLeft: spacing.xxs },
                ]}
              >
                OFFLINE ACCESS AVAILABLE
              </Text>
            </View>

            <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xxs }]}>
              {offlineGrant.fullName}
            </Text>
            <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
              {offlineGrant.tenantName || 'Personal Workspace'} • Valid until{' '}
              {new Date(offlineGrant.expiresAt).toLocaleDateString()}
            </Text>

            <Button
              title="Unlock Offline Library with Biometrics"
              variant="secondary"
              leftIcon={<Fingerprint size={20} color={colors.brand.primary} />}
              onPress={handleBiometricUnlock}
              style={{ borderColor: colors.brand.primary, borderWidth: 1 }}
            />
          </Card>
        )}

        {/* Online Credentials Form */}
        <TextInput
          label="Email or Institutional ID"
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
          placeholder="••••••••"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
          isPassword
        />

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
          title="Sign In"
          variant="primary"
          loading={loading}
          onPress={handleSignIn}
          style={{ marginBottom: spacing.md }}
        />

        <Button
          title="Sign In with Institution SSO (OIDC)"
          variant="outline"
          leftIcon={<Building2 size={20} color={colors.brand.primary} />}
          onPress={() => Alert.alert('SSO', 'Redirecting to University SAML/OIDC PKCE portal...')}
          style={{ marginBottom: spacing.lg }}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={[typography.bodyMd, { color: colors.text.secondary }]}>
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('CreateAccount')}>
            <Text
              style={[
                typography.bodyMd,
                { color: colors.brand.primary, fontWeight: '600' },
              ]}
            >
              Register
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
