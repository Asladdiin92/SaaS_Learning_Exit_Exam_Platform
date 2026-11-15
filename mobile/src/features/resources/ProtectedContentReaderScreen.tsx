import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated,
} from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useTheme } from '../../shared/theme';
import { WatermarkOverlay } from '../../shared/components/WatermarkOverlay';
import {
  ProtectedContentReader,
  ReaderThemeMode,
} from '../../shared/components/ProtectedContentReader';
import { useAuthSession } from '../../services/auth-session/AuthSessionContext';
import { downloadManager } from '../../services/download-manager';
import { database } from '../../shared/database/db';
import { secureStorage } from '../../shared/secure-storage';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Sun,
  Moon,
  Coffee,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  AArrowUp,
  AArrowDown,
  Compass,
} from 'lucide-react-native';

export const ProtectedContentReaderScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { colors, typography } = useTheme();
  const { user, currentWorkspace } = useAuthSession();

  const resourceId = route.params?.resourceId || 'res_default';
  const title = route.params?.title || 'Course Lecture & Exam Package';
  const courseId = route.params?.courseId || 101;
  const resourceType = route.params?.type || route.params?.resourceType || 'LECTURE_NOTE';
  const anchorCode = route.params?.anchorCode as string | undefined;

  // Reader configuration state
  const [readerTheme, setReaderTheme] = useState<ReaderThemeMode>('light');
  const [fontSize, setFontSize] = useState(16);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(30);
  const [savedLastPage, setSavedLastPage] = useState<number | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  // Security & License verification state
  const [isLoading, setIsLoading] = useState(true);
  const [licenseExpiredError, setLicenseExpiredError] = useState<string | null>(null);
  const [notDownloadedError, setNotDownloadedError] = useState<string | null>(null);
  const [ephemeralKey, setEphemeralKey] = useState<string | null>(null);
  const [packagePath, setPackagePath] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>('00000000');
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Offline Startup & License Verification
  useEffect(() => {
    let isMounted = true;

    async function initializeReader() {
      try {
        setIsLoading(true);
        setLicenseExpiredError(null);
        setNotDownloadedError(null);

        // Fetch Device ID for Watermark
        const devId = await secureStorage.getDeviceId();
        if (isMounted) setDeviceId(devId);

        // Initialize Database
        await database.init();
        const noteRows = await database.query<{ content_markdown: string | null }>(
          `SELECT content_markdown
           FROM local_resources
           WHERE resource_id = ?
           LIMIT 1;`,
          [resourceId]
        );
        if (noteRows[0]?.content_markdown && isMounted) {
          setMarkdownContent(noteRows[0].content_markdown);
          setTotalPages(1);
          setCurrentPage(1);
        }

        // 1. Query download_packages to check offline state and license
        const packages = await database.query<{
          package_id: string;
          resource_id: string;
          state: string;
          license_expiry: string | null;
          encrypted_path: string;
        }>(
          `SELECT package_id, resource_id, state, license_expiry, encrypted_path
           FROM download_packages
           WHERE resource_id = ? OR package_id = ?
           LIMIT 1;`,
          [resourceId, resourceId]
        );

        const pkg = packages && packages.length > 0 ? packages[0] : null;

        if (pkg && pkg.state === 'AVAILABLE_OFFLINE') {
          // Check License Expiry
          if (pkg.license_expiry) {
            const expiryTime = new Date(pkg.license_expiry).getTime();
            if (!isNaN(expiryTime) && expiryTime <= Date.now()) {
              if (isMounted) {
                const formattedDate = new Date(pkg.license_expiry).toLocaleDateString();
                setLicenseExpiredError(
                  `Offline access for this package expired on ${formattedDate} — Connect to refresh access.`
                );
                setIsLoading(false);
              }
              return;
            }
          }

          // Valid offline package!
          if (isMounted) {
            setPackagePath(pkg.encrypted_path);
          }

          // Retrieve wrapped AES-256 key from SecureStore (never from SQLite)
          const key = await secureStorage.getPackageKey(pkg.package_id || resourceId);
          if (isMounted) {
            setEphemeralKey(key);
          }

          // Register reading lock & update last opened timestamp
          downloadManager.setCurrentlyReading(resourceId);
          await database.execute(
            `UPDATE download_packages SET last_opened_at = datetime('now') WHERE package_id = ?;`,
            [pkg.package_id]
          );
        } else if (pkg && pkg.state !== 'AVAILABLE_OFFLINE') {
          // Package exists but is not available offline
          if (isMounted) {
            setNotDownloadedError(
              `This package is not downloaded for offline use (Status: ${pkg.state}). Connect to download.`
            );
          }
        } else {
          // No package found in download_packages
          // Allow opening default/preview mode if needed, but register reading session
          downloadManager.setCurrentlyReading(resourceId);
        }

        // 2. Load previous reading position from local_bookmarks
        const bookmarkRows = await database.query<{ page_or_position: string }>(
          `SELECT page_or_position FROM local_bookmarks WHERE resource_id = ? LIMIT 1;`,
          [resourceId]
        );

        if (bookmarkRows && bookmarkRows.length > 0 && isMounted) {
          const parsed = parseInt(bookmarkRows[0].page_or_position, 10);
          if (!isNaN(parsed) && parsed >= 1) {
            setSavedLastPage(parsed);
            setCurrentPage(parsed);
            setIsBookmarked(true);
          }
        }
      } catch (err) {
        console.warn('Reader initialization error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeReader();

    // Enable OS Screen Capture Prevention
    async function enableProtection() {
      try {
        await ScreenCapture.preventScreenCaptureAsync();
      } catch (e) {
        console.warn('ScreenCapture protection warning:', e);
      }
    }
    enableProtection();

    return () => {
      isMounted = false;
      downloadManager.setCurrentlyReading(null);
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [resourceId]);

  // 2. Persist Reading Position to SQLite & sync_operations (Debounced 3s)
  const persistReadingPosition = useCallback(
    async (pageToSave: number) => {
      try {
        await database.init();
        const userId = user?.userId || 'anonymous_user';
        const tenantId = currentWorkspace?.tenantId || null;
        const bookmarkId = `bm_${resourceId}`;
        const pageStr = String(pageToSave);

        // Atomic SQLite transaction saving bookmark and enqueuing sync_operations
        await database.withTransaction(async (tx) => {
          // 1. Update local_bookmarks
          await tx.execute(
            `INSERT OR REPLACE INTO local_bookmarks
             (bookmark_id, user_id, resource_id, page_or_position, updated_at, version)
             VALUES (?, ?, ?, ?, datetime('now'), 1);`,
            [bookmarkId, userId, resourceId, pageStr]
          );

          // 2. Enqueue bookmark.upsert in durable sync_operations outbox
          const operationId = `op_bm_${resourceId}_${Date.now()}`;
          const payload = JSON.stringify({
            bookmark_id: bookmarkId,
            resource_id: resourceId,
            page_or_position: pageStr,
            updated_at: new Date().toISOString(),
          });

          await tx.execute(
            `INSERT OR REPLACE INTO sync_operations
             (operation_id, user_id, tenant_id, type, payload_json, state, created_at)
             VALUES (?, ?, ?, 'bookmark.upsert', ?, 'QUEUED', datetime('now'));`,
            [operationId, userId, tenantId, payload]
          );
        });
      } catch (err) {
        console.warn('Failed to persist reading position to SQLite & sync_operations:', err);
      }
    },
    [resourceId, user, currentWorkspace]
  );

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, newPage));
    setCurrentPage(clamped);

    // Debounce position persistence by 3 seconds
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      persistReadingPosition(clamped);
    }, 3000);
  };

  const toggleBookmark = async () => {
    const nextState = !isBookmarked;
    setIsBookmarked(nextState);

    if (nextState) {
      await persistReadingPosition(currentPage);
    } else {
      try {
        await database.init();
        const bookmarkId = `bm_${resourceId}`;
        await database.execute(`DELETE FROM local_bookmarks WHERE bookmark_id = ?;`, [bookmarkId]);
      } catch (e) {
        console.warn('Failed to delete bookmark:', e);
      }
    }
  };

  // Jump to saved bookmark position
  const jumpToLastRead = () => {
    if (savedLastPage && savedLastPage !== currentPage) {
      handlePageChange(savedLastPage);
    }
  };

  // Navigate to Practice drills for this course
  const handlePracticeTopic = () => {
    navigation.navigate('Practice', {
      screen: 'PracticeCatalog',
      params: { courseId },
    });
  };

  // Build dynamic user watermark
  const utcTimestamp = new Date().toISOString().substring(0, 16).replace('T', ' ') + ' UTC';
  const watermarkText = `${user?.fullName || 'Verified Student'} • ${
    user?.email || 'student@university.edu.et'
  } • Device: ${deviceId ? deviceId.slice(0, 8) : '00000000'} • ${utcTimestamp}`;

  const themeStyles = {
    light: {
      bg: '#FFFFFF',
      text: '#1F2937',
      secondaryText: '#6B7280',
      toolbarBg: '#F9FAFB',
      border: '#E5E7EB',
    },
    sepia: {
      bg: '#FBF0D9',
      text: '#433422',
      secondaryText: '#786245',
      toolbarBg: '#F3E5C8',
      border: '#E2D1B3',
    },
    dark: {
      bg: '#0F172A',
      text: '#F3F4F6',
      secondaryText: '#94A3B8',
      toolbarBg: '#1E293B',
      border: '#334155',
    },
  }[readerTheme];

  // --- Render Loading State ---
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: themeStyles.bg }]}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={[typography.bodyMd, { color: themeStyles.text, marginTop: 16 }]}>
          Loading and decrypting protected package...
        </Text>
      </SafeAreaView>
    );
  }

  // --- Render Expired License State ---
  if (licenseExpiredError) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: themeStyles.bg }]}>
        <View style={styles.errorCard} testID="expired-license-view">
          <AlertTriangle size={48} color={colors.status.offline} style={{ marginBottom: 16 }} />
          <Text style={[typography.h3, { color: themeStyles.text, textAlign: 'center' }]}>
            Access Expired
          </Text>
          <Text
            style={[
              typography.bodyMd,
              { color: themeStyles.secondaryText, textAlign: 'center', marginVertical: 12 },
            ]}
          >
            {licenseExpiredError}
          </Text>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: colors.brand.primary }]}
            onPress={() => navigation.goBack()}
            testID="expired-license-action-btn"
          >
            <RotateCcw size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
              Connect to Refresh Access
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Render Not Downloaded State ---
  if (notDownloadedError) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: themeStyles.bg }]}>
        <View style={styles.errorCard} testID="not-downloaded-view">
          <Compass size={48} color={colors.status.info} style={{ marginBottom: 16 }} />
          <Text style={[typography.h3, { color: themeStyles.text, textAlign: 'center' }]}>
            Not Available Offline
          </Text>
          <Text
            style={[
              typography.bodyMd,
              { color: themeStyles.secondaryText, textAlign: 'center', marginVertical: 12 },
            ]}
          >
            {notDownloadedError}
          </Text>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: colors.brand.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeStyles.bg }}>
      <StatusBar
        barStyle={readerTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={themeStyles.toolbarBg}
      />

      {/* Auto-Hiding Top Toolbar */}
      {isToolbarVisible && (
        <View
          style={[
            styles.toolbar,
            { backgroundColor: themeStyles.toolbarBg, borderBottomColor: themeStyles.border },
          ]}
          testID="reader-toolbar"
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconButton}
            accessibilityLabel="Back"
            testID="reader-back-button"
          >
            <ArrowLeft size={22} color={themeStyles.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text style={[typography.h3, { color: themeStyles.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[typography.labelSm, { color: themeStyles.secondaryText }]}>
              Page {currentPage} of {totalPages} • Auto-saving
            </Text>
          </View>

          {/* Font Size Adjusters */}
          <View style={styles.fontSizeControls}>
            <TouchableOpacity
              onPress={() => setFontSize((s) => Math.max(12, s - 2))}
              style={styles.fontSizeBtn}
              accessibilityLabel="Decrease font size"
            >
              <AArrowDown size={16} color={themeStyles.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFontSize((s) => Math.min(24, s + 2))}
              style={styles.fontSizeBtn}
              accessibilityLabel="Increase font size"
            >
              <AArrowUp size={16} color={themeStyles.text} />
            </TouchableOpacity>
          </View>

          {/* Theme Palette Controls */}
          <View style={styles.themeGroup}>
            <TouchableOpacity
              onPress={() => setReaderTheme('light')}
              style={[
                styles.themeChip,
                readerTheme === 'light' && { borderColor: colors.brand.primary, borderWidth: 2 },
              ]}
              accessibilityLabel="Light theme"
            >
              <Sun size={13} color="#1F2937" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setReaderTheme('sepia')}
              style={[
                styles.themeChip,
                { backgroundColor: '#FBF0D9' },
                readerTheme === 'sepia' && { borderColor: colors.brand.primary, borderWidth: 2 },
              ]}
              accessibilityLabel="Sepia theme"
            >
              <Coffee size={13} color="#433422" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setReaderTheme('dark')}
              style={[
                styles.themeChip,
                { backgroundColor: '#0F172A' },
                readerTheme === 'dark' && { borderColor: colors.brand.primary, borderWidth: 2 },
              ]}
              accessibilityLabel="Dark theme"
            >
              <Moon size={13} color="#F3F4F6" />
            </TouchableOpacity>
          </View>

          {/* Bookmark Toggle Icon */}
          <TouchableOpacity
            onPress={toggleBookmark}
            style={styles.iconButton}
            accessibilityLabel="Bookmark page"
            testID="reader-bookmark-button"
          >
            {isBookmarked ? (
              <BookmarkCheck size={22} color={colors.brand.primary} />
            ) : (
              <Bookmark size={22} color={themeStyles.text} />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Main Reader Viewport with Watermark & Decryption */}
      <ProtectedContentReader
        packagePath={packagePath || undefined}
        ephemeralKey={ephemeralKey}
        watermarkText={watermarkText}
        resourceId={resourceId}
        courseId={courseId}
        title={title}
        resourceType={resourceType}
        totalPages={totalPages}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        readerTheme={readerTheme}
        fontSize={fontSize}
        onPracticeTopic={handlePracticeTopic}
        markdownContent={markdownContent || undefined}
        anchorCode={anchorCode}
      />

      {/* Bottom Scrubber & Practice Navigation Bar */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: themeStyles.toolbarBg, borderTopColor: themeStyles.border },
        ]}
        testID="reader-bottom-bar"
      >
        {/* Previous Page */}
        <TouchableOpacity
          onPress={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={[styles.pageButton, currentPage === 1 && { opacity: 0.3 }]}
          testID="reader-prev-page"
        >
          <ChevronLeft size={18} color={themeStyles.text} />
          <Text style={[typography.labelSm, { color: themeStyles.text, marginLeft: 2 }]}>Prev</Text>
        </TouchableOpacity>

        {/* Center Indicators & Jump Pill */}
        <View style={styles.centerIndicatorGroup}>
          <Text style={[typography.labelSm, { color: themeStyles.text, fontWeight: '700' }]}>
            {currentPage} / {totalPages}
          </Text>

          {/* Jump to Last Read Position Pill */}
          {savedLastPage && savedLastPage !== currentPage && (
            <TouchableOpacity
              onPress={jumpToLastRead}
              style={[styles.jumpPill, { backgroundColor: colors.brand.primary + '18' }]}
              testID="jump-to-last-read"
            >
              <Text style={[styles.jumpPillText, { color: colors.brand.primary }]}>
                Jump to p. {savedLastPage}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Contextual Practice Topic CTA */}
        <TouchableOpacity
          onPress={handlePracticeTopic}
          style={[styles.practiceTopicBtn, { backgroundColor: colors.brand.primary }]}
          testID="practice-topic-btn"
        >
          <Sparkles size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.practiceTopicBtnText}>Practice</Text>
        </TouchableOpacity>

        {/* Next Page */}
        <TouchableOpacity
          onPress={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={[styles.pageButton, currentPage === totalPages && { opacity: 0.3 }]}
          testID="reader-next-page"
        >
          <Text style={[typography.labelSm, { color: themeStyles.text, marginRight: 2 }]}>Next</Text>
          <ChevronRight size={18} color={themeStyles.text} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    maxWidth: 360,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  toolbar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontSizeControls: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 6,
  },
  fontSizeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeGroup: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 6,
  },
  themeChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  bottomBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 40,
  },
  centerIndicatorGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  jumpPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  practiceTopicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  practiceTopicBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
