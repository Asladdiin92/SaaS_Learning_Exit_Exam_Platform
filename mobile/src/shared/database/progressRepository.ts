import { database } from './db';
import { curriculumRepository } from './curriculumRepository';

export interface ProgressSummary {
  overall_readiness_percent: number;
  active_courses_count: number;
  total_courses_count: number;
  validated_attempts_count: number;
  study_streak_days: number;
  last_calculated_at: string;
  disclaimer: string;
}

export interface ThemeMastery {
  theme_id: number;
  theme_number: number;
  title: string;
  credit_hours: number;
  courses_count: number;
  mastery_score: number;
  mastery_percentage: number;
  attempted_outcomes_count: number;
  total_outcomes_count: number;
}

export interface BloomLevel {
  level: string;
  display_name: string;
  attempted_count: number;
  correct_count: number;
  mastery_score: number;
  mastery_percentage: number;
}

export interface OutcomeMasteryItem {
  outcome_id: number;
  outcome_code?: string | null;
  description: string;
  domain: string;
  level: string;
  attempts_evidence_count: number;
  correct_evidence_count: number;
  mastery_score: number;
}

export interface CourseMastery {
  course_id: number;
  theme_id: number;
  code: string;
  title: string;
  credit_hours: number;
  mastery_score: number;
  mastery_percentage: number;
  total_outcomes_count: number;
  attempted_outcomes_count: number;
  outcomes: OutcomeMasteryItem[];
}

export interface RecentAttempt {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  score_percent: number | null;
  passed: boolean;
  duration_seconds: number | null;
  scored_at: string | null;
}

export interface StudentProgressData {
  summary: ProgressSummary;
  themes: ThemeMastery[];
  blooms_distribution: BloomLevel[];
  courses: CourseMastery[];
  recent_attempts: RecentAttempt[];
}

