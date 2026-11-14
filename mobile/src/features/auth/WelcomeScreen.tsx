import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Button } from '../../shared/components';
import { GraduationCap, WifiOff, Award, Globe } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface WelcomeScreenProps {
  navigation: any;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing } = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState<'EN' | 'OM' | 'AM'>('EN');

  const slides = [
    {
      icon: <GraduationCap size={44} color={colors.brand.primary} />,
      title: 'National Exit Exam Alignment',
      description:
        'All 5 IT Themes, 15 canonical B.Sc. courses, and 45 credit hours mapped strictly to the Ethiopian National Higher Education curriculum.',
    },
    {
      icon: <WifiOff size={44} color={colors.status.offline} />,
      title: 'Offline-First Study Mode',
      description:
        'Download encrypted course packages over Wi-Fi. Read lecture notes, lab guides, and run practice exams without internet.',
    },
    {
      icon: <Award size={44} color={colors.status.online} />,
      title: "Bloom's Taxonomy Mastery",
      description:
        'Track competencies from Remember to Create with sliding-window IRT assessment analytics and adaptive exam simulations.',
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <StatusBar barStyle={colors.surface.primary === '#0F172A' ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1, paddingHorizontal: spacing.screenPadding }}>
        {/* Top Header with Language Pill */}
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
                { color: colors.text.primary, marginLeft: spacing.xs },
              ]}
            >
              IT Exit Exam
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

        {/* Value Carousel Content */}
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingVertical: spacing.lg,
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
                  { color: colors.text.primary, marginBottom: spacing.xs },
                ]}
              >
                {s.title}
              </Text>
              <Text style={[typography.bodyMd, { color: colors.text.secondary }]}>
                {s.description}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Data & Terms Disclosure Box */}
        <View style={{ paddingVertical: spacing.sm }}>
          <Text
            style={[
              typography.labelSm,
              { color: colors.text.muted, textAlign: 'center', marginBottom: spacing.md },
            ]}
          >
            Encrypted with SQLCipher. Complies with institutional privacy policies.
          </Text>

          {/* Sticky Dual CTAs */}
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            <Button
              title="Create Free Account"
              variant="primary"
              onPress={() => navigation.navigate('CreateAccount')}
            />
            <Button
              title="Sign In"
              variant="outline"
              onPress={() => navigation.navigate('SignIn')}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};
