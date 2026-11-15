import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, Button } from '../../shared/components';
import { ExamQuestion, EXAM_QUESTIONS } from './ExamRunnerScreen';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Bookmark,
  BookOpen,
  Sparkles,
  Lock,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react-native';
import { AITutorModalSheet } from '../ai/components/AITutorModalSheet';

interface AnswerReviewScreenProps {
  route: any;
  navigation: any;
}

type ReviewFilter = 'ALL' | 'INCORRECT' | 'CORRECT' | 'FLAGGED';

export const AnswerReviewScreen: React.FC<AnswerReviewScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();

  const {
    localAttemptId,
    examPackageId = 'pkg_hu_cci_model_exit_2023',
    title = 'HU CCI B.Sc. IT Model Exit Exam (Jan 2023)',
    questions: rawQuestions,
    selectedAnswers = {},
    flaggedSet: rawFlagged = [],
    isSubmitted = true,
  } = route.params || {};

  const questions: ExamQuestion[] = useMemo(() => {
    if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
      return rawQuestions;
    }
    return EXAM_QUESTIONS;
  }, [rawQuestions]);

  const flaggedSet = useMemo(() => {
    return new Set(Array.isArray(rawFlagged) ? rawFlagged : []);
  }, [rawFlagged]);

  const [activeFilter, setActiveFilter] = useState<ReviewFilter>('ALL');
  const [selectedAiQuestion, setSelectedAiQuestion] = useState<ExamQuestion | null>(null);

  // ── Reveal Policy Guard ─────────────────────────────────────────────────────
  if (!isSubmitted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
        <View
          style={{
            flex: 1,
            padding: spacing.screenPadding,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#FEF3C7',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Lock size={32} color="#B45309" />
          </View>
          <Text
            testID="reveal-policy-locked-title"
            style={[typography.h3, { color: colors.text.primary, fontWeight: '700', textAlign: 'center', marginBottom: spacing.xs }]}
          >
            Answer Key Locked
          </Text>
          <Text
            testID="reveal-policy-locked-text"
            style={[typography.bodyMd, { color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 22 }]}
          >
            Per assessment security policy (ADR-005, FR-009), answer keys and instructor explanations remain locked until the exam attempt is officially submitted and recorded.
          </Text>
          <Button
            title="Return"
            variant="primary"
            size="md"
            onPress={() => navigation.goBack()}
            style={{ minWidth: 160 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Categorize Questions ────────────────────────────────────────────────────
  const correctCount = useMemo(() => {
    return questions.filter((q) => selectedAnswers[q.id] === q.correctOptionId).length;
  }, [questions, selectedAnswers]);

  const incorrectCount = useMemo(() => {
    return questions.filter((q) => selectedAnswers[q.id] && selectedAnswers[q.id] !== q.correctOptionId).length;
  }, [questions, selectedAnswers]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const isCorrect = selectedAnswers[q.id] === q.correctOptionId;
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'CORRECT') return isCorrect;
      if (activeFilter === 'INCORRECT') return !isCorrect;
      if (activeFilter === 'FLAGGED') return flaggedSet.has(q.id);
      return true;
    });
  }, [questions, activeFilter, selectedAnswers, flaggedSet]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.screenPadding,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.default,
            backgroundColor: colors.surface.card,
          }}
        >
          <TouchableOpacity
            testID="review-back-btn"
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              minHeight: 44,
              minWidth: 44,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: spacing.sm,
            }}
          >
            <ArrowLeft size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              EXAM ASSESSMENT REVIEW
            </Text>
            <Text numberOfLines={1} style={[typography.h3, { color: colors.text.primary, fontWeight: '700' }]}>
              Answer Review & Explanations
            </Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: spacing.screenPadding,
            paddingVertical: spacing.sm,
            gap: 6,
            backgroundColor: colors.surface.secondary,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.default,
          }}
        >
          {(
            [
              { key: 'ALL', label: `All (${questions.length})` },
              { key: 'INCORRECT', label: `Incorrect (${incorrectCount})` },
              { key: 'CORRECT', label: `Correct (${correctCount})` },
              { key: 'FLAGGED', label: `Flagged (${flaggedSet.size})` },
            ] as const
          ).map((tab) => {
            const isActive = activeFilter === tab.key;

            return (
              <TouchableOpacity
                key={tab.key}
                testID={`review-filter-${tab.key}`}
                onPress={() => setActiveFilter(tab.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: borderRadius.full,
                  backgroundColor: isActive ? colors.brand.primary : colors.surface.card,
                  borderWidth: 1,
                  borderColor: isActive ? colors.brand.primary : colors.border.default,
                }}
              >
                <Text
                  style={[
                    typography.labelSm,
                    {
                      color: isActive ? '#FFFFFF' : colors.text.secondary,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Question Review List */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: spacing.screenPadding,
            paddingBottom: spacing.xxl,
            gap: spacing.md,
          }}
        >
          {filteredQuestions.map((q) => {
            const userSelected = selectedAnswers[q.id];
            const isCorrect = userSelected === q.correctOptionId;
            const isFlagged = flaggedSet.has(q.id);

            return (
              <Card
                key={q.id}
                testID={`review-question-${q.questionNumber}`}
                variant="elevated"
                style={{
                  padding: spacing.md,
                  borderLeftWidth: 4,
                  borderLeftColor: isCorrect ? colors.status.online : colors.status.error,
                }}
              >
                {/* Meta Header */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: spacing.xs,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                      Q{q.questionNumber} • {q.courseCode}
                    </Text>
                    <View
                      style={{
                        backgroundColor: colors.surface.secondary,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: borderRadius.sm,
                      }}
                    >
                      <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                        {q.bloomLevel}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {isFlagged && <Bookmark size={15} color="#B45309" fill="#F59E0B" />}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: isCorrect ? '#D1FAE5' : '#FEF2F2',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: borderRadius.sm,
                      }}
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircle2 size={13} color={colors.status.online} />
                          <Text style={[typography.labelSm, { color: colors.status.online, fontWeight: '700' }]}>
                            Correct
                          </Text>
                        </>
                      ) : (
                        <>
                          <XCircle size={13} color={colors.status.error} />
                          <Text style={[typography.labelSm, { color: colors.status.error, fontWeight: '700' }]}>
                            Incorrect
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>

                {/* Prompt */}
                <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600', lineHeight: 22, marginBottom: spacing.sm }]}>
                  {q.prompt}
                </Text>

                {/* Options List */}
                <View style={{ gap: 6, marginBottom: spacing.md }}>
                  {q.options.map((opt) => {
                    const isUserChoice = userSelected === opt.id;
                    const isRightChoice = q.correctOptionId === opt.id;

                    let bg = colors.surface.secondary;
                    let border = colors.border.default;
                    let textCol = colors.text.primary;

                    if (isRightChoice) {
                      bg = '#F0FDF4';
                      border = colors.status.online;
                      textCol = '#065F46';
                    } else if (isUserChoice && !isRightChoice) {
                      bg = '#FEF2F2';
                      border = colors.status.error;
                      textCol = '#991B1B';
                    }

                    return (
                      <View key={opt.id}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 10,
                            borderRadius: borderRadius.sm,
                            borderWidth: 1.5,
                            borderColor: border,
                            backgroundColor: bg,
                          }}
                        >
                          <Text style={[typography.labelSm, { fontWeight: '700', width: 24, color: textCol }]}>
                            {opt.label}.
                          </Text>
                          <Text style={[typography.bodySm, { flex: 1, color: textCol }]}>
                            {opt.text}
                          </Text>
                          {isRightChoice && (
                            <Text style={[typography.labelSm, { color: colors.status.online, fontWeight: '700' }]}>
                              ✓ Correct
                            </Text>
                          )}
                          {isUserChoice && !isRightChoice && (
                            <Text style={[typography.labelSm, { color: colors.status.error, fontWeight: '700' }]}>
                              ✗ Your Choice
                            </Text>
                          )}
                        </View>
                        {opt.explanation && (
                          <Text
                            testID={`option-explanation-${q.questionNumber}-${opt.label}`}
                            style={[
                              typography.bodySm,
                              {
                                color: colors.text.secondary,
                                lineHeight: 18,
                                paddingHorizontal: spacing.sm,
                                paddingTop: 4,
                              },
                            ]}
                          >
                            {opt.explanation}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Instructor Explanation Box */}
                <View
                  style={{
                    backgroundColor: colors.surface.secondary,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    borderLeftWidth: 3,
                    borderLeftColor: colors.brand.primary,
                    marginBottom: spacing.sm,
                  }}
                >
                  <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700', marginBottom: 4 }]}>
                    OFFICIAL INSTRUCTOR EXPLANATION
                  </Text>
                  <Text style={[typography.bodySm, { color: colors.text.primary, lineHeight: 20 }]}>
                    {q.explanation}
                  </Text>
                </View>

                {/* Deep Link to Course Study Note (MOB-11) & AI Tutor CTA */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                  <TouchableOpacity
                    testID={`open-in-reader-${q.questionNumber}`}
                    onPress={() =>
                      navigation.navigate('ProtectedContentReader', {
                        resourceId: q.recommendedResourceId || 'res_itsec_master_cheatsheet',
                        title: `${q.chapterTitle || q.courseTitle} Notes`,
                        courseId: 402,
                        type: 'LECTURE_NOTE',
                        anchorCode: q.linkedNoteCode,
                      })
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingVertical: 6,
                    }}
                  >
                    <BookOpen size={14} color={colors.brand.primary} />
                    <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '600' }]}>
                      Open in Reader (MOB-11)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    testID={`ask-ai-tutor-${q.questionNumber}`}
                    onPress={() => setSelectedAiQuestion(q)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: '#EFF6FF',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: borderRadius.sm,
                    }}
                  >
                    <Sparkles size={14} color={colors.brand.primary} />
                    <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                      Ask AI Tutor
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })}
        </ScrollView>

        {/* ── AI Tutor Modal Sheet ────────────────────────────────────────── */}
        <AITutorModalSheet
          visible={Boolean(selectedAiQuestion)}
          onClose={() => setSelectedAiQuestion(null)}
          questionId={selectedAiQuestion?.id}
          questionNumber={selectedAiQuestion?.questionNumber}
          questionStem={selectedAiQuestion?.prompt}
          courseTitle={selectedAiQuestion?.courseTitle}
        />
      </View>
    </SafeAreaView>
  );
};
