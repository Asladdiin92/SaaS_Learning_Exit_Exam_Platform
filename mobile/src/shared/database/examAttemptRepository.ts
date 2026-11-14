import { database } from './db';
import * as Crypto from 'expo-crypto';

export interface LocalExamAttempt {
  local_attempt_id: string;
  user_id: string;
  tenant_id: string | null;
  exam_package_id: string;
  status: 'IN_PROGRESS' | 'SUBMITTED_LOCAL_PENDING' | 'ACCEPTED_RESULT_READY' | 'REJECTED_NEEDS_ATTENTION' | string;
  started_at: string;
  elapsed_monotonic_sec: number;
  submitted_at: string | null;
  server_attempt_id: string | null;
}

export interface LocalAnswerEvent {
  event_id: string;
  local_attempt_id: string;
  question_id: string;
  selected_option_id: string | null;
  text_or_code_answer: string | null;
  is_flagged: number; // 0 or 1
  sequence_no: number;
  created_at: string;
}

export interface SyncOperationRecord {
  operation_id: string;
  user_id: string;
  tenant_id: string | null;
  type: string;
  payload_json: string;
  state: 'QUEUED' | 'UPLOADING' | 'SERVER_ACCEPTED' | 'RETRYABLE_FAILURE' | 'REJECTED_NEEDS_RESOLUTION' | string;
  retry_count: number;
  reason_code: string | null;
  last_error: string | null;
  created_at: string;
}

