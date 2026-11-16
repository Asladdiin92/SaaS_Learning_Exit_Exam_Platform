import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, Button, EntitlementBadge, PackageDownloadButton } from '../../shared/components';
import { useAuthSession } from '../../services/auth-session';
import { database } from '../../shared/database/db';
import { examRepository } from '../../shared/database/examRepository';
import {
  ITEC4133_BLUEPRINTS,
  seedItec4133ToDatabase,
} from '../../shared/database/parseHuQuestionBank';
import { AlertCircle, BookOpen, Clock, FileText } from 'lucide-react-native';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ExamType =
  | 'NATIONAL_EXIT_SIMULATION'
  | 'PRACTICE_QUIZ'
  | 'COURSE_EXAM'
  | 'OFFLINE_READY';

type FilterKey = 'ALL' | 'NATIONAL_EXIT_SIMULATION' | 'BY_THEME' | 'OFFLINE_READY' | ExamType;

export interface ExamBlueprint {
  id: string;
  title: string;
  courseCode: string;
  type: ExamType;
  questionCount: number;
  durationMin: number;
  sizeBytes: number;
}

interface InProgressAttempt {
  local_attempt_id: string;
  exam_package_id: string;
  packageTitle: string;
}

// ─── Filter Chips Config ────────────────────────────────────────────────────────

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'NATIONAL_EXIT_SIMULATION', label: 'Exit Exam Simulation' },
  { key: 'BY_THEME', label: 'By Theme' },
  { key: 'OFFLINE_READY', label: 'Offline Ready' },
];

// ─── Exam Type Label Map ────────────────────────────────────────────────────────

const TYPE_LABEL: Record<ExamType, string> = {
  NATIONAL_EXIT_SIMULATION: 'National Exit Sim',
  PRACTICE_QUIZ: 'Practice Quiz',
  COURSE_EXAM: 'Course Exam',
  OFFLINE_READY: 'Offline Ready',
};

// ─── Component ─────────────────────────────────────────────────────────────────

