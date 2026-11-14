import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Button } from '../../shared/components';
import { useNetwork } from '../../shared/network/NetworkContext';
import {
  TRANSLATIONS,
  SupportedLanguage,
} from '../../shared/localization';
import {
  GraduationCap,
  WifiOff,
  Award,
  AlertCircle,
} from 'lucide-react-native';

interface WelcomeScreenProps {
  navigation: any;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing, isDark } = useTheme();
  const { isOnline } = useNetwork();
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('EN');

  const t = TRANSLATIONS[selectedLanguage];

  const slides = [
    {
      icon: <GraduationCap size={44} color={colors.brand.primary} />,
      title: t.nationalExitTitle,
      description: t.nationalExitDesc,
    },
    {
      icon: <WifiOff size={44} color={colors.status.offline} />,
      title: t.offlineModeTitle,
      description: t.offlineModeDesc,
    },
    {
      icon: <Award size={44} color={colors.status.online} />,
      title: t.bloomMasteryTitle,
      description: t.bloomMasteryDesc,
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1, paddingHorizontal: spacing.screenPadding }}>
        {/* Top Header with App Branding and Language Selector Pill */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <GraduationCap size={24} color={colors.brand.primary} />
            <Text
              style={[
                typography.h3,
                { color: colors.text.primary, marginLeft: spacing.xs, fontWeight: '700' },
              ]}
            >
              {t.welcomeTitle}
            </Text>
          </View>

          {/* Language Selector Pill */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.surface.secondary,
              borderRadius: 20,
              padding: 3,
            }}
          >
            {(['EN', 'OM', 'AM'] as const).map((lang) => (
              <Button
                key={lang}
                title={lang}
                size="sm"
                variant={selectedLanguage === lang ? 'primary' : 'secondary'}
                onPress={() => setSelectedLanguage(lang)}
                style={{
                  minHeight: 28,
                  paddingHorizontal: 10,
                  borderRadius: 16,
                  backgroundColor:
                    selectedLanguage === lang ? colors.brand.primary : 'transparent',
                }}
              />
            ))}
          </View>
        </View>

        {/* Offline Warning Banner on First Launch */}
        {!isOnline && (
          <View
            testID="welcome-offline-banner"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? '#451A03' : '#FEF3C7',
              borderColor: colors.status.offline,
              borderWidth: 1,
              borderRadius: 8,
              padding: spacing.sm,
              marginBottom: spacing.sm,
            }}
          >
            <AlertCircle size={18} color={colors.status.offline} style={{ marginRight: 8 }} />
            <Text
              style={[
                typography.labelSm,
                { color: isDark ? '#FDE68A' : '#92400E', flex: 1, fontWeight: '600' },
              ]}
            >
              {t.offlineNotice}
            </Text>
          </View>
        )}

        {/* Value Carousel Content */}
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingVertical: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {slides.map((s, idx) => (
            <View
              key={idx}
              style={{
                backgroundColor: colors.surface.card,
                padding: spacing.lg,
                borderRadius: 16,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: colors.border.default,
              }}
            >
              <View style={{ marginBottom: spacing.sm }}>{s.icon}</View>
              <Text
                style={[
                  typography.h2,
                  { color: colors.text.primary, marginBottom: spacing.xs, fontWeight: '700' },
                ]}
              >
                {s.title}
              </Text>
              <Text style={[typography.bodyMd, { color: colors.text.secondary, lineHeight: 22 }]}>
                {s.description}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Sticky CTAs & Security Invariant Disclosure */}
        <View style={{ paddingVertical: spacing.sm }}>
          <Text
            style={[
              typography.labelSm,
              { color: colors.text.muted, textAlign: 'center', marginBottom: spacing.md },
            ]}
          >
            Encrypted with SQLCipher. Complies with institutional privacy policies.
          </Text>

          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            <Button
              testID="welcome-create-account-btn"
              title={t.createAccount}
              variant="primary"
              disabled={!isOnline}
              onPress={() => navigation.navigate('CreateAccount')}
            />
            <Button
              testID="welcome-sign-in-btn"
              title={t.signIn}
              variant="outline"
              onPress={() => navigation.navigate('SignIn')}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};
