/**
 * mobile/src/shared/database/examRepository.ts
 * =============================================================================
 * Offline-First Exam Repository & FastAPI Data Hydration Service
 * Caches the canonical Haramaya University CCI B.Sc. IT Model Exit Exam (Jan 2023,
 * 100 Questions, 180 Mins) and Course Practice Quizzes in SQLite local_exam_packages.
 * =============================================================================
 */

import { database } from './db';
import type { LocalExamPackage } from './curriculumRepository';
import type { ApiClient } from '../api/client';
import huModelQuestions from './hu_model_exit_2023_questions.json';

export type { LocalExamPackage };

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
}

export interface SnapshotQuestion {
  id: string;
  questionNumber: number;
  courseCode: string;
  courseTitle?: string;
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation?: string;
  bloomLevel?: string;
  difficulty?: string;
  codeSnippet?: string;
}

export interface ParsedExamSnapshot {
  title: string;
  total_questions: number;
  durationMin?: number;
  questions: SnapshotQuestion[];
}

export const CANONICAL_HU_2023_EXAM_PACKAGE: LocalExamPackage = {
  exam_package_id: 'pkg_hu_cci_model_exit_2023',
  exam_id: 'exam-hu-cci-2023',
  course_id: 101,
  blueprint_version: 1,
  question_snapshot_json: JSON.stringify({
    title: 'Haramaya University CCI B.Sc. IT Model Exit Exam (Jan 2023)',
    total_questions: 100,
    durationMin: 180,
    examType: 'NATIONAL_EXIT_SIMULATION',
    questions: huModelQuestions,
  }),
  duration_sec: 10800, // 180 mins
  grant_id: null,
  license_expiry: null,
  state: 'READY',
};

