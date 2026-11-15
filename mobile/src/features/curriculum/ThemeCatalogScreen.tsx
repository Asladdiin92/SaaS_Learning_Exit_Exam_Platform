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
import { Card, TextInput } from '../../shared/components';
import { curriculumRepository, LocalTheme } from '../../shared/database/curriculumRepository';
import { api } from '../../shared/api/client';
import { useAuthSession } from '../../services/auth-session/AuthSessionContext';
import {
  Search,
  BookOpen,
  ChevronRight,
  Wifi,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react-native';

interface ThemeCatalogScreenProps {
  navigation: any;
}

export const ThemeCatalogScreen: React.FC<ThemeCatalogScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { isOfflineMode } = useAuthSession();

  const [themes, setThemes] = useState<LocalTheme[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOfflineOnly, setFilterOfflineOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadThemes = useCallback(async () => {
    // 1. Instant local read (<16ms) from SQLite
    const local = await curriculumRepository.getThemesWithOfflineStatus();
    if (local.length > 0) {
      setThemes(local);
    }

    // 2. Background sync if online
    if (!isOfflineMode) {
      try {
        const remote = await api.get('/curriculum/themes');
        if (Array.isArray(remote)) {
          await curriculumRepository.saveThemes(remote);
          const updated = await curriculumRepository.getThemesWithOfflineStatus();
          setThemes(updated);
        }
      } catch (e) {
        console.log('Using cached SQLite themes:', e);
      }
    }
  }, [isOfflineMode]);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadThemes();
    setRefreshing(false);
  };

  const filteredThemes = themes.filter((t) => {
    if (filterOfflineOnly && !t.is_offline_ready && (t.downloaded_courses || 0) === 0) {
      return false;
    }
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    const matchesTitle = t.title.toLowerCase().includes(q);
    const matchesDesc = (t.description || '').toLowerCase().includes(q);
    const matchesCourse =
      t.courses &&
      t.courses.some(
        (c) => c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
      );
    return matchesTitle || matchesDesc || matchesCourse;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, padding: spacing.screenPadding }}>
        {/* Header */}
        <Text style={[typography.h1, { color: colors.text.primary, marginBottom: spacing.xxs, fontWeight: '700' }]}>
          Curriculum Themes
        </Text>
        <Text
          style={[
            typography.bodyMd,
            { color: colors.text.secondary, marginBottom: spacing.md },
          ]}
        >
          National B.Sc. IT Exit Exam Blueprint • 5 Themes • 45 Credit Hours
        </Text>

        {/* Distraction-Free Study Workspace & Digital Library Launcher */}
        <TouchableOpacity
          testID="study-workspace-theme-banner"
          onPress={() => navigation.navigate('StudyWorkspace')}
          accessibilityRole="button"
          accessibilityLabel="Open Study Workspace Digital Library"
          style={{
            backgroundColor: '#0F172A',
            borderRadius: borderRadius.md,
            padding: spacing.sm,
            marginBottom: spacing.sm,
            borderWidth: 1,
            borderColor: '#1E293B',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.xs }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.sm,
              }}
            >
              <BookOpen size={18} color="#38BDF8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.labelSm, { color: '#38BDF8', fontWeight: '700' }]}>
                STUDY WORKSPACE & DIGITAL LIBRARY
              </Text>
              <Text style={[typography.bodySm, { color: '#94A3B8', fontSize: 12 }]}>
                Distraction-free manuscripts & chapter notes
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#38BDF8" />
        </TouchableOpacity>

        {/* Search Bar */}
        <TextInput
          placeholder="Search themes, courses (e.g. IT-OOPJ-201)..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={{ marginBottom: spacing.sm }}
        />

        {/* Filter Chips */}
        <View style={{ flexDirection: 'row', marginBottom: spacing.md, gap: spacing.xs }}>
          <TouchableOpacity
            testID="filter-all-themes"
            onPress={() => setFilterOfflineOnly(false)}
            accessibilityRole="button"
            accessibilityLabel="Show all 5 themes"
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: borderRadius.full,
              backgroundColor: !filterOfflineOnly ? colors.brand.primary : colors.surface.card,
              borderWidth: 1,
              borderColor: !filterOfflineOnly ? colors.brand.primary : colors.border.default,
              minHeight: 36,
              justifyContent: 'center',
            }}
          >
            <Text
              style={[
                typography.labelSm,
                { color: !filterOfflineOnly ? '#FFFFFF' : colors.text.secondary, fontWeight: '600' },
              ]}
            >
              All 5 Themes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="filter-offline-ready"
            onPress={() => setFilterOfflineOnly(true)}
            accessibilityRole="button"
            accessibilityLabel="Filter offline ready themes"
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: borderRadius.full,
              backgroundColor: filterOfflineOnly ? colors.brand.primary : colors.surface.card,
              borderWidth: 1,
              borderColor: filterOfflineOnly ? colors.brand.primary : colors.border.default,
              minHeight: 36,
              justifyContent: 'center',
            }}
          >
            <Text
              style={[
                typography.labelSm,
                { color: filterOfflineOnly ? '#FFFFFF' : colors.text.secondary, fontWeight: '600' },
              ]}
            >
              Available Offline ✓
            </Text>
          </TouchableOpacity>
        </View>

        {/* Themes List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredThemes.map((theme) => {
            const courseCount = theme.courses?.length || theme.total_courses || 0;
            const isReady = Boolean(theme.is_offline_ready || (theme.downloaded_courses || 0) > 0);

            return (
              <Card
                key={theme.theme_id}
                testID={`theme-card-${theme.theme_id}`}
                variant="elevated"
                onPress={() =>
                  navigation.navigate('CourseList', {
                    themeId: theme.theme_id,
                    title: theme.title,
                  })
                }
                style={{ marginBottom: spacing.md, padding: spacing.md }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                      <View
                        style={{
                          backgroundColor: '#E0F2FE',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: borderRadius.sm,
                        }}
                      >
                        <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                          THEME {theme.theme_number}
                        </Text>
                      </View>

                      <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '600' }]}>
                        {theme.total_credit_hours} Credit Hours
                      </Text>

                      {isReady && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#ECFDF5',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: borderRadius.sm,
                          }}
                        >
                          <CheckCircle2 size={12} color={colors.status.online} />
                          <Text
                            style={[
                              typography.labelSm,
                              { color: colors.status.online, fontWeight: '700', fontSize: 11, marginLeft: 3 },
                            ]}
                          >
                            Offline Ready
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xs, fontWeight: '700' }]}>
                      {theme.title}
                    </Text>

                    {theme.description && (
                      <Text
                        numberOfLines={2}
                        style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}
                      >
                        {theme.description}
                      </Text>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                        {courseCount} {courseCount === 1 ? 'Course' : 'Courses'}
                      </Text>
                      <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '600' }]}>
                        View Courses →
                      </Text>
                    </View>
                  </View>

                  <ChevronRight size={22} color={colors.text.secondary} />
                </View>
              </Card>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
