import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useTheme } from '../../../shared/theme';
import { Card, Button, RichContentRenderer } from '../../../shared/components';
import {
  ArrowLeft,
  Globe,
  Bell,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ShieldAlert,
  WifiOff,
  Check,
} from 'lucide-react-native';

interface SettingsAndHelpScreenProps {
  navigation: any;
}

type LanguageCode = 'EN' | 'AM' | 'OM';

interface FAQItem {
  question: string;
  answer: string;
}

export const SettingsAndHelpScreen: React.FC<SettingsAndHelpScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();

  const [language, setLanguage] = useState<LanguageCode>('EN');
  const [examAlerts, setExamAlerts] = useState<boolean>(true);
  const [syncAlerts, setSyncAlerts] = useState<boolean>(true);
  const [announcements, setAnnouncements] = useState<boolean>(true);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      question: 'Can I take an exit exam in Airplane Mode?',
      answer:
        'Yes! Once the exam package (e.g. HU CCI Model Exit Exam) is downloaded to your device, the exam runner operates completely offline. Zero network calls are made during the examination session.',
    },
    {
      question: 'How are my answers saved during an offline exam?',
      answer:
        'Every answer selection is committed to the local SQLCipher encrypted database (local_answer_events) in under 16 milliseconds. Even if your device suddenly loses power or crashes, all answers are safely preserved.',
    },
    {
      question: 'When will my official exam score be validated?',
      answer:
        'When you submit an offline exam, it is assigned a Provisional state. As soon as your device reconnects to the internet, the opaque sync engine submits the attempt to public.grade_exam_attempt() on the server, ensuring authoritative server-side scoring.',
    },
    {
      question: 'Will cache clearing delete my unsynced answers?',
      answer:
        'Never. Our strict Zero Silent Data Loss guardrail guarantees that local exam attempts, unscored answers, and queued sync mutations are permanently protected from LRU cache eviction and manual cache maintenance.',
    },
  ];

  const handleSupportContact = () => {
    Alert.alert(
      'Exit Exam Support',
      'For curriculum inquiries, exam scheduling, or institutional workspace issues, contact your Department Exit Exam Coordinator or email support@exitexam.edu.et.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.screenPadding,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.default,
        }}
      >
        <TouchableOpacity
          testID="settings-back-btn"
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to Profile"
          style={{
            minHeight: 48,
            minWidth: 48,
            justifyContent: 'center',
            alignItems: 'flex-start',
            marginRight: spacing.xs,
          }}
        >
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View>
          <Text style={[typography.h2, { color: colors.text.primary, fontWeight: '700' }]}>
            Help, Language & Alerts
          </Text>
          <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
            Ethiopian Localization & Offline Exam Guide
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding }}>
        {/* Language Selection Card */}
        <Card variant="elevated" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
            <Globe size={20} color={colors.brand.primary} />
            <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700' }]}>
              Platform Language / ቋንቋ
            </Text>
          </View>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.md }]}>
            Select your preferred display language for UI labels and notifications.
          </Text>

          <View style={{ gap: 8 }}>
            {[
              { code: 'EN' as LanguageCode, label: 'English', native: 'English (US / UK)' },
              { code: 'AM' as LanguageCode, label: 'Amharic', native: 'አማርኛ' },
              { code: 'OM' as LanguageCode, label: 'Afaan Oromoo', native: 'Afaan Oromoo' },
            ].map((lang) => {
              const isSelected = language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  testID={`lang-select-${lang.code}`}
                  onPress={() => setLanguage(lang.code)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: spacing.sm,
                    borderRadius: borderRadius.md,
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.brand.primary : colors.border.default,
                    backgroundColor: isSelected ? '#EFF6FF' : colors.surface.primary,
                    minHeight: 48,
                  }}
                >
                  <View>
                    <Text
                      style={[
                        typography.bodyMd,
                        { color: colors.text.primary, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {lang.native}
                    </Text>
                    <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                      {lang.label} ({lang.code})
                    </Text>
                  </View>
                  {isSelected && <Check size={20} color={colors.brand.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Notifications Card */}
        <Card variant="outlined" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
            <Bell size={20} color={colors.brand.primary} />
            <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700' }]}>
              Notification Preferences
            </Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}>
                  Exam Schedule & Reminders
                </Text>
                <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                  Alerts for scheduled mock exams and study deadlines
                </Text>
              </View>
              <Switch
                testID="exam-alerts-switch"
                value={examAlerts}
                onValueChange={setExamAlerts}
                trackColor={{ false: '#CBD5E1', true: colors.brand.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border.default }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}>
                  Sync & Grade Verifications
                </Text>
                <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                  Notifies when provisional attempts are validated on the server
                </Text>
              </View>
              <Switch
                testID="sync-alerts-switch"
                value={syncAlerts}
                onValueChange={setSyncAlerts}
                trackColor={{ false: '#CBD5E1', true: colors.brand.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border.default }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}>
                  Institutional Announcements
                </Text>
                <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                  Broadcasts from your university department coordinator
                </Text>
              </View>
              <Switch
                testID="announcements-switch"
                value={announcements}
                onValueChange={setAnnouncements}
                trackColor={{ false: '#CBD5E1', true: colors.brand.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </Card>

        {/* Offline Exam FAQ Guide */}
        <View style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
            <HelpCircle size={20} color={colors.brand.primary} />
            <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700' }]}>
              Offline Exam & Troubleshooting Guide
            </Text>
          </View>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
            Essential tips for taking Ethiopian B.Sc. IT exit exams in low-bandwidth areas.
          </Text>

          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <Card
                key={idx}
                testID={`faq-item-${idx}`}
                variant="outlined"
                style={{ marginBottom: spacing.xs, padding: spacing.sm }}
              >
                <TouchableOpacity
                  onPress={() => setExpandedFaq(isExpanded ? null : idx)}
                  accessibilityRole="button"
                  accessibilityLabel={faq.question}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: 44,
                  }}
                >
                  <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600', flex: 1 }]}>
                    {faq.question}
                  </Text>
                  {isExpanded ? (
                    <ChevronUp size={20} color={colors.text.secondary} />
                  ) : (
                    <ChevronDown size={20} color={colors.text.secondary} />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={{ marginTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border.default, paddingTop: spacing.xs }}>
                    <RichContentRenderer content={faq.answer} themeMode={isDark ? 'dark' : 'light'} />
                  </View>
                )}
              </Card>
            );
          })}
        </View>

        {/* Support Helpdesk CTA */}
        <Card
          variant="outlined"
          style={{
            marginBottom: spacing.xl,
            backgroundColor: colors.surface.secondary,
            alignItems: 'center',
            padding: spacing.md,
          }}
        >
          <MessageSquare size={28} color={colors.brand.primary} style={{ marginBottom: spacing.xs }} />
          <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700', marginBottom: 2 }]}>
            Need Help with the Platform?
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.md }]}>
            Reach out to our academic support team or your university test center administrator.
          </Text>
          <Button
            testID="contact-support-cta"
            title="Contact Exit Exam Support"
            variant="outline"
            onPress={handleSupportContact}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};
