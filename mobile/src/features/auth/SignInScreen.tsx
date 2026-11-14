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
import { useNetwork } from '../../shared/network/NetworkContext';
import { Fingerprint, Building2, ShieldCheck, ArrowLeft } from 'lucide-react-native';

interface SignInScreenProps {
  navigation: any;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing, isDark } = useTheme();
  const { isOnline } = useNetwork();
  const {
    login,
    offlineGrant,
    hasValidOfflineGrant,
    unlockOfflineWithBiometrics,
  } = useAuthSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show biometric unlock card when offline and grant is valid, OR if offlineGrant is present
  const showBiometricCard = (!isOnline && hasValidOfflineGrant) || (Boolean(offlineGrant) && !isOnline);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await login(email.trim(), password);
      if (result.hasMultipleWorkspaces) {
        navigation.navigate('WorkspaceSelection');
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
    try {
      const success = await unlockOfflineWithBiometrics();
      if (!success) {
        Alert.alert(
          'Authentication Failed',
          'Biometric verification was not recognized or offline grant has expired.'
        );
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
          style={{ marginBottom: spacing.md, minHeight: 48, minWidth: 48, justifyContent: 'center' }}
        >
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>

        <Text style={[typography.h1, { color: colors.text.primary, marginBottom: spacing.xs, fontWeight: '700' }]}>
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
        {/* OFFLINE BIOMETRIC UNLOCK CARD (Rendered when offline & grant valid) */}
        {/* ============================================================ */}
        {showBiometricCard && offlineGrant && (
          <Card
            testID="offline-biometric-card"
            variant="elevated"
            style={{
              borderColor: colors.brand.primary,
              borderWidth: 1.5,
              backgroundColor: isDark ? '#172554' : colors.surface.card,
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

            <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xxs, fontWeight: '700' }]}>
              {offlineGrant.fullName}
            </Text>
            <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
              {offlineGrant.tenantName || 'Personal Workspace'} • Valid until{' '}
              {offlineGrant.expiresAt ? new Date(offlineGrant.expiresAt).toLocaleDateString() : '7 days'}
            </Text>

            <Button
              testID="offline-biometric-unlock-btn"
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
              { color: colors.status.error, marginBottom: spacing.md, fontWeight: '600' },
            ]}
          >
            {error}
          </Text>
        )}

        <Button
          testID="sign-in-submit-btn"
          title="Sign In"
          variant="primary"
          loading={loading}
          disabled={!isOnline && !showBiometricCard}
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

        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[typography.bodyMd, { color: colors.text.secondary }]}>
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('CreateAccount')}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Text
              style={[
                typography.bodyMd,
                { color: colors.brand.primary, fontWeight: '700' },
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
