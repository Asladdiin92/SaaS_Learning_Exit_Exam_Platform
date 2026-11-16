/**
 * mobile/src/shared/database/parseHuQuestionBank.ts
 * =============================================================================
 * Dual-format Question Bank Parser & Seeder for ITec4133 / IT-SEC-401
 * Information Assurance and Security.
 *
 * Implements deterministic Markdown/text parsing, chapter normalization (including
 * Q30 typo mapping to Chapter 2), distractor explanation extraction, and idempotent
 * seeding into offline SQLite database.
 * =============================================================================
 */

import { database } from './db';
import { curriculumRepository } from './curriculumRepository';
import itec4133Canonical from './itec4133_parsed.json';

export interface ParsedOption {
  id: string;
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
  isCorrect: boolean;
  explanation: string;
}

export type BloomLevel = 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';

export interface ParsedQuestion {
  questionNumber: number;
  id: string;
  courseCode: string;
  chapterNumber: number;
  chapterTitle: string;
  outcomeId: string;
  bloomLevel: BloomLevel;
  difficulty: DifficultyLevel;
  linkedNoteCode: string;
  prompt: string;
  options: ParsedOption[];
  correctOptionId: string;
  correctLabel: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  cheatSheetNote: string;
  recommendedResourceId: string;
}

export interface CheatNote {
  code: string;
  anchor: string;
  questionNumber: number;
  chapterNumber: number;
  note: string;
}

export interface ChapterMeta {
  chapter_number: number;
  title: string;
  question_range: [number, number];
  outcome_id: string;
  resource_id: string;
}

export interface QuestionBankData {
  metadata: {
    title: string;
    courseCode: string;
    courseTitle: string;
    totalQuestions: number;
    difficultyCounts: {
      EASY: number;
      MEDIUM: number;
      HARD: number;
    };
    chapters: ChapterMeta[];
  };
  questions: ParsedQuestion[];
  cheatNotes: CheatNote[];
}

// ─── Canonical Chapter Definitions ─────────────────────────────────────────────

export const CHAPTER_METADATA: Record<number, ChapterMeta> = {
  1: {
    chapter_number: 1,
    title: 'Introduction to Information Security & Security Architecture',
    question_range: [1, 20],
    outcome_id: 'OUTCOME-ITSEC-CH1',
    resource_id: 'res_itsec_ch1_notes',
  },
  2: {
    chapter_number: 2,
    title: 'Classical Encryption Techniques & Symmetric Ciphers',
    question_range: [21, 40],
    outcome_id: 'OUTCOME-ITSEC-CH2',
    resource_id: 'res_itsec_ch2_notes',
  },
  3: {
    chapter_number: 3,
    title: 'Modern Block Ciphers & Data Encryption Standard (DES)',
    question_range: [41, 60],
    outcome_id: 'OUTCOME-ITSEC-CH3',
    resource_id: 'res_itsec_ch3_notes',
  },
  4: {
    chapter_number: 4,
    title: 'Basic Concepts in Number Theory, Finite Fields & Public-Key Cryptography (RSA, Diffie-Hellman)',
    question_range: [61, 80],
    outcome_id: 'OUTCOME-ITSEC-CH4',
    resource_id: 'res_itsec_ch4_notes',
  },
};

// Authoritative Difficulty Matrix Alignment (28 EASY, 36 MEDIUM, 16 HARD)
export const DIFFICULTY_NORMALIZATION: Record<number, DifficultyLevel> = {
  2: 'MEDIUM',
  9: 'MEDIUM',
  14: 'MEDIUM',
  15: 'HARD',
  33: 'HARD',
  43: 'MEDIUM',
  63: 'HARD',
};

// ─── Deterministic Question Bank Parser ────────────────────────────────────────

