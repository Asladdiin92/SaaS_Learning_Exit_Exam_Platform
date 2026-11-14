from typing import Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def recompute_outcome_mastery(
    db: AsyncSession,
    user_id: UUID,
    tenant_id: Optional[UUID],
    outcome_ids: set[int],
) -> None:
    """Rebuild mastery using evidence from the ten most recent scored attempts."""
    for outcome_id in outcome_ids:
        await db.execute(
            text(
                """
                WITH ranked_attempts AS (
                    SELECT ea.attempt_id,
                           ea.question_snapshots,
                           ROW_NUMBER() OVER (
                               ORDER BY ea.scored_at DESC, ea.attempt_id DESC
                           ) AS attempt_rank
                    FROM exam_attempts ea
                    WHERE ea.user_id = :user_id
                      AND ea.tenant_id IS NOT DISTINCT FROM :tenant_id
                      AND ea.status = 'SCORED'
                      AND EXISTS (
                          SELECT 1
                          FROM jsonb_array_elements(ea.question_snapshots) AS item
                          WHERE (item->>'outcome_id')::integer = :outcome_id
                      )
                ),
                evidence AS (
                    SELECT COUNT(*)::integer AS attempts_count,
                           COUNT(*) FILTER (WHERE aa.is_correct)::integer AS correct_count
                    FROM ranked_attempts ra
                    CROSS JOIN LATERAL jsonb_array_elements(ra.question_snapshots) AS item
                    LEFT JOIN attempt_answers aa
                      ON aa.attempt_id = ra.attempt_id
                     AND aa.question_id = (item->>'question_id')::uuid
                    WHERE ra.attempt_rank <= 10
                      AND (item->>'outcome_id')::integer = :outcome_id
                )
                INSERT INTO outcome_mastery (
                    user_id, tenant_id, outcome_id,
                    attempts_evidence_count, correct_evidence_count,
                    mastery_score, last_evaluated_at
                )
                SELECT :user_id, :tenant_id, :outcome_id,
                       attempts_count, correct_count,
                       CASE WHEN attempts_count = 0 THEN 0
                            ELSE correct_count::numeric / attempts_count
                       END,
                       CURRENT_TIMESTAMP
                FROM evidence
                ON CONFLICT (user_id, tenant_id, outcome_id)
                DO UPDATE SET
                    attempts_evidence_count = EXCLUDED.attempts_evidence_count,
                    correct_evidence_count = EXCLUDED.correct_evidence_count,
                    mastery_score = EXCLUDED.mastery_score,
                    last_evaluated_at = EXCLUDED.last_evaluated_at
                """
            ),
            {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "outcome_id": outcome_id,
            },
        )
