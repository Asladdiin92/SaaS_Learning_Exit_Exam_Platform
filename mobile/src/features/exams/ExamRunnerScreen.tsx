import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  BackHandler,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, Button } from '../../shared/components';
import { database } from '../../shared/database/db';
import { examAttemptRepository } from '../../shared/database/examAttemptRepository';
import {
  getQuestionsForBlueprint,
  ITEC4133_BLUEPRINTS,
  ParsedQuestion,
} from '../../shared/database/parseHuQuestionBank';
import {
  ArrowLeft,
  Clock,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Grid,
  ChevronLeft,
  ChevronRight,
  Send,
  X,
  BookOpen,
  Sparkles,
} from 'lucide-react-native';

// ─── Question Data Types & Contracts ──────────────────────────────────────────

export interface ExamOption {
  id: string;
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
  explanation?: string;
}

export type BloomLevel = 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';

export interface ExamQuestion {
  id: string;
  questionNumber: number;
  courseCode: string;
  courseTitle: string;
  prompt: string;
  codeSnippet?: string;
  options: ExamOption[];
  correctOptionId: string;
  explanation: string;
  bloomLevel: BloomLevel;
  chapterTitle?: string;
  linkedNoteCode?: string;
  recommendedResourceId?: string;
}

export function toExamQuestion(question: ParsedQuestion): ExamQuestion {
  return {
    id: question.id,
    questionNumber: question.questionNumber,
    courseCode: question.courseCode,
    courseTitle: 'Information Assurance and Security',
    prompt: question.prompt,
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      text: option.text,
      explanation: option.explanation,
    })),
    correctOptionId: question.correctOptionId,
    explanation: question.explanation,
    bloomLevel: question.bloomLevel,
    chapterTitle: question.chapterTitle,
    linkedNoteCode: question.linkedNoteCode,
    recommendedResourceId: question.recommendedResourceId,
  };
}

// ─── 100-Question Exam Bank Generator ─────────────────────────────────────────

const CURRICULUM_COURSES = [
  { code: 'IT-CMTS-101', title: 'Computer Maintenance & Technical Support' },
  { code: 'IT-FCOM-102', title: 'Fundamentals of Computing & Architecture' },
  { code: 'IT-DMAT-103', title: 'Discrete Mathematics for IT' },
  { code: 'IT-OOPR-201', title: 'Object Oriented Programming in Java' },
  { code: 'IT-DSA-202', title: 'Data Structures & Algorithms' },
  { code: 'IT-EDPR-203', title: 'Event Driven Programming' },
  { code: 'IT-OSYS-204', title: 'Operating Systems Principles & Admin' },
  { code: 'IT-DBMS-301', title: 'Database Systems & Design' },
  { code: 'IT-CNET-302', title: 'Computer Networking & Internet Protocols' },
  { code: 'IT-SASD-303', title: 'Systems Analysis & Design' },
  { code: 'IT-WEBP-304', title: 'Web Development Technologies' },
  { code: 'IT-IASE-401', title: 'Information Assurance & Cyber Security' },
  { code: 'IT-SEEN-402', title: 'Software Engineering Principles' },
  { code: 'IT-ENMA-403', title: 'Enterprise Architecture & Management' },
  { code: 'IT-MBLA-404', title: 'Mobile Application Development' },
];

