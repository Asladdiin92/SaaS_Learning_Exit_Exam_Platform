import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../shared/theme';
import { useAuthSession } from '../../../services/auth-session/AuthSessionContext';
import { api } from '../../../shared/api/client';
import {
  progressRepository,
  CourseMastery,
  OutcomeMasteryItem,
  StudentProgressData,
} from '../../../shared/database/progressRepository';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Target,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
} from 'lucide-react-native';

export const CourseProgressScreen: React.FC = () => {
  const { colors, typography, spacing } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { courseId, courseCode, courseTitle } = route.params || {
    courseId: 1,
    courseCode: 'IT-CMTS-101',
    courseTitle: 'Computer Maintenance & Troubleshooting',
  };

  const { user, currentWorkspace } = useAuthSession();
  const userId = user?.userId || 'anonymous-user';
  const tenantId = currentWorkspace?.tenantId || null;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [courseData, setCourseData] = useState<CourseMastery | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<'ALL' | 'COGNITIVE' | 'AFFECTIVE' | 'PSYCHOMOTOR'>('ALL');
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  const loadCourseProgress = useCallback(
    async (forceNetwork: boolean = false) => {
      try {
        const pending = await progressRepository.getPendingLocalAttemptsCount(userId, tenantId);
        setPendingSyncCount(pending);

        // 1. Try local cache first
        const cached = await progressRepository.getCachedProgress(userId, tenantId);
        if (cached) {
          const matched = cached.courses.find((c) => c.course_id === Number(courseId));
          if (matched && !forceNetwork) {
            setCourseData(matched);
            setIsLoading(false);
          }
        }

        // 2. Fetch fresh course-scoped progress
        try {
          const remote = await api.get<StudentProgressData>(
            `/me/progress?course_id=${courseId}`
          );
          if (remote && remote.courses && remote.courses.length > 0) {
            const matched = remote.courses.find((c) => c.course_id === Number(courseId)) || remote.courses[0];
            setCourseData(matched);
          }
        } catch (_) {
          // If offline and no cache, generate offline fallback
          if (!cached) {
            const fallback = await progressRepository.generateOfflineFallbackProgress(userId, tenantId);
            const matched = fallback.courses.find((c) => c.course_id === Number(courseId));
            if (matched) setCourseData(matched);
          }
        }
      } catch (err) {
        console.warn('Error loading course progress:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [userId, tenantId, courseId]
  );

  useEffect(() => {
    loadCourseProgress();
  }, [loadCourseProgress]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadCourseProgress(true);
  };

  const handlePracticeOutcome = (outcome: OutcomeMasteryItem) => {
    // Navigate to exam flow targeting this outcome
    navigation.navigate('ExamInstructions', {
      courseId: courseId,
      examType: 'PRACTICE_QUIZ',
      outcomeId: outcome.outcome_id,
      title: `${courseData?.code || 'Course'} Practice Quiz`,
    });
  };

  if (isLoading && !courseData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.surface.primary }]}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={[typography.bodyMd, { color: colors.text.secondary, marginTop: 12 }]}>
          Loading course mastery evidence...
        </Text>
      </View>
    );
  }

  const outcomes = courseData?.outcomes || [];
  const filteredOutcomes =
    selectedDomain === 'ALL'
      ? outcomes
      : outcomes.filter((o) => (o.domain || 'COGNITIVE').toUpperCase() === selectedDomain);

  const masteryPct = Math.round(courseData?.mastery_percentage || 0);

  const getBloomLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'REMEMBER':
        return '#3B82F6';
      case 'UNDERSTAND':
        return '#06B6D4';
      case 'APPLY':
        return '#8B5CF6';
      case 'ANALYSE':
        return '#D946EF';
      case 'EVALUATE':
        return '#F59E0B';
      case 'CREATE':
        return '#10B981';
      default:
        return colors.brand.primary;
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surface.primary }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      testID="course-progress-screen"
    >
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="course-progress-back-btn"
        >
          <ArrowLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.text.primary }]}>
          Course Outcome Mastery
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Course Hero Card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.surface.card,
            borderColor: colors.border.subtle,
          },
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={[styles.codeBadge, { backgroundColor: colors.surface.secondary }]}>
            <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
              {courseData?.code || courseCode}
            </Text>
          </View>
          <Text style={[typography.labelSm, { color: colors.text.muted }]}>
            {courseData?.credit_hours || 3} Credit Hours
          </Text>
        </View>

        <Text style={[typography.h2, { color: colors.text.primary, marginTop: 8 }]}>
          {courseData?.title || courseTitle}
        </Text>

        {/* Course Mastery Bar */}
        <View style={styles.masteryProgressWrapper}>
          <View style={styles.masteryHeader}>
            <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
              Course Mastery Score
            </Text>
            <Text
              style={[
                typography.h3,
                {
                  color:
                    masteryPct >= 70
                      ? colors.status.online
                      : masteryPct > 0
                      ? colors.brand.primary
                      : colors.text.muted,
                  fontWeight: '700',
                },
              ]}
            >
              {masteryPct}%
            </Text>
          </View>

          <View
            style={[
              styles.progressBarBg,
              { backgroundColor: colors.surface.secondary },
            ]}
          >
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor:
                    masteryPct >= 70
                      ? colors.status.online
                      : colors.brand.primary,
                  width: `${Math.max(3, Math.min(100, masteryPct))}%`,
                },
              ]}
            />
          </View>

          <View style={styles.masteryFooter}>
            <Text style={[typography.labelSm, { color: colors.text.muted }]}>
              {courseData?.attempted_outcomes_count || 0} of {courseData?.total_outcomes_count || outcomes.length} Outcomes Attempted
            </Text>
            {pendingSyncCount > 0 && (
              <View style={styles.unsyncedRow}>
                <AlertCircle size={12} color="#D97706" />
                <Text style={[typography.labelSm, { color: '#B45309', marginLeft: 4 }]}>
                  Local activity not yet synced
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Domain Filter Pills */}
      <View style={styles.filterPillsRow}>
        {(['ALL', 'COGNITIVE', 'AFFECTIVE', 'PSYCHOMOTOR'] as const).map((dom) => {
          const isSelected = selectedDomain === dom;
          return (
            <TouchableOpacity
              key={dom}
              style={[
                styles.filterPill,
                {
                  backgroundColor: isSelected ? colors.brand.primary : colors.surface.card,
                  borderColor: isSelected ? colors.brand.primary : colors.border.subtle,
                },
              ]}
              onPress={() => setSelectedDomain(dom)}
              testID={`filter-pill-${dom}`}
            >
              <Text
                style={[
                  typography.labelSm,
                  {
                    color: isSelected ? '#FFFFFF' : colors.text.secondary,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {dom}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Outcomes List */}
      <View style={styles.outcomesSection}>
        <Text style={[typography.h3, { color: colors.text.primary, marginBottom: 12 }]}>
          Learning Outcomes ({filteredOutcomes.length})
        </Text>

        {filteredOutcomes.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface.card, borderColor: colors.border.subtle }]}>
            <BookOpen size={24} color={colors.text.muted} />
            <Text style={[typography.bodyMd, { color: colors.text.muted, marginTop: 8 }]}>
              No learning outcomes found for this filter.
            </Text>
          </View>
        ) : (
          filteredOutcomes.map((lo, idx) => {
            const loPct = Math.round(lo.mastery_score * 100);
            const levelColor = getBloomLevelColor(lo.level);

            return (
              <View
                key={lo.outcome_id || idx}
                style={[
                  styles.outcomeCard,
                  {
                    backgroundColor: colors.surface.card,
                    borderColor: colors.border.subtle,
                  },
                ]}
                testID={`outcome-card-${lo.outcome_id}`}
              >
                {/* Outcome Header */}
                <View style={styles.outcomeHeaderRow}>
                  <View style={styles.outcomeBadgeGroup}>
                    {lo.outcome_code && (
                      <View style={[styles.outcomeCodePill, { backgroundColor: colors.surface.secondary }]}>
                        <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '600' }]}>
                          {lo.outcome_code}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.bloomPill, { backgroundColor: `${levelColor}1A` }]}>
                      <Text style={[typography.labelSm, { color: levelColor, fontWeight: '700' }]}>
                        {lo.level}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      typography.labelSm,
                      {
                        color:
                          loPct >= 70
                            ? colors.status.online
                            : loPct > 0
                            ? colors.brand.primary
                            : colors.text.muted,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {loPct}% Mastery
                  </Text>
                </View>

                {/* Outcome Description */}
                <Text style={[typography.bodyMd, { color: colors.text.primary, marginVertical: 8 }]}>
                  {lo.description}
                </Text>

                {/* Outcome Evidence Stats */}
                <View style={styles.evidenceStatsRow}>
                  <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                    Evidence: {lo.correct_evidence_count}/{lo.attempts_evidence_count} items correct
                  </Text>
                  <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                    Domain: {lo.domain}
                  </Text>
                </View>

                {/* Mastery Progress Bar */}
                <View
                  style={[
                    styles.outcomeBarBg,
                    { backgroundColor: colors.surface.secondary },
                  ]}
                >
                  <View
                    style={[
                      styles.outcomeBarFill,
                      {
                        backgroundColor: loPct >= 70 ? colors.status.online : colors.brand.primary,
                        width: `${Math.max(2, Math.min(100, loPct))}%`,
                      },
                    ]}
                  />
                </View>

                {/* Practice This Outcome CTA Button */}
                <TouchableOpacity
                  style={[styles.practiceOutcomeBtn, { borderColor: colors.brand.primary }]}
                  onPress={() => handlePracticeOutcome(lo)}
                  activeOpacity={0.7}
                  testID={`practice-outcome-btn-${lo.outcome_id}`}
                >
                  <Target size={14} color={colors.brand.primary} />
                  <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700', marginLeft: 6 }]}>
                    Practice This Outcome
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    minHeight: 48,
  },
  backBtn: {
    padding: 6,
  },
  heroCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  masteryProgressWrapper: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  masteryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  masteryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  unsyncedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPillsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    minHeight: 32,
    justifyContent: 'center',
  },
  outcomesSection: {
    marginBottom: 20,
  },
  emptyCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  outcomeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outcomeBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  outcomeCodePill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 6,
  },
  bloomPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  evidenceStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  outcomeBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  outcomeBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  practiceOutcomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    minHeight: 48,
  },
});