const generateUUID = (): string => {
  try {
    if (typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch (_) {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const examAttemptRepository = {
  /**
   * Create an in-progress local exam attempt
   */
  async createLocalAttempt(
    examPackageId: string,
    userId: string,
    tenantId: string | null = null
  ): Promise<LocalExamAttempt> {
    const localAttemptId = generateUUID();
    const startedAt = new Date().toISOString();

    const attempt: LocalExamAttempt = {
      local_attempt_id: localAttemptId,
      user_id: userId,
      tenant_id: tenantId,
      exam_package_id: examPackageId,
      status: 'IN_PROGRESS',
      started_at: startedAt,
      elapsed_monotonic_sec: 0,
      submitted_at: null,
      server_attempt_id: null,
    };

    await database.execute(
      `INSERT INTO local_exam_attempts
       (local_attempt_id, user_id, tenant_id, exam_package_id, status, started_at, elapsed_monotonic_sec)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        attempt.local_attempt_id,
        attempt.user_id,
        attempt.tenant_id,
        attempt.exam_package_id,
        attempt.status,
        attempt.started_at,
        attempt.elapsed_monotonic_sec,
      ]
    );

    return attempt;
  },

  /**
   * Transactional answer persistence (<16ms, NFR-03).
   * Appends monotonic event to local_answer_events AND touches local_exam_attempts.
   */
  async saveAnswerTransactional(
    localAttemptId: string,
    questionId: string,
    selectedOptionId: string | null,
    isFlagged = false,
    textOrCodeAnswer?: string,
    elapsedMonotonicSec?: number
  ): Promise<LocalAnswerEvent> {
    return await database.withTransaction(async (tx) => {
      // 1. Determine next sequence_no for this attempt
      const seqRows = await tx.query<{ max_seq: number | null }>(
        `SELECT MAX(sequence_no) as max_seq FROM local_answer_events WHERE local_attempt_id = ?;`,
        [localAttemptId]
      );
      const nextSeq = ((seqRows[0]?.max_seq ?? 0) || 0) + 1;

      const eventId = generateUUID();
      const createdAt = new Date().toISOString();

      const event: LocalAnswerEvent = {
        event_id: eventId,
        local_attempt_id: localAttemptId,
        question_id: questionId,
        selected_option_id: selectedOptionId,
        text_or_code_answer: textOrCodeAnswer || null,
        is_flagged: isFlagged ? 1 : 0,
        sequence_no: nextSeq,
        created_at: createdAt,
      };

      // 2. Append event
      await tx.execute(
        `INSERT INTO local_answer_events
         (event_id, local_attempt_id, question_id, selected_option_id, text_or_code_answer, is_flagged, sequence_no, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          event.event_id,
          event.local_attempt_id,
          event.question_id,
          event.selected_option_id,
          event.text_or_code_answer,
          event.is_flagged,
          event.sequence_no,
          event.created_at,
        ]
      );

      // 3. Update attempt timer if provided
      if (elapsedMonotonicSec !== undefined) {
        await tx.execute(
          `UPDATE local_exam_attempts SET elapsed_monotonic_sec = ? WHERE local_attempt_id = ?;`,
          [elapsedMonotonicSec, localAttemptId]
        );
      }

      return event;
    });
  },

  /**
   * Submit exam attempt offline inside an atomic transaction:
   * Sets local_exam_attempts.status = 'SUBMITTED_LOCAL_PENDING' and creates a durable sync_operations outbox record.
   */
  async submitAttemptOfflineTransactional(
    localAttemptId: string
  ): Promise<{ localAttemptId: string; syncOperationId: string }> {
    return await database.withTransaction(async (tx) => {
      // 1. Fetch current attempt
      const attempts = await tx.query<LocalExamAttempt>(
        `SELECT * FROM local_exam_attempts WHERE local_attempt_id = ?;`,
        [localAttemptId]
      );
      if (attempts.length === 0) {
        throw new Error(`Local attempt ${localAttemptId} not found`);
      }
      const attempt = attempts[0];

      if (attempt.status !== 'IN_PROGRESS') {
        throw new Error(
          `Cannot submit attempt ${localAttemptId} in status ${attempt.status}`
        );
      }

      const submittedAt = new Date().toISOString();

      // 2. Transition status to SUBMITTED_LOCAL_PENDING
      await tx.execute(
        `UPDATE local_exam_attempts SET status = ?, submitted_at = ? WHERE local_attempt_id = ?;`,
        ['SUBMITTED_LOCAL_PENDING', submittedAt, localAttemptId]
      );

      // 3. Gather latest answer events for all questions
      const allEvents = await tx.query<LocalAnswerEvent>(
        `SELECT * FROM local_answer_events WHERE local_attempt_id = ? ORDER BY sequence_no ASC;`,
        [localAttemptId]
      );

      // Deduplicate to latest answer per question
      const latestAnswersMap = new Map<string, LocalAnswerEvent>();
      for (const ev of allEvents) {
        latestAnswersMap.set(ev.question_id, ev);
      }

      const answersPayload = Array.from(latestAnswersMap.values()).map((ans) => ({
        question_id: ans.question_id,
        selected_option_id: ans.selected_option_id,
        text_or_code_answer: ans.text_or_code_answer,
        sequence_no: ans.sequence_no,
      }));

      const syncOperationId = generateUUID();
      const payload = {
        local_attempt_id: localAttemptId,
        exam_package_id: attempt.exam_package_id,
        started_at: attempt.started_at,
        submitted_at: submittedAt,
        elapsed_monotonic_sec: attempt.elapsed_monotonic_sec,
        answers: answersPayload,
      };

      // 4. Enqueue into durable sync_operations table
      await tx.execute(
        `INSERT INTO sync_operations
         (operation_id, user_id, tenant_id, type, payload_json, state, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          syncOperationId,
          attempt.user_id,
          attempt.tenant_id,
          'exam_attempt.submit',
          JSON.stringify(payload),
          'QUEUED',
          submittedAt,
        ]
      );

      return {
        localAttemptId,
        syncOperationId,
      };
    });
  },

  async getAttemptById(localAttemptId: string): Promise<LocalExamAttempt | null> {
    const rows = await database.query<LocalExamAttempt>(
      `SELECT * FROM local_exam_attempts WHERE local_attempt_id = ?;`,
      [localAttemptId]
    );
    return rows.length > 0 ? rows[0] : null;
  },

  async getActiveAttemptForPackage(
    examPackageId: string,
    userId: string
  ): Promise<LocalExamAttempt | null> {
    const rows = await database.query<LocalExamAttempt>(
      `SELECT * FROM local_exam_attempts 
       WHERE exam_package_id = ? AND user_id = ? AND status = 'IN_PROGRESS'
       ORDER BY started_at DESC LIMIT 1;`,
      [examPackageId, userId]
    );
    return rows.length > 0 ? rows[0] : null;
  },

  async getAnswerEventsForAttempt(localAttemptId: string): Promise<LocalAnswerEvent[]> {
    return await database.query<LocalAnswerEvent>(
      `SELECT * FROM local_answer_events WHERE local_attempt_id = ? ORDER BY sequence_no ASC;`,
      [localAttemptId]
    );
  },

  async getAllAttempts(userId?: string): Promise<LocalExamAttempt[]> {
    if (userId) {
      return await database.query<LocalExamAttempt>(
        `SELECT * FROM local_exam_attempts WHERE user_id = ? ORDER BY started_at DESC;`,
        [userId]
      );
    }
    return await database.query<LocalExamAttempt>(
      `SELECT * FROM local_exam_attempts ORDER BY started_at DESC;`
    );
  },

  async markAttemptAccepted(localAttemptId: string, serverAttemptId?: string): Promise<void> {
    await database.execute(
      `UPDATE local_exam_attempts SET status = ?, server_attempt_id = ? WHERE local_attempt_id = ?;`,
      ['ACCEPTED_RESULT_READY', serverAttemptId || localAttemptId, localAttemptId]
    );
  },

  async updateLocalProgressCache(
    cacheKey: string,
    masteryScore: number,
    masteryJson: string,
    pendingDelta = 0
  ): Promise<void> {
    const now = new Date().toISOString();
    await database.execute(
      `INSERT OR REPLACE INTO local_progress_cache
       (cache_key, mastery_json, mastery_score, last_calculated_at, pending_local_attempts_count)
       VALUES (?, ?, ?, ?, ?);`,
      [cacheKey, masteryJson, masteryScore, now, pendingDelta]
    );
  },
};
