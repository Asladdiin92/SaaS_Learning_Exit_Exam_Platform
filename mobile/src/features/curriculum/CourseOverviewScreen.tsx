import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import {
  Card,
  Button,
  EntitlementBadge,
  PackageDownloadButton,
} from '../../shared/components';
import {
  curriculumRepository,
  LocalCourse,
  LocalOutcome,
  LocalResource,
  LocalExamPackage,
} from '../../shared/database/curriculumRepository';
import { api } from '../../shared/api/client';
import { useAuthSession } from '../../services/auth-session/AuthSessionContext';
import { useNetwork } from '../../shared/network/NetworkContext';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Bot,
  BookOpen,
  FileText,
  Target,
  Clock,
  HelpCircle,
  FileCheck2,
  WifiOff,
} from 'lucide-react-native';

interface CourseOverviewScreenProps {
  route: any;
  navigation: any;
}

export const CourseOverviewScreen: React.FC<CourseOverviewScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { isOfflineMode } = useAuthSession();
  const { isOnline } = useNetwork();
  const { courseId = 101, code = 'IT-CMTS-101' } = route.params || {};

  const [course, setCourse] = useState<LocalCourse | null>(null);
  const [outcomes, setOutcomes] = useState<LocalOutcome[]>([]);
  const [outcomesByDomain, setOutcomesByDomain] = useState<Record<string, LocalOutcome[]>>({
    COGNITIVE: [],
    AFFECTIVE: [],
    PSYCHOMOTOR: [],
  });
  const [resources, setResources] = useState<LocalResource[]>([]);
  const [examPackages, setExamPackages] = useState<LocalExamPackage[]>([]);
  const [activeTab, setActiveTab] = useState<'outcomes' | 'resources' | 'practice'>('outcomes');
  const [isDownloaded, setIsDownloaded] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadCourseData = useCallback(async () => {
    try {
      // 1. Instant local read (<16ms)
      const overview = await curriculumRepository.getCourseOverview(courseId);
      if (overview) {
        setCourse(overview.course);
        setOutcomes(overview.outcomes);
        setOutcomesByDomain(overview.outcomesByDomain);
        setResources(overview.resources);
        setExamPackages(overview.examPackages);
        setIsDownloaded(overview.isAvailableOffline);
      } else {
        const fallbackCourse = await curriculumRepository.getCourseById(courseId);
        setCourse(fallbackCourse);
        const resList = await curriculumRepository.getResourcesByCourse(courseId);
        setResources(resList);
        const examList = await curriculumRepository.getExamPackagesByCourse(courseId);
        setExamPackages(examList);
      }

      // 2. Fetch remote outcomes if online and empty
      if (!isOfflineMode && outcomes.length === 0) {
        try {
          const remote = await api.get(`/courses/${courseId}`);
          if (remote?.outcomes) {
            await curriculumRepository.saveCourseOutcomes(courseId, remote.outcomes);
            const updatedOutcomes = await curriculumRepository.getOutcomesByCourse(courseId);
            setOutcomes(updatedOutcomes);
          }
        } catch (e) {
          console.log('Using SQLite cached outcomes:', e);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [courseId, isOfflineMode, outcomes.length]);

  useEffect(() => {
    loadCourseData();
  }, [loadCourseData]);

  const handleDownloadToggle = () => {
    setIsDownloaded((prev) => !prev);
  };

  const isAiTutorAvailable = isOnline && !isOfflineMode;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding }} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <TouchableOpacity
            testID="course-overview-back-btn"
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to Courses"
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
              COURSE SYLLABUS & BLUEPRINT
            </Text>
            <Text style={[typography.h2, { color: colors.text.primary, fontWeight: '700' }]}>
              {course?.code || code}
            </Text>
          </View>
        </View>

        {/* Course Header Hero Card */}
        <Card variant="elevated" style={{ marginBottom: spacing.md, padding: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
            <View
              style={{
                backgroundColor: '#EFF6FF',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: borderRadius.sm,
              }}
            >
              <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                {course?.credit_hours || 3} Credit Hours
              </Text>
            </View>
            <EntitlementBadge status="INCLUDED" />
          </View>

          <Text style={[typography.h2, { color: colors.text.primary, marginBottom: spacing.xs, fontWeight: '700' }]}>
            {course?.title || 'Computer Maintenance and Technical Support'}
          </Text>

          <Text style={[typography.bodyMd, { color: colors.text.secondary, marginBottom: spacing.md }]}>
            {course?.general_objective || 'Diagnose and repair computer hardware, peripherals, and system software failures.'}
          </Text>

          {/* Course Package Control Card (Package v1 • Size • Download) */}
          <View
            style={{
              backgroundColor: colors.surface.secondary,
              padding: spacing.sm,
              borderRadius: borderRadius.md,
              borderWidth: 1,
              borderColor: colors.border.default,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CheckCircle2 size={16} color={colors.status.online} />
                <Text
                  style={[
                    typography.labelSm,
                    { color: colors.status.online, fontWeight: '700', marginLeft: 6 },
                  ]}
                >
                  Package v1 • Updated 14 Nov 2026
                </Text>
              </View>
              <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                18.4 MB
              </Text>
            </View>

            <PackageDownloadButton
              testID="course-package-control-button"
              state={isDownloaded ? 'AVAILABLE_OFFLINE' : 'ELIGIBLE'}
              sizeBytes={18.4 * 1024 * 1024}
              onPress={handleDownloadToggle}
            />
          </View>
        </Card>

        {/* Segmented Tabs (Outcomes | Resources | Practice) */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surface.secondary,
            borderRadius: borderRadius.md,
            padding: 3,
            marginBottom: spacing.md,
          }}
        >
          {(['outcomes', 'resources', 'practice'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                testID={`tab-${tab}`}
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.xs + 2,
                  alignItems: 'center',
                  backgroundColor: isActive ? colors.surface.card : 'transparent',
                  borderRadius: borderRadius.sm,
                  minHeight: 40,
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={[
                    typography.labelSm,
                    {
                      color: isActive ? colors.brand.primary : colors.text.secondary,
                      fontWeight: isActive ? '700' : '500',
                      textTransform: 'capitalize',
                    },
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab 1: Outcomes */}
        {activeTab === 'outcomes' && (
          <View testID="tab-content-outcomes">
            <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xxs, fontWeight: '700' }]}>
              Bloom's Taxonomy Competencies
            </Text>
            <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.md }]}>
              Mastery objectives evaluated in the National Exit Examination
            </Text>

            {outcomes.length === 0 ? (
              <Card variant="outlined">
                <Text style={[typography.bodyMd, { color: colors.text.secondary }]}>
                  Course learning outcomes mapped to Bloom's taxonomy are cached in local SQLite.
                </Text>
              </Card>
            ) : (
              outcomes.map((outcome, idx) => (
                <Card key={idx} testID={`outcome-card-${idx}`} variant="outlined" style={{ marginBottom: spacing.sm, padding: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <View
                      style={{
                        backgroundColor: '#F3E8FF',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: borderRadius.sm,
                        marginRight: spacing.xs,
                      }}
                    >
                      <Text style={[typography.labelSm, { color: '#7E22CE', fontWeight: '700' }]}>
                        {outcome.level}
                      </Text>
                    </View>
                    <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                      {outcome.domain} DOMAIN
                    </Text>
                  </View>

                  <Text style={[typography.bodyMd, { color: colors.text.primary, marginBottom: spacing.xs }]}>
                    {outcome.description}
                  </Text>

                  {/* Mastery Score Progress Bar */}
                  <View style={{ marginTop: spacing.xs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={[typography.labelSm, { color: colors.text.muted, fontSize: 11 }]}>
                        Mastery Level
                      </Text>
                      <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700', fontSize: 11 }]}>
                        78% Proficient
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 4,
                        backgroundColor: colors.surface.secondary,
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: '78%',
                          height: '100%',
                          backgroundColor: colors.brand.primary,
                          borderRadius: 2,
                        }}
                      />
                    </View>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {/* Tab 2: Resources */}
        {activeTab === 'resources' && (
          <View testID="tab-content-resources">
            <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xxs, fontWeight: '700' }]}>
              Course Lecture Notes & Past Model Exams
            </Text>
            <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.md }]}>
              Encrypted resources ready for offline reading
            </Text>

            {resources.map((res, idx) => {
              const isPdf = res.type === 'PAST_EXAM' || res.title.includes('PDF');
              const mb = (res.size_bytes / (1024 * 1024)).toFixed(1);

              return (
                <Card
                  key={idx}
                  testID={`resource-item-${idx}`}
                  variant="outlined"
                  style={{ marginBottom: spacing.sm, padding: spacing.md }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: borderRadius.sm,
                        backgroundColor: isPdf ? '#FEE2E2' : '#EFF6FF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: spacing.sm,
                      }}
                    >
                      <FileText size={22} color={isPdf ? colors.status.error : colors.brand.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600', marginBottom: 2 }]}>
                        {res.title}
                      </Text>
                      <Text style={[typography.labelSm, { color: colors.text.muted, marginBottom: spacing.xs }]}>
                        {res.type} • {mb} MB • Encrypted AES-256
                      </Text>

                      <Button
                        testID={`open-resource-btn-${idx}`}
                        title="Open in Reader (MOB-11)"
                        variant="outline"
                        size="sm"
                        onPress={() =>
                          navigation.navigate('ProtectedContentReader', {
                            resourceId: res.resource_id,
                            title: res.title,
                          })
                        }
                        style={{ alignSelf: 'flex-start', minHeight: 36 }}
                      />
                    </View>
                  </View>
                </Card>
              );
            })}

            <Button
              testID="browse-full-resource-library-btn"
              title="Browse Full Resource Library (MOB-09)"
              variant="outline"
              onPress={() =>
                navigation.navigate('ResourceLibrary', {
                  courseId,
                  courseCode: course?.code,
                  courseTitle: course?.title,
                })
              }
              style={{ marginTop: spacing.sm, marginBottom: spacing.md }}
            />
          </View>
        )}

        {/* Tab 3: Practice */}
        {activeTab === 'practice' && (
          <View testID="tab-content-practice">
            <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xxs, fontWeight: '700' }]}>
              Practice Assessments & Model Exit Exams
            </Text>
            <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.md }]}>
              Simulated exam runners with sub-16ms transactional SQLite saving
            </Text>

            {/* Seeded 100-Question Haramaya University Model Exit Exam */}
            <Card
              testID="model-exit-exam-card"
              variant="elevated"
              style={{
                marginBottom: spacing.md,
                padding: spacing.md,
                borderColor: colors.brand.primary,
                borderWidth: 1,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs }}>
                <View
                  style={{
                    backgroundColor: '#FEF3C7',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: borderRadius.sm,
                  }}
                >
                  <Text style={[typography.labelSm, { color: '#B45309', fontWeight: '700' }]}>
                    NATIONAL MODEL EXAM
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Clock size={14} color={colors.text.secondary} />
                  <Text style={[typography.labelSm, { color: colors.text.secondary, marginLeft: 4 }]}>
                    180 mins
                  </Text>
                </View>
              </View>

              <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xs, fontWeight: '700' }]}>
                HU CCI B.Sc. IT Graduating Class Model Exit Exam
              </Text>

              <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.md }]}>
                100 Questions • Timed assessment covering all 5 core themes. Transactional offline answer persistence with provisional grading.
              </Text>

              <Button
                testID="start-model-exam-cta"
                title="Start 100-Question Exam (MOB-13)"
                variant="primary"
                size="md"
                onPress={() =>
                  navigation.navigate('ExamInstructions', {
                    examPackageId: 'pkg_hu_cci_model_exit_2023',
                    title: 'HU CCI Model Exit Exam',
                    durationMinutes: 180,
                    questionCount: 100,
                  })
                }
                style={{ minHeight: 48 }}
              />
            </Card>

            {/* 25-Question Hardware Diagnostics Drill */}
            <Card
              testID="drill-25-card"
              variant="outlined"
              style={{ marginBottom: spacing.md, padding: spacing.md }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs }}>
                <View
                  style={{
                    backgroundColor: '#EFF6FF',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: borderRadius.sm,
                  }}
                >
                  <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                    PRACTICE DRILL
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Clock size={14} color={colors.text.secondary} />
                  <Text style={[typography.labelSm, { color: colors.text.secondary, marginLeft: 4 }]}>
                    45 mins
                  </Text>
                </View>
              </View>

              <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xs, fontWeight: '700' }]}>
                25-Question Hardware Diagnostics & Fault Isolation
              </Text>

              <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.md }]}>
                Quick diagnostic review drill with immediate local grading and Bloom's analytics.
              </Text>

              <Button
                testID="start-drill-cta"
                title="Start 25-Question Drill"
                variant="outline"
                size="md"
                onPress={() =>
                  navigation.navigate('ExamInstructions', {
                    examPackageId: 'pkg-it-cmts-drill-25',
                    title: 'Hardware Diagnostics Drill',
                    durationMinutes: 45,
                    questionCount: 25,
                  })
                }
                style={{ minHeight: 48 }}
              />
            </Card>
          </View>
        )}

        {/* Secondary Action: Grounded RAG AI Course Tutor Button */}
        <View style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
          <Button
            testID="ask-ai-tutor-btn"
            title="Ask AI Course Tutor (RAG)"
            variant="outline"
            leftIcon={<Bot size={20} color={isAiTutorAvailable ? colors.brand.primary : colors.text.muted} />}
            disabled={!isAiTutorAvailable}
            onPress={() =>
              Alert.alert(
                'AI Course Tutor',
                `Connecting to grounded pgvector(384) tutor for ${course?.code || 'Course'}...`
              )
            }
            style={{
              borderColor: isAiTutorAvailable ? colors.brand.primary : colors.border.default,
              minHeight: 48,
            }}
          />

          {!isAiTutorAvailable && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs }}>
              <WifiOff size={14} color={colors.status.offline} />
              <Text style={[typography.labelSm, { color: colors.status.offline, marginLeft: 4 }]}>
                Online connection required for AI Tutor
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