export const generate100Questions = (): ExamQuestion[] => {
  const questions: ExamQuestion[] = [];

  for (let i = 1; i <= 100; i++) {
    const padded = i.toString().padStart(3, '0');
    const courseIndex = (i - 1) % CURRICULUM_COURSES.length;
    const course = CURRICULUM_COURSES[courseIndex];

    if (i === 1) {
      questions.push({
        id: 'q_hu2023_001',
        questionNumber: 1,
        courseCode: 'IT-FCOM-102',
        courseTitle: 'Fundamentals of Computing & Architecture',
        prompt: 'In the Von Neumann computer architecture, which component is specifically responsible for fetching instructions from memory, decoding them, and issuing control signals to the datapath?',
        options: [
          { id: 'q001_a', label: 'A', text: 'Arithmetic Logic Unit (ALU)' },
          { id: 'q001_b', label: 'B', text: 'Control Unit (CU)' },
          { id: 'q001_c', label: 'C', text: 'Memory Management Unit (MMU)' },
          { id: 'q001_d', label: 'D', text: 'Instruction Register (IR) Bus Buffer' },
        ],
        correctOptionId: 'q001_b',
        explanation: 'The Control Unit (CU) coordinates all computer operations by fetching instructions from primary memory, decoding them into micro-operations, and directing the flow of signals between ALU, registers, and buses.',
        bloomLevel: 'UNDERSTAND',
      });
    } else if (i === 19) {
      questions.push({
        id: 'q_hu2023_019',
        questionNumber: 19,
        courseCode: 'IT-EDPR-203',
        courseTitle: 'Event Driven Programming',
        prompt: 'In event-driven GUI architectures, which design pattern is primarily used for event handling and listener notification between event sources and subscriber components?',
        codeSnippet: `// Example Event Subscription Contract\ninterface ActionListener extends EventListener {\n  void actionPerformed(ActionEvent e);\n}`,
        options: [
          { id: 'q019_a', label: 'A', text: 'Factory Method Pattern' },
          { id: 'q019_b', label: 'B', text: 'Observer Pattern' },
          { id: 'q019_c', label: 'C', text: 'Singleton Pattern' },
          { id: 'q019_d', label: 'D', text: 'Adapter Pattern' },
        ],
        correctOptionId: 'q019_b',
        explanation: 'The Observer pattern defines a one-to-many dependency between objects so that when an event source subject changes state or fires an interaction, all registered listener observers are notified automatically.',
        bloomLevel: 'ANALYZE',
      });
    } else if (i === 91) {
      questions.push({
        id: 'q_hu2023_091',
        questionNumber: 91,
        courseCode: 'IT-DBMS-301',
        courseTitle: 'Database Systems & Design',
        prompt: 'Consider a relational database table with functional dependencies. Which Normal Form eliminates transitive dependencies between non-prime attributes and candidate keys?',
        codeSnippet: `R(A, B, C) with FDs: A -> B, B -> C\nPrimary Key: A\nTransitive Dependency: A -> C via B`,
        options: [
          { id: 'q091_a', label: 'A', text: 'First Normal Form (1NF)' },
          { id: 'q091_b', label: 'B', text: 'Second Normal Form (2NF)' },
          { id: 'q091_c', label: 'C', text: 'Third Normal Form (3NF)' },
          { id: 'q091_d', label: 'D', text: 'Boyce-Codd Normal Form (BCNF)' },
        ],
        correctOptionId: 'q091_c',
        explanation: 'Third Normal Form (3NF) requires the relation to be in 2NF and have no transitive functional dependencies where a non-prime attribute depends on another non-prime attribute.',
        bloomLevel: 'APPLY',
      });
    } else {
      questions.push({
        id: `q_hu2023_${padded}`,
        questionNumber: i,
        courseCode: course.code,
        courseTitle: course.title,
        prompt: `[${course.code}] Assessment Item #${i}: Which architectural mechanism provides optimal fault tolerance and deterministic state management for this domain scenario?`,
        options: [
          { id: `q${padded}_a`, label: 'A', text: `Option A for question ${i}: Linear Sequential Verification Protocol` },
          { id: `q${padded}_b`, label: 'B', text: `Option B for question ${i}: Idempotent Monotonic State Synchronization` },
          { id: `q${padded}_c`, label: 'C', text: `Option C for question ${i}: Centralized Shared Mutable Singleton Gateway` },
          { id: `q${padded}_d`, label: 'D', text: `Option D for question ${i}: Unbounded Asynchronous Message Broadcast Queue` },
        ],
        correctOptionId: `q${padded}_b`,
        explanation: `Idempotent state synchronization ensures that re-executions or offline retries produce identical valid outcomes without duplicating side effects.`,
        bloomLevel: (i % 3 === 0 ? 'ANALYZE' : i % 2 === 0 ? 'APPLY' : 'UNDERSTAND') as BloomLevel,
      });
    }
  }

  return questions;
};

export const EXAM_QUESTIONS: ExamQuestion[] = generate100Questions();

// ─── Component Props ──────────────────────────────────────────────────────────

interface ExamRunnerScreenProps {
  route: any;
  navigation: any;
}