export const examRepository = {
  /**
   * Seed canonical exam packages (HU 2023 100-Q Model Exam + Course Drills) if empty.
   */
  async seedCanonicalExamsIfEmpty(): Promise<boolean> {
    const existing = await database.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM local_exam_packages WHERE exam_package_id = 'pkg_it_oopj_201_quiz';`
    );

    const count = existing[0]?.count || 0;
    if (count > 0) {
      return false;
    }

    await database.withTransaction(async (tx) => {
      // 1. Seed HU 2023 100-Question Exam
      await tx.execute(
        `INSERT OR REPLACE INTO local_exam_packages
         (exam_package_id, exam_id, course_id, blueprint_version, question_snapshot_json, duration_sec, state)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          CANONICAL_HU_2023_EXAM_PACKAGE.exam_package_id,
          CANONICAL_HU_2023_EXAM_PACKAGE.exam_id,
          CANONICAL_HU_2023_EXAM_PACKAGE.course_id,
          CANONICAL_HU_2023_EXAM_PACKAGE.blueprint_version,
          CANONICAL_HU_2023_EXAM_PACKAGE.question_snapshot_json,
          CANONICAL_HU_2023_EXAM_PACKAGE.duration_sec,
          CANONICAL_HU_2023_EXAM_PACKAGE.state,
        ]
      );

      // 2. Seed Canonical Course Practice Quizzes (11 Key Exit Exam Courses)
      const quizzes = [
        {
          id: 'pkg_it_oopj_201_quiz',
          examId: 'exam-oopj-201',
          courseId: 201,
          courseCode: 'IT-OOPJ-201',
          title: 'IT-OOPJ-201 Object-Oriented Programming (Java) Quiz',
          questions: (huModelQuestions as SnapshotQuestion[]).filter((q) => q.courseCode === 'IT-OOPJ-201'),
          durationSec: 1500, // 25 min
        },
        {
          id: 'pkg_it_advp_202_quiz',
          examId: 'exam-advp-202',
          courseId: 202,
          courseCode: 'IT-ADVP-202',
          title: 'IT-ADVP-202 Advanced Programming in Java Quiz',
          questions: (huModelQuestions as SnapshotQuestion[]).filter((q) => q.courseCode === 'IT-ADVP-202'),
          durationSec: 1500, // 25 min
        },
        {
          id: 'pkg_it_edpr_203_quiz',
          examId: 'exam-edpr-203',
          courseId: 203,
          courseCode: 'IT-EDPR-203',
          title: 'IT-EDPR-203 Event-Driven Programming (C# / GUI) Quiz',
          questions: (huModelQuestions as SnapshotQuestion[]).filter((q) => q.courseCode === 'IT-EDPR-203'),
          durationSec: 1500, // 25 min
        },
        {
          id: 'pkg_it_iprg_301_302_quiz',
          examId: 'exam-iprg-301-302',
          courseId: 303,
          courseCode: 'IT-IPRG-301',
          title: 'IT-IPRG-301/302 Internet Programming (Web Technologies) Quiz',
          questions: (huModelQuestions as SnapshotQuestion[]).filter(
            (q) => q.courseCode === 'IT-IPRG-301' || q.courseCode === 'IT-IPRG-302'
          ),
          durationSec: 1800, // 30 min
        },
        {
          id: 'pkg_it_syad_204_quiz',
          examId: 'exam-syad-204',
          courseId: 204,
          courseCode: 'IT-SYAD-204',
          title: 'IT-SYAD-204 Systems Analysis & Design Quiz',
          questions: (huModelQuestions as SnapshotQuestion[]).filter((q) => q.courseCode === 'IT-SYAD-204'),
          durationSec: 1500, // 25 min
        },
        {
          id: 'pkg_it_dccn_201_quiz',
          examId: 'exam-dccn-201',
          courseId: 206,
          courseCode: 'IT-DCCN-201',
          title: 'IT-DCCN-201 Data Communication & Networks Quiz',
          questions: (huModelQuestions as SnapshotQuestion[]).filter((q) => q.courseCode === 'IT-DCCN-201'),
          durationSec: 1500, // 25 min
        },
        {
          id: 'pkg_it_iasc_401_quiz',
          examId: 'exam-iasc-401',
          courseId: 402,
          courseCode: 'IT-IASC-401',
          title: 'IT-IASC-401 Information Assurance & Security Assessment',
          questions: (huModelQuestions as SnapshotQuestion[]).filter((q) => q.courseCode === 'IT-IASC-401'),
          durationSec: 1500, // 25 min
        },
        {
          id: 'pkg_it_cmts_101_quiz',
          examId: 'exam-cmts-101',
          courseId: 101,
          courseCode: 'IT-CMTS-101',
          title: 'IT-CMTS-101 Computer Maintenance & Diagnostics Drill',
          questions: (huModelQuestions as SnapshotQuestion[]).filter((q) => q.courseCode === 'IT-CMTS-101'),
          durationSec: 1500, // 25 min
        },
        {
          id: 'pkg_it_snad_301_quiz',
          examId: 'exam-snad-301',
          courseId: 301,
          courseCode: 'IT-SNAD-301',
          title: 'IT-SNAD-301 System & Network Administration Quiz',
          questions: (huModelQuestions as SnapshotQuestion[]).filter((q) => q.courseCode === 'IT-SNAD-301'),
          durationSec: 1500, // 25 min
        },
        {
          id: 'pkg_it_fdbs_201_quiz',
          examId: 'exam-fdbs-201',
          courseId: 205,
          courseCode: 'IT-FDBS-201',
          title: 'IT-FDBS-201 Fundamentals of Database Systems Quiz',
          questions: (huModelQuestions as SnapshotQuestion[]).filter((q) => q.courseCode === 'IT-FDBS-201'),
          durationSec: 1800, // 30 min
        },
        {
          id: 'pkg_it_adbs_301_quiz',
          examId: 'exam-adbs-301',
          courseId: 302,
          courseCode: 'IT-ADBS-301',
          title: 'IT-ADBS-301 Advanced Database Systems Quiz',
          questions: (huModelQuestions as SnapshotQuestion[]).filter((q) => q.courseCode === 'IT-ADBS-301'),
          durationSec: 1200, // 20 min
        },
        // Legacy quiz package aliases for backwards compatibility
        {
          id: 'pkg_event_prog_quiz',
          examId: 'exam-edpr-quiz',
          courseId: 203,
          courseCode: 'IT-EDPR-203',
          title: 'IT-EDPR-203 Event Driven Programming Quiz',
          questions: (huModelQuestions as SnapshotQuestion[]).filter((q) => q.courseCode === 'IT-EDPR-203'),
          durationSec: 1500,
        },
        {
          id: 'pkg_oop_java_quiz',
          examId: 'exam-oopj-quiz',
          courseId: 201,
          courseCode: 'IT-OOPJ-201',
          title: 'IT-OOPJ-201 OOP in Java Assessment',
          questions: (huModelQuestions as SnapshotQuestion[]).filter(
            (q) => q.courseCode === 'IT-OOPJ-201' || q.courseCode === 'IT-ADVP-202'
          ),
          durationSec: 1800,
        },
        {
          id: 'pkg_dbms_quiz',
          examId: 'exam-dbms-quiz',
          courseId: 205,
          courseCode: 'IT-FDBS-201',
          title: 'IT-FDBS-201 Database Systems Quiz',
          questions: (huModelQuestions as SnapshotQuestion[]).filter(
            (q) => q.courseCode === 'IT-FDBS-201' || q.courseCode === 'IT-ADBS-301'
          ),
          durationSec: 1800,
        },
      ];

      for (const q of quizzes) {
        await tx.execute(
          `INSERT OR REPLACE INTO local_exam_packages
           (exam_package_id, exam_id, course_id, blueprint_version, question_snapshot_json, duration_sec, state)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            q.id,
            q.examId,
            q.courseId,
            1,
            JSON.stringify({
              title: q.title,
              course_code: q.courseCode,
              total_questions: q.questions.length,
              questions: q.questions,
            }),
            q.durationSec,
            'READY',
          ]
        );
      }
    });

    return true;
  },

  /**
   * Get all cached exam packages.
   */
  async getAllExamPackages(): Promise<LocalExamPackage[]> {
    await this.seedCanonicalExamsIfEmpty();
    return await database.query<LocalExamPackage>(
      `SELECT * FROM local_exam_packages ORDER BY blueprint_version DESC;`
    );
  },

  /**
   * Get exam package by ID with parsed snapshot.
   */
  async getExamPackageById(packageId: string): Promise<{
    package: LocalExamPackage | null;
    snapshot: ParsedExamSnapshot | null;
  }> {
    await this.seedCanonicalExamsIfEmpty();
    const rows = await database.query<LocalExamPackage>(
      `SELECT * FROM local_exam_packages WHERE exam_package_id = ? LIMIT 1;`,
      [packageId]
    );

    if (rows.length === 0) {
      return { package: null, snapshot: null };
    }

    const pkg = rows[0];
    let snapshot: ParsedExamSnapshot | null = null;
    try {
      snapshot = JSON.parse(pkg.question_snapshot_json) as ParsedExamSnapshot;
    } catch (_) {}

    return { package: pkg, snapshot };
  },

  /**
   * Fetch live exam blueprints from FastAPI (/api/v1/exams) and cache in SQLite.
   */
  async hydrateExamsFromServer(xTenantId?: string | null): Promise<{
    hydrated: boolean;
    count: number;
  }> {
    try {
      // Lazy load apiClient to prevent expo-secure-store evaluation in offline test runners
      const { apiClient } = require('../api/client') as { apiClient: ApiClient };
      const headers: Record<string, string> = {};
      if (xTenantId) {
        headers['X-Tenant-ID'] = xTenantId;
      }

      const remoteExams = await apiClient.get<any[]>('/exams', { headers });

      if (Array.isArray(remoteExams) && remoteExams.length > 0) {
        await database.withTransaction(async (tx) => {
          for (const exam of remoteExams) {
            await tx.execute(
              `INSERT OR REPLACE INTO local_exam_packages
               (exam_package_id, exam_id, course_id, blueprint_version, question_snapshot_json, duration_sec, state)
               VALUES (?, ?, ?, ?, ?, ?, ?);`,
              [
                exam.blueprint_id || exam.exam_package_id || exam.id,
                exam.exam_id || exam.blueprint_id || exam.id,
                exam.course_id ?? null,
                exam.version || 1,
                typeof exam.question_snapshot === 'string'
                  ? exam.question_snapshot
                  : JSON.stringify(exam.question_snapshot || { title: exam.title, questions: [] }),
                (exam.duration_minutes || 180) * 60,
                'READY',
              ]
            );
          }
        });

        return { hydrated: true, count: remoteExams.length };
      }
    } catch (_error) {
      // Offline fallback: ensure local seed is present
      await this.seedCanonicalExamsIfEmpty();
    }

    return { hydrated: false, count: 0 };
  },
};
