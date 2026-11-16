import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import {
  AppHeader,
  WorkspaceSwitcherChip,
  SyncStatusChip,
  ConnectionBanner,
  Card,
  Button,
} from '../../shared/components';
import { useAuthSession } from '../../services/auth-session/AuthSessionContext';
import { useNetwork } from '../../shared/network/NetworkContext';
import {
  curriculumRepository,
  LocalCourse,
  ContinueLearningAction,
  OfflineReadinessStats,
  WeakOutcomeRecommendation,
} from '../../shared/database/curriculumRepository';
import { examRepository } from '../../shared/database/examRepository';
import { database } from '../../shared/database/db';
import {
  BookOpen,
  Wifi,
  WifiOff,
  Flame,
  ChevronRight,
  Sparkles,
  Layers,
  FileCheck,
  Bell,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react-native';

interface HomeDashboardProps {
  navigation: any;
}

export const HomeDashboardScreen: React.FC<HomeDashboardProps> = ({ navigation }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { currentWorkspace, isOfflineMode, user } = useAuthSession();
  const { isOnline, isReachable, isMetered, dataSaverEnabled } = useNetwork();

  const [courses, setCourses] = useState<LocalCourse[]>([]);
  const [continueAction, setContinueAction] = useState<ContinueLearningAction | null>(null);
  const [readinessStats, setReadinessStats] = useState<OfflineReadinessStats>({
    downloadedCoursesCount: 0,
    offlineExamPackagesCount: 0,
    pendingSyncCount: 0,
  });
  const [weakOutcomes, setWeakOutcomes] = useState<WeakOutcomeRecommendation[]>([]);
  const [activeStreak, setActiveStreak] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      // 0. Remove any ghost in-progress attempts with 0 answered questions
      await curriculumRepository.cleanupAbandonedZeroAnswerAttempts(user?.userId);

      // 1. Instant sub-16ms reads from SQLite
      const [allCourses, contLearning, stats, outcomes, streakRows] = await Promise.all([
        curriculumRepository.getAllCourses(),
        curriculumRepository.getContinueLearning(user?.userId),
        curriculumRepository.getOfflineReadinessStats(user?.userId),
        curriculumRepository.getWeakOutcomeRecommendations(2),
        database.query<{ active_days: number }>(
          `SELECT COUNT(DISTINCT DATE(created_at)) as active_days FROM local_answer_events;`
        ),
      ]);

      setCourses(allCourses);
      setContinueAction(contLearning);
      setReadinessStats(stats);
      setWeakOutcomes(outcomes);
      setActiveStreak(streakRows[0]?.active_days || 0);

      // 2. Asynchronously hydrate live data from FastAPI in background without blocking UI
      if (isOnline && !isOfflineMode) {
        curriculumRepository.hydrateCurriculumFromServer().catch(() => {});
        examRepository.hydrateExamsFromServer(currentWorkspace?.tenantId).catch(() => {});
      }
    } catch (e) {
      console.warn('Error loading home dashboard data:', e);
    }
  }, [user?.userId, isOnline, isOfflineMode, currentWorkspace?.tenantId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, isOfflineMode]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const syncChipState = !isOnline || isOfflineMode
    ? 'offline'
    : readinessStats.pendingSyncCount > 0
    ? 'pending'
    : 'online';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      {/* Top AppHeader (MOB-05) */}
      <AppHeader
        workspaceSwitcher={
          <WorkspaceSwitcherChip
            organizationName={currentWorkspace?.organizationName || 'Personal Workspace'}
            isPersonal={currentWorkspace?.isPersonal ?? true}
            onPress={() => navigation.navigate('WorkspaceSelection')}
          />
        }
        rightActions={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SyncStatusChip
              state={syncChipState}
              pendingCount={readinessStats.pendingSyncCount}
              onPress={() => navigation.navigate('SyncCenter')}
            />
            <TouchableOpacity
              testID="home-notification-bell"
              onPress={() => navigation.navigate('Notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                marginLeft: spacing.xs,
                minHeight: 48,
                minWidth: 48,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Bell size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Connection Banner (Collapses smoothly to 0dp when online & synced) */}
      <ConnectionBanner
        isOnline={isOnline && !isOfflineMode}
        isReachable={isReachable}
        isMetered={isMetered}
        dataSaverEnabled={dataSaverEnabled}
        syncQueueCount={readinessStats.pendingSyncCount}
        onPressSyncCenter={() => navigation.navigate('SyncCenter')}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Greeting & Streak Banner */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}
        >
          <View>
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              ETHIOPIAN IT EXIT EXAM
            </Text>
            <Text style={[typography.h2, { color: colors.text.primary, fontWeight: '700' }]}>
              {user?.fullName
                ? `Hello, ${user.fullName.split(' ')[0]} 👋`
                : user?.email
                ? `Hello, ${user.email.split('@')[0]} 👋`
                : 'Hello, Asladdiin 👋'}
            </Text>
          </View>

          {/* Daily Streak Pill */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFEDD5',
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xxs + 2,
              borderRadius: borderRadius.full,
              minHeight: 32,
            }}
          >
            <Flame size={16} color="#EA580C" />
            <Text
              style={[
                typography.labelSm,
                { color: '#EA580C', fontWeight: '700', marginLeft: 4 },
              ]}
            >
              {activeStreak > 0 ? `${activeStreak}-Day Streak` : 'Active Learner'}
            </Text>
          </View>
        </View>

        {/* Zone 1: Continue Learning Hero Card */}
        <Card
          testID="continue-learning-hero-card"
          variant="elevated"
          style={{
            backgroundColor: colors.brand.primary,
            borderColor: 'transparent',
            padding: spacing.lg,
            marginBottom: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text
                style={[
                  typography.labelSm,
                  { color: 'rgba(255, 255, 255, 0.85)', fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
                ]}
              >
                {continueAction?.type === 'EXAM_ATTEMPT'
                  ? 'CONTINUE ASSESSMENT'
                  : continueAction?.type === 'BOOKMARK'
                  ? 'RESUME STUDYING'
                  : 'NATIONAL EXIT EXAM SIMULATION'}
              </Text>
              <Text style={[typography.h3, { color: '#FFFFFF', marginBottom: spacing.xs, fontWeight: '700' }]}>
                {continueAction?.type === 'EXAM_ATTEMPT' || continueAction?.type === 'BOOKMARK'
                  ? continueAction.title
                  : 'B.Sc. IT National Exit Exam Simulation (100 Questions • 5 Themes)'}
              </Text>
              <Text style={[typography.bodySm, { color: 'rgba(255, 255, 255, 0.95)' }]}>
                {continueAction?.type === 'EXAM_ATTEMPT'
                  ? `${continueAction.answeredCount || 0} / ${continueAction.totalQuestions || 100} Answered`
                  : continueAction?.type === 'BOOKMARK'
                  ? continueAction.subtitle
                  : 'No exam in progress — Select a course or start the 100-Question HU Model Exit Exam'}
              </Text>

              {continueAction?.type === 'EXAM_ATTEMPT' && (
                <View style={{ marginTop: spacing.sm }}>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.min(
                          100,
                          Math.max(
                            3,
                            Math.round(
                              ((continueAction.answeredCount || 0) /
                                (continueAction.totalQuestions || 100)) *
                                100
                            )
                          )
                        )}%`,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 3,
                      }}
                    />
                  </View>
                </View>
              )}
            </View>

            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={24} color="#FFFFFF" />
            </View>
          </View>

          <Button
            testID="continue-learning-cta"
            title={
              continueAction?.type === 'EXAM_ATTEMPT'
                ? 'Continue Exam Attempt'
                : continueAction?.type === 'BOOKMARK'
                ? continueAction.buttonLabel
                : 'Start Full Simulation'
            }
            variant="inverse"
            size="md"
            onPress={() => {
              if (continueAction?.type === 'EXAM_ATTEMPT' && continueAction.attemptId) {
                navigation.navigate('ExamRunner', {
                  localAttemptId: continueAction.attemptId,
                });
              } else if (continueAction?.type === 'BOOKMARK') {
                navigation.navigate('CourseOverview', {
                  courseId: continueAction.courseId,
                  code: continueAction.courseCode,
                });
              } else {
                navigation.navigate('ExamInstructions', {
                  examPackageId: 'pkg_hu_cci_model_exit_2023',
                  title: 'HU CCI B.Sc. IT Model Exit Exam (Jan 2023)',
                  courseCode: 'ALL-COURSES',
                  questionCount: 100,
                  durationMin: 180,
                  examType: 'NATIONAL_EXIT_SIMULATION',
                });
              }
            }}
            style={{
              marginTop: spacing.md,
              minHeight: 48,
            }}
          />
        </Card>

        {/* Distraction-Free Study Workspace & Digital Library Card */}
        <Card
          testID="study-workspace-launcher-card"
          variant="elevated"
          onPress={() => navigation.navigate('StudyWorkspace')}
          style={{
            backgroundColor: '#0F172A',
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: '#1E293B',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View
                  style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: borderRadius.sm,
                    marginRight: spacing.xs,
                  }}
                >
                  <Text style={[typography.labelSm, { color: '#38BDF8', fontWeight: '700' }]}>
                    DIGITAL LIBRARY
                  </Text>
                </View>
                <Text style={[typography.labelSm, { color: '#94A3B8' }]}>
                  Offline Ready • 5 Themes
                </Text>
              </View>

              <Text style={[typography.h3, { color: '#F8FAFC', fontWeight: '700', marginBottom: 2 }]}>
                Study Workspace
              </Text>
              <Text style={[typography.bodySm, { color: '#94A3B8' }]}>
                Distraction-free manuscripts, exit exam cheat-sheets & typography controls
              </Text>
            </View>

            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#1E293B',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={22} color="#38BDF8" />
            </View>
          </View>
        </Card>

        {/* Zone 2: Offline Readiness Strip */}
        <View
          testID="offline-readiness-strip"
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: spacing.md,
            gap: spacing.xs,
          }}
        >
          {/* Downloaded Courses */}
          <View
            testID="stat-downloaded-courses"
            style={[
              styles.statCard,
              {
                backgroundColor: colors.surface.card,
                borderColor: colors.border.default,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <Layers size={22} color={colors.brand.primary} />
            <Text style={[typography.h2, { color: colors.text.primary, marginTop: 4, fontWeight: '700' }]}>
              {readinessStats.downloadedCoursesCount}
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.secondary, fontSize: 11, textAlign: 'center' }]}>
              Courses Ready
            </Text>
          </View>

          {/* Offline Exam Packages */}
          <View
            testID="stat-offline-exam-packages"
            style={[
              styles.statCard,
              {
                backgroundColor: colors.surface.card,
                borderColor: colors.border.default,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <FileCheck size={22} color={colors.status.online} />
            <Text style={[typography.h2, { color: colors.text.primary, marginTop: 4, fontWeight: '700' }]}>
              {readinessStats.offlineExamPackagesCount}
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.secondary, fontSize: 11, textAlign: 'center' }]}>
              Offline Exams
            </Text>
          </View>

          {/* Pending Sync Items */}
          <View
            testID="stat-pending-sync-items"
            style={[
              styles.statCard,
              {
                backgroundColor: colors.surface.card,
                borderColor: colors.border.default,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <Clock size={22} color={readinessStats.pendingSyncCount > 0 ? '#D97706' : '#7E22CE'} />
            <Text style={[typography.h2, { color: colors.text.primary, marginTop: 4, fontWeight: '700' }]}>
              {readinessStats.pendingSyncCount}
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.secondary, fontSize: 11, textAlign: 'center' }]}>
              Pending Sync
            </Text>
          </View>
        </View>

        {/* Zone 3: Targeted Weak-Outcome Practice Recommendations */}
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xxs, fontWeight: '700' }]}>
            Recommended Practice Drills
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
            Targeted Bloom's Taxonomy competencies requiring reinforcement
          </Text>

          {weakOutcomes.map((wo, idx) => (
            <Card
              key={idx}
              testID={`weak-outcome-card-${idx}`}
              variant="outlined"
              onPress={() =>
                navigation.navigate('CourseOverview', {
                  courseId: wo.courseId,
                  code: wo.courseCode,
                })
              }
              style={{
                marginBottom: spacing.sm,
                borderColor: colors.border.default,
                minHeight: 68,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View
                      style={{
                        backgroundColor: '#EFF6FF',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: borderRadius.sm,
                        marginRight: spacing.xs,
                      }}
                    >
                      <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                        {wo.courseCode}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: '#F3E8FF',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: borderRadius.sm,
                      }}
                    >
                      <Text style={[typography.labelSm, { color: '#7E22CE', fontWeight: '700' }]}>
                        {wo.level}
                      </Text>
                    </View>
                  </View>

                  <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}>
                    {wo.description}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      navigation.navigate('ExamInstructions', {
                        examPackageId: 'pkg_hu_cci_model_exit_2023',
                        title: `${wo.courseCode} ${wo.level} Drill`,
                        courseCode: wo.courseCode,
                        questionCount: 25,
                        durationMinutes: 45,
                      });
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#EFF6FF',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: borderRadius.sm,
                    }}
                  >
                    <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700', fontSize: 12, marginRight: 2 }]}>
                      Drill
                    </Text>
                    <ChevronRight size={14} color={colors.brand.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* Zone 4: Recent Courses Strip */}
        <View style={{ marginBottom: spacing.lg }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.xs,
            }}
          >
            <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700' }]}>
              Curriculum Courses
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Curriculum')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '600' }]}>
                View All (15) →
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.screenPadding, paddingHorizontal: spacing.screenPadding }}>
            {courses.slice(0, 5).map((c) => (
              <Card
                key={c.course_id}
                testID={`recent-course-card-${c.course_id}`}
                variant="outlined"
                onPress={() =>
                  navigation.navigate('CourseOverview', {
                    courseId: c.course_id,
                    code: c.code,
                  })
                }
                style={{
                  width: 200,
                  marginRight: spacing.sm,
                  padding: spacing.md,
                }}
              >
                <View
                  style={{
                    backgroundColor: '#EFF6FF',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: borderRadius.sm,
                    alignSelf: 'flex-start',
                    marginBottom: spacing.xs,
                  }}
                >
                  <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                    {c.code}
                  </Text>
                </View>
                <Text numberOfLines={2} style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600', marginBottom: 4, height: 42 }]}>
                  {c.title}
                </Text>
                <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                  {c.credit_hours} Credit Hours
                </Text>
              </Card>
            ))}
          </ScrollView>
        </View>

        {/* Quick Curriculum Exploration CTA */}
        <Button
          testID="browse-curriculum-themes-btn"
          title="Browse All 5 Curriculum Themes"
          variant="outline"
          onPress={() => navigation.navigate('Curriculum')}
          style={{ marginBottom: spacing.lg, minHeight: 48 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  statCard: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 88,
  },
});
