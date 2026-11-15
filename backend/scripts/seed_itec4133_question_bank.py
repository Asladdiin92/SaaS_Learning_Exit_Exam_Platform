#!/usr/bin/env python3
"""Idempotently seed the ITec4133 question bank and structured study resources."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.content.storage_adapter import storage_adapter
from backend.app.database.session import AsyncSessionLocal
from scripts.parse_hu_question_bank import (
    CHAPTER_METADATA,
    generate_study_notes_markdown,
    parse_hu_question_bank,
    validate_question_bank,
)

SEED_NAMESPACE = uuid.UUID("bf8ca4bc-a708-4bc8-a0f2-47a392b70432")
SOURCE_PATH = (
    PROJECT_ROOT
    / "data/exam_packs/itec4133_information_assurance_parsed.json"
)
COURSE_CODE = "IT-IASC-401"
SOURCE_COURSE_CODE = "IT-SEC-401"
COURSE_TITLE = "Information Assurance and Security"
OUTCOME_DESCRIPTIONS = {
    1: "Analyze CIA triad, passive/active attacks, X.800 architecture and access control models.",
    2: "Apply classical encryption techniques, Caesar, Playfair, Hill, and Vigenère polyalphabetic ciphers.",
    3: "Analyze modern block cipher structures, Feistel networks, DES rounds, and avalanche effects.",
    4: "Compute modular arithmetic, gcd, Euler totient, RSA keys, and Diffie-Hellman key exchanges.",
}

BLUEPRINTS = (
    {
        "code": "ITEC4133-FULL-80",
        "title": "ITec4133 Information Assurance & Security — Comprehensive Exam (80 Qs, 120 mins)",
        "type": "COURSE_EXAM",
        "question_count": 80,
        "duration_seconds": 7200,
        "chapter": None,
    },
    {
        "code": "ITEC4133-CH1-20",
        "title": "Ch 1: Security Concepts & X.800 Architecture Practice Quiz (20 Qs)",
        "type": "PRACTICE_QUIZ",
        "question_count": 20,
        "duration_seconds": 1800,
        "chapter": 1,
    },
    {
        "code": "ITEC4133-CH2-20",
        "title": "Ch 2: Classical Encryption & Symmetric Ciphers Practice Quiz (20 Qs)",
        "type": "PRACTICE_QUIZ",
        "question_count": 20,
        "duration_seconds": 1800,
        "chapter": 2,
    },
    {
        "code": "ITEC4133-CH3-20",
        "title": "Ch 3: Modern Block Ciphers & DES Practice Quiz (20 Qs)",
        "type": "PRACTICE_QUIZ",
        "question_count": 20,
        "duration_seconds": 1800,
        "chapter": 3,
    },
    {
        "code": "ITEC4133-CH4-20",
        "title": "Ch 4: Number Theory, RSA & Diffie-Hellman Practice Quiz (20 Qs)",
        "type": "PRACTICE_QUIZ",
        "question_count": 20,
        "duration_seconds": 1800,
        "chapter": 4,
    },
)


def stable_uuid(kind: str, key: str) -> uuid.UUID:
    return uuid.uuid5(SEED_NAMESPACE, f"{kind}:{key}")


def _encoded_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


async def seed_question_bank(
    db: AsyncSession,
    parsed: dict[str, Any],
    markdown_files: dict[str, str],
    *,
    upload_resources: bool = True,
) -> dict[str, int]:
    theme_id = await db.scalar(
        text(
            "SELECT theme_id FROM themes WHERE theme_number = 5 "
            "ORDER BY theme_id LIMIT 1"
        )
    )
    if theme_id is None:
        raise RuntimeError("Canonical Theme 5 is missing; cannot seed IT-SEC-401.")

    course_id = await db.scalar(
        text(
            """
            INSERT INTO courses (
                theme_id, code, title, credit_hours, general_objective, version
            )
            VALUES (
                :theme_id, :code, :title, 2, :objective, 1
            )
            ON CONFLICT (code) DO UPDATE SET
                theme_id = EXCLUDED.theme_id,
                title = EXCLUDED.title,
                credit_hours = EXCLUDED.credit_hours,
                general_objective = EXCLUDED.general_objective,
                version = EXCLUDED.version
            RETURNING course_id
            """
        ),
        {
            "theme_id": theme_id,
            "code": COURSE_CODE,
            "title": COURSE_TITLE,
            "objective": (
                "Comprehensive study of information security, cryptography, "
                "symmetric/asymmetric algorithms, and key exchange mechanisms."
            ),
        },
    )

    outcome_ids: dict[int, int] = {}
    for chapter_number, chapter in CHAPTER_METADATA.items():
        outcome_code = chapter["outcome_id"]
        row = (
            await db.execute(
                text(
                    """
                    SELECT outcome_id FROM learning_outcomes
                    WHERE course_id = :course_id AND outcome_code = :outcome_code
                    FOR UPDATE
                    """
                ),
                {"course_id": course_id, "outcome_code": outcome_code},
            )
        ).first()
        if row:
            outcome_id = row.outcome_id
            await db.execute(
                text(
                    """
                    UPDATE learning_outcomes
                    SET description = :description, domain = 'COGNITIVE',
                        level = :level, version = 1
                    WHERE outcome_id = :outcome_id
                    """
                ),
                {
                    "outcome_id": outcome_id,
                    "description": OUTCOME_DESCRIPTIONS[chapter_number],
                    "level": "ANALYSE" if chapter_number in {1, 3} else "APPLY",
                },
            )
        else:
            outcome_id = await db.scalar(
                text(
                    """
                    INSERT INTO learning_outcomes (
                        course_id, outcome_code, description, domain, level, version
                    )
                    VALUES (
                        :course_id, :outcome_code, :description, 'COGNITIVE',
                        :level, 1
                    )
                    RETURNING outcome_id
                    """
                ),
                {
                    "course_id": course_id,
                    "outcome_code": outcome_code,
                    "description": OUTCOME_DESCRIPTIONS[chapter_number],
                    "level": "ANALYSE" if chapter_number in {1, 3} else "APPLY",
                },
            )
        outcome_ids[chapter_number] = outcome_id

    question_ids: dict[int, uuid.UUID] = {}
    for question in parsed["questions"]:
        question_id = stable_uuid("question", question["id"])
        question_ids[question["questionNumber"]] = question_id
        outcome_id = outcome_ids[question["chapterNumber"]]
        level = "ANALYSE" if question["bloomLevel"] == "ANALYZE" else question["bloomLevel"]
        option_explanations = {
            option["label"]: option["explanation"] for option in question["options"]
        }
        await db.execute(
            text(
                """
                INSERT INTO questions (
                    question_id, course_id, outcome_id, tenant_id, question_text,
                    type, level, difficulty, explanation, option_explanations,
                    version, is_published
                )
                VALUES (
                    :question_id, :course_id, :outcome_id, NULL, :question_text,
                    'MULTIPLE_CHOICE', :level, :difficulty, :explanation,
                    CAST(:option_explanations AS jsonb), 1, TRUE
                )
                ON CONFLICT (question_id) DO UPDATE SET
                    course_id = EXCLUDED.course_id,
                    outcome_id = EXCLUDED.outcome_id,
                    question_text = EXCLUDED.question_text,
                    type = EXCLUDED.type,
                    level = EXCLUDED.level,
                    difficulty = EXCLUDED.difficulty,
                    explanation = EXCLUDED.explanation,
                    option_explanations = EXCLUDED.option_explanations,
                    version = EXCLUDED.version,
                    is_published = TRUE
                """
            ),
            {
                "question_id": question_id,
                "course_id": course_id,
                "outcome_id": outcome_id,
                "question_text": f"[Q{question['questionNumber']}] {question['prompt']}",
                "level": level,
                "difficulty": question["difficulty"],
                "explanation": question["explanation"],
                "option_explanations": _encoded_json(option_explanations),
            },
        )
        for option in question["options"]:
            option_id = stable_uuid(
                "option", f"{question['id']}:{option['label']}"
            )
            await db.execute(
                text(
                    """
                    INSERT INTO question_options (
                        option_id, question_id, option_label, option_text, is_correct
                    )
                    VALUES (
                        :option_id, :question_id, :option_label, :option_text,
                        :is_correct
                    )
                    ON CONFLICT (option_id) DO UPDATE SET
                        question_id = EXCLUDED.question_id,
                        option_label = EXCLUDED.option_label,
                        option_text = EXCLUDED.option_text,
                        is_correct = EXCLUDED.is_correct
                    """
                ),
                {
                    "option_id": option_id,
                    "question_id": question_id,
                    "option_label": option["label"],
                    "option_text": option["text"],
                    "is_correct": option["isCorrect"],
                },
            )

    for blueprint in BLUEPRINTS:
        selected_questions = [
            question
            for question in parsed["questions"]
            if blueprint["chapter"] is None
            or question["chapterNumber"] == blueprint["chapter"]
        ]
        if len(selected_questions) != blueprint["question_count"]:
            raise ValueError(f"{blueprint['code']} selected an unexpected question count.")
        exam_id = stable_uuid("blueprint", blueprint["code"])
        await db.execute(
            text(
                """
                INSERT INTO exam_blueprints (
                    exam_id, course_id, tenant_id, title, type, total_questions,
                    duration_seconds, is_offline_eligible,
                    reveal_answers_immediately, version, rules_json
                )
                VALUES (
                    :exam_id, :course_id, NULL, :title, :type, :total_questions,
                    :duration_seconds, TRUE, TRUE, 1, CAST(:rules_json AS jsonb)
                )
                ON CONFLICT (exam_id) DO UPDATE SET
                    course_id = EXCLUDED.course_id,
                    title = EXCLUDED.title,
                    type = EXCLUDED.type,
                    total_questions = EXCLUDED.total_questions,
                    duration_seconds = EXCLUDED.duration_seconds,
                    is_offline_eligible = TRUE,
                    reveal_answers_immediately = TRUE,
                    version = 1,
                    rules_json = EXCLUDED.rules_json
                """
            ),
            {
                "exam_id": exam_id,
                "course_id": course_id,
                "title": blueprint["title"],
                "type": blueprint["type"],
                "total_questions": blueprint["question_count"],
                "duration_seconds": blueprint["duration_seconds"],
                "rules_json": _encoded_json(
                    {
                        "blueprint_code": blueprint["code"],
                        "source_course_code": SOURCE_COURSE_CODE,
                        "question_ids": [
                            str(question_ids[item["questionNumber"]])
                            for item in selected_questions
                        ],
                    }
                ),
            },
        )

    resource_count = 0
    for resource_id, markdown in markdown_files.items():
        chapter_number = next(
            (
                number
                for number, chapter in CHAPTER_METADATA.items()
                if chapter["resource_id"] == resource_id
            ),
            None,
        )
        note_codes = [
            note["code"]
            for note in parsed["cheatNotes"]
            if chapter_number is None or note["chapterNumber"] == chapter_number
        ]
        content = markdown.encode("utf-8")
        object_key = f"itec4133/{resource_id}.md"
        checksum = hashlib.sha256(content).hexdigest()
        if upload_resources:
            storage_adapter.upload_markdown_resource(
                "course-packages", object_key, content
            )
        title = (
            f"Ch {chapter_number}: {CHAPTER_METADATA[chapter_number]['title']} Notes"
            if chapter_number is not None
            else "IT-SEC-401 Master Cheat Sheet (80 Key Notes)"
        )
        await db.execute(
            text(
                """
                INSERT INTO course_resources (
                    resource_id, course_id, tenant_id, type, title, storage_bucket,
                    storage_object_key, file_size_bytes, sha256_checksum,
                    is_offline_eligible, version, metadata, published_at
                )
                VALUES (
                    :resource_id, :course_id, NULL, 'LECTURE_NOTE', :title,
                    'course-packages', :object_key, :file_size, :checksum,
                    FALSE, 1, CAST(:metadata AS jsonb), NOW()
                )
                ON CONFLICT (resource_id) DO UPDATE SET
                    course_id = EXCLUDED.course_id,
                    title = EXCLUDED.title,
                    storage_bucket = EXCLUDED.storage_bucket,
                    storage_object_key = EXCLUDED.storage_object_key,
                    file_size_bytes = EXCLUDED.file_size_bytes,
                    sha256_checksum = EXCLUDED.sha256_checksum,
                    is_offline_eligible = FALSE,
                    version = 1,
                    metadata = EXCLUDED.metadata,
                    published_at = EXCLUDED.published_at
                """
            ),
            {
                "resource_id": stable_uuid("resource", resource_id),
                "course_id": course_id,
                "title": title,
                "object_key": object_key,
                "file_size": len(content),
                "checksum": checksum,
                "metadata": _encoded_json(
                    {
                        "course_code": COURSE_CODE,
                        "source_course_code": SOURCE_COURSE_CODE,
                        "chapter_number": chapter_number,
                        "content_format": "text/markdown",
                        "note_codes": note_codes,
                    }
                ),
            },
        )
        resource_count += 1

    return {
        "outcomes": len(outcome_ids),
        "questions": len(question_ids),
        "options": sum(len(question["options"]) for question in parsed["questions"]),
        "blueprints": len(BLUEPRINTS),
        "resources": resource_count,
    }


async def main(upload_resources: bool = True) -> None:
    parsed = parse_hu_question_bank(str(SOURCE_PATH))
    validate_question_bank(parsed)
    markdown_files = generate_study_notes_markdown(parsed)
    async with AsyncSessionLocal() as db:
        async with db.begin():
            summary = await seed_question_bank(
                db,
                parsed,
                markdown_files,
                upload_resources=upload_resources,
            )
    print(
        "Seeded IT-SEC-401: "
        + ", ".join(f"{key}={value}" for key, value in summary.items())
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skip-storage",
        action="store_true",
        help="Seed database metadata without uploading Markdown objects.",
    )
    arguments = parser.parse_args()
    asyncio.run(main(upload_resources=not arguments.skip_storage))
