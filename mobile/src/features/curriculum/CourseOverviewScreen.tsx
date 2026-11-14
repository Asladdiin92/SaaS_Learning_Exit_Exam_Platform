import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, Button, EntitlementBadge } from '../../shared/components';
import {
  curriculumRepository,
  LocalCourse,
  LocalOutcome,
} from '../../shared/database/curriculumRepository';
import { api } from '../../shared/api/client';
import { useAuthSession } from '../../services/auth-session/AuthSessionContext';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Bot,
  BookOpen,
  FileText,
  Target,
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
  const { courseId = 1 } = route.params || {};

  const [course, setCourse] = useState<LocalCourse | null>(null);
  const [outcomes, setOutcomes] = useState<LocalOutcome[]>([]);
  const [activeTab, setActiveTab] = useState<'outcomes' | 'resources' | 'practice'>('outcomes');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCourse = async () => {
      try {
        // 1. Instant local read (<16ms)
        const localCourse = await curriculumRepository.getCourseById(courseId);
        setCourse(localCourse);

        const localOutcomes = await curriculumRepository.getOutcomesByCourse(courseId);
        setOutcomes(localOutcomes);

        // 2. Fetch remote outcomes if online and uncached
        if (!isOfflineMode && localOutcomes.length === 0) {
          try {
            const remote = await api.get(`/courses/${courseId}`);
            if (remote && remote.outcomes) {
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
    };

    loadCourse();
  }, [courseId, isOfflineMode]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding }}>
        {/* Top Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: spacing.sm }}
          >
            <ArrowLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              COURSE SYLLABUS & BLUEPRINT
            </Text>
            <Text style={[typography.h2, { color: colors.text.primary }]}>
              {course?.code || 'Course'}
            </Text>
          </View>
        </View>

        {/* Course Header Hero Card */}
        <Card variant="elevated" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
            <Text
              style={[
                typography.labelSm,
                {
                  color: colors.brand.primary,
                  fontWeight: '700',
                  backgroundColor: '#EFF6FF',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: borderRadius.sm,
                },
              ]}
            >
              {course?.credit_hours || 3} Credit Hours
            </Text>
            <EntitlementBadge status="INCLUDED" />
          </View>

          <Text style={[typography.h2, { color: colors.text.primary, marginBottom: spacing.xs }]}>
            {course?.title}
          </Text>

          <Text style={[typography.bodyMd, { color: colors.text.secondary, marginBottom: spacing.md }]}>
            {course?.general_objective}
          </Text>

          {/* Package Offline Status Bar */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: colors.surface.secondary,
              padding: spacing.sm,
              borderRadius: borderRadius.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CheckCircle2 size={16} color={colors.status.online} />
              <Text
                style={[
                  typography.labelSm,
                  { color: colors.status.online, fontWeight: '700', marginLeft: 6 },
                ]}
              >
                Package v1 • Available Offline
              </Text>
            </View>

            <Text style={[typography.labelSm, { color: colors.text.muted }]}>
              18.4 MB
            </Text>
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
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.xs + 2,
                  alignItems: 'center',
                  backgroundColor: isActive ? colors.surface.card : 'transparent',
                  borderRadius: borderRadius.sm,
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
          <View>
            <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xs }]}>
              Bloom's Taxonomy Competencies
            </Text>
            <Text
              style={[
                typography.bodySm,
                { color: colors.text.secondary, marginBottom: spacing.md },
              ]}
            >
              Mastery requirements evaluated in the National Exit Examination
            </Text>

            {outcomes.length === 0 ? (
              <Card variant="outlined">
                <Text style={[typography.bodyMd, { color: colors.text.secondary }]}>
                  Course learning outcomes mapped to Bloom's taxonomy are cached in local SQLite.
                </Text>
              </Card>
            ) : (
              outcomes.map((outcome, idx) => (
                <Card key={idx} variant="outlined" style={{ marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
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
                  <Text style={[typography.bodyMd, { color: colors.text.primary }]}>
                    {outcome.description}
                  </Text>
                </Card>
              ))
            )}
          </View>
        )}

        {/* Tab 2: Resources */}
        {activeTab === 'resources' && (
          <View>
            <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.sm }]}>
              Course Lecture Notes & Lab Packages
            </Text>
            <Card variant="outlined">
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                <FileText size={20} color={colors.brand.primary} />
                <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600', marginLeft: 8 }]}>
                  Complete Course Syllabus & Lecture Slides
                </Text>
              </View>
              <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
                Encrypted AES-256 package • 14.2 MB • Ready for offline reader
              </Text>
              <Button
                title="Browse Full Resource Library (MOB-09)"
                variant="primary"
                size="sm"
                onPress={() =>
                  navigation.navigate('ResourceLibrary', {
                    courseId: course?.course_id || courseId,
                    courseTitle: course?.title || 'Course Resources',
                  })
                }
              />
            </Card>
          </View>
        )}

        {/* Tab 3: Practice */}
        {activeTab === 'practice' && (
          <View>
            <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.sm }]}>
              Exam Drills & Practice Blueprints
            </Text>
            <Card variant="outlined">
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                <Target size={20} color={colors.status.online} />
                <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600', marginLeft: 8 }]}>
                  25-Question Course Exit Drill
                </Text>
              </View>
              <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
                Timed assessment (45 min) • Sub-16ms transactional SQLite answer saves
              </Text>
              <Button
                title="Start Practice Exam (MOB-15)"
                variant="primary"
                size="sm"
                onPress={() => Alert.alert('Exam Runner', 'Launching locked offline exam runner with transactional answer persistence...')}
              />
            </Card>
          </View>
        )}

        {/* Grounded RAG AI Tutor CTA */}
        <Button
          title="Ask AI Course Tutor (RAG)"
          variant="outline"
          leftIcon={<Bot size={20} color={colors.brand.primary} />}
          onPress={() =>
            Alert.alert(
              'AI Tutor',
              `Connecting to grounded pgvector(384) course tutor for ${course?.code}...`
            )
          }
          style={{ marginTop: spacing.lg, marginBottom: spacing.md }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};