export const ExamRunnerScreen: React.FC<ExamRunnerScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();

  const {
    localAttemptId,
    examPackageId = 'pkg_hu_cci_model_exit_2023',
    title = 'HU CCI B.Sc. IT Model Exit Exam (Jan 2023)',
    questionCount = 100,
    durationMin = 180,
    studyMode = 'STRICT_TIMED',
    examType = 'NATIONAL_EXIT_SIMULATION',
  } = route.params || {};

  // ── State ───────────────────────────────────────────────────────────────────
  const isItec4133Package = ITEC4133_BLUEPRINTS.some(
    (blueprint) => blueprint.id === examPackageId
  );
  const [questions, setQuestions] = useState<ExamQuestion[]>(() =>
    isItec4133Package
      ? getQuestionsForBlueprint(examPackageId).map(toExamQuestion)
      : EXAM_QUESTIONS
  );
  const [questionBankError, setQuestionBankError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [flaggedSet, setFlaggedSet] = useState<Set<string>>(new Set());
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [isSavedLocally, setIsSavedLocally] = useState<boolean>(false);
  const [showPalette, setShowPalette] = useState<boolean>(false);
  const [paletteFilter, setPaletteFilter] = useState<'ALL' | 'UNANSWERED' | 'FLAGGED'>('ALL');
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState<boolean>(false);

  const currentQuestion = questions[currentIndex] || questions[0];
  const isSimulation = examType === 'NATIONAL_EXIT_SIMULATION';
  const showStudyAssistant = studyMode === 'INTERACTIVE_STUDY' && !isSimulation;

  const totalSec = durationMin * 60;
  const remainingSec = Math.max(0, totalSec - elapsedSec);
  const isTimeCritical = remainingSec < 600; // < 10 mins

  useEffect(() => {
    if (!isItec4133Package) return;
    let active = true;
    database
      .query<{ question_snapshot_json: string }>(
        `SELECT question_snapshot_json
         FROM local_exam_packages
         WHERE exam_package_id = ?
         LIMIT 1;`,
        [examPackageId]
      )
      .then((rows) => {
        if (!active) return;
        if (!rows[0]) {
          throw new Error(`Seeded question package ${examPackageId} is missing.`);
        }
        const snapshot = JSON.parse(rows[0].question_snapshot_json) as {
          questions?: ParsedQuestion[];
        };
        if (!Array.isArray(snapshot.questions) || snapshot.questions.length !== questionCount) {
          throw new Error(`Question package ${examPackageId} has an invalid snapshot.`);
        }
        setQuestions(snapshot.questions.map(toExamQuestion));
      })
      .catch((error: unknown) => {
        console.error('Failed to load the selected ITec4133 question package:', error);
        if (active) {
          setQuestionBankError('This exam package could not be loaded. Return to the catalog and try again.');
        }
      });
    return () => {
      active = false;
    };
  }, [examPackageId, isItec4133Package, questionCount]);

  // ── Format Timer (HH:MM:SS) ─────────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  // ── Restore on Mount (Force-Close Recovery) ──────────────────────────────────
  useEffect(() => {
    if (route.params?.jumpToQuestionIndex !== undefined) {
      setCurrentIndex(route.params.jumpToQuestionIndex);
    }
  }, [route.params?.jumpToQuestionIndex]);

  useEffect(() => {
    const restoreAttempt = async () => {
      if (!localAttemptId) return;
      try {
        const attempt = await examAttemptRepository.getAttemptById(localAttemptId);
        if (attempt && attempt.elapsed_monotonic_sec > 0) {
          setElapsedSec(attempt.elapsed_monotonic_sec);
        }

        const events = await examAttemptRepository.getAnswerEventsForAttempt(localAttemptId);
        const restoredAnswers: Record<string, string> = {};
        const restoredFlags = new Set<string>();

        for (const ev of events) {
          if (ev.selected_option_id) {
            restoredAnswers[ev.question_id] = ev.selected_option_id;
          }
          if (ev.is_flagged === 1) {
            restoredFlags.add(ev.question_id);
          } else {
            restoredFlags.delete(ev.question_id);
          }
        }

        setSelectedAnswers(restoredAnswers);
        setFlaggedSet(restoredFlags);
      } catch (err) {
        // Safe fallback in dev/test
      }
    };

    restoreAttempt();
  }, [localAttemptId]);

  // ── Monotonic Elapsed Timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (isSubmittedSuccess) return;

    const timer = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        // Checkpoint elapsed seconds to SQLite every 15 seconds
        if (next % 15 === 0 && localAttemptId) {
          database.execute(
            `UPDATE local_exam_attempts SET elapsed_monotonic_sec = ? WHERE local_attempt_id = ?;`,
            [next, localAttemptId]
          ).catch(() => {});
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [localAttemptId, isSubmittedSuccess]);

  // ── Hardware Back Button Intercept ──────────────────────────────────────────
  useEffect(() => {
    const onBackPress = () => {
      if (isSubmittedSuccess) {
        navigation.goBack();
        return true;
      }
      setShowExitModal(true);
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation, isSubmittedSuccess]);

  // ── Answer Selection with Sub-16ms Transactional SQLite Save ─────────────────
  const handleSelectOption = async (optionId: string) => {
    const q = currentQuestion;
    const isFlagged = flaggedSet.has(q.id);

    // Optimistic UI update
    setSelectedAnswers((prev) => ({ ...prev, [q.id]: optionId }));
    setIsSavedLocally(true);

    if (localAttemptId) {
      try {
        await examAttemptRepository.saveAnswerTransactional(
          localAttemptId,
          q.id,
          optionId,
          isFlagged,
          undefined,
          elapsedSec
        );
      } catch (err) {
        console.warn('saveAnswerTransactional error:', err);
      }
    }

    setTimeout(() => {
      setIsSavedLocally(false);
    }, 1500);
  };

  // ── Toggle Flag for Review ──────────────────────────────────────────────────
  const handleToggleFlag = async () => {
    const q = currentQuestion;
    const nextFlagged = !flaggedSet.has(q.id);
    const updated = new Set(flaggedSet);

    if (nextFlagged) {
      updated.add(q.id);
    } else {
      updated.delete(q.id);
    }
    setFlaggedSet(updated);

    if (localAttemptId) {
      try {
        const selectedOption = selectedAnswers[q.id] || null;
        await examAttemptRepository.saveAnswerTransactional(
          localAttemptId,
          q.id,
          selectedOption,
          nextFlagged,
          undefined,
          elapsedSec
        );
      } catch (err) {
        console.warn('saveFlag error:', err);
      }
    }
  };

  // ── Filtered Palette Questions ──────────────────────────────────────────────
  const paletteQuestions = useMemo(() => {
    return questions.filter((q, idx) => {
      if (paletteFilter === 'ALL') return true;
      if (paletteFilter === 'UNANSWERED') return !selectedAnswers[q.id];
      if (paletteFilter === 'FLAGGED') return flaggedSet.has(q.id);
      return true;
    });
  }, [questions, paletteFilter, selectedAnswers, flaggedSet]);

  const answeredCount = Object.keys(selectedAnswers).length;
  const unansweredCount = questions.length - answeredCount;
  const flaggedCount = flaggedSet.size;

  const navigateToSubmitConfirmation = () => {
    const firstUnansweredIndex = questions.findIndex((q) => !selectedAnswers[q.id]);
    navigation.navigate('SubmitConfirmation', {
      localAttemptId,
      examPackageId,
      title,
      durationMin,
      elapsedSec,
      totalQuestions: questions.length,
      answeredCount,
      unansweredCount,
      flaggedCount,
      firstUnansweredIndex: firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0,
      questions,
      selectedAnswers,
      examType,
    });
  };

  // ── Submit Attempt Offline ──────────────────────────────────────────────────
  const handleConfirmSubmit = async () => {
    if (!localAttemptId) {
      setIsSubmittedSuccess(true);
      setShowSubmitModal(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await examAttemptRepository.submitAttemptOfflineTransactional(localAttemptId);
      setIsSubmitting(false);
      setShowSubmitModal(false);
      setIsSubmittedSuccess(true);
    } catch (err) {
      setIsSubmitting(false);
      Alert.alert('Submission Error', 'Failed to record offline exam submission. Please try again.');
    }
  };

  if (questionBankError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
        <View style={{ flex: 1, padding: spacing.screenPadding, justifyContent: 'center' }}>
          <Text style={[typography.bodyMd, { color: colors.status.error, textAlign: 'center' }]}>
            {questionBankError}
          </Text>
          <Button
            title="Return to Catalog"
            variant="primary"
            size="md"
            onPress={() => navigation.goBack()}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render Submitted Success View ───────────────────────────────────────────
  if (isSubmittedSuccess) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
        <View
          style={{
            flex: 1,
            padding: spacing.screenPadding,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#D1FAE5',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <CheckCircle2 size={48} color={colors.status.online} />
          </View>

          <Text
            style={[
              typography.h2,
              { color: colors.text.primary, fontWeight: '700', textAlign: 'center', marginBottom: spacing.xs },
            ]}
          >
            Exam Attempt Recorded
          </Text>

          <View
            style={{
              backgroundColor: '#EFF6FF',
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: borderRadius.full,
              marginBottom: spacing.md,
            }}
          >
            <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
              STATUS: SUBMITTED_LOCAL_PENDING
            </Text>
          </View>

          <Card
            variant="elevated"
            style={{
              width: '100%',
              padding: spacing.lg,
              marginBottom: spacing.xl,
            }}
          >
            <Text style={[typography.bodyMd, { color: colors.text.secondary, lineHeight: 22, textAlign: 'center' }]}>
              Your exam answers have been committed to local encrypted SQLite storage and queued in the durable outbox.
              Grading will execute automatically via server-side verification upon next network sync.
            </Text>

            <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border.default, paddingTop: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[typography.labelSm, { color: colors.text.secondary }]}>Total Questions:</Text>
                <Text style={[typography.labelSm, { color: colors.text.primary, fontWeight: '700' }]}>{questions.length}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[typography.labelSm, { color: colors.text.secondary }]}>Answered:</Text>
                <Text style={[typography.labelSm, { color: colors.status.online, fontWeight: '700' }]}>{answeredCount}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[typography.labelSm, { color: colors.text.secondary }]}>Unanswered:</Text>
                <Text style={[typography.labelSm, { color: colors.status.offline, fontWeight: '700' }]}>{unansweredCount}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[typography.labelSm, { color: colors.text.secondary }]}>Time Elapsed:</Text>
                <Text style={[typography.labelSm, { color: colors.text.primary, fontWeight: '700' }]}>{formatTime(elapsedSec)}</Text>
              </View>
            </View>
          </Card>

          <Button
            testID="return-to-catalog-btn"
            title="Return to Exam Catalog"
            variant="primary"
            size="lg"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Practice' })}
            style={{ width: '100%' }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1 }}>
        {/* ── Top Header with Monotonic Clock & Palette Toggle ─────────────── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.screenPadding,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.default,
            backgroundColor: colors.surface.card,
          }}
        >
          {/* Back button */}
          <TouchableOpacity
            testID="exam-runner-back-btn"
            onPress={() => setShowExitModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              minHeight: 44,
              minWidth: 44,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ArrowLeft size={22} color={colors.text.primary} />
          </TouchableOpacity>

          {/* Question Index Progress */}
          <View style={{ alignItems: 'center' }}>
            <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '700' }]}>
              QUESTION {currentIndex + 1} OF {questions.length}
            </Text>
            <Text numberOfLines={1} style={[typography.bodySm, { color: colors.text.primary, fontWeight: '600', maxWidth: 160 }]}>
              {currentQuestion.courseCode}
            </Text>
          </View>

          {/* Right Header: Palette Button */}
          <TouchableOpacity
            testID="palette-toggle-btn"
            onPress={() => setShowPalette(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.surface.secondary,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: borderRadius.md,
              borderWidth: 1,
              borderColor: colors.border.default,
              minHeight: 36,
            }}
          >
            <Grid size={16} color={colors.brand.primary} />
            <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
              Palette
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Sub-Header: Monotonic Timer Pill + Saved Status ──────────────── */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.screenPadding,
            paddingVertical: 8,
            backgroundColor: isTimeCritical ? '#FEF2F2' : colors.surface.secondary,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.default,
          }}
        >
          {/* Monotonic Timer Pill */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Clock size={16} color={isTimeCritical ? colors.status.error : colors.text.secondary} />
            <Text
              testID="exam-timer-text"
              style={[
                typography.labelSm,
                {
                  color: isTimeCritical ? colors.status.error : colors.text.primary,
                  fontWeight: '700',
                  letterSpacing: 0.5,
                },
              ]}
            >
              {formatTime(remainingSec)} remaining
            </Text>
          </View>

          {/* Local SQLite Saved Indicator */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {isSavedLocally ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={14} color={colors.status.online} />
                <Text style={[typography.labelSm, { color: colors.status.online, fontWeight: '600' }]}>
                  Saved Locally ✓
                </Text>
              </View>
            ) : (
              <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                Offline Protected
              </Text>
            )}
          </View>
        </View>

        {/* ── Question Body ScrollView ─────────────────────────────────────── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: spacing.screenPadding,
            paddingBottom: 100,
          }}
        >
          {/* Course Title and Flag Toggle Row */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: spacing.sm,
            }}
          >
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                {currentQuestion.courseTitle}
              </Text>
              <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                Bloom Level: {currentQuestion.bloomLevel}
              </Text>
            </View>

            {/* Flag for Review Toggle */}
            <TouchableOpacity
              testID="flag-question-btn"
              onPress={handleToggleFlag}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: borderRadius.md,
                backgroundColor: flaggedSet.has(currentQuestion.id) ? '#FEF3C7' : colors.surface.card,
                borderWidth: 1,
                borderColor: flaggedSet.has(currentQuestion.id) ? '#F59E0B' : colors.border.default,
              }}
            >
              <Bookmark
                size={16}
                color={flaggedSet.has(currentQuestion.id) ? '#B45309' : colors.text.secondary}
                fill={flaggedSet.has(currentQuestion.id) ? '#F59E0B' : 'transparent'}
              />
              <Text
                style={[
                  typography.labelSm,
                  {
                    color: flaggedSet.has(currentQuestion.id) ? '#92400E' : colors.text.secondary,
                    fontWeight: '600',
                  },
                ]}
              >
                {flaggedSet.has(currentQuestion.id) ? 'Flagged' : 'Flag'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Question Prompt */}
          <Text
            testID="question-prompt-text"
            style={[
              typography.bodyLg,
              {
                color: colors.text.primary,
                fontWeight: '600',
                lineHeight: 26,
                marginBottom: spacing.md,
              },
            ]}
          >
            {currentQuestion.prompt}
          </Text>

          {/* Optional Code Snippet */}
          {currentQuestion.codeSnippet && (
            <View
              style={{
                backgroundColor: '#1E293B',
                padding: spacing.md,
                borderRadius: borderRadius.md,
                marginBottom: spacing.md,
              }}
            >
              <Text
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: '#38BDF8',
                  lineHeight: 20,
                }}
              >
                {currentQuestion.codeSnippet}
              </Text>
            </View>
          )}

          {/* Multiple Choice Options (A, B, C, D) */}
          <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedAnswers[currentQuestion.id] === opt.id;

              return (
                <TouchableOpacity
                  key={opt.id}
                  testID={`option-${opt.label}`}
                  onPress={() => handleSelectOption(opt.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    borderWidth: 2,
                    borderColor: isSelected ? colors.brand.primary : colors.border.default,
                    backgroundColor: isSelected ? '#EFF6FF' : colors.surface.card,
                    minHeight: 56,
                  }}
                >
                  {/* Option Badge (A, B, C, D) */}
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isSelected ? colors.brand.primary : colors.surface.secondary,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: spacing.md,
                    }}
                  >
                    <Text
                      style={[
                        typography.labelSm,
                        {
                          color: isSelected ? '#FFFFFF' : colors.text.primary,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </View>

                  {/* Option Text */}
                  <Text
                    style={[
                      typography.bodyMd,
                      {
                        flex: 1,
                        color: isSelected ? colors.brand.primary : colors.text.primary,
                        fontWeight: isSelected ? '600' : '400',
                        lineHeight: 20,
                      },
                    ]}
                  >
                    {opt.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Interactive Study Assistant Explanation Card ─────────────────── */}
          {showStudyAssistant && selectedAnswers[currentQuestion.id] && (
            <Card
              testID="explanation-card"
              variant="elevated"
              style={{
                padding: spacing.md,
                backgroundColor:
                  selectedAnswers[currentQuestion.id] === currentQuestion.correctOptionId
                    ? '#F0FDF4'
                    : '#FEF2F2',
                borderLeftWidth: 4,
                borderLeftColor:
                  selectedAnswers[currentQuestion.id] === currentQuestion.correctOptionId
                    ? colors.status.online
                    : colors.status.error,
                marginBottom: spacing.lg,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Sparkles
                  size={18}
                  color={
                    selectedAnswers[currentQuestion.id] === currentQuestion.correctOptionId
                      ? colors.status.online
                      : colors.status.error
                  }
                />
                <Text
                  style={[
                    typography.labelSm,
                    {
                      color:
                        selectedAnswers[currentQuestion.id] === currentQuestion.correctOptionId
                          ? colors.status.online
                          : colors.status.error,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {selectedAnswers[currentQuestion.id] === currentQuestion.correctOptionId
                    ? 'Correct Answer!'
                    : 'Incorrect Selection'}
                </Text>
              </View>

              <Text style={[typography.bodyMd, { color: colors.text.primary, lineHeight: 22, marginBottom: spacing.xs }]}>
                {currentQuestion.explanation}
              </Text>

              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                <View
                  style={{
                    backgroundColor: colors.surface.card,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: borderRadius.sm,
                  }}
                >
                  <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                    Cognitive Domain: {currentQuestion.bloomLevel}
                  </Text>
                </View>
              </View>
            </Card>
          )}
        </ScrollView>

        {/* ── Fixed Bottom Navigation Bar ──────────────────────────────────── */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.surface.card,
            borderTopWidth: 1,
            borderTopColor: colors.border.default,
            paddingHorizontal: spacing.screenPadding,
            paddingVertical: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
          }}
        >
          {/* Previous Button */}
          <Button
            testID="prev-question-btn"
            title="Previous"
            variant="outline"
            size="md"
            leftIcon={<ChevronLeft size={18} color={colors.text.primary} />}
            disabled={currentIndex === 0}
            onPress={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            style={{ flex: 1, minHeight: 48 }}
          />

          {/* Next / Submit Button */}
          {currentIndex < questions.length - 1 ? (
            <Button
              testID="next-question-btn"
              title="Next"
              variant="primary"
              size="md"
              onPress={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              style={{ flex: 1, minHeight: 48 }}
            />
          ) : (
            <Button
              testID="submit-exam-footer-btn"
              title="Review & Submit"
              variant="primary"
              size="md"
              leftIcon={<Send size={16} color="#FFFFFF" />}
              onPress={navigateToSubmitConfirmation}
              style={{ flex: 1, minHeight: 48 }}
            />
          )}

          {/* Floating Finish Button */}
          <TouchableOpacity
            testID="submit-exam-btn"
            onPress={navigateToSubmitConfirmation}
            style={{
              paddingHorizontal: spacing.sm,
              minHeight: 48,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
              Submit
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Question Palette Modal (5-Column Grid) ────────────────────────── */}
        <Modal
          visible={showPalette}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPalette(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'flex-end',
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface.primary,
                borderTopLeftRadius: borderRadius.lg,
                borderTopRightRadius: borderRadius.lg,
                maxHeight: '85%',
                padding: spacing.md,
              }}
            >
              {/* Palette Header */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.sm,
                }}
              >
                <View>
                  <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700' }]}>
                    Question Palette
                  </Text>
                  <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                    {answeredCount} Answered • {unansweredCount} Unanswered • {flaggedCount} Flagged
                  </Text>
                </View>
                <TouchableOpacity
                  testID="close-palette-btn"
                  onPress={() => setShowPalette(false)}
                  style={{ minHeight: 40, minWidth: 40, justifyContent: 'center', alignItems: 'center' }}
                >
                  <X size={22} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

              {/* Filter Tabs: ALL, UNANSWERED, FLAGGED */}
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: colors.surface.secondary,
                  borderRadius: borderRadius.md,
                  padding: 4,
                  marginBottom: spacing.md,
                }}
              >
                {(['ALL', 'UNANSWERED', 'FLAGGED'] as const).map((tab) => {
                  const isActive = paletteFilter === tab;
                  const label =
                    tab === 'ALL'
                      ? `All (${questions.length})`
                      : tab === 'UNANSWERED'
                      ? `Unanswered (${unansweredCount})`
                      : `Flagged (${flaggedCount})`;

                  return (
                    <TouchableOpacity
                      key={tab}
                      testID={`palette-tab-${tab}`}
                      onPress={() => setPaletteFilter(tab)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: borderRadius.sm,
                        backgroundColor: isActive ? colors.surface.card : 'transparent',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={[
                          typography.labelSm,
                          {
                            color: isActive ? colors.brand.primary : colors.text.secondary,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 5-Column Grid */}
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-start',
                    gap: 8,
                  }}
                >
                  {paletteQuestions.map((q) => {
                    const originalIndex = questions.findIndex((item) => item.id === q.id);
                    const isAnswered = Boolean(selectedAnswers[q.id]);
                    const isFlagged = flaggedSet.has(q.id);
                    const isCurrent = originalIndex === currentIndex;

                    let bg = colors.surface.card;
                    let textCol = colors.text.primary;
                    let borderColor = colors.border.default;

                    if (isFlagged) {
                      bg = '#FEF3C7';
                      textCol = '#92400E';
                      borderColor = '#F59E0B';
                    } else if (isAnswered) {
                      bg = '#D1FAE5';
                      textCol = '#065F46';
                      borderColor = '#10B981';
                    }

                    if (isCurrent) {
                      borderColor = colors.brand.primary;
                    }

                    return (
                      <TouchableOpacity
                        key={q.id}
                        testID={`palette-item-${originalIndex + 1}`}
                        onPress={() => {
                          setCurrentIndex(originalIndex);
                          setShowPalette(false);
                        }}
                        style={{
                          width: '18%',
                          aspectRatio: 1,
                          backgroundColor: bg,
                          borderRadius: borderRadius.md,
                          borderWidth: isCurrent ? 2.5 : 1,
                          borderColor: borderColor,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={[typography.labelSm, { color: textCol, fontWeight: '700' }]}>
                          {originalIndex + 1}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── Exit Confirmation Modal (Hardware Back Intercept) ────────────── */}
        <Modal
          visible={showExitModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowExitModal(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.6)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: spacing.screenPadding,
            }}
          >
            <Card variant="elevated" style={{ width: '100%', padding: spacing.lg }}>
              <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700', marginBottom: spacing.xs }]}>
                Leave Exam?
              </Text>
              <Text style={[typography.bodyMd, { color: colors.text.secondary, marginBottom: spacing.md, lineHeight: 22 }]}>
                Your progress is committed locally to SQLite. You can resume this attempt anytime from the Exam Catalog.
              </Text>

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  testID="exit-cancel-btn"
                  title="Resume Exam"
                  variant="outline"
                  size="md"
                  onPress={() => setShowExitModal(false)}
                  style={{ flex: 1, minHeight: 48 }}
                />
                <Button
                  testID="exit-confirm-btn"
                  title="Save & Exit"
                  variant="primary"
                  size="md"
                  onPress={() => {
                    setShowExitModal(false);
                    navigation.goBack();
                  }}
                  style={{ flex: 1, minHeight: 48 }}
                />
              </View>
            </Card>
          </View>
        </Modal>

        {/* ── Submit Confirmation Modal ────────────────────────────────────── */}
        <Modal
          visible={showSubmitModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowSubmitModal(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.6)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: spacing.screenPadding,
            }}
          >
            <Card variant="elevated" style={{ width: '100%', padding: spacing.lg }}>
              <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700', marginBottom: spacing.xs }]}>
                Submit Exam Attempt?
              </Text>

              <View style={{ marginVertical: spacing.md }}>
                <Text style={[typography.bodyMd, { color: colors.text.secondary, marginBottom: 8 }]}>
                  Please review your attempt summary:
                </Text>
                <View style={{ backgroundColor: colors.surface.secondary, padding: spacing.md, borderRadius: borderRadius.md }}>
                  <Text style={[typography.bodySm, { color: colors.text.primary, fontWeight: '600', marginBottom: 4 }]}>
                    • Answered: {answeredCount} / {questions.length}
                  </Text>
                  <Text style={[typography.bodySm, { color: colors.status.offline, fontWeight: '600', marginBottom: 4 }]}>
                    • Unanswered: {unansweredCount}
                  </Text>
                  <Text style={[typography.bodySm, { color: '#92400E', fontWeight: '600' }]}>
                    • Flagged for Review: {flaggedCount}
                  </Text>
                </View>

                {unansweredCount > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
                    <AlertCircle size={16} color={colors.status.offline} />
                    <Text style={[typography.labelSm, { color: colors.status.offline, fontWeight: '600' }]}>
                      You have {unansweredCount} unanswered questions.
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  testID="submit-cancel-btn"
                  title="Keep Reviewing"
                  variant="outline"
                  size="md"
                  onPress={() => setShowSubmitModal(false)}
                  style={{ flex: 1, minHeight: 48 }}
                />
                <Button
                  testID="submit-confirm-btn"
                  title={isSubmitting ? 'Submitting…' : 'Confirm & Submit'}
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                  onPress={handleConfirmSubmit}
                  style={{ flex: 1, minHeight: 48 }}
                />
              </View>
            </Card>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};
