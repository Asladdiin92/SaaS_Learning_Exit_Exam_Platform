import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, Button, RichContentRenderer, WatermarkOverlay } from '../../shared/components';
import { useAuthSession } from '../../services/auth-session/AuthSessionContext';
import {
  CANONICAL_STUDY_MATERIALS,
  CourseMaterialItem,
} from '../../shared/database/courseStudyMaterials';
import { AITutorModalSheet } from '../ai/components/AITutorModalSheet';
import { database } from '../../shared/database/db';
import {
  BookOpen,
  Search,
  Maximize2,
  Minimize2,
  Bookmark,
  BookmarkCheck,
  Bot,
  Sun,
  Moon,
  Coffee,
  ArrowLeft,
  ChevronRight,
  List,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
} from 'lucide-react-native';

export type ReaderTheme = 'dark' | 'sepia' | 'light';

export const StudyWorkspaceScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { user } = useAuthSession();

  // Selected material state
  const initialMaterialId = route.params?.materialId;
  const initialCourseId = route.params?.courseId;

  const [activeMaterial, setActiveMaterial] = useState<CourseMaterialItem | null>(() => {
    if (initialMaterialId) {
      return (
        CANONICAL_STUDY_MATERIALS.find((m) => m.id === initialMaterialId) || null
      );
    }
    if (initialCourseId) {
      return (
        CANONICAL_STUDY_MATERIALS.find((m) => m.courseId === initialCourseId) || null
      );
    }
    return null;
  });

  // Library mode vs Reader mode
  const [isDistractionFree, setIsDistractionFree] = useState(false);
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>('dark');
  const [fontSize, setFontSize] = useState(16);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<number | 'ALL'>('ALL');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [isTOCVisible, setIsTOCVisible] = useState(false);
  const [isAITutorOpen, setIsAITutorOpen] = useState(false);
  const [currentSectionTitle, setCurrentSectionTitle] = useState('');

  // Load bookmarks on mount
  useEffect(() => {
    database
      .query<{ resource_id: string }>(
        `SELECT resource_id FROM local_bookmarks WHERE resource_id IS NOT NULL;`
      )
      .then((rows) => {
        const ids = new Set(rows.map((r) => r.resource_id));
        setBookmarkedIds(ids);
      })
      .catch(() => {});
  }, []);

  // Filter materials in Library
  const filteredMaterials = useMemo(() => {
    return CANONICAL_STUDY_MATERIALS.filter((mat) => {
      if (selectedThemeFilter !== 'ALL' && mat.themeNumber !== selectedThemeFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        mat.title.toLowerCase().includes(q) ||
        mat.courseCode.toLowerCase().includes(q) ||
        mat.courseTitle.toLowerCase().includes(q) ||
        mat.subtitle.toLowerCase().includes(q) ||
        mat.chapters.some((ch) => ch.title.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, selectedThemeFilter]);

  // Toggle Bookmark
  const toggleBookmark = async (materialId: string) => {
    const isBookmarked = bookmarkedIds.has(materialId);
    const newSet = new Set(bookmarkedIds);
    if (isBookmarked) {
      newSet.delete(materialId);
      await database
        .execute(`DELETE FROM local_bookmarks WHERE resource_id = ?;`, [materialId])
        .catch(() => {});
    } else {
      newSet.add(materialId);
      await database
        .execute(
          `INSERT OR REPLACE INTO local_bookmarks (bookmark_id, user_id, resource_id, location_anchor, created_at)
           VALUES (?, ?, ?, ?, ?);`,
          [
            `bm_${materialId}`,
            'usr-local',
            materialId,
            'page-1',
            new Date().toISOString(),
          ]
        )
        .catch(() => {});
    }
    setBookmarkedIds(newSet);
  };

  // Theme styling for Reader mode
  const readerStyles = useMemo(() => {
    switch (readerTheme) {
      case 'sepia':
        return {
          bg: '#FBF0D9',
          cardBg: '#F3E5C8',
          text: '#433422',
          subtext: '#6A5638',
          border: '#E2D1B3',
        };
      case 'light':
        return {
          bg: '#FFFFFF',
          cardBg: '#F8FAFC',
          text: '#0F172A',
          subtext: '#475569',
          border: '#E2E8F0',
        };
      case 'dark':
      default:
        return {
          bg: '#0B0F19',
          cardBg: '#131B2E',
          text: '#F8FAFC',
          subtext: '#94A3B8',
          border: '#1E293B',
        };
    }
  }, [readerTheme]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: DISTRACTION-FREE STUDY READER
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeMaterial) {
    const isCurrentBookmarked = bookmarkedIds.has(activeMaterial.id);

    return (
      <View style={{ flex: 1, backgroundColor: readerStyles.bg }}>
        <StatusBar
          barStyle={readerTheme === 'light' ? 'dark-content' : 'light-content'}
          hidden={isDistractionFree}
        />

        {/* Floating Minimalist Control Bar (can be toggled or minimized) */}
        {!isDistractionFree && (
          <SafeAreaView style={{ backgroundColor: readerStyles.cardBg }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 2,
                borderBottomWidth: 1,
                borderBottomColor: readerStyles.border,
              }}
            >
              {/* Back to Library */}
              <TouchableOpacity
                onPress={() => setActiveMaterial(null)}
                style={{ flexDirection: 'row', alignItems: 'center' }}
                accessibilityLabel="Back to Digital Library"
              >
                <ArrowLeft size={20} color={readerStyles.text} />
                <Text
                  style={[
                    typography.labelSm,
                    { color: readerStyles.text, marginLeft: 6, fontWeight: '600' },
                  ]}
                >
                  Library
                </Text>
              </TouchableOpacity>

              {/* Reader Tools */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {/* Font Size Scaling */}
                <TouchableOpacity
                  onPress={() => setFontSize((prev) => Math.max(13, prev - 2))}
                  style={styles.toolIconBtn}
                >
                  <Text style={{ color: readerStyles.text, fontWeight: '700', fontSize: 13 }}>
                    A-
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFontSize((prev) => Math.min(24, prev + 2))}
                  style={styles.toolIconBtn}
                >
                  <Text style={{ color: readerStyles.text, fontWeight: '700', fontSize: 16 }}>
                    A+
                  </Text>
                </TouchableOpacity>

                {/* Theme Switcher (Dark -> Sepia -> Light) */}
                <TouchableOpacity
                  onPress={() => {
                    if (readerTheme === 'dark') setReaderTheme('sepia');
                    else if (readerTheme === 'sepia') setReaderTheme('light');
                    else setReaderTheme('dark');
                  }}
                  style={styles.toolIconBtn}
                >
                  {readerTheme === 'dark' ? (
                    <Moon size={18} color="#FBBF24" />
                  ) : readerTheme === 'sepia' ? (
                    <Coffee size={18} color="#92400E" />
                  ) : (
                    <Sun size={18} color="#EA580C" />
                  )}
                </TouchableOpacity>

                {/* Table of Contents */}
                <TouchableOpacity
                  onPress={() => setIsTOCVisible((prev) => !prev)}
                  style={styles.toolIconBtn}
                >
                  <List size={18} color={readerStyles.text} />
                </TouchableOpacity>

                {/* Bookmark */}
                <TouchableOpacity
                  onPress={() => toggleBookmark(activeMaterial.id)}
                  style={styles.toolIconBtn}
                >
                  {isCurrentBookmarked ? (
                    <BookmarkCheck size={18} color={colors.brand.primary} />
                  ) : (
                    <Bookmark size={18} color={readerStyles.text} />
                  )}
                </TouchableOpacity>

                {/* Fullscreen Distraction-Free Toggle */}
                <TouchableOpacity
                  onPress={() => setIsDistractionFree(true)}
                  style={[
                    styles.toolIconBtn,
                    { backgroundColor: colors.brand.primary, borderRadius: 6, paddingHorizontal: 6 },
                  ]}
                >
                  <Maximize2 size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        )}

        {/* Minimal Float Exit Button in Fullscreen Distraction-Free Mode */}
        {isDistractionFree && (
          <TouchableOpacity
            onPress={() => setIsDistractionFree(false)}
            style={{
              position: 'absolute',
              top: 36,
              right: 18,
              zIndex: 99,
              backgroundColor: 'rgba(0,0,0,0.6)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Minimize2 size={14} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>
              Exit Fullscreen
            </Text>
          </TouchableOpacity>
        )}

        {/* Table of Contents Drawer Popup */}
        {isTOCVisible && (
          <View
            style={{
              position: 'absolute',
              top: 55,
              right: 16,
              zIndex: 100,
              backgroundColor: readerStyles.cardBg,
              borderRadius: borderRadius.md,
              borderWidth: 1,
              borderColor: readerStyles.border,
              padding: spacing.md,
              maxWidth: 320,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 8,
            }}
          >
            <Text
              style={[
                typography.labelSm,
                { color: readerStyles.text, fontWeight: '700', marginBottom: spacing.xs },
              ]}
            >
              TABLE OF CONTENTS
            </Text>
            {activeMaterial.chapters.map((ch, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  setCurrentSectionTitle(ch.title);
                  setIsTOCVisible(false);
                }}
                style={{ paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: readerStyles.border }}
              >
                <Text style={{ color: readerStyles.text, fontSize: 13 }}>{ch.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Distraction-Free Markdown Content Reader */}
        <View style={{ flex: 1, position: 'relative' }}>
          <WatermarkOverlay
            watermarkText={`${user?.fullName || 'Verified Student'} • ${user?.email || 'student@university.edu.et'} • HARAMAYA CCI`}
            opacity={0.06}
          />
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: isDistractionFree ? 60 : spacing.lg,
              paddingBottom: 120,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Module Title Header */}
            <View style={{ marginBottom: spacing.lg }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <View
                  style={{
                    backgroundColor: colors.brand.primary,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                    {activeMaterial.courseCode}
                  </Text>
                </View>
                <Text style={{ color: readerStyles.subtext, fontSize: 12, fontWeight: '600' }}>
                  Theme {activeMaterial.themeNumber}: {activeMaterial.themeTitle}
                </Text>
                <Text style={{ color: readerStyles.subtext, fontSize: 12 }}>
                  • {activeMaterial.readTimeMin} min read
                </Text>
              </View>

              <Text
                style={{
                  color: readerStyles.text,
                  fontSize: fontSize + 8,
                  fontWeight: '800',
                  lineHeight: fontSize + 14,
                  marginBottom: 4,
                }}
              >
                {activeMaterial.title}
              </Text>
              <Text style={{ color: readerStyles.subtext, fontSize: fontSize, lineHeight: fontSize + 6 }}>
                {activeMaterial.subtitle}
              </Text>
            </View>

            {/* Rich Formatted Markdown Presentation */}
            <RichContentRenderer
              content={activeMaterial.markdown}
              fontScale={fontSize / 16}
              themeMode={readerTheme === 'dark' ? 'dark' : 'light'}
            />
          </ScrollView>
        </View>

        {/* Floating Quick Action Button: AI Tutor Companion */}
        <TouchableOpacity
          onPress={() => setIsAITutorOpen(true)}
          style={{
            position: 'absolute',
            bottom: 24,
            right: 20,
            backgroundColor: colors.brand.primary,
            borderRadius: 28,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Bot size={20} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13, marginLeft: 6 }}>
            Ask AI Tutor
          </Text>
        </TouchableOpacity>

        {/* Integrated AI Tutor Sheet */}
        <AITutorModalSheet
          visible={isAITutorOpen}
          onClose={() => setIsAITutorOpen(false)}
          courseId={activeMaterial.courseId}
          courseTitle={activeMaterial.courseTitle}
          initialPrompt={`Explain key principles for ${activeMaterial.title}`}
        />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: DIGITAL LIBRARY CATALOG VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, padding: spacing.screenPadding }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.xs,
          }}
        >
          <View>
            <Text
              style={[
                typography.h1,
                { color: colors.text.primary, fontWeight: '800', marginBottom: 2 },
              ]}
            >
              Study Workspace
            </Text>
            <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
              Official B.Sc. IT Exit Exam Digital Library & Manuscript Notes
            </Text>
          </View>

          <View
            style={{
              backgroundColor: '#1E293B',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: borderRadius.full,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <CheckCircle2 size={14} color={colors.status.online} />
            <Text
              style={{
                color: colors.status.online,
                fontSize: 11,
                fontWeight: '700',
                marginLeft: 4,
              }}
            >
              Offline Ready
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface.card,
            borderWidth: 1,
            borderColor: colors.border.default,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.sm,
            height: 44,
            marginTop: spacing.sm,
            marginBottom: spacing.sm,
          }}
        >
          <Search size={18} color={colors.text.muted} />
          <TextInput
            placeholder="Search topics, algorithms, ciphers, SQL..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[
              typography.bodySm,
              { flex: 1, marginLeft: 8, color: colors.text.primary },
            ]}
          />
        </View>

        {/* Theme Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 42, marginBottom: spacing.md }}
          contentContainerStyle={{ gap: 8 }}
        >
          {(['ALL', 1, 2, 3, 5] as const).map((filter) => {
            const isSelected = selectedThemeFilter === filter;
            const label =
              filter === 'ALL'
                ? 'All Materials'
                : filter === 1
                ? 'Theme 1: Systems'
                : filter === 2
                ? 'Theme 2: Software'
                : filter === 3
                ? 'Theme 3: Databases'
                : 'Theme 5: Security';

            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setSelectedThemeFilter(filter)}
                style={{
                  backgroundColor: isSelected ? colors.brand.primary : colors.surface.card,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: borderRadius.full,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.brand.primary : colors.border.default,
                  justifyContent: 'center',
                  minHeight: 34,
                }}
              >
                <Text
                  style={{
                    color: isSelected ? '#FFFFFF' : colors.text.secondary,
                    fontSize: 12,
                    fontWeight: isSelected ? '700' : '500',
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Material Cards List */}
        <ScrollView showsVerticalScrollIndicator={false}>
          {filteredMaterials.map((item) => {
            const isBookmarked = bookmarkedIds.has(item.id);

            return (
              <Card
                key={item.id}
                testID={`study-card-${item.id}`}
                variant="elevated"
                onPress={() => setActiveMaterial(item)}
                style={{
                  marginBottom: spacing.md,
                  padding: spacing.md,
                  backgroundColor: colors.surface.card,
                  borderColor: colors.border.default,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    {/* Header Chips */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 4,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: '#E0F2FE',
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: borderRadius.sm,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.brand.primary,
                            fontSize: 11,
                            fontWeight: '700',
                          }}
                        >
                          {item.courseCode}
                        </Text>
                      </View>
                      <Text
                        style={[
                          typography.labelSm,
                          { color: colors.text.secondary, fontWeight: '600' },
                        ]}
                      >
                        Theme {item.themeNumber}
                      </Text>
                    </View>

                    {/* Title & Subtitle */}
                    <Text
                      style={[
                        typography.h3,
                        { color: colors.text.primary, fontWeight: '700', marginBottom: 2 },
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        typography.bodySm,
                        { color: colors.text.secondary, marginBottom: spacing.xs },
                      ]}
                      numberOfLines={2}
                    >
                      {item.subtitle}
                    </Text>

                    {/* Meta & Stats */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        marginTop: 4,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Clock size={13} color={colors.text.muted} />
                        <Text
                          style={{
                            color: colors.text.muted,
                            fontSize: 11,
                            marginLeft: 4,
                          }}
                        >
                          {item.readTimeMin} min study
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Layers size={13} color={colors.text.muted} />
                        <Text
                          style={{
                            color: colors.text.muted,
                            fontSize: 11,
                            marginLeft: 4,
                          }}
                        >
                          {item.chapters.length} Key Chapters
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Bookmark Button */}
                  <TouchableOpacity
                    onPress={() => toggleBookmark(item.id)}
                    style={{ padding: 4 }}
                  >
                    {isBookmarked ? (
                      <BookmarkCheck size={20} color={colors.brand.primary} />
                    ) : (
                      <Bookmark size={20} color={colors.text.muted} />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Read Action CTA */}
                <View style={{ marginTop: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 0.5, borderTopColor: colors.border.default, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.brand.primary, fontSize: 12, fontWeight: '700' }}>
                    Open in Distraction-Free Reader ➔
                  </Text>
                  <ChevronRight size={16} color={colors.brand.primary} />
                </View>
              </Card>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  toolIconBtn: {
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
