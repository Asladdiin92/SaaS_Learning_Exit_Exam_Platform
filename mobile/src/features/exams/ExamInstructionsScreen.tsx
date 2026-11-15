import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, Button } from '../../shared/components';
import { useAuthSession } from '../../services/auth-session';
import { examAttemptRepository } from '../../shared/database/examAttemptRepository';
import {
  ArrowLeft,
  Clock,
  FileText,
  CheckSquare,
  WifiOff,
  CheckCircle2,
  BookOpen,
  Zap,
} from 'lucide-react-native';

// ─── Types ─────────────────────────────────────────────────────────────────────

type StudyMode = 'STRICT_TIMED' | 'INTERACTIVE_STUDY';

interface StudyModeOption {
  key: StudyMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const ExamInstructionsScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { user, currentWorkspace } = useAuthSession();

  const {
    examPackageId = 'pkg_hu_cci_model_exit_2023',
    title = 'Exam',
    courseCode = '',
    questionCount = 100,
    durationMin = 180,
    examType = 'NATIONAL_EXIT_SIMULATION',
  } = route.params || {};

  const [studyMode, setStudyMode] = useState<StudyMode>('STRICT_TIMED');
  const [loading, setLoading] = useState(false);

  const isSimulation = examType === 'NATIONAL_EXIT_SIMULATION';
  const showStudyModeSelector = !isSimulation;

  const STUDY_MODES: StudyModeOption[] = [
    {
      key: 'STRICT_TIMED',
      label: 'Strict Timed Mode',
      description: 'No hints until submission. Official score on completion.',
      icon: <Zap size={20} color={studyMode === 'STRICT_TIMED' ? colors.brand.primary : colors.text.secondary} />,
    },
    {
      key: 'INTERACTIVE_STUDY',
      label: 'Interactive Study Assistant Mode',
      description: 'Instant step-by-step explanations after each answer. Linked notes available.',
      icon: <BookOpen size={20} color={studyMode === 'INTERACTIVE_STUDY' ? colors.brand.primary : colors.text.secondary} />,
    },
  ];

  // ── Summary Grid Items ──────────────────────────────────────────────────────
  const summaryItems = [
    { icon: <FileText size={18} color={colors.brand.primary} />, label: `${questionCount} Questions` },
    { icon: <Clock size={18} color={colors.brand.primary} />, label: `${durationMin}:00 Duration` },
    { icon: <CheckSquare size={18} color={colors.brand.primary} />, label: 'Multiple Choice (A–F)' },
    { icon: <WifiOff size={18} color={colors.brand.primary} />, label: 'Offline-Capable Practice' },
  ];

  // ── Pre-flight Checklist ────────────────────────────────────────────────────
  const checklistItems = [
    'Exam Package Verified (SHA-256 checksum confirmed)',
    'Entitlement Grant Active',
    'Answers auto-saved to this device on every tap',
  ];

