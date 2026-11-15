import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  AppState,
  AppStateStatus,
  TextInput as RNTextInput,
} from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useTheme } from '../theme';
import { WatermarkOverlay } from './WatermarkOverlay';
import {
  Bookmark,
  BookmarkCheck,
  Search,
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  HelpCircle,
  FileText,
  Code2,
  Table,
  CheckCircle2,
} from 'lucide-react-native';

export type ReaderThemeMode = 'light' | 'sepia' | 'dark';

export interface ProtectedContentReaderProps {
  packagePath?: string;
  ephemeralKey?: string | null;
  watermarkText: string;
  resourceId: string;
  courseId?: number;
  title: string;
  resourceType?: string;
  markdownContent?: string;
  anchorCode?: string;
  totalPages?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onToggleBookmark?: () => void;
  isBookmarked?: boolean;
  readerTheme?: ReaderThemeMode;
  fontSize?: number;
  onPracticeTopic?: () => void;
  onBack?: () => void;
  testID?: string;
}

export const ProtectedContentReader: React.FC<ProtectedContentReaderProps> = ({
  packagePath,
  ephemeralKey,
  watermarkText,
  resourceId,
  courseId = 101,
  title,
  resourceType = 'LECTURE_NOTE',
  markdownContent,
  anchorCode,
  totalPages = 30,
  currentPage: externalCurrentPage,
  onPageChange,
  onToggleBookmark,
  isBookmarked = false,
  readerTheme = 'light',
  fontSize = 16,
  onPracticeTopic,
  onBack,
  testID = 'protected-content-reader',
}) => {
  const { colors, typography } = useTheme();

  // Internal page state if not controlled externally
  const [internalPage, setInternalPage] = useState(externalCurrentPage || 1);
  const activePage = externalCurrentPage !== undefined ? externalCurrentPage : internalPage;

  // Zoom scale for PDF / Document viewer
  const [zoomScale, setZoomScale] = useState(1.0);

  // Search in document
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Screen recording security status
  const [isScreenRecordingDetected, setIsScreenRecordingDetected] = useState(false);

  // Ephemeral memory buffer for decrypted content (purged on background/unmount)
  const [volatileDecryptedBuffer, setVolatileDecryptedBuffer] = useState<string | null>(null);
  const markdownScrollRef = useRef<ScrollView>(null);
  const markdownAnchorOffsets = useRef<Record<string, number>>({});

  const structuredNotes = useMemo(() => {
    if (!markdownContent) return { introduction: '', notes: [] as Array<{ anchor: string; content: string }> };
    const anchorRegex = /<a id="(NOTE-[^"]+)"><\/a>\s*([\s\S]*?)(?=<a id="NOTE-[^"]+"><\/a>|$)/g;
    const matches = [...markdownContent.matchAll(anchorRegex)];
    return {
      introduction: matches.length
        ? markdownContent.slice(0, matches[0].index).trim()
        : markdownContent.trim(),
      notes: matches.map((match) => ({
        anchor: match[1],
        content: match[2].trim(),
      })),
    };
  }, [markdownContent]);

  useEffect(() => {
    markdownAnchorOffsets.current = {};
  }, [markdownContent]);

  useEffect(() => {
    if (!anchorCode) return;
    const offset = markdownAnchorOffsets.current[anchorCode];
    if (offset !== undefined) {
      markdownScrollRef.current?.scrollTo({ y: offset, animated: false });
    }
  }, [anchorCode, structuredNotes]);

  // Decryption into volatile memory only
  const decryptInRAM = useCallback(() => {
    // In mobile runtime, load decrypted representation strictly in memory
    const memoryKey = ephemeralKey || 'dev_ephemeral_aes_256_key';
    const bufferPayload = `DECRYPTED_PAYLOAD_CHUNK_PAGE_${activePage}_KEY_${memoryKey.slice(0, 8)}`;
    setVolatileDecryptedBuffer(bufferPayload);
  }, [activePage, ephemeralKey]);

  // Purge volatile buffer on background or unmount
  const purgeDecryptedBuffer = useCallback(() => {
    setVolatileDecryptedBuffer(null);
  }, []);

  useEffect(() => {
    decryptInRAM();

    // AppState listener to purge memory buffers when app backgrounds
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        purgeDecryptedBuffer();
      } else if (nextAppState === 'active') {
        decryptInRAM();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      sub.remove();
      purgeDecryptedBuffer();
    };
  }, [decryptInRAM, purgeDecryptedBuffer]);

  // Screen Capture Protection (FLAG_SECURE on Android & Screen Recording observer)
  useEffect(() => {
    let screenshotSub: ScreenCapture.Subscription | null = null;

    async function setupCaptureProtection() {
      try {
        await ScreenCapture.preventScreenCaptureAsync();
      } catch (err) {
        console.warn('ScreenCapture.preventScreenCaptureAsync warning:', err);
      }

      try {
        screenshotSub = ScreenCapture.addScreenshotListener(() => {
          setIsScreenRecordingDetected(true);
        });
      } catch (err) {
        // Not all platforms support screenshot listeners
      }
    }

    setupCaptureProtection();

    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
      if (screenshotSub) {
        ScreenCapture.removeScreenshotListener(screenshotSub);
      }
    };
  }, []);

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, newPage));
    if (clamped !== activePage) {
      setInternalPage(clamped);
      if (onPageChange) {
        onPageChange(clamped);
      }
    }
  };

  const themeColors = {
    light: {
      bg: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#0F172A',
      secondaryText: '#475569',
      border: '#E2E8F0',
      codeBg: '#0F172A',
      codeText: '#38BDF8',
      calloutBg: '#EFF6FF',
      calloutBorder: '#3B82F6',
    },
    sepia: {
      bg: '#FBF0D9',
      surface: '#F4E6C8',
      text: '#433422',
      secondaryText: '#786245',
      border: '#E5D3B3',
      codeBg: '#2D2318',
      codeText: '#E6C280',
      calloutBg: '#F5E9CE',
      calloutBorder: '#B45309',
    },
    dark: {
      bg: '#0F172A',
      surface: '#1E293B',
      text: '#F1F5F9',
      secondaryText: '#94A3B8',
      border: '#334155',
      codeBg: '#020617',
      codeText: '#38BDF8',
      calloutBg: '#1E293B',
      calloutBorder: '#2563EB',
    },
  }[readerTheme];

  const isPdfOrExam =
    resourceType === 'PAST_EXAM' ||
    title.toLowerCase().includes('pdf') ||
    title.toLowerCase().includes('model exit exam');

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]} testID={testID}>
      {/* Screen Recording Warning Banner */}
      {isScreenRecordingDetected && (
        <View style={styles.securityBanner} testID="screen-recording-banner">
          <Text style={styles.securityBannerText}>
            Screen recording is disabled for protected course materials.
          </Text>
          <TouchableOpacity
            onPress={() => setIsScreenRecordingDetected(false)}
            style={styles.securityDismiss}
          >
            <X size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Find in Document Bar */}
      {isSearchActive && (
        <View
          style={[
            styles.searchBar,
            { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border },
          ]}
        >
          <Search size={18} color={themeColors.secondaryText} style={{ marginRight: 8 }} />
          <RNTextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Find in document..."
            placeholderTextColor={themeColors.secondaryText}
            style={[styles.searchInput, { color: themeColors.text }]}
            autoFocus
          />
          <TouchableOpacity onPress={() => setIsSearchActive(false)}>
            <X size={18} color={themeColors.secondaryText} />
          </TouchableOpacity>
        </View>
      )}

      {/* Main Viewport Content */}
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          ref={markdownContent ? markdownScrollRef : undefined}
          contentContainerStyle={[
            styles.scrollContent,
            { transform: [{ scale: zoomScale }] },
          ]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (!anchorCode) return;
            const offset = markdownAnchorOffsets.current[anchorCode];
            if (offset !== undefined) {
              markdownScrollRef.current?.scrollTo({ y: offset + 20, animated: false });
            }
          }}
        >
          {markdownContent ? (
            <View style={styles.markdownPage} testID="structured-study-notes">
              <Text
                style={[
                  styles.markdownHeading1,
                  { color: themeColors.text, fontSize: fontSize + 6 },
                ]}
              >
                {title}
              </Text>
              {structuredNotes.introduction && (
                <Text
                  style={[
                    styles.markdownBody,
                    { color: themeColors.text, fontSize, lineHeight: fontSize * 1.6 },
                  ]}
                >
                  {structuredNotes.introduction
                    .replace(/^#+\s*/gm, '')
                    .replace(/\*\*/g, '')
                    .replace(/`/g, '')}
                </Text>
              )}
              {anchorCode && !structuredNotes.notes.some((note) => note.anchor === anchorCode) && (
                <Text
                  accessibilityRole="alert"
                  style={[styles.markdownBody, { color: colors.status.error, fontSize }]}
                >
                  The requested study-note anchor {anchorCode} is not available in this resource.
                </Text>
              )}
              {structuredNotes.notes.map((note) => (
                <View
                  key={note.anchor}
                  nativeID={note.anchor}
                  testID={`study-note-${note.anchor}`}
                  onLayout={(event) => {
                    const y = event.nativeEvent.layout.y + 20;
                    markdownAnchorOffsets.current[note.anchor] = y;
                    if (note.anchor === anchorCode) {
                      markdownScrollRef.current?.scrollTo({ y, animated: false });
                    }
                  }}
                  style={[
                    styles.calloutCard,
                    {
                      backgroundColor: themeColors.surface,
                      borderLeftColor: themeColors.calloutBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.calloutBody,
                      {
                        color: themeColors.text,
                        fontSize,
                        lineHeight: fontSize * 1.6,
                      },
                    ]}
                  >
                    {note.content
                      .replace(/^#{1,6}\s*/gm, '')
                      .replace(/\*\*/g, '')
                      .replace(/`/g, '')}
                  </Text>
                </View>
              ))}
            </View>
          ) : isPdfOrExam ? (
            /* --- PDF / Past Exam Paged Document View --- */
            <View style={styles.documentPage}>
              <View
                style={[
                  styles.examHeaderCard,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                ]}
              >
                <Text style={[styles.examInstitution, { color: colors.brand.primary }]}>
                  HARAMAYA UNIVERSITY • CCI
                </Text>
                <Text style={[styles.examDepartment, { color: themeColors.text }]}>
                  Department of Information Technology
                </Text>
                <Text style={[styles.examDocTitle, { color: themeColors.text }]}>
                  B.Sc. IT National Model Exit Exam Paper
                </Text>
                <View style={styles.examMetaRow}>
                  <Text style={[styles.examMetaTag, { color: themeColors.secondaryText }]}>
                    Section {activePage} of {totalPages}
                  </Text>
                  <Text style={[styles.examMetaTag, { color: themeColors.secondaryText }]}>
                    Time Allowed: 3 Hours
                  </Text>
                  <Text style={[styles.examMetaTag, { color: themeColors.secondaryText }]}>
                    Total Items: 100
                  </Text>
                </View>
              </View>

              {/* Exam Question Item Sample on this Page */}
              <View
                style={[
                  styles.questionContainer,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                ]}
              >
                <View style={styles.questionBadgeRow}>
                  <Text style={styles.questionNumberBadge}>Item {activePage}</Text>
                  <Text style={[styles.questionCourseCode, { color: colors.brand.primary }]}>
                    IT-CMTS-101 • Apply
                  </Text>
                </View>

                <Text
                  style={[
                    styles.questionStem,
                    { color: themeColors.text, fontSize: fontSize + 1 },
                  ]}
                >
                  During a routine hardware diagnosis of a laboratory workstation, the system emits
                  one long beep followed by two short beeps during POST. Which hardware subsystem is
                  most likely failing?
                </Text>

                {/* Question Options */}
                <View style={styles.optionsList}>
                  {[
                    'A. Main System RAM parity failure',
                    'B. Display adapter or video memory fault',
                    'C. CMOS battery depleted',
                    'D. Secondary SATA storage controller malfunction',
                  ].map((opt, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.optionRow,
                        { borderColor: themeColors.border, backgroundColor: themeColors.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          { color: themeColors.text, fontSize },
                        ]}
                      >
                        {opt}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Code Snippet for Multi-Format Diagnostic */}
              <View style={[styles.codeBlock, { backgroundColor: themeColors.codeBg }]}>
                <View style={styles.codeHeader}>
                  <Code2 size={14} color={themeColors.codeText} />
                  <Text style={[styles.codeLang, { color: themeColors.codeText }]}>
                    C++ / Hardware POST Routine
                  </Text>
                </View>
                <Text
                  style={[
                    styles.codeContent,
                    { color: themeColors.codeText, fontSize: fontSize - 2 },
                  ]}
                >
                  {`// POST Diagnostic Check - Module ${activePage}
void BIOS_BeepSequence(int longBeeps, int shortBeeps) {
    if (longBeeps == 1 && shortBeeps == 2) {
        logDiagnosticFault(VIDEO_CONTROLLER_FAIL);
        haltExecution(POST_ERR_GRAPHICS);
    }
}`}
                </Text>
              </View>
            </View>
          ) : (
            /* --- Structured Markdown / Lecture Notes View --- */
            <View style={styles.markdownPage}>
              <Text
                style={[
                  styles.markdownHeading1,
                  { color: themeColors.text, fontSize: fontSize + 6 },
                ]}
              >
                Topic {activePage}: System Architecture & Maintenance
              </Text>

              <Text
                style={[
                  styles.markdownBody,
                  { color: themeColors.text, fontSize, lineHeight: fontSize * 1.6 },
                ]}
              >
                This module prepares graduating seniors for the Ministry of Education exit
                examination competency area in Computer Maintenance and Technical Support.
                Instructional concepts adhere directly to the Harmonized Ethiopian National
                Curriculum standards.
              </Text>

              {/* Key Takeaway Callout */}
              <View
                style={[
                  styles.calloutCard,
                  {
                    backgroundColor: themeColors.calloutBg,
                    borderLeftColor: themeColors.calloutBorder,
                  },
                ]}
              >
                <View style={styles.calloutHeader}>
                  <CheckCircle2 size={18} color={themeColors.calloutBorder} />
                  <Text
                    style={[
                      styles.calloutTitle,
                      { color: themeColors.calloutBorder, fontSize: fontSize },
                    ]}
                  >
                    Core Competency Takeaway
                  </Text>
                </View>
                <Text
                  style={[
                    styles.calloutBody,
                    {
                      color: themeColors.text,
                      fontSize: fontSize - 1,
                      lineHeight: (fontSize - 1) * 1.5,
                    },
                  ]}
                >
                  Systematic fault isolation requires isolating the power delivery subsystem, POST
                  chime diagnostic codes, and BIOS memory before physical component replacement.
                </Text>
              </View>

              {/* Relational Table */}
              <View
                style={[
                  styles.tableCard,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                ]}
              >
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.tableCellHeader, { color: themeColors.text }]}>
                    Fault Symptom
                  </Text>
                  <Text style={[styles.tableCellHeader, { color: themeColors.text }]}>
                    Probable Cause
                  </Text>
                  <Text style={[styles.tableCellHeader, { color: themeColors.text }]}>
                    Action
                  </Text>
                </View>
                <View style={[styles.tableRow, { borderBottomColor: themeColors.border }]}>
                  <Text style={[styles.tableCell, { color: themeColors.text }]}>
                    No Power / Silent
                  </Text>
                  <Text style={[styles.tableCell, { color: themeColors.text }]}>
                    SMPS / Main Fuse
                  </Text>
                  <Text style={[styles.tableCell, { color: themeColors.text }]}>
                    Pin 16-17 Test
                  </Text>
                </View>
                <View style={[styles.tableRow, { borderBottomColor: themeColors.border }]}>
                  <Text style={[styles.tableCell, { color: themeColors.text }]}>
                    1 Long, 2 Short
                  </Text>
                  <Text style={[styles.tableCell, { color: themeColors.text }]}>
                    Display Adapter
                  </Text>
                  <Text style={[styles.tableCell, { color: themeColors.text }]}>
                    Reseat GPU / RAM
                  </Text>
                </View>
              </View>

              {/* Syntax Highlighted Code / Script Block */}
              <View style={[styles.codeBlock, { backgroundColor: themeColors.codeBg }]}>
                <View style={styles.codeHeader}>
                  <Code2 size={14} color={themeColors.codeText} />
                  <Text style={[styles.codeLang, { color: themeColors.codeText }]}>
                    SQL / Database Schema Diagnostic
                  </Text>
                </View>
                <Text
                  style={[
                    styles.codeContent,
                    { color: themeColors.codeText, fontSize: fontSize - 2 },
                  ]}
                >
                  {`-- Query exam competency outcome mastery
SELECT outcome_id, description, domain, level
FROM local_outcomes
WHERE course_id = ${courseId} AND level IN ('APPLY', 'ANALYZE');`}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Dynamic User Watermark Overlay */}
        <WatermarkOverlay watermarkText={watermarkText} opacity={0.08} />
      </View>

      {/* Reader Floating Controls (Zoom for PDF & Find in Page) */}
      <View style={styles.floatingControls}>
        <TouchableOpacity
          onPress={() => setIsSearchActive((s) => !s)}
          style={[styles.floatingButton, { backgroundColor: themeColors.surface }]}
          accessibilityLabel="Find in document"
        >
          <Search size={18} color={themeColors.text} />
        </TouchableOpacity>

        {isPdfOrExam && (
          <>
            <TouchableOpacity
              onPress={() => setZoomScale((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
              style={[styles.floatingButton, { backgroundColor: themeColors.surface }]}
              accessibilityLabel="Zoom in"
            >
              <ZoomIn size={18} color={themeColors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setZoomScale((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
              style={[styles.floatingButton, { backgroundColor: themeColors.surface }]}
              accessibilityLabel="Zoom out"
            >
              <ZoomOut size={18} color={themeColors.text} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  securityBanner: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  securityBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  securityDismiss: {
    marginLeft: 8,
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  documentPage: {
    flex: 1,
  },
  examHeaderCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  examInstitution: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  examDepartment: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  examDocTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  examMetaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  examMetaTag: {
    fontSize: 11,
    fontWeight: '500',
  },
  questionContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  questionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  questionNumberBadge: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  questionCourseCode: {
    fontSize: 12,
    fontWeight: '600',
  },
  questionStem: {
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 16,
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
  },
  optionText: {
    lineHeight: 20,
  },
  codeBlock: {
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
    marginBottom: 16,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  codeLang: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  codeContent: {
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  markdownPage: {
    flex: 1,
  },
  markdownHeading1: {
    fontWeight: '800',
    marginBottom: 14,
  },
  markdownBody: {
    marginBottom: 16,
  },
  calloutCard: {
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: 14,
    marginVertical: 14,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  calloutTitle: {
    fontWeight: '700',
  },
  calloutBody: {
    fontWeight: '400',
  },
  tableCard: {
    borderWidth: 1,
    borderRadius: 8,
    marginVertical: 16,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  tableHeaderRow: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderBottomWidth: 1,
  },
  tableCellHeader: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    gap: 8,
  },
  floatingButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
});
