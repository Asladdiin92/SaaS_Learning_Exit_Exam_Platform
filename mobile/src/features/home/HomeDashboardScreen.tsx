import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import {
  WorkspaceSwitcherChip,
  SyncStatusChip,
  Card,
  Button,
} from '../../shared/components';
import { useAuthSession } from '../../services/auth-session/AuthSessionContext';
import { curriculumRepository, LocalCourse } from '../../shared/database/curriculumRepository';
import {
  BookOpen,
  Wifi,
  WifiOff,
  Flame,
  ChevronRight,
  Sparkles,
  Layers,
  FileCheck,
} from 'lucide-react-native';

interface HomeDashboardProps {
  navigation: any;
}

export const HomeDashboardScreen: React.FC<HomeDashboardProps> = ({ navigation }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { currentWorkspace, isOfflineMode, user } = useAuthSession();

  const [courses, setCourses] = useState<LocalCourse[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const list = await curriculumRepository.getAllCourses();
    setCourses(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      {/* Top AppHeader */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.screenPadding,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.default,
          backgroundColor: colors.surface.card,
        }}
      >
        <WorkspaceSwitcherChip
          organizationName={currentWorkspace?.organizationName || 'Personal Workspace'}
          isPersonal={currentWorkspace?.isPersonal ?? true}
          onPress={() => navigation.navigate('WorkspaceSelection')}
        />

        <SyncStatusChip
          state={isOfflineMode ? 'offline' : 'online'}
          onPress={() => navigation.navigate('SyncCenter')}
        />
      </View>

      {/* Connection Banner (Expands when offline) */}
      {isOfflineMode && (
        <View
          style={{
            backgroundColor: '#FEF3C7',
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.screenPadding,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <WifiOff size={14} color={colors.status.offline} />
          <Text
            style={[
              typography.labelSm,
              { color: colors.status.offline, marginLeft: spacing.xxs, fontWeight: '600' },
            ]}
          >
            Offline Mode — Instant sub-16ms access from encrypted storage
          </Text>
        </View>
      )}

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
            <Text style={[typography.h2, { color: colors.text.primary }]}>
              Hello, {user?.fullName?.split(' ')[0] || 'Student'} 👋
            </Text>
          </View>

          {/* Daily Streak Pill */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFEDD5',
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xxs,
              borderRadius: borderRadius.full,
            }}
          >
            <Flame size={16} color="#EA580C" />
            <Text
              style={[
                typography.labelSm,
                { color: '#EA580C', fontWeight: '700', marginLeft: 4 },
              ]}
            >
              5-Day Streak
            </Text>
          </View>
        </View>

        {/* Zone 1: Continue Learning Hero Card */}
        <Card
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
                  { color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600', marginBottom: 4 },
                ]}
              >
                RESUME STUDYING
              </Text>
              <Text style={[typography.h3, { color: '#FFFFFF', marginBottom: spacing.xs }]}>
                IT-FDBS-201: Relational Algebra & SQL
              </Text>
              <Text style={[typography.bodySm, { color: 'rgba(255, 255, 255, 0.9)' }]}>
                Lecture 04 • Normalization (1NF to BCNF)
              </Text>
            </View>

            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={22} color="#FFFFFF" />
            </View>
          </View>

          <Button
            title="Resume Reading (p. 14)"
            variant="secondary"
            size="sm"
            onPress={() => navigation.navigate('CourseOverview', { courseId: 7 })}
            style={{ marginTop: spacing.md, backgroundColor: '#FFFFFF' }}
          />
        </Card>

        {/* Zone 2: Offline Readiness Strip */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: spacing.md,
            gap: spacing.xs,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface.card,
              padding: spacing.sm,
              borderRadius: borderRadius.md,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border.default,
            }}
          >
            <Layers size={20} color={colors.brand.primary} />
            <Text style={[typography.h3, { color: colors.text.primary, marginTop: 4 }]}>
              {courses.length || 15}
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.muted, fontSize: 11 }]}>
              Courses Ready
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface.card,
              padding: spacing.sm,
              borderRadius: borderRadius.md,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border.default,
            }}
          >
            <FileCheck size={20} color={colors.status.online} />
            <Text style={[typography.h3, { color: colors.text.primary, marginTop: 4 }]}>
              120 Qs
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.muted, fontSize: 11 }]}>
              Sim Ready
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface.card,
              padding: spacing.sm,
              borderRadius: borderRadius.md,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border.default,
            }}
          >
            <Sparkles size={20} color="#7E22CE" />
            <Text style={[typography.h3, { color: colors.text.primary, marginTop: 4 }]}>
              45 Cr
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.muted, fontSize: 11 }]}>
              Total Scope
            </Text>
          </View>
        </View>

        {/* Zone 3: Targeted Weak-Outcome Recommendations */}
        <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xs }]}>
          Recommended Practice Drills
        </Text>
        <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
          Based on Bloom's Taxonomy assessment objectives
        </Text>

        <Card
          variant="outlined"
          onPress={() => navigation.navigate('CourseOverview', { courseId: 12 })}
          style={{ marginBottom: spacing.sm }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                IT-DCCN-201 • APPLY
              </Text>
              <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}>
                VLSM Subnetting & IPv4 Subnet Mask Calculation
              </Text>
            </View>
            <ChevronRight size={18} color={colors.text.secondary} />
          </View>
        </Card>

        <Card
          variant="outlined"
          onPress={() => navigation.navigate('CourseOverview', { courseId: 2 })}
          style={{ marginBottom: spacing.lg }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                IT-OOPJ-201 • ANALYSE
              </Text>
              <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}>
                JVM Memory Stack vs Heap & Polymorphic Dispatch
              </Text>
            </View>
            <ChevronRight size={18} color={colors.text.secondary} />
          </View>
        </Card>

        {/* Quick Curriculum Exploration CTA */}
        <Button
          title="Browse All 5 Curriculum Themes"
          variant="outline"
          onPress={() => navigation.navigate('Curriculum')}
          style={{ marginBottom: spacing.md }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};