export function parseHuQuestionBankText(content: string): QuestionBankData {
  if (content.trimStart().startsWith('{')) {
    const sourceDocument: unknown = JSON.parse(content);
    if (
      typeof sourceDocument === 'object' &&
      sourceDocument !== null &&
      'metadata' in sourceDocument &&
      'questions' in sourceDocument &&
      'cheatNotes' in sourceDocument
    ) {
      return sourceDocument as QuestionBankData;
    }
    if (
      typeof sourceDocument !== 'object' ||
      sourceDocument === null ||
      !('content' in sourceDocument) ||
      typeof sourceDocument.content !== 'string'
    ) {
      throw new Error("JSON question-bank sources must contain a Markdown 'content' string.");
    }
    content = sourceDocument.content;
  }
  const questionRegex = /(?:^|\n)(?:##\s*)?Question\s+(\d+)\s*\n([\s\S]*?)(?=\n(?:##\s*)?Question\s+\d+|\n(?:#\s*)?Question Classification Summary Matrix|$)/g;

  const parsedQuestions: ParsedQuestion[] = [];
  const allCheatNotes: CheatNote[] = [];

  let match: RegExpExecArray | null;
  while ((match = questionRegex.exec(content)) !== null) {
    const qnum = parseInt(match[1], 10);
    const qtext = match[2];

    // 1. Basic Metadata
    const idM = qtext.match(/(?:-\s*\*\*)?ID(?:\*\*)?:\s*([A-Za-z0-9_-]+)/);
    const courseM = qtext.match(/(?:-\s*\*\*)?Course Code(?:\*\*)?:\s*([A-Za-z0-9_-]+)/);
    const bloomM = qtext.match(/(?:-\s*\*\*)?Bloom Level(?:\*\*)?:\s*([A-Za-z]+)/);
    const diffM = qtext.match(/(?:-\s*\*\*)?Difficulty(?:\*\*)?:\s*([A-Za-z]+)/);
    const noteM = qtext.match(/(?:-\s*\*\*)?Linked Note Code(?:\*\*)?:\s*(NOTE-[A-Za-z0-9_-]+)/);
    const promptM = qtext.match(/(?:-\s*\*\*)?Question Text(?:\*\*)?:\s*([\s\S]*?)(?=\n(?:-\s*\*\*)?Options:)/);

    const rawId = idM ? idM[1] : `Q-${qnum}`;
    const courseCode = courseM ? courseM[1] : 'IT-SEC-401';
    const bloomLevel = (bloomM ? bloomM[1].toUpperCase() : 'UNDERSTAND') as BloomLevel;
    const rawDiff = (diffM ? diffM[1].toUpperCase() : 'MEDIUM') as DifficultyLevel;
    const linkedNoteCode = noteM ? noteM[1] : `NOTE-CH1-${String(qnum).padStart(3, '0')}`;
    const questionPrompt = promptM ? promptM[1].trim() : '';

    // Normalize difficulty to align with Chapter Matrix
    const difficulty = DIFFICULTY_NORMALIZATION[qnum] || rawDiff;

    // Linked note codes take priority over question ID/number typos.
    const precedingText = content.slice(0, match.index);
    const headings = [...precedingText.matchAll(/^\s*#{0,2}\s*Chapter\s+([1-4])\s*:\s*.+$/gim)];
    const noteChapter = linkedNoteCode.match(/NOTE-CH([1-4])-/i);
    const chapterNum = noteChapter
      ? Number(noteChapter[1])
      : headings.length > 0
        ? Number(headings[headings.length - 1][1])
        : qnum >= 1 && qnum <= 20
          ? 1
          : qnum >= 21 && qnum <= 40
            ? 2
            : qnum >= 41 && qnum <= 60
              ? 3
              : qnum >= 61 && qnum <= 80
                ? 4
                : 0;
    if (!chapterNum) {
      throw new Error(`Question ${qnum} has no resolvable chapter.`);
    }

    const chapterInfo = CHAPTER_METADATA[chapterNum];

    // 3. Options
    const optionsMatch = qtext.match(/(?:-\s*\*\*)?Options:(?:\*\*)?\s*\n([\s\S]*?)(?=\n(?:-\s*\*\*)?Step-by-Step Explanation:)/);
    const rawOptions = optionsMatch ? optionsMatch[1].trim() : '';

    // 4. Step-by-Step Explanation & Distractor Extraction
    const explMatch = qtext.match(/(?:-\s*\*\*)?Step-by-Step Explanation:(?:\*\*)?\s*\n([\s\S]*?)(?=\n(?:-\s*\*\*)?Cheat Sheet Note|$)/);
    const fullExplanation = explMatch ? explMatch[1].trim() : '';

    const distractors: Record<string, string> = {};
    const distractorRegex = /(?:-\s*\*\*)?Why\s+([A-D])\s+is\s+(correct|incorrect)(?:\*\*)?:\s*([\s\S]*?)(?=\n(?:-\s*\*\*)?Why\s+[A-D]\s+is|$)/g;
    let dM: RegExpExecArray | null;
    while ((dM = distractorRegex.exec(fullExplanation)) !== null) {
      const lbl = dM[1];
      const reason = dM[3].trim();
      // Handle Q31 typo where second Why C explains option D
      if (distractors[lbl] && lbl === 'C' && !distractors['D']) {
        distractors['D'] = reason;
      } else {
        distractors[lbl] = reason;
      }
    }

    const parsedOptions: ParsedOption[] = [];
    let correctOptionId = 'A';

    for (const optLine of rawOptions.split('\n')) {
      const trimmed = optLine.trim().replace(/^[-*]\s*/, '').trim();
      const optM = trimmed.match(/^([A-D])[\.:]\s*([\s\S]*?)$/);
      if (optM) {
        const label = optM[1] as 'A' | 'B' | 'C' | 'D';
        const optText = optM[2].trim();
        const isCorrect = /\(Correct\)|\*\(Correct\)\*/i.test(optText);
        const cleanedText = optText.replace(/\s*\(Correct\)|\s*\*\(Correct\)\*/gi, '').trim();

        if (isCorrect) {
          correctOptionId = label;
        }

        parsedOptions.push({
          id: `q${String(qnum).padStart(3, '0')}_${label.toLowerCase()}`,
          label,
          text: cleanedText,
          isCorrect,
          explanation: distractors[label] || '',
        });
      }
    }
    if (
      parsedOptions.length !== 4 ||
      parsedOptions.map((option) => option.label).join('') !== 'ABCD'
    ) {
      throw new Error(`Question ${qnum} must define options A-D exactly once.`);
    }
    if (parsedOptions.filter((option) => option.isCorrect).length !== 1) {
      throw new Error(`Question ${qnum} must have exactly one correct option.`);
    }
    const missingExplanations = parsedOptions
      .filter((option) => !option.explanation)
      .map((option) => option.label);
    if (missingExplanations.length > 0) {
      throw new Error(
        `Question ${qnum} is missing explanations for options ${missingExplanations.join(', ')}.`
      );
    }

    // 5. Parse Cheat Sheet Note
    const noteMatch = qtext.match(/(?:-\s*\*\*)?Cheat Sheet Note\s*\((NOTE-[A-Za-z0-9_-]+)\)(?:\*\*)?:\s*([\s\S]*?)(?=\n\n|$)/);
    let noteCode = linkedNoteCode;
    let noteContent = 'Core Information Assurance competency reference.';
    if (noteMatch) {
      noteCode = noteMatch[1];
      noteContent = noteMatch[2].trim();
    }

    const cheatNoteItem: CheatNote = {
      code: noteCode,
      anchor: noteCode,
      questionNumber: qnum,
      chapterNumber: chapterNum,
      note: noteContent,
    };
    allCheatNotes.push(cheatNoteItem);

    parsedQuestions.push({
      questionNumber: qnum,
      id: rawId,
      courseCode,
      chapterNumber: chapterNum,
      chapterTitle: chapterInfo.title,
      outcomeId: chapterInfo.outcome_id,
      bloomLevel,
      difficulty,
      linkedNoteCode,
      prompt: questionPrompt,
      options: parsedOptions,
      correctOptionId: `q${String(qnum).padStart(3, '0')}_${correctOptionId.toLowerCase()}`,
      correctLabel: correctOptionId as 'A' | 'B' | 'C' | 'D',
      explanation: fullExplanation,
      cheatSheetNote: noteContent,
      recommendedResourceId: chapterInfo.resource_id,
    });
  }

  const diffCounts = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const q of parsedQuestions) {
    if (q.difficulty === 'EASY') diffCounts.EASY++;
    else if (q.difficulty === 'MEDIUM') diffCounts.MEDIUM++;
    else if (q.difficulty === 'HARD') diffCounts.HARD++;
  }

  return {
    metadata: {
      title: 'ITec4133 / IT-SEC-401 Information Assurance and Security Comprehensive Question Bank',
      courseCode: 'IT-SEC-401',
      courseTitle: 'Information Assurance and Security',
      totalQuestions: parsedQuestions.length,
      difficultyCounts: diffCounts,
      chapters: Object.values(CHAPTER_METADATA),
    },
    questions: parsedQuestions,
    cheatNotes: allCheatNotes,
  };
}

// Export pre-parsed canonical data for fast offline execution
export const ITEC4133_PARSED_DATA = itec4133Canonical as unknown as QuestionBankData;

// ─── 5 Exam Blueprints for ITec4133 / IT-SEC-401 ──────────────────────────────

export interface ExamBlueprintDef {
  id: string;
  title: string;
  courseCode: string;
  type: 'NATIONAL_EXIT_SIMULATION' | 'COURSE_EXAM' | 'PRACTICE_QUIZ';
  questionCount: number;
  durationMin: number;
  sizeBytes: number;
  chapterFilter?: number;
  description: string;
}

export interface StudyNoteResource {
  id: string;
  title: string;
  markdown: string;
  chapterNumber?: number;
}

export function generateStudyNotesMarkdown(
  data: QuestionBankData = ITEC4133_PARSED_DATA
): StudyNoteResource[] {
  const resources: StudyNoteResource[] = data.metadata.chapters.map((chapter) => {
    const notes = data.cheatNotes.filter(
      (note) => note.chapterNumber === chapter.chapter_number
    );
    const lines = [
      `# ${chapter.title}`,
      `**Course Code:** IT-SEC-401 (ITec4133) | **Learning Outcome:** \`${chapter.outcome_id}\``,
      '',
      '## Chapter Learning Focus & Cheat Sheet Notes',
      '',
    ];
    for (const note of notes) {
      lines.push(
        `<a id="${note.anchor}"></a>`,
        `### ${note.code} (Question ${note.questionNumber})`,
        note.note,
        ''
      );
    }
    return {
      id: chapter.resource_id,
      title: `Ch ${chapter.chapter_number}: ${chapter.title} Notes`,
      markdown: `${lines.join('\n').trimEnd()}\n`,
      chapterNumber: chapter.chapter_number,
    };
  });

  const masterLines = [
    '# IT-SEC-401 Information Assurance and Security — Master Cheat Sheet',
    'Comprehensive 80-Note Key Knowledge Synthesis across Chapters 1 through 4.',
    '',
  ];
  for (const chapter of data.metadata.chapters) {
    masterLines.push(`## Chapter ${chapter.chapter_number}: ${chapter.title}`, '');
    for (const note of data.cheatNotes.filter(
      (item) => item.chapterNumber === chapter.chapter_number
    )) {
      masterLines.push(
        `<a id="${note.anchor}"></a>`,
        `**${note.code}**: ${note.note}`,
        ''
      );
    }
  }
  resources.push({
    id: 'res_itsec_master_cheatsheet',
    title: 'IT-SEC-401 Master Cheat Sheet (80 Key Notes)',
    markdown: `${masterLines.join('\n').trimEnd()}\n`,
  });
  return resources;
}

export const ITEC4133_BLUEPRINTS: ExamBlueprintDef[] = [
  {
    id: 'ITEC4133-FULL-80',
    title: 'ITec4133 Information Assurance & Security — Comprehensive Exam (80 Qs, 120 mins)',
    courseCode: 'IT-SEC-401',
    type: 'COURSE_EXAM',
    questionCount: 80,
    durationMin: 120,
    sizeBytes: 1950000,
    description: '80 questions across Chapters 1 through 4: Concepts, Classical Ciphers, Block Ciphers/DES, and Number Theory/RSA.',
  },
  {
    id: 'ITEC4133-CH1-20',
    title: 'Ch 1: Security Concepts & X.800 Architecture Practice Quiz',
    courseCode: 'IT-SEC-401',
    type: 'PRACTICE_QUIZ',
    questionCount: 20,
    durationMin: 30,
    sizeBytes: 480000,
    chapterFilter: 1,
    description: '20 questions focusing on CIA Triad, Active/Passive Attacks, and X.800 Security Architecture.',
  },
  {
    id: 'ITEC4133-CH2-20',
    title: 'Ch 2: Classical Encryption & Symmetric Ciphers Practice Quiz',
    courseCode: 'IT-SEC-401',
    type: 'PRACTICE_QUIZ',
    questionCount: 20,
    durationMin: 30,
    sizeBytes: 520000,
    chapterFilter: 2,
    description: '20 questions focusing on Caesar, Playfair, Hill, Vigenère, Rail Fence, and One-Time Pad.',
  },
  {
    id: 'ITEC4133-CH3-20',
    title: 'Ch 3: Modern Block Ciphers & DES Practice Quiz',
    courseCode: 'IT-SEC-401',
    type: 'PRACTICE_QUIZ',
    questionCount: 20,
    durationMin: 30,
    sizeBytes: 510000,
    chapterFilter: 3,
    description: '20 questions focusing on Feistel Networks, DES Rounds, S-Boxes, and Avalanche Effects.',
  },
  {
    id: 'ITEC4133-CH4-20',
    title: 'Ch 4: Number Theory, RSA & Diffie-Hellman Practice Quiz',
    courseCode: 'IT-SEC-401',
    type: 'PRACTICE_QUIZ',
    questionCount: 20,
    durationMin: 30,
    sizeBytes: 540000,
    chapterFilter: 4,
    description: '20 questions focusing on Modular Arithmetic, GCD, Euler Totient, RSA Cryptosystem, and Diffie-Hellman Key Exchange.',
  },
];

export function getQuestionsForBlueprint(blueprintId: string): ParsedQuestion[] {
  const all = ITEC4133_PARSED_DATA.questions;
  const bp = ITEC4133_BLUEPRINTS.find((b) => b.id === blueprintId);
  if (!bp) throw new Error(`Unknown ITec4133 exam blueprint: ${blueprintId}`);

  if (bp.chapterFilter) {
    return all.filter((q) => q.chapterNumber === bp.chapterFilter);
  }
  return all;
}

// ─── Idempotent Database Seeder (Task 2) ──────────────────────────────────────

export async function seedItec4133ToDatabase(): Promise<{
  courseSeeded: boolean;
  outcomesSeeded: number;
  resourcesSeeded: number;
  packagesSeeded: number;
}> {
  await database.init();
  await curriculumRepository.seedCanonicalCurriculumIfEmpty();

  // Fast check: If the package snapshots already exist, skip redundant re-seeding
  const existingPkg = await database.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM local_exam_packages WHERE exam_package_id = 'ITEC4133-FULL-80';`
  );
  if (existingPkg[0]?.count && existingPkg[0].count > 0) {
    return {
      courseSeeded: true,
      outcomesSeeded: 4,
      resourcesSeeded: 5,
      packagesSeeded: ITEC4133_BLUEPRINTS.length,
    };
  }

  const outcomes = [
    {
      id: 40201,
      desc: 'Analyze CIA triad, passive/active attacks, X.800 architecture and access control models.',
      domain: 'COGNITIVE',
      level: 'UNDERSTAND',
    },
    {
      id: 40202,
      desc: 'Apply classical encryption techniques, Caesar, Playfair, Hill, and Vigenère polyalphabetic ciphers.',
      domain: 'COGNITIVE',
      level: 'APPLY',
    },
    {
      id: 40203,
      desc: 'Analyze modern block cipher structures, Feistel networks, DES rounds, and avalanche effects.',
      domain: 'COGNITIVE',
      level: 'ANALYZE',
    },
    {
      id: 40204,
      desc: 'Compute modular arithmetic, gcd, Euler totient, RSA keys, and Diffie-Hellman key exchanges.',
      domain: 'COGNITIVE',
      level: 'APPLY',
    },
  ];

  const resources = generateStudyNotesMarkdown();
  await database.withTransaction(async (tx) => {
    // Guarantee Theme 5 exists for foreign key constraint
    await tx.execute(
      `INSERT OR IGNORE INTO local_themes
       (theme_id, theme_number, title, description, total_credit_hours, version)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        5,
        5,
        'Networking & Information Security',
        'Data communications, routing/switching CLI, system administration and cryptographic security.',
        11,
        1,
      ]
    );

    await tx.execute(
      `INSERT OR REPLACE INTO local_courses
       (course_id, theme_id, code, title, credit_hours, general_objective, version, updated_sequence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        402,
        5,
        'IT-IASC-401',
        'Information Assurance and Security',
        2,
        'Comprehensive study of cryptography, security architecture, symmetric/asymmetric algorithms, and key exchange mechanisms.',
        1,
        1,
      ]
    );

    for (const outcome of outcomes) {
      await tx.execute(
        `INSERT OR REPLACE INTO local_outcomes
         (outcome_id, course_id, description, domain, level, version)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [outcome.id, 402, outcome.desc, outcome.domain, outcome.level, 1]
      );
    }

    for (const resource of resources) {
      await tx.execute(
        `INSERT OR REPLACE INTO local_resources
         (resource_id, course_id, tenant_id, type, title, size_bytes, package_id,
          access_state, version, content_markdown)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          resource.id,
          402,
          null,
          'LECTURE_NOTE',
          resource.title,
          resource.markdown.length,
          null,
          'AVAILABLE',
          1,
          resource.markdown,
        ]
      );
    }

    for (const blueprint of ITEC4133_BLUEPRINTS) {
      const questionsForPackage = getQuestionsForBlueprint(blueprint.id);
      await tx.execute(
        `INSERT OR REPLACE INTO local_exam_packages
         (exam_package_id, exam_id, course_id, blueprint_version, question_snapshot_json,
          duration_sec, state)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          blueprint.id,
          blueprint.id.toLowerCase(),
          402,
          1,
          JSON.stringify({
            title: blueprint.title,
            questionCount: blueprint.questionCount,
            questions: questionsForPackage,
          }),
          blueprint.durationMin * 60,
          'READY',
        ]
      );
    }
  });

  return {
    courseSeeded: true,
    outcomesSeeded: outcomes.length,
    resourcesSeeded: resources.length,
    packagesSeeded: ITEC4133_BLUEPRINTS.length,
  };
}
