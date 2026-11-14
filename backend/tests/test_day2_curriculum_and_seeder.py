import json
import uuid

import psycopg2
import pytest

from backend.app.core.config import settings


def _connect():
    db_url = settings.DIRECT_URL or settings.DATABASE_URL
    db_url = (
        db_url.replace("postgresql+asyncpg://", "postgresql://")
        .replace("postgresql+psycopg2://", "postgresql://")
        .replace("postgresql+psycopg://", "postgresql://")
    )
    return psycopg2.connect(db_url)


def test_day2_curriculum_and_present_model_exam_and_grading():
    expected_codes = [
        "IT-CMTS-101",
        "IT-OOPJ-201",
        "IT-ADVP-202",
        "IT-EDPR-203",
        "IT-SYAD-204",
        "IT-ITPM-301",
        "IT-FDBS-201",
        "IT-ADBS-301",
        "IT-IPRG-301",
        "IT-IPRG-302",
        "IT-MABD-401",
        "IT-DCCN-201",
        "IT-SNAD-301",
        "IT-NDVC-302",
        "IT-IASC-401",
    ]

    blueprint_title = "HU CCI B.Sc. IT Graduating Class Model Exit Exam (Jan 2023 — 100 Questions)"

    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*), COALESCE(SUM(total_credit_hours), 0) FROM themes")
            themes_count, theme_credits = cur.fetchone()
            assert themes_count == 5, f"Expected 5 themes, found {themes_count}"
            assert theme_credits == 45, f"Expected 45 theme credits, found {theme_credits}"

            cur.execute("SELECT COUNT(*), COALESCE(SUM(credit_hours), 0) FROM courses")
            courses_count, course_credits = cur.fetchone()
            assert courses_count == 15, f"Expected 15 courses, found {courses_count}"
            assert course_credits == 45, f"Expected 45 course credits, found {course_credits}"

            cur.execute("SELECT COUNT(*) FROM learning_outcomes")
            learning_outcomes = cur.fetchone()[0]
            assert learning_outcomes >= 45, f"Expected >=45 learning outcomes, found {learning_outcomes}"

            cur.execute("SELECT code FROM courses ORDER BY code")
            actual_codes = [row[0] for row in cur.fetchall()]
            assert set(expected_codes).issubset(set(actual_codes)), (
                f"Missing canonical courses: {sorted(set(expected_codes) - set(actual_codes))}"
            )

            cur.execute("SELECT COUNT(*) FROM exam_blueprints WHERE title = %s", (blueprint_title,))
            assert cur.fetchone()[0] == 1, "HU model exam blueprint missing"

            cur.execute("SELECT COUNT(*) FROM questions")
            assert cur.fetchone()[0] == 100, "Expected 100 questions"

            cur.execute("SELECT COUNT(*) FROM question_options")
            assert cur.fetchone()[0] == 420, "Expected 420 question options"

            cur.execute(
                "SELECT exam_id FROM exam_blueprints WHERE title = %s",
                (blueprint_title,),
            )
            exam_id = cur.fetchone()[0]

            cur.execute(
                "SELECT question_id FROM questions ORDER BY created_at LIMIT 3"
            )
            question_ids = [row[0] for row in cur.fetchall()]
            assert len(question_ids) == 3

            snapshot = []
            selected_option_ids = []
            for index, question_id in enumerate(question_ids):
                cur.execute(
                    "SELECT option_id, option_label, is_correct FROM question_options WHERE question_id = %s ORDER BY option_label",
                    (question_id,),
                )
                options = cur.fetchall()
                assert len(options) >= 2
                snapshot.append(
                    {
                        "question_id": str(question_id),
                        "options": [
                            {"option_id": str(option_id), "is_correct": bool(is_correct)}
                            for option_id, _, is_correct in options
                        ],
                    }
                )
                correct_option_id = next(option_id for option_id, _, is_correct in options if is_correct)
                wrong_option_id = next(option_id for option_id, _, is_correct in options if not is_correct)
                selected_option_ids.append(
                    (question_id, correct_option_id if index < 2 else wrong_option_id)
                )

            user_id = uuid.uuid4()
            cur.execute(
                "INSERT INTO users (user_id, email, password_hash, full_name) VALUES (%s, %s, %s, %s)",
                (str(user_id), f"day2-grader-{uuid.uuid4().hex[:8]}@hu.edu.et", "hash", "Day 2 Grader"),
            )

            attempt_id = uuid.uuid4()
            cur.execute(
                "INSERT INTO exam_attempts (attempt_id, user_id, exam_id, status, question_snapshots, total_questions) VALUES (%s, %s, %s, 'IN_PROGRESS', %s::jsonb, %s)",
                (str(attempt_id), str(user_id), str(exam_id), json.dumps(snapshot), len(snapshot)),
            )

            sequence_no = 1
            for question_id, selected_option_id in selected_option_ids:
                cur.execute(
                    "INSERT INTO attempt_answers (answer_id, attempt_id, question_id, selected_option_id, is_correct, sequence_no) VALUES (%s, %s, %s, %s, %s, %s)",
                    (
                        str(uuid.uuid4()),
                        str(attempt_id),
                        str(question_id),
                        str(selected_option_id),
                        False,
                        sequence_no,
                    ),
                )
                sequence_no += 1

            cur.execute(
                "SELECT final_score, total_correct, total_items FROM public.grade_exam_attempt(%s)",
                (str(attempt_id),),
            )
            final_score, total_correct, total_items = cur.fetchone()
            assert total_correct == 2, f"Expected 2 correct answers, found {total_correct}"
            assert total_items == 3, f"Expected 3 total answers, found {total_items}"
            assert float(final_score) == pytest.approx(66.67), f"Unexpected score: {final_score}"

            cur.execute(
                "SELECT correct_count, score_percent FROM exam_attempts WHERE attempt_id = %s",
                (str(attempt_id),),
            )
            correct_count, score_percent = cur.fetchone()
            assert correct_count == 2, f"Expected correct_count=2, found {correct_count}"
            assert float(score_percent) == pytest.approx(66.67), f"Unexpected score_percent: {score_percent}"

            conn.rollback()