export const PracticeCatalogScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { user } = useAuthSession();

  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('ALL');
  const [blueprints, setBlueprints] = useState<ExamBlueprint[]>([]);
  const [inProgressAttempt, setInProgressAttempt] = useState<InProgressAttempt | null>(null);
  const [loadingAttempt, setLoadingAttempt] = useState(true);
  const [downloadStates, setDownloadStates] = useState<Record<string, boolean>>({});
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // ── Load live/cached blueprints and in-progress attempt from SQLite ──────────
  const fetchCatalogAndAttempt = useCallback(async () => {
    try {
      await examRepository.seedCanonicalExamsIfEmpty();
      await seedItec4133ToDatabase();

      const localPkgs = await examRepository.getAllExamPackages();
      const mapped: ExamBlueprint[] = localPkgs.map((pkg) => {
        let title = 'Practice Assessment';
        let questionCount = 25;
        let courseCode = 'ALL-COURSES';

        try {
          const snapshot = JSON.parse(pkg.question_snapshot_json);
          if (snapshot.title) title = snapshot.title;
          if (Array.isArray(snapshot.questions)) questionCount = snapshot.questions.length;
          else if (snapshot.total_questions) questionCount = snapshot.total_questions;
          if (snapshot.course_code) courseCode = snapshot.course_code;
        } catch (_) {}

        const isSim = pkg.exam_package_id.includes('model_exit') || questionCount >= 100;
        return {
          id: pkg.exam_package_id,
          title,
          courseCode,
          type: (isSim ? 'NATIONAL_EXIT_SIMULATION' : 'PRACTICE_QUIZ') as ExamType,
          questionCount,
          durationMin: Math.max(15, Math.round(pkg.duration_sec / 60)),
          sizeBytes: 2450000,
        };
      });

      // Append any ITEC4133 blueprints not already present
      for (const ib of ITEC4133_BLUEPRINTS) {
        if (!mapped.some((m) => m.id === ib.id)) {
          mapped.push(ib);
        }
      }

      setBlueprints(mapped);

      // Check for active in-progress attempt
      if (user?.userId) {
        const rows = await database.query<{
          local_attempt_id: string;
          exam_package_id: string;
        }>(
          `SELECT local_attempt_id, exam_package_id
           FROM local_exam_attempts
           WHERE user_id = ? AND status = 'IN_PROGRESS'
           ORDER BY started_at DESC
           LIMIT 1;`,
          [user.userId]
        );

        if (rows.length > 0) {
          const row = rows[0];
          const matchedBp = mapped.find((b) => b.id === row.exam_package_id);
          setInProgressAttempt({
            local_attempt_id: row.local_attempt_id,
            exam_package_id: row.exam_package_id,
            packageTitle: matchedBp?.title ?? row.exam_package_id,
          });
        } else {
          setInProgressAttempt(null);
        }
      } else {
        setInProgressAttempt(null);
      }
    } catch (err) {
      console.warn('Failed to load practice catalog:', err);
      setCatalogError('Could not load exam packages. Please try again.');
    } finally {
      setLoadingAttempt(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    fetchCatalogAndAttempt();
  }, [fetchCatalogAndAttempt]);

  // ── Filter blueprints ───────────────────────────────────────────────────────
  const filteredBlueprints = blueprints.filter((bp) => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'NATIONAL_EXIT_SIMULATION') {
      return bp.type === 'NATIONAL_EXIT_SIMULATION';
    }
    if (selectedFilter === 'BY_THEME') {
      return bp.type === 'PRACTICE_QUIZ' || bp.type === 'COURSE_EXAM';
    }
    if (selectedFilter === 'OFFLINE_READY') {
      return true;
    }
    return bp.type === selectedFilter;
  });

  // ── Handle start / resume ───────────────────────────────────────────────────
  const handleStartOrResume = (bp: ExamBlueprint, hasActiveAttempt: boolean) => {
    navigation.navigate('ExamInstructions', {
      examPackageId: bp.id,
      title: bp.title,
      courseCode: bp.courseCode,
      questionCount: bp.questionCount,
      durationMin: bp.durationMin,
      examType: bp.type,
      hasActiveAttempt,
    });
  };

  const handleResumeFromBanner = () => {
    if (!inProgressAttempt) return;
    navigation.navigate('ExamRunner', {
      localAttemptId: inProgressAttempt.local_attempt_id,
      examPackageId: inProgressAttempt.exam_package_id,
      title: inProgressAttempt.packageTitle,
    });
  };

  // ── Render exam card ────────────────────────────────────────────────────────
  const renderCard = ({ item }: { item: ExamBlueprint }) => {
    const isNationalSim = item.type === 'NATIONAL_EXIT_SIMULATION';
    const isDownloaded = Boolean(downloadStates[item.id]);
    const hasActiveAttempt =
      inProgressAttempt?.exam_package_id === item.id;

    return (
      <Card
        testID={`exam-card-${item.id}`}
        variant="elevated"
        style={{ marginBottom: spacing.md, padding: spacing.md }}
      >
        {/* Top row: course code tag + type label */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.xs,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                backgroundColor: isNationalSim ? '#FEF3C7' : '#EFF6FF',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: borderRadius.sm,
              }}
            >
              <Text
                style={[
                  typography.labelSm,
                  {
                    color: isNationalSim ? '#B45309' : colors.brand.primary,
                    fontWeight: '700',
                  },
                ]}
              >
                {item.courseCode}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: colors.surface.secondary,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: borderRadius.sm,
              }}
            >
              <Text
                style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '600' }]}
              >
                {TYPE_LABEL[item.type]}
              </Text>
            </View>
          </View>

          {/* Entitlement badge — national sim locked for demo, others included */}
          <EntitlementBadge
            testID={`entitlement-${item.id}`}
            status={isNationalSim ? 'PERSONAL_PLAN' : 'INCLUDED'}
          />
        </View>

        {/* Title */}
        <Text
          style={[
            typography.h3,
            { color: colors.text.primary, marginBottom: spacing.xs, fontWeight: '700' },
          ]}
        >
          {item.title}
        </Text>

        {/* Question count + Duration badges */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            marginBottom: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <FileText size={14} color={colors.text.secondary} />
            <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '600' }]}>
              {item.questionCount} Questions
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Clock size={14} color={colors.text.secondary} />
            <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '600' }]}>
              {item.durationMin} min
            </Text>
          </View>
        </View>

        {/* Primary CTA button */}
        <Button
          testID={`start-exam-btn-${item.id}`}
          title={hasActiveAttempt ? 'Resume Exam' : 'Start Exam'}
          variant={hasActiveAttempt ? 'outline' : 'primary'}
          size="md"
          onPress={() => handleStartOrResume(item, hasActiveAttempt)}
          style={{ minHeight: 48, marginBottom: spacing.xs }}
        />

        {/* Secondary Download package button */}
        <PackageDownloadButton
          testID={`download-btn-${item.id}`}
          state={isDownloaded ? 'AVAILABLE_OFFLINE' : 'ELIGIBLE'}
          variant="secondary"
          sizeBytes={item.sizeBytes}
          onPress={() =>
            setDownloadStates((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
          }
        />
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1 }}>
        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: spacing.screenPadding,
            paddingTop: spacing.md,
            paddingBottom: spacing.xs,
          }}
        >
          <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
            PRACTICE & EXAM CENTER
          </Text>
          <Text
            style={[typography.h2, { color: colors.text.primary, fontWeight: '700' }]}
          >
            Exam Catalog
          </Text>
        </View>

        {/* ── Catalog Alert Banner (if error) ──────────────────────────────── */}
        {catalogError && (
          <View
            testID="catalog-error-banner"
            style={{
              marginHorizontal: spacing.screenPadding,
              marginBottom: spacing.sm,
              padding: spacing.md,
              backgroundColor: colors.status.error + '15',
              borderColor: colors.status.error,
              borderWidth: 1,
              borderRadius: borderRadius.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={18} color={colors.status.error} />
            <Text
              accessibilityRole="alert"
              style={[
                typography.labelSm,
                { color: colors.status.error, flex: 1, fontWeight: '600' },
              ]}
            >
              {catalogError}
            </Text>
          </View>
        )}

        {/* ── Pinned Resume Banner ─────────────────────────────────────────── */}
        {!loadingAttempt && inProgressAttempt && (
          <View
            testID="resume-banner"
            style={{
              marginHorizontal: spacing.screenPadding,
              marginBottom: spacing.sm,
              backgroundColor: '#FFFBEB',
              borderWidth: 1,
              borderColor: '#FCD34D',
              borderRadius: borderRadius.md,
              padding: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text
                style={[typography.labelSm, { color: '#92400E', fontWeight: '700' }]}
              >
                IN-PROGRESS
              </Text>
              <Text
                numberOfLines={1}
                style={[typography.bodyMd, { color: '#78350F', fontWeight: '600' }]}
              >
                {inProgressAttempt.packageTitle} — Resume Attempt
              </Text>
            </View>
            <Button
              testID="resume-banner-btn"
              title="Resume"
              variant="primary"
              size="sm"
              onPress={handleResumeFromBanner}
              style={{ minHeight: 40 }}
            />
          </View>
        )}

        {/* ── Filter Chips ─────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.screenPadding,
            paddingBottom: spacing.sm,
            gap: spacing.xs,
          }}
        >
          {FILTERS.map((f) => {
            const isActive = selectedFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                testID={`filter-chip-${f.key}`}
                onPress={() => setSelectedFilter(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: borderRadius.full,
                  borderWidth: 1,
                  borderColor: isActive ? colors.brand.primary : colors.border.default,
                  backgroundColor: isActive ? colors.brand.primary : colors.surface.card,
                  minHeight: 36,
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={[
                    typography.labelSm,
                    {
                      color: isActive ? '#FFFFFF' : colors.text.secondary,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Exam Cards ───────────────────────────────────────────────────── */}
        {loadingAttempt ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
            <Text
              style={[
                typography.bodyMd,
                { color: colors.text.secondary, marginTop: spacing.sm },
              ]}
            >
              Loading exam catalog…
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredBlueprints}
            keyExtractor={(item) => item.id}
            renderItem={renderCard}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.screenPadding,
              paddingTop: spacing.xs,
              paddingBottom: spacing.xxl,
            }}
            ListEmptyComponent={
              <View
                style={{
                  alignItems: 'center',
                  paddingTop: spacing.xxl,
                }}
              >
                <BookOpen size={48} color={colors.text.muted} />
                <Text
                  style={[
                    typography.bodyMd,
                    { color: colors.text.secondary, marginTop: spacing.md, textAlign: 'center' },
                  ]}
                >
                  No exams match the selected filter.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};
