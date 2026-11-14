import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import {
  Card,
  EntitlementBadge,
  PackageDownloadButton,
} from '../../shared/components';
import { curriculumRepository, LocalCourse } from '../../shared/database/curriculumRepository';
import { ArrowLeft, BookOpen, ChevronRight, CheckCircle2 } from 'lucide-react-native';

interface CourseListScreenProps {
  route: any;
  navigation: any;
}

export const CourseListScreen: React.FC<CourseListScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { themeId = 1, title = 'Courses' } = route.params || {};

  const [courses, setCourses] = useState<LocalCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadStates, setDownloadStates] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const list = await curriculumRepository.getCoursesByTheme(themeId);
        setCourses(list);

        const dlMap: Record<number, boolean> = {};
        for (const c of list) {
          dlMap[c.course_id] = Boolean(c.is_downloaded);
        }
        setDownloadStates(dlMap);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [themeId]);

  const handleDownloadToggle = (courseId: number) => {
    setDownloadStates((prev) => ({
      ...prev,
      [courseId]: !prev[courseId],
    }));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, padding: spacing.screenPadding }}>
        {/* Breadcrumb Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <TouchableOpacity
            testID="course-list-back-btn"
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to Theme Catalog"
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
              THEME {themeId} COURSES
            </Text>
            <Text numberOfLines={1} style={[typography.h2, { color: colors.text.primary, fontWeight: '700' }]}>
              {title}
            </Text>
          </View>
        </View>

        {/* Course Cards List */}
        <ScrollView showsVerticalScrollIndicator={false}>
          {courses.map((course) => {
            const isDownloaded = Boolean(downloadStates[course.course_id]);
            const packageBytes = 14.2 * 1024 * 1024; // 14.2 MB canonical course package size

            return (
              <Card
                key={course.course_id}
                testID={`course-card-${course.course_id}`}
                variant="elevated"
                onPress={() =>
                  navigation.navigate('CourseOverview', {
                    courseId: course.course_id,
                    code: course.code,
                  })
                }
                style={{ marginBottom: spacing.md, padding: spacing.md }}
              >
                {/* Header row: Course Code + Entitlement */}
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
                        backgroundColor: '#EFF6FF',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: borderRadius.sm,
                      }}
                    >
                      <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                        {course.code}
                      </Text>
                    </View>
                    <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '600' }]}>
                      {course.credit_hours} Cr
                    </Text>
                  </View>

                  <EntitlementBadge status="INCLUDED" />
                </View>

                {/* Title */}
                <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xs, fontWeight: '700' }]}>
                  {course.title}
                </Text>

                {/* Objective */}
                <Text
                  numberOfLines={2}
                  style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}
                >
                  {course.general_objective}
                </Text>

                {/* Mastery Progress Bar (3/6 Outcomes) */}
                <View style={{ marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                      Bloom's Outcomes Mastery
                    </Text>
                    <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '600' }]}>
                      3/6 Outcomes
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: colors.surface.secondary,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: '50%',
                        height: '100%',
                        backgroundColor: colors.brand.primary,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                </View>

                {/* Download Button + Details Action */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTopWidth: 1,
                    borderTopColor: colors.border.subtle,
                    paddingTop: spacing.xs,
                  }}
                >
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <PackageDownloadButton
                      testID={`download-btn-${course.course_id}`}
                      state={isDownloaded ? 'AVAILABLE_OFFLINE' : 'ELIGIBLE'}
                      sizeBytes={packageBytes}
                      onPress={() => handleDownloadToggle(course.course_id)}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={[
                        typography.labelSm,
                        { color: colors.brand.primary, fontWeight: '600', marginRight: 2 },
                      ]}
                    >
                      Overview
                    </Text>
                    <ChevronRight size={16} color={colors.brand.primary} />
                  </View>
                </View>
              </Card>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
