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
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../shared/theme';
import { useAuthSession } from '../../../services/auth-session/AuthSessionContext';
import { api } from '../../../shared/api/client';
import {
  progressRepository,
  StudentProgressData,
  ThemeMastery,
  CourseMastery,
} from '../../../shared/database/progressRepository';
import { BloomsRadarChart } from '../components/BloomsRadarChart';
import {
  Award,
  TrendingUp,
  Flame,
  BookOpen,
  RefreshCw,
  ChevronRight,
  Target,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react-native';

export const ProgressOverviewScreen: React.FC = () => {
  const { colors, typography, spacing } = useTheme();
  const navigation = useNavigation<any>();
  const { user, currentWorkspace } = useAuthSession();

  const [period, setPeriod] = useState<'7_DAYS' | '30_DAYS' | 'ALL_TIME'>('ALL_TIME');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [progressData, setProgressData] = useState<StudentProgressData | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lastSyncedText, setLastSyncedText] = useState<string>('Never');

  const userId = user?.userId || 'anonymous-user';
  const tenantId = currentWorkspace?.tenantId || null;

  const loadProgress = useCallback(
    async (forceNetwork: boolean = false) => {
      try {
        const pending = await progressRepository.getPendingLocalAttemptsCount(userId, tenantId);
        setPendingSyncCount(pending);

        // 1. First render from local SQLite cache (<16ms)
        const cached = await progressRepository.getCachedProgress(userId, tenantId);
        if (cached && !forceNetwork) {
          setProgressData(cached);
          if (cached.summary.last_calculated_at) {
            setLastSyncedText(new Date(cached.summary.last_calculated_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              month: 'short',
              day: 'numeric',
            }));
          }
          setIsLoading(false);
        }

        // 2. Fetch fresh rolling mastery from server
        try {
          const remoteData = await api.get<StudentProgressData>(
            `/me/progress?period=${period}`
          );
          if (remoteData && remoteData.summary) {
            setProgressData(remoteData);
            await progressRepository.saveProgressCache(userId, tenantId, remoteData, pending);
            if (remoteData.summary.last_calculated_at) {
              setLastSyncedText(new Date(remoteData.summary.last_calculated_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                month: 'short',
                day: 'numeric',
              }));
            }
          }
        } catch (networkErr) {
          // If network failed and no cached data yet, generate offline fallback
          if (!cached) {
            const fallback = await progressRepository.generateOfflineFallbackProgress(userId, tenantId);
            setProgressData(fallback);
          }
        }
      } catch (err) {
        console.warn('Error loading progress overview:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [userId, tenantId, period]
  );

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadProgress(true);
  };

  const handleThemePress = (theme: ThemeMastery) => {
    // Find courses for this theme
    const themeCourses = (progressData?.courses || []).filter((c) => c.theme_id === theme.theme_id);
    if (themeCourses.length > 0) {
      // Navigate to the first course or open course progress
      navigation.navigate('CourseProgress', {
        courseId: themeCourses[0].course_id,
        courseCode: themeCourses[0].code,
        courseTitle: themeCourses[0].title,
      });
    }
  };

  const handleCoursePress = (course: CourseMastery) => {
    navigation.navigate('CourseProgress', {
      courseId: course.course_id,
      courseCode: course.code,
      courseTitle: course.title,
    });
  };

  if (isLoading && !progressData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.surface.primary }]}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={[typography.bodyMd, { color: colors.text.secondary, marginTop: 12 }]}>
          Calculating mastery analytics...
        </Text>
      </View>
    );
  }

  const summary = progressData?.summary;
  const overallPct = Math.round(summary?.overall_readiness_percent || 0);
  const isReady = overallPct >= 70;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surface.primary }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      testID="progress-overview-screen"
    >
      {/* Screen Header */}
      <View style={styles.header}>
        <Text style={[typography.h1, { color: colors.text.primary }]}>
          Mastery & Exit Readiness
        </Text>
        <Text style={[typography.bodySm, { color: colors.text.secondary, marginTop: 2 }]}>
          Rolling B.Sc. IT Exit Exam Competency
        </Text>
      </View>

      {/* Freshness & Offline Sync Strip */}
      <View
        style={[
          styles.freshnessStrip,
          {
            backgroundColor: colors.surface.card,
            borderColor: colors.border.subtle,
          },
        ]}
      >
        <View style={styles.freshnessInfo}>
          <Clock size={14} color={colors.text.muted} />
          <Text style={[typography.labelSm, { color: colors.text.secondary, marginLeft: 6 }]}>
            Last calculated: {lastSyncedText}
          </Text>
        </View>

        {pendingSyncCount > 0 ? (
          <View style={[styles.pendingPill, { backgroundColor: '#FEF3C7' }]}>
            <AlertCircle size={12} color="#D97706" />
            <Text style={[typography.labelSm, { color: '#B45309', marginLeft: 4, fontWeight: '600' }]}>
              {pendingSyncCount} offline awaiting sync
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <RefreshCw size={14} color={colors.brand.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Period Selector */}
      <View
        style={[
          styles.periodSelectorContainer,
          {
            backgroundColor: colors.surface.secondary,
            borderColor: colors.border.subtle,
          },
        ]}
      >
        {(['7_DAYS', '30_DAYS', 'ALL_TIME'] as const).map((p) => {
          const isSelected = period === p;
          const label = p === '7_DAYS' ? '7 Days' : p === '30_DAYS' ? '30 Days' : 'All Time';
          return (
            <TouchableOpacity
              key={p}
              style={[
                styles.periodTab,
                isSelected && {
                  backgroundColor: colors.surface.card,
                  elevation: 2,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                },
              ]}
              onPress={() => setPeriod(p)}
              testID={`period-tab-${p}`}
            >
              <Text
                style={[
                  typography.labelSm,
                  {
                    color: isSelected ? colors.brand.primary : colors.text.secondary,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3 KPI Cards */}
      <View style={styles.kpiGrid}>
        {/* Readiness Card */}
        <View
          style={[
            styles.kpiCard,
            styles.kpiCardLarge,
            {
              backgroundColor: colors.surface.card,
              borderColor: isReady ? colors.status.online : colors.border.default,
            },
          ]}
        >
          <View style={styles.kpiHeader}>
            <Award size={18} color={isReady ? colors.status.online : colors.brand.primary} />
            <View
              style={[
                styles.readinessBadge,
                { backgroundColor: isReady ? '#DCFCE7' : '#FEF3C7' },
              ]}
            >
              <Text
                style={[
                  typography.labelSm,
                  { color: isReady ? '#15803D' : '#B45309', fontWeight: '700' },
                ]}
              >
                {isReady ? 'EXAM READY' : 'IN PROGRESS'}
              </Text>
            </View>
          </View>

          <Text style={[typography.h1, styles.readinessVal, { color: colors.text.primary }]}>
            {overallPct}%
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
            Overall Exit Readiness
          </Text>
          <Text style={[typography.labelSm, { color: colors.text.muted, marginTop: 2 }]}>
            Target: 70% threshold
          </Text>
        </View>

        {/* Small KPI Row */}
        <View style={styles.kpiRow}>
          <View
            style={[
              styles.kpiCardSmall,
              { backgroundColor: colors.surface.card, borderColor: colors.border.subtle },
            ]}
          >
            <BookOpen size={16} color={colors.brand.primary} />
            <Text style={[typography.h2, { color: colors.text.primary, marginTop: 4 }]}>
              {summary?.active_courses_count || 0}/15
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              Active Courses
            </Text>
          </View>

          <View
            style={[
              styles.kpiCardSmall,
              { backgroundColor: colors.surface.card, borderColor: colors.border.subtle },
            ]}
          >
            <CheckCircle2 size={16} color={colors.status.online} />
            <Text style={[typography.h2, { color: colors.text.primary, marginTop: 4 }]}>
              {summary?.validated_attempts_count || 0}
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              Scored Attempts
            </Text>
          </View>

          <View
            style={[
              styles.kpiCardSmall,
              { backgroundColor: colors.surface.card, borderColor: colors.border.subtle },
            ]}
          >
            <Flame size={16} color="#EA580C" />
            <Text style={[typography.h2, { color: '#EA580C', marginTop: 4 }]}>
              {summary?.study_streak_days || 0}
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              Day Streak
            </Text>
          </View>
        </View>
      </View>

      {/* Section 1: 5 Theme Mastery Breakdown */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.h2, { color: colors.text.primary }]}>
            Curriculum Themes
          </Text>
          <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '600' }]}>
            45 Credit Hours
          </Text>
        </View>

        {(progressData?.themes || []).map((theme) => {
          const themePct = Math.round(theme.mastery_percentage);
          const barColor =
            themePct >= 75
              ? colors.status.online
              : themePct >= 50
              ? colors.brand.primary
              : '#F59E0B';

          return (
            <TouchableOpacity
              key={theme.theme_id}
              style={[
                styles.themeCard,
                {
                  backgroundColor: colors.surface.card,
                  borderColor: colors.border.subtle,
                },
              ]}
              onPress={() => handleThemePress(theme)}
              activeOpacity={0.7}
              testID={`theme-card-${theme.theme_id}`}
            >
              <View style={styles.themeHeader}>
                <View style={styles.themeTitleWrapper}>
                  <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                    THEME {theme.theme_number}
                  </Text>
                  <Text
                    style={[typography.h3, { color: colors.text.primary, marginTop: 2 }]}
                    numberOfLines={1}
                  >
                    {theme.title}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.text.muted} />
              </View>

              {/* Progress Bar */}
              <View style={styles.themeProgressContainer}>
                <View
                  style={[
                    styles.themeBarBg,
                    { backgroundColor: colors.surface.secondary },
                  ]}
                >
                  <View
                    style={[
                      styles.themeBarFill,
                      {
                        backgroundColor: barColor,
                        width: `${Math.max(3, Math.min(100, themePct))}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[typography.labelSm, styles.themePctText, { color: barColor, fontWeight: '700' }]}>
                  {themePct}%
                </Text>
              </View>

              <View style={styles.themeFooter}>
                <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                  {theme.credit_hours} Cr. Hrs • {theme.courses_count} Courses
                </Text>
                <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                  {theme.attempted_outcomes_count}/{theme.total_outcomes_count} Outcomes
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Section 2: 6-Level Bloom's Cognitive Radar */}
      <View
        style={[
          styles.radarCard,
          {
            backgroundColor: colors.surface.card,
            borderColor: colors.border.subtle,
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.h2, { color: colors.text.primary }]}>
            Bloom's Cognitive Distribution
          </Text>
          <TrendingUp size={18} color={colors.brand.primary} />
        </View>
        <Text style={[typography.bodySm, { color: colors.text.secondary, marginTop: 2, marginBottom: 8 }]}>
          Mastery depth across cognitive levels from recall to synthesis
        </Text>

        <BloomsRadarChart data={progressData?.blooms_distribution || []} size={280} />

        <Text
          style={[
            typography.labelSm,
            styles.footnote,
            { color: colors.text.muted, borderTopColor: colors.border.subtle },
          ]}
        >
          {summary?.disclaimer ||
            'Mastery scores are rolling estimates based on validated practice evidence, not official university grades.'}
        </Text>
      </View>

      {/* Section 3: Course Mastery Drilldown */}
      <View style={styles.section}>
        <Text style={[typography.h2, { color: colors.text.primary, marginBottom: 12 }]}>
          Course Outcome Drilldown
        </Text>

        {(progressData?.courses || []).map((course) => {
          const coursePct = Math.round(course.mastery_percentage || 0);
          const barColor =
            coursePct >= 70
              ? colors.status.online
              : coursePct > 0
              ? colors.brand.primary
              : colors.text.muted;

          return (
            <View
              key={course.course_id}
              style={[
                styles.courseCard,
                {
                  backgroundColor: colors.surface.card,
                  borderColor: colors.border.subtle,
                },
              ]}
              testID={`course-row-${course.course_id}`}
            >
              <TouchableOpacity
                style={styles.courseRowHeader}
                onPress={() => handleCoursePress(course)}
                activeOpacity={0.7}
              >
                <View style={styles.courseRowLeft}>
                  <View style={[styles.codeBadge, { backgroundColor: colors.surface.secondary }]}>
                    <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                      {course.code}
                    </Text>
                  </View>
                  <View style={styles.courseRowText}>
                    <Text
                      style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}
                      numberOfLines={1}
                    >
                      {course.title}
                    </Text>
                    <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                      {course.credit_hours} Cr. Hrs • {course.attempted_outcomes_count}/{course.total_outcomes_count} Outcomes
                    </Text>
                  </View>
                </View>

                <View style={styles.courseRowRight}>
                  <Text style={[typography.h3, { color: barColor, fontWeight: '700', marginRight: 4 }]}>
                    {coursePct}%
                  </Text>
                  <ChevronRight size={16} color={colors.text.muted} />
                </View>
              </TouchableOpacity>

              {/* Course Progress Bar */}
              <View style={styles.courseBarBg}>
                <View
                  style={[
                    styles.courseBarFill,
                    {
                      backgroundColor: barColor,
                      width: `${Math.max(2, Math.min(100, coursePct))}%`,
                    },
                  ]}
                />
              </View>

              {/* Improve Weakest Topic Button */}
              <TouchableOpacity
                style={styles.improveTopicBtn}
                onPress={() => {
                  navigation.navigate('ExamInstructions', {
                    courseId: course.course_id,
                    examType: 'PRACTICE_QUIZ',
                    title: `${course.code} Targeted Practice`,
                  });
                }}
                activeOpacity={0.8}
                testID={`improve-weakest-btn-${course.course_id}`}
              >
                <Target size={14} color="#1D4ED8" style={{ marginRight: 6 }} />
                <Text style={[typography.labelSm, { color: '#1D4ED8', fontWeight: '700' }]}>
                  Improve Weakest Topic
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Primary CTA: Launch Practice */}
      <TouchableOpacity
        style={[styles.primaryCTA, { backgroundColor: colors.brand.primary }]}
        onPress={() => navigation.navigate('Practice')}
        activeOpacity={0.8}
        testID="practice-cta-btn"
      >
        <Target size={18} color="#FFFFFF" />
        <Text style={[typography.h3, { color: '#FFFFFF', marginLeft: 8 }]}>
          Take Practice Exit Exam
        </Text>
      </TouchableOpacity>
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
  header: {
    marginBottom: 12,
  },
  freshnessStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  freshnessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  refreshBtn: {
    padding: 4,
  },
  periodSelectorContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 3,
    marginBottom: 16,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    minHeight: 40,
  },
  kpiGrid: {
    marginBottom: 20,
  },
  kpiCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
  },
  kpiCardLarge: {
    marginBottom: 10,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readinessBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  readinessVal: {
    fontSize: 40,
    lineHeight: 46,
    marginVertical: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kpiCardSmall: {
    flex: 1,
    marginHorizontal: 3,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  themeCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  themeTitleWrapper: {
    flex: 1,
    marginRight: 8,
  },
  themeProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  themeBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 10,
  },
  themeBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  themePctText: {
    width: 40,
    textAlign: 'right',
  },
  themeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radarCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  footnote: {
    fontStyle: 'italic',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
    textAlign: 'center',
  },
  courseCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  courseRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  courseBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
  courseBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  improveTopicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    minHeight: 48,
  },
  courseRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  courseRowText: {
    flex: 1,
  },
  courseRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  primaryCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 14,
    minHeight: 48,
    marginTop: 8,
  },
});
