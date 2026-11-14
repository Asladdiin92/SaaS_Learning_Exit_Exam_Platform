import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useTheme } from '../../shared/theme';
import { WatermarkOverlay } from '../../shared/components';
import { useAuthSession } from '../../services/auth-session/AuthSessionContext';
import { downloadManager } from '../../services/download-manager';
import { database } from '../../shared/database/db';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Sun,
  Moon,
  Coffee,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';

type ReaderTheme = 'light' | 'sepia' | 'dark';

export const ProtectedContentReaderScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { colors, typography } = useTheme();
  const { user } = useAuthSession();
  const resourceId = route.params?.resourceId || 'res_default';
  const title = route.params?.title || 'Course Lecture & Exam Package';
  const courseId = route.params?.courseId || 1;

  const [readerTheme, setReaderTheme] = useState<ReaderTheme>('light');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages] = useState(12);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Android FLAG_SECURE Deterrence & Reading Lock Registration
  useEffect(() => {
    downloadManager.setCurrentlyReading(resourceId);

    async function enableScreenProtection() {
      try {
        await ScreenCapture.preventScreenCaptureAsync();
      } catch (e) {
        console.warn('ScreenCapture protection not available in this environment:', e);
      }
    }
    enableScreenProtection();

    async function loadBookmark() {
      try {
        await database.init();
        const rows = await database.query<{ page_or_position: string }>(
          `SELECT page_or_position FROM local_bookmarks WHERE resource_id = ? LIMIT 1`,
          [resourceId]
        );
        if (rows && rows.length > 0) {
          const savedPage = parseInt(rows[0].page_or_position, 10);
          if (!isNaN(savedPage) && savedPage >= 1) {
            setCurrentPage(savedPage);
            setIsBookmarked(true);
          }
        }
      } catch (err) {
        console.warn('Failed to load bookmark:', err);
      }
    }
    loadBookmark();

    return () => {
      downloadManager.setCurrentlyReading(null);
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [resourceId]);

  // 2. 3-Second Debounced Bookmark / Reading Position Persistence
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await database.init();
        const userId = user?.userId || 'anonymous_user';
        const bookmarkId = `bm_${resourceId}`;
        await database.execute(
          `INSERT OR REPLACE INTO local_bookmarks (bookmark_id, user_id, resource_id, page_or_position, updated_at, version)
           VALUES (?, ?, ?, ?, datetime('now'), 1);`,
          [bookmarkId, userId, resourceId, String(currentPage)]
        );
      } catch (err) {
        console.warn('Failed to persist debounced reading progress:', err);
      }
    }, 3000);
  }, [currentPage, resourceId, user]);

  const toggleBookmark = async () => {
    const nextState = !isBookmarked;
    setIsBookmarked(nextState);
    await database.init();
    const userId = user?.userId || 'anonymous_user';
    const bookmarkId = `bm_${resourceId}`;

    if (nextState) {
      await database.execute(
        `INSERT OR REPLACE INTO local_bookmarks (bookmark_id, user_id, resource_id, page_or_position, updated_at, version)
         VALUES (?, ?, ?, ?, datetime('now'), 1);`,
        [bookmarkId, userId, resourceId, String(currentPage)]
      );
    } else {
      await database.execute(`DELETE FROM local_bookmarks WHERE bookmark_id = ?`, [bookmarkId]);
    }
  };

  const watermarkText = `${user?.fullName || 'Verified Student'} • ${
    user?.email || 'student@university.edu.et'
  } • ${new Date().toISOString().substring(0, 16).replace('T', ' ')} UTC`;

  const themeStyles = {
    light: {
      bg: '#FFFFFF',
      text: '#1F2937',
      toolbarBg: '#F9FAFB',
      border: '#E5E7EB',
    },
    sepia: {
      bg: '#FBF0D9',
      text: '#433422',
      toolbarBg: '#F3E5C8',
      border: '#E2D1B3',
    },
    dark: {
      bg: '#111827',
      text: '#F3F4F6',
      toolbarBg: '#1F2937',
      border: '#374151',
    },
  }[readerTheme];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeStyles.bg }}>
      <StatusBar
        barStyle={readerTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={themeStyles.toolbarBg}
      />

      {/* Top Toolbar */}
      <View
        style={[
          styles.toolbar,
          { backgroundColor: themeStyles.toolbarBg, borderBottomColor: themeStyles.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={themeStyles.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={[typography.h3, { color: themeStyles.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
            Page {currentPage} of {totalPages} • Auto-saved
          </Text>
        </View>

        {/* Theme Controls */}
        <View style={styles.themeGroup}>
          <TouchableOpacity
            onPress={() => setReaderTheme('light')}
            style={[
              styles.themeChip,
              readerTheme === 'light' && { borderColor: colors.brand.primary, borderWidth: 2 },
            ]}
          >
            <Sun size={14} color="#1F2937" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setReaderTheme('sepia')}
            style={[
              styles.themeChip,
              { backgroundColor: '#FBF0D9' },
              readerTheme === 'sepia' && { borderColor: colors.brand.primary, borderWidth: 2 },
            ]}
          >
            <Coffee size={14} color="#433422" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setReaderTheme('dark')}
            style={[
              styles.themeChip,
              { backgroundColor: '#111827' },
              readerTheme === 'dark' && { borderColor: colors.brand.primary, borderWidth: 2 },
            ]}
          >
            <Moon size={14} color="#F3F4F6" />
          </TouchableOpacity>
        </View>

        {/* Bookmark Toggle */}
        <TouchableOpacity onPress={toggleBookmark} style={styles.iconButton}>
          {isBookmarked ? (
            <BookmarkCheck size={22} color={colors.status.offline} />
          ) : (
            <Bookmark size={22} color={themeStyles.text} />
          )}
        </TouchableOpacity>
      </View>

      {/* Protected Viewport with Dynamic Watermark */}
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <Text
            style={[
              typography.h2,
              { color: themeStyles.text, marginBottom: 16, fontWeight: '700' },
            ]}
          >
            Section {currentPage}: Comprehensive Exit Exam Synthesis
          </Text>

          <Text style={[typography.bodyLg, { color: themeStyles.text, lineHeight: 28 }]}>
            This protected module covers the required Bloom’s taxonomy outcomes for Information
            Technology Exit Exam preparation. Content is decrypted on-the-fly into memory and
            bound strictly to your enrolled device profile.
          </Text>

          <View
            style={[
              styles.codeBox,
              {
                backgroundColor: readerTheme === 'dark' ? '#0F172A' : '#F1F5F9',
                borderColor: themeStyles.border,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: 'monospace',
                fontSize: 13,
                color: readerTheme === 'dark' ? '#38BDF8' : '#0369A1',
                lineHeight: 20,
              }}
            >
              {`// DRM Protected Stream Chunk - Section ${currentPage}\nclass ExamSessionSecurity {\n    static boolean verifyIntegrity(String sha256) {\n        return sha256 != null && sha256.length() == 64;\n    }\n}`}
            </Text>
          </View>

          <Text style={[typography.bodyLg, { color: themeStyles.text, lineHeight: 28, marginTop: 16 }]}>
            Review the past exam questions and verify corresponding learning outcomes in your
            course dashboard before scheduling an exam runner simulation.
          </Text>
        </ScrollView>

        {/* Dynamic User Identity Watermark Overlay */}
        <WatermarkOverlay watermarkText={watermarkText} opacity={0.14} />
      </View>

      {/* Bottom Scrubber & Navigation Bar */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: themeStyles.toolbarBg, borderTopColor: themeStyles.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          style={[styles.pageButton, currentPage === 1 && { opacity: 0.3 }]}
        >
          <ChevronLeft size={20} color={themeStyles.text} />
          <Text style={[typography.labelSm, { color: themeStyles.text, marginLeft: 4 }]}>
            Previous
          </Text>
        </TouchableOpacity>

        <Text style={[typography.labelSm, { color: themeStyles.text }]}>
          {currentPage} / {totalPages}
        </Text>

        <TouchableOpacity
          onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          style={[styles.pageButton, currentPage === totalPages && { opacity: 0.3 }]}
        >
          <Text style={[typography.labelSm, { color: themeStyles.text, marginRight: 4 }]}>
            Next
          </Text>
          <ChevronRight size={20} color={themeStyles.text} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  toolbar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeGroup: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 6,
  },
  themeChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  codeBox: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 14,
  },
  bottomBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
  },
});
