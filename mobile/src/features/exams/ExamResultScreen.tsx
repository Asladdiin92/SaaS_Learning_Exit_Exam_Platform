import React, { useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, Button } from '../../shared/components';
import {
  CheckCircle2,
  Clock,
  Award,
  AlertTriangle,
  RotateCw,
  History,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';

interface CourseOutcomeBreakdown {
  courseCode: string;
  courseTitle: string;
  total: number;
  correct: number;
  percentage: number;
  recommendedResourceTitle: string;
  recommendedResourceId: string;
}

interface ExamResultScreenProps {
  route: any;
  navigation: any;
}

export const ExamResultScreen: React.FC<ExamResultScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();

  const {
    localAttemptId,
    examPackageId = 'pkg_hu_cci_model_exit_2023',
    title = 'HU CCI B.Sc. IT Model Exit Exam (Jan 2023)',
    status = 'ACCEPTED_RESULT_READY',
    scorePercent = 84.0,
    correctCount = 84,
    totalQuestions = 100,
    elapsedSec = 5400,
    operationId = 'op_mock_sync_9918',
    questions = [],
    selectedAnswers = {},
    examType = 'NATIONAL_EXIT_SIMULATION',
  } = route.params || {};

  const isServerVerified = status === 'ACCEPTED_RESULT_READY';
  const isPassing = scorePercent >= 70.0;

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
  };

  // ── Compute or Mock Course Outcome Breakdown ─────────────────────────────────
  const courseBreakdowns: CourseOutcomeBreakdown[] = useMemo(() => {
    const raw: CourseOutcomeBreakdown[] = [
      {
        courseCode: 'IT-EDPR-203',
        courseTitle: 'Event Driven Programming',
        total: 15,
        correct: 13,
        percentage: 86.7,
        recommendedResourceTitle: 'GUI Architectures & Event Dispatcher Notes',
        recommendedResourceId: 'res_edpr_203_notes',
      },
      {
        courseCode: 'IT-OOPR-201',
        courseTitle: 'OOP in Java',
        total: 15,
        correct: 14,
        percentage: 93.3,
        recommendedResourceTitle: 'Polymorphism & JVM Runtime Models',
        recommendedResourceId: 'res_oopr_201_notes',
      },
      {
        courseCode: 'IT-DBMS-301',
        courseTitle: 'Database Systems & Design',
        total: 15,
        correct: 12,
        percentage: 80.0,
        recommendedResourceTitle: '3NF Normalization & Transitive Dependency Guide',
        recommendedResourceId: 'res_dbms_301_notes',
      },
      {
        courseCode: 'IT-CNET-302',
        courseTitle: 'Computer Networking',
        total: 15,
        correct: 8,
        percentage: 53.3, // Weak area < 60%
        recommendedResourceTitle: 'Subnetting VLSM & Routing Protocols Handbook',
        recommendedResourceId: 'res_cnet_302_notes',
      },
      {
        courseCode: 'IT-WEBP-304',
        courseTitle: 'Web Development Technologies',
        total: 15,
        correct: 13,
        percentage: 86.7,
        recommendedResourceTitle: 'RESTful API Contracts & Client-Side Rendering',
        recommendedResourceId: 'res_webp_304_notes',
      },
      {
        courseCode: 'IT-SASD-303',
        courseTitle: 'Systems Analysis & Design',
        total: 15,
        correct: 12,
        percentage: 80.0,
        recommendedResourceTitle: 'UML Sequence & Use-Case Modeling Review',
        recommendedResourceId: 'res_sasd_303_notes',
      },
      {
        courseCode: 'IT-IASE-401',
        courseTitle: 'Information Assurance & Security',
        total: 10,
        correct: 5,
        percentage: 50.0, // Weak area < 60%
        recommendedResourceTitle: 'Public Key Cryptography & Zero-Trust Architecture',
        recommendedResourceId: 'res_iase_401_notes',
      },
    ];

    return raw;
  }, []);

  const weakOutcomes = courseBreakdowns.filter((c) => c.percentage < 60.0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.screenPadding,
          paddingBottom: spacing.xxl,
        }}
      >
        {/* ── Variant A: Server-Validated Result ───────────────────────────── */}
        {isServerVerified ? (
          <>
            {/* Server Verified Badge */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#D1FAE5',
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
                borderRadius: borderRadius.full,
                alignSelf: 'center',
                marginBottom: spacing.md,
              }}
            >
              <CheckCircle2 size={16} color={colors.status.online} />
              <Text
                testID="server-verified-badge"
                style={[typography.labelSm, { color: colors.status.online, fontWeight: '700' }]}
              >
                Server Verified ✓
              </Text>
            </View>

            {/* Circular / Hero Score Gauge Card */}
            <Card
              variant="elevated"
              style={{
                alignItems: 'center',
                paddingVertical: spacing.xl,
                paddingHorizontal: spacing.lg,
                marginBottom: spacing.md,
              }}
            >
              <View
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  borderWidth: 8,
                  borderColor: isPassing ? colors.status.online : colors.status.offline,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: spacing.md,
                  backgroundColor: colors.surface.secondary,
                }}
              >
                <Text
                  testID="score-percentage-text"
                  style={[typography.h1, { color: colors.text.primary, fontWeight: '800' }]}
                >
                  {scorePercent.toFixed(1)}%
                </Text>
                <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                  {correctCount}/{totalQuestions} Correct
                </Text>
              </View>

              <Text style={[typography.h2, { color: colors.text.primary, fontWeight: '700', textAlign: 'center', marginBottom: 4 }]}>
                {isPassing ? 'National Exit Exam Ready' : 'Remediation Recommended'}
              </Text>
              <Text style={[typography.bodyMd, { color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.md }]}>
                {isPassing
                  ? 'Congratulations! You met and exceeded the 70.0% benchmark for graduating class qualification.'
                  : 'Score fell below the 70.0% threshold. Practice targeted weak competencies below.'}
              </Text>

              {/* Meta row */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: spacing.lg,
                  borderTopWidth: 1,
                  borderTopColor: colors.border.default,
                  paddingTop: spacing.md,
                  width: '100%',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} color={colors.text.secondary} />
                  <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                    Time: {formatDuration(elapsedSec)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Award size={16} color={colors.brand.primary} />
                  <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '600' }]}>
                    Status: Qualified
                  </Text>
                </View>
              </View>
            </Card>

            {/* ── Theme & Course Outcome Breakdown ─────────────────────────── */}
            <Card variant="elevated" style={{ padding: spacing.md, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700' }]}>
                  Course & Outcome Breakdown
                </Text>
                <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                  7 Sections Tested
                </Text>
              </View>

              <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
                {courseBreakdowns.map((course) => {
                  const isWeak = course.percentage < 60.0;

                  return (
                    <View key={course.courseCode} testID={`breakdown-${course.courseCode}`}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[typography.bodySm, { color: colors.text.primary, fontWeight: '600' }]}>
                            {course.courseCode} — {course.courseTitle}
                          </Text>
                          {isWeak && (
                            <View
                              style={{
                                backgroundColor: '#FEF2F2',
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                                borderRadius: borderRadius.sm,
                              }}
                            >
                              <Text style={[typography.labelSm, { color: colors.status.error, fontWeight: '700' }]}>
                                &lt;60% Review
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            typography.labelSm,
                            {
                              color: isWeak ? colors.status.error : colors.status.online,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {course.percentage.toFixed(0)}%
                        </Text>
                      </View>

                      {/* Progress bar */}
                      <View
                        style={{
                          height: 8,
                          backgroundColor: colors.surface.secondary,
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            height: '100%',
                            width: `${course.percentage}%`,
                            backgroundColor: isWeak ? colors.status.error : colors.brand.primary,
                          }}
                        />
                      </View>

                      {/* Structured study note link if weak */}
                      {isWeak && (
                        <TouchableOpacity
                          testID={`study-note-link-${course.courseCode}`}
                          onPress={() =>
                            navigation.navigate('ProtectedContentReader', {
                              resourceId: course.recommendedResourceId,
                              title: course.recommendedResourceTitle,
                            })
                          }
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 4,
                            paddingVertical: 2,
                          }}
                        >
                          <BookOpen size={13} color={colors.brand.primary} />
                          <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '600' }]}>
                            Study: {course.recommendedResourceTitle} →
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* CTAs */}
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <Button
                testID="review-answers-btn"
                title="Review Answers & Explanations (MOB-19)"
                variant="primary"
                size="lg"
                onPress={() =>
                  navigation.navigate('AnswerReview', {
                    localAttemptId,
                    examPackageId,
                    title,
                    questions,
                    selectedAnswers,
                    isSubmitted: true,
                  })
                }
                style={{ minHeight: 52 }}
              />

              {weakOutcomes.length > 0 && (
                <Button
                  testID="practice-weak-outcomes-btn"
                  title="Practice Weak Outcomes (<60%)"
                  variant="outline"
                  size="md"
                  onPress={() =>
                    navigation.navigate('MainTabs', {
                      screen: 'Practice',
                      params: { filterCourse: weakOutcomes[0].courseCode },
                    })
                  }
                  style={{ minHeight: 48 }}
                />
              )}

              <Button
                testID="view-attempt-history-btn"
                title="View Attempt History (MOB-20)"
                variant="outline"
                size="md"
                onPress={() => navigation.navigate('AttemptHistory')}
                style={{ minHeight: 48 }}
              />
            </View>
          </>
        ) : (
          /* ── Variant B: Offline Queued / Awaiting Server Validation ─────── */
          <>
            {/* High-Contrast Amber Banner */}
            <View
              testID="offline-queued-banner"
              style={{
                backgroundColor: '#FFFBEB',
                borderWidth: 2,
                borderColor: '#F59E0B',
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <AlertTriangle size={22} color="#B45309" />
                <Text style={[typography.h3, { color: '#92400E', fontWeight: '800' }]}>
                  Submitted Offline — Awaiting Server Validation
                </Text>
              </View>
              <Text style={[typography.bodyMd, { color: '#78350F', lineHeight: 22 }]}>
                {totalQuestions}/{totalQuestions} answers locked safely in local encrypted storage. Official score
                and mastery records will update upon next network synchronization.
              </Text>
            </View>

            {/* Provisional Estimate Badge */}
            <Card variant="elevated" style={{ padding: spacing.md, marginBottom: spacing.md }}>
              <View
                style={{
                  backgroundColor: '#EFF6FF',
                  paddingHorizontal: spacing.md,
                  paddingVertical: 4,
                  borderRadius: borderRadius.sm,
                  alignSelf: 'flex-start',
                  marginBottom: spacing.sm,
                }}
              >
                <Text
                  testID="provisional-estimate-badge"
                  style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}
                >
                  Provisional Local Estimate — Official Score & Mastery Update After Server Sync
                </Text>
              </View>

              <Text style={[typography.h2, { color: colors.text.primary, fontWeight: '700', marginBottom: 2 }]}>
                {title}
              </Text>
              <Text style={[typography.labelSm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
                Operation ID: {operationId}
              </Text>

              <View style={{ borderTopWidth: 1, borderTopColor: colors.border.default, paddingTop: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={[typography.labelSm, { color: colors.text.secondary }]}>Questions Answered:</Text>
                  <Text style={[typography.labelSm, { color: colors.status.online, fontWeight: '700' }]}>
                    {totalQuestions} / {totalQuestions}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={[typography.labelSm, { color: colors.text.secondary }]}>Time Elapsed:</Text>
                  <Text style={[typography.labelSm, { color: colors.text.primary, fontWeight: '700' }]}>
                    {formatDuration(elapsedSec)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[typography.labelSm, { color: colors.text.secondary }]}>Device State:</Text>
                  <Text style={[typography.labelSm, { color: colors.status.offline, fontWeight: '700' }]}>
                    Locked in sync_operations outbox
                  </Text>
                </View>
              </View>
            </Card>

            {/* Offline CTAs */}
            <View style={{ gap: spacing.sm }}>
              <Button
                testID="sync-now-btn"
                title="Sync Now"
                variant="primary"
                size="lg"
                onPress={() => navigation.navigate('SyncCenter')}
                style={{ minHeight: 52 }}
              />

              <Button
                testID="track-status-btn"
                title="Track Submission Status (MOB-17)"
                variant="outline"
                size="md"
                onPress={() =>
                  navigation.navigate('SubmissionStatus', {
                    localAttemptId,
                    operationId,
                    title,
                  })
                }
                style={{ minHeight: 48 }}
              />

              <Button
                testID="back-to-catalog-btn"
                title="Back to Practice Catalog"
                variant="outline"
                size="md"
                onPress={() => navigation.navigate('MainTabs', { screen: 'Practice' })}
                style={{ minHeight: 48 }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