export const progressRepository = {
  getCacheKey(userId: string, tenantId?: string | null): string {
    return tenantId ? `${userId}:${tenantId}` : `${userId}:personal`;
  },

  async getPendingLocalAttemptsCount(userId: string, tenantId?: string | null): Promise<number> {
    try {
      const rows = await database.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM local_exam_attempts
         WHERE user_id = ? AND status = 'SUBMITTED_LOCAL_PENDING'`,
        [userId]
      );
      return rows[0]?.count || 0;
    } catch (_) {
      return 0;
    }
  },

  async getCachedProgress(userId: string, tenantId?: string | null): Promise<StudentProgressData | null> {
    const key = this.getCacheKey(userId, tenantId);
    try {
      const rows = await database.query<{
        mastery_json: string;
        mastery_score: number;
        last_calculated_at: string;
        pending_local_attempts_count: number;
      }>(
        `SELECT mastery_json, mastery_score, last_calculated_at, pending_local_attempts_count
         FROM local_progress_cache WHERE cache_key = ?`,
        [key]
      );
      if (rows.length === 0) return null;

      const data: StudentProgressData = JSON.parse(rows[0].mastery_json);
      return data;
    } catch (_) {
      return null;
    }
  },

  async saveProgressCache(
    userId: string,
    tenantId: string | null = null,
    data: StudentProgressData,
    pendingLocalAttempts: number = 0
  ): Promise<void> {
    const key = this.getCacheKey(userId, tenantId);
    const jsonStr = JSON.stringify(data);
    const overallScore = (data.summary.overall_readiness_percent || 0) / 100.0;
    const now = data.summary.last_calculated_at || new Date().toISOString();

    await database.execute(
      `INSERT OR REPLACE INTO local_progress_cache (
        cache_key, mastery_json, mastery_score, last_calculated_at, pending_local_attempts_count
      ) VALUES (?, ?, ?, ?, ?)`,
      [key, jsonStr, overallScore, now, pendingLocalAttempts]
    );
  },

  /**
   * Generates offline fallback progress directly from SQLite tables
   * when device is in airplane mode without network access.
   */
  async generateOfflineFallbackProgress(userId: string, tenantId?: string | null): Promise<StudentProgressData> {
    const themes = await curriculumRepository.getThemes();
    const courses = await curriculumRepository.getAllCourses();
    const pendingCount = await this.getPendingLocalAttemptsCount(userId, tenantId);

    const bloomsMap: Record<string, { attempted: number; correct: number; total: number }> = {
      REMEMBER: { attempted: 0, correct: 0, total: 0 },
      UNDERSTAND: { attempted: 0, correct: 0, total: 0 },
      APPLY: { attempted: 0, correct: 0, total: 0 },
      ANALYSE: { attempted: 0, correct: 0, total: 0 },
      EVALUATE: { attempted: 0, correct: 0, total: 0 },
      CREATE: { attempted: 0, correct: 0, total: 0 },
    };

    const courseMasteryList: CourseMastery[] = [];
    const courseScoresByTheme: Record<number, number[]> = {};

    for (const c of courses) {
      const outcomes = await curriculumRepository.getOutcomesByCourse(c.course_id);
      const outcomeItems: OutcomeMasteryItem[] = outcomes.map((lo) => {
        const lvl = (lo.level || 'REMEMBER').toUpperCase();
        if (bloomsMap[lvl]) {
          bloomsMap[lvl].total += 1;
        }
        return {
          outcome_id: lo.outcome_id,
          description: lo.description,
          domain: lo.domain || 'COGNITIVE',
          level: lvl,
          attempts_evidence_count: 0,
          correct_evidence_count: 0,
          mastery_score: 0.0,
        };
      });

      const cItem: CourseMastery = {
        course_id: c.course_id,
        theme_id: c.theme_id,
        code: c.code,
        title: c.title,
        credit_hours: c.credit_hours,
        mastery_score: 0.0,
        mastery_percentage: 0.0,
        total_outcomes_count: outcomeItems.length,
        attempted_outcomes_count: 0,
        outcomes: outcomeItems,
      };

      courseMasteryList.push(cItem);
      if (!courseScoresByTheme[c.theme_id]) {
        courseScoresByTheme[c.theme_id] = [];
      }
      courseScoresByTheme[c.theme_id].push(0.0);
    }

    const themeMasteryList: ThemeMastery[] = themes.map((t) => {
      const tCourses = courses.filter((c: any) => c.theme_id === t.theme_id);
      return {
        theme_id: t.theme_id,
        theme_number: t.theme_number,
        title: t.title,
        credit_hours: t.total_credit_hours,
        courses_count: tCourses.length,
        mastery_score: 0.0,
        mastery_percentage: 0.0,
        attempted_outcomes_count: 0,
        total_outcomes_count: 0,
      };
    });

    const bloomsDistribution: BloomLevel[] = [
      { level: 'REMEMBER', display_name: 'Remembering', attempted_count: 0, correct_count: 0, mastery_score: 0.0, mastery_percentage: 0.0 },
      { level: 'UNDERSTAND', display_name: 'Understanding', attempted_count: 0, correct_count: 0, mastery_score: 0.0, mastery_percentage: 0.0 },
      { level: 'APPLY', display_name: 'Applying', attempted_count: 0, correct_count: 0, mastery_score: 0.0, mastery_percentage: 0.0 },
      { level: 'ANALYSE', display_name: 'Analyzing', attempted_count: 0, correct_count: 0, mastery_score: 0.0, mastery_percentage: 0.0 },
      { level: 'EVALUATE', display_name: 'Evaluating', attempted_count: 0, correct_count: 0, mastery_score: 0.0, mastery_percentage: 0.0 },
      { level: 'CREATE', display_name: 'Creating', attempted_count: 0, correct_count: 0, mastery_score: 0.0, mastery_percentage: 0.0 },
    ];

    return {
      summary: {
        overall_readiness_percent: 0.0,
        active_courses_count: 0,
        total_courses_count: courses.length || 15,
        validated_attempts_count: 0,
        study_streak_days: 0,
        last_calculated_at: new Date().toISOString(),
        disclaimer: 'Mastery scores are rolling estimates based on validated practice evidence, not official university grades.',
      },
      themes: themeMasteryList,
      blooms_distribution: bloomsDistribution,
      courses: courseMasteryList,
      recent_attempts: [],
    };
  },
};