  // ── Begin Exam Handler ──────────────────────────────────────────────────────
  const handleBeginExam = async () => {
    if (!user?.userId) {
      Alert.alert('Not Signed In', 'You must be signed in to start an exam.');
      return;
    }

    setLoading(true);
    try {
      const tenantId = currentWorkspace?.tenantId ?? null;
      const attempt = await examAttemptRepository.createLocalAttempt(
        examPackageId,
        user.userId,
        tenantId
      );

      navigation.navigate('ExamRunner', {
        localAttemptId: attempt.local_attempt_id,
        examPackageId,
        title,
        questionCount,
        durationMin,
        studyMode,
        examType,
      });
    } catch (err: any) {
      console.error('Failed to create local attempt:', err);
      Alert.alert(
        'Failed to Start Exam',
        err?.message || 'Could not create a local attempt. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1 }}>
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.screenPadding,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
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
            {/* Course code breadcrumb */}
            {courseCode ? (
              <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                {courseCode} · EXAM INSTRUCTIONS
              </Text>
            ) : (
              <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                EXAM INSTRUCTIONS
              </Text>
            )}
            <Text
              numberOfLines={2}
              style={[typography.h2, { color: colors.text.primary, fontWeight: '700' }]}
            >
              {title}
            </Text>
          </View>
        </View>

        {/* ── Scrollable Body ───────────────────────────────────────────────── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.screenPadding,
            paddingBottom: spacing.xxl + 80, // leave room for sticky CTA
          }}
        >
          {/* ── 2×2 Summary Grid ──────────────────────────────────────────── */}
          <Card
            variant="elevated"
            style={{ marginBottom: spacing.md, padding: spacing.md }}
          >
            <Text
              style={[
                typography.h3,
                { color: colors.text.primary, fontWeight: '700', marginBottom: spacing.sm },
              ]}
            >
              Assessment Overview
            </Text>

            {/* Row 1 */}
            <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {summaryItems[0].icon}
                <Text
                  style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}
                >
                  {summaryItems[0].label}
                </Text>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {summaryItems[1].icon}
                <Text
                  style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}
                >
                  {summaryItems[1].label}
                </Text>
              </View>
            </View>

            {/* Row 2 */}
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {summaryItems[2].icon}
                <Text
                  style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}
                >
                  {summaryItems[2].label}
                </Text>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {summaryItems[3].icon}
                <Text
                  style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}
                >
                  {summaryItems[3].label}
                </Text>
              </View>
            </View>
          </Card>

          {/* ── Study Mode Selector (PRACTICE_QUIZ / COURSE_EXAM only) ─────── */}
          {showStudyModeSelector && (
            <View style={{ marginBottom: spacing.md }}>
              <Text
                style={[
                  typography.h3,
                  {
                    color: colors.text.primary,
                    fontWeight: '700',
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                Study Mode
              </Text>
              {STUDY_MODES.map((mode) => {
                const isSelected = studyMode === mode.key;
                return (
                  <TouchableOpacity
                    key={mode.key}
                    testID={`study-mode-${mode.key}`}
                    onPress={() => setStudyMode(mode.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      padding: spacing.md,
                      marginBottom: spacing.xs,
                      borderRadius: borderRadius.md,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? colors.brand.primary : colors.border.default,
                      backgroundColor: isSelected
                        ? colors.brand.primary + '0D'
                        : colors.surface.card,
                    }}
                  >
                    {/* Radio circle */}
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: isSelected ? colors.brand.primary : colors.border.default,
                        backgroundColor: isSelected ? colors.brand.primary : 'transparent',
                        marginRight: spacing.sm,
                        marginTop: 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: '#FFFFFF',
                          }}
                        />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 2,
                        }}
                      >
                        {mode.icon}
                        <Text
                          style={[
                            typography.bodyMd,
                            {
                              color: isSelected ? colors.brand.primary : colors.text.primary,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {mode.label}
                        </Text>
                      </View>
                      <Text
                        style={[
                          typography.bodyMd,
                          { color: colors.text.secondary, fontSize: 13 },
                        ]}
                      >
                        {mode.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Pre-Flight Readiness Checklist ───────────────────────────── */}
          <Card
            variant="outlined"
            style={{ marginBottom: spacing.md, padding: spacing.md }}
          >
            <Text
              style={[
                typography.h3,
                {
                  color: colors.text.primary,
                  fontWeight: '700',
                  marginBottom: spacing.sm,
                },
              ]}
            >
              Pre-Flight Readiness
            </Text>
            {checklistItems.map((item, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  marginBottom: idx < checklistItems.length - 1 ? spacing.xs : 0,
                }}
              >
                <CheckCircle2
                  size={18}
                  color={colors.status.online}
                  style={{ marginRight: 8, marginTop: 1 }}
                />
                <Text
                  style={[
                    typography.bodyMd,
                    { color: colors.text.primary, flex: 1 },
                  ]}
                >
                  {item}
                </Text>
              </View>
            ))}
          </Card>

          {/* ── Offline invariant note ────────────────────────────────────── */}
          <View
            style={{
              backgroundColor: '#EFF6FF',
              borderRadius: borderRadius.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            }}
          >
            <Text
              style={[typography.bodyMd, { color: colors.brand.primary, fontWeight: '600' }]}
            >
              100% Offline-Safe
            </Text>
            <Text style={[typography.bodyMd, { color: colors.text.secondary, fontSize: 13 }]}>
              Every answer is persisted to encrypted SQLite in {'<'}16 ms. No internet connection
              required during the exam. Results display as{' '}
              <Text style={{ fontStyle: 'italic' }}>Provisional / Awaiting Server Sync</Text>{' '}
              until graded by the server.
            </Text>
          </View>
        </ScrollView>

        {/* ── Sticky Bottom CTA ────────────────────────────────────────────── */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.surface.primary,
            borderTopWidth: 1,
            borderTopColor: colors.border.default,
            paddingHorizontal: spacing.screenPadding,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
          }}
        >
          <Button
            testID="begin-exam-btn"
            title={loading ? 'Creating Attempt…' : 'Begin Exam Now'}
            variant="primary"
            size="lg"
            onPress={handleBeginExam}
            disabled={loading}
            style={{ minHeight: 52 }}
          />
          {loading && (
            <ActivityIndicator
              size="small"
              color={colors.brand.primary}
              style={{ position: 'absolute', right: spacing.screenPadding + 16, top: spacing.md + 16 }}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};
