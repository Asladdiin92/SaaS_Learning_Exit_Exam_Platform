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

  const loadThemes = async () => {
    // 1. Instant local read (<16ms) from SQLite
    const local = await curriculumRepository.getThemes();
    if (local.length > 0) {
      setThemes(local);
    }

    // 2. Background sync if online
    if (!isOfflineMode) {
      try {
        const remote = await api.get('/curriculum/themes');
        if (Array.isArray(remote)) {
          await curriculumRepository.saveThemes(remote);
          const updated = await curriculumRepository.getThemes();
          setThemes(updated);
        }
      } catch (e) {
        console.log('Using cached SQLite themes:', e);
      }
    }
  };

  useEffect(() => {
    loadThemes();
  }, [isOfflineMode]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadThemes();
    setRefreshing(false);
  };

  const filteredThemes = themes.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.courses && t.courses.some((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.code.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesSearch;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, padding: spacing.screenPadding }}>
        {/* Header */}
        <Text style={[typography.h1, { color: colors.text.primary, marginBottom: spacing.xxs }]}>
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
            onPress={() => setFilterOfflineOnly(false)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: borderRadius.full,
              backgroundColor: !filterOfflineOnly ? colors.brand.primary : colors.surface.card,
              borderWidth: 1,
              borderColor: !filterOfflineOnly ? colors.brand.primary : colors.border.default,
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
            onPress={() => setFilterOfflineOnly(true)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: borderRadius.full,
              backgroundColor: filterOfflineOnly ? colors.brand.primary : colors.surface.card,
              borderWidth: 1,
              borderColor: filterOfflineOnly ? colors.brand.primary : colors.border.default,
            }}
          >
            <Text
              style={[
                typography.labelSm,
                { color: filterOfflineOnly ? '#FFFFFF' : colors.text.secondary, fontWeight: '600' },
              ]}
            >
              Offline Ready ✓
            </Text>
          </TouchableOpacity>
        </View>

        {/* Themes List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredThemes.map((theme) => {
            const courseCount = theme.courses?.length || 0;

            return (
              <Card
                key={theme.theme_id}
                variant="elevated"
                onPress={() => navigation.navigate('CourseList', { themeId: theme.theme_id, title: theme.title })}
                style={{ marginBottom: spacing.md }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <View
                        style={{
                          backgroundColor: '#E0F2FE',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: borderRadius.sm,
                          marginRight: spacing.xs,
                        }}
                      >
                        <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                          THEME {theme.theme_number}
                        </Text>
                      </View>

                      <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '600' }]}>
                        {theme.total_credit_hours} Credit Hours
                      </Text>
                    </View>

                    <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.xs }]}>
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
                        {courseCount} Courses Included
                      </Text>
                      <Text style={[typography.labelSm, { color: colors.status.online, fontWeight: '600' }]}>
                        ● Local SQLite Cached
                      </Text>
                    </View>
                  </View>

                  <ChevronRight size={20} color={colors.text.secondary} />
                </View>
              </Card>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
