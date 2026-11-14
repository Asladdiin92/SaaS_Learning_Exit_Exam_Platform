import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, EntitlementBadge } from '../../shared/components';
import { curriculumRepository, LocalCourse } from '../../shared/database/curriculumRepository';
import { ArrowLeft, BookOpen, Download, Check, ChevronRight } from 'lucide-react-native';

interface CourseListScreenProps {
  route: any;
  navigation: any;
}

export const CourseListScreen: React.FC<CourseListScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { themeId, title } = route.params || { themeId: 1, title: 'Courses' };

  const [courses, setCourses] = useState<LocalCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const list = await curriculumRepository.getCoursesByTheme(themeId);
        setCourses(list);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [themeId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, padding: spacing.screenPadding }}>
        {/* Breadcrumb Header */}
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
              THEME {themeId} COURSES
            </Text>
            <Text numberOfLines={1} style={[typography.h2, { color: colors.text.primary }]}>
              {title}
            </Text>
          </View>
        </View>

        {/* Course Cards List */}
        <ScrollView showsVerticalScrollIndicator={false}>
          {courses.map((course) => (
            <Card
              key={course.course_id}
              variant="elevated"
              onPress={() =>
                navigation.navigate('CourseOverview', {
                  courseId: course.course_id,
                  code: course.code,
                })
              }
              style={{ marginBottom: spacing.md }}
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
                        marginRight: spacing.xs,
                      },
                    ]}
                  >
                    {course.code}
                  </Text>
                  <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '600' }]}>
                    {course.credit_hours} Credit Hours
                  </Text>
                </View>

                <EntitlementBadge status="INCLUDED" />
              </View>

              {/* Title */}
              <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xs }]}>
                {course.title}
              </Text>

              {/* Objective */}
              <Text
                numberOfLines={2}
                style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.md }]}
              >
                {course.general_objective}
              </Text>

              {/* Footer action bar */}
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Check size={14} color={colors.status.online} />
                  <Text
                    style={[
                      typography.labelSm,
                      { color: colors.status.online, marginLeft: 4, fontWeight: '600' },
                    ]}
                  >
                    Available Offline
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    style={[
                      typography.labelSm,
                      { color: colors.brand.primary, fontWeight: '600', marginRight: 2 },
                    ]}
                  >
                    View Syllabus
                  </Text>
                  <ChevronRight size={16} color={colors.brand.primary} />
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
