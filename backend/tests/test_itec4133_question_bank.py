from pathlib import Path

import pytest
from sqlalchemy import text

from backend.app.assessments.router import _client_snapshot
from backend.app.database.session import AsyncSessionLocal
from backend.scripts.seed_itec4133_question_bank import seed_question_bank
from scripts.parse_hu_question_bank import (
    generate_study_notes_markdown,
    parse_hu_question_bank,
    validate_question_bank,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CANONICAL_PATH = (
    PROJECT_ROOT / "data/exam_packs/itec4133_information_assurance_parsed.json"
)


def _read_canonical_bank():
    parsed = parse_hu_question_bank(str(CANONICAL_PATH))
    validate_question_bank(parsed)
    return parsed


def test_canonical_bank_contains_full_question_and_distractor_data():
    parsed = _read_canonical_bank()
    assert parsed["metadata"]["difficultyCounts"] == {
        "EASY": 28,
        "MEDIUM": 36,
        "HARD": 16,
    }
    assert len(parsed["questions"]) == len(parsed["cheatNotes"]) == 80
    question_30 = next(
        question for question in parsed["questions"] if question["questionNumber"] == 30
    )
    assert question_30["id"] == "Q-CH3-030"
    assert question_30["chapterNumber"] == 2
    assert question_30["linkedNoteCode"] == "NOTE-CH2-030"
    assert all(
        len(question["options"]) == 4
        and all(option["explanation"] for option in question["options"])
        for question in parsed["questions"]
    )


def test_start_attempt_snapshot_removes_all_answer_keys():
    client_snapshot = _client_snapshot(
        [
            {
                "question_id": "question-id",
                "explanation": "Full rationale",
                "option_explanations": {"A": "Distractor rationale"},
                "options": [
                    {
                        "option_id": "option-id",
                        "option_label": "A",
                        "option_text": "Choice",
                        "is_correct": True,
                        "explanation": "Distractor rationale",
                    }
                ],
            }
        ]
    )
    assert "explanation" not in client_snapshot[0]
    assert "option_explanations" not in client_snapshot[0]
    assert "is_correct" not in client_snapshot[0]["options"][0]
    assert "explanation" not in client_snapshot[0]["options"][0]


@pytest.mark.asyncio
async def test_backend_seed_is_idempotent_and_preserves_option_explanations():
    parsed = _read_canonical_bank()
    markdown_files = generate_study_notes_markdown(parsed)
    async with AsyncSessionLocal() as db:
        transaction = await db.begin()
        try:
            first = await seed_question_bank(
                db,
                parsed,
                markdown_files,
                upload_resources=False,
            )
            second = await seed_question_bank(
                db,
                parsed,
                markdown_files,
                upload_resources=False,
            )
            assert first == second == {
                "outcomes": 4,
                "questions": 80,
                "options": 320,
                "blueprints": 5,
                "resources": 5,
            }

            counts = await db.execute(
                text(
                    """
                    SELECT
                      (SELECT COUNT(*) FROM questions
                        WHERE course_id = (
                          SELECT course_id FROM courses WHERE code = 'IT-IASC-401'
                        )
                        AND question_text LIKE '[Q%') AS questions,
                      (SELECT COUNT(*) FROM exam_blueprints WHERE rules_json ? 'blueprint_code'
                        AND course_id = (
                          SELECT course_id FROM courses WHERE code = 'IT-IASC-401'
                        )) AS blueprints,
                      (SELECT COUNT(*) FROM course_resources WHERE course_id = (
                        SELECT course_id FROM courses WHERE code = 'IT-IASC-401'
                      )) AS resources
                    """
                )
            )
            assert counts.one()._asdict() == {
                "questions": 80,
                "blueprints": 5,
                "resources": 5,
            }

            option_explanations = await db.scalar(
                text(
                    """
                    SELECT option_explanations
                    FROM questions
                    WHERE question_id = (
                      SELECT question_id FROM questions
                      WHERE question_text LIKE '[Q1]%' LIMIT 1
                    )
                    """
                )
            )
            assert option_explanations["A"]
            assert len(option_explanations) == 4
        finally:
            await transaction.rollback()
