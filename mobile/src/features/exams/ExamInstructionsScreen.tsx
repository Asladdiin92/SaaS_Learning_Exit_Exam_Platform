import React from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, Button } from '../../shared/components';
import {
  ArrowLeft,
  Clock,
  HelpCircle,
  ShieldCheck,
  WifiOff,
  AlertTriangle,
} from 'lucide-react-native';

interface ExamInstructionsScreenProps {
  route: any;
  navigation: any;
}

export const ExamInstructionsScreen: React.FC<ExamInstructionsScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const {
    examPackageId = 'pkg_hu_cci_model_exit_2023',
    title = 'HU CCI Model Exit Exam',
    durationMinutes = 180,
    questionCount = 100,
  } = route.params || {};

  const handleStartExam = () => {
    navigation.navigate('ExamRunner', {
      examPackageId,
      title,
      durationMinutes,
      questionCount,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, padding: spacing.screenPadding }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <TouchableOpacity
            testID="exam-instructions-back-btn"
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              marginRight: spacing.sm,
              minHeight: 48,
              minWidth: 48,
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              EXAM INSTRUCTIONS & CODE OF CONDUCT
            </Text>
            <Text numberOfLines={1} style={[typography.h2, { color: colors.text.primary, fontWeight: '700' }]}>
              {title}
            </Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
          {/* Summary Card */}
          <Card variant="elevated" style={{ marginBottom: spacing.md, padding: spacing.md }}>
            <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xs, fontWeight: '700' }]}>
              Assessment Blueprint Overview
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Clock size={16} color={colors.brand.primary} />
                <Text style={[typography.bodySm, { color: colors.text.primary, fontWeight: '600', marginLeft: 4 }]}>
                  {durationMinutes} Minutes
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <HelpCircle size={16} color={colors.status.online} />
                <Text style={[typography.bodySm, { color: colors.text.primary, fontWeight: '600', marginLeft: 4 }]}>
                  {questionCount} Questions
                </Text>
              </View>
            </View>
            <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
              Aligned with the Ethiopian National Higher Education Exit Exam Blueprint across all 5 IT themes.
            </Text>
          </Card>

          {/* Key Invariants & Offline Rules */}
          <Card variant="outlined" style={{ marginBottom: spacing.md, padding: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <WifiOff size={18} color={colors.status.offline} />
              <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '700', marginLeft: 8 }]}>
                100% Offline-Safe Execution
              </Text>
            </View>
            <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.md }]}>
              Every answer is persisted to encrypted SQLite in &lt;16ms. You do not need an active internet connection while taking this exam.
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <ShieldCheck size={18} color={colors.brand.primary} />
              <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '700', marginLeft: 8 }]}>
                Server-Side Authoritative Grading (ADR-005)
              </Text>
            </View>
            <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
              Upon submission, your attempt is marked as Provisional / Awaiting Server Sync until verified and scored by public.grade_exam_attempt().
            </Text>
          </Card>

          {/* Code of Conduct Warning */}
          <Card
            variant="outlined"
            style={{
              marginBottom: spacing.lg,
              padding: spacing.md,
              borderColor: '#FEF3C7',
              backgroundColor: '#FFFBEB',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <AlertTriangle size={18} color="#D97706" />
              <Text style={[typography.bodyMd, { color: '#B45309', fontWeight: '700', marginLeft: 8 }]}>
                Strict Anti-Cheating Invariant
              </Text>
            </View>
            <Text style={[typography.bodySm, { color: '#78350F' }]}>
              Leaving the app or switching tasks will trigger security event logs recorded in your exam audit trail.
            </Text>
          </Card>

          {/* Primary CTA */}
          <Button
            testID="begin-timed-exam-btn"
            title="I Understand — Begin Timed Exam"
            variant="primary"
            size="lg"
            onPress={handleStartExam}
            style={{ minHeight: 48 }}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
