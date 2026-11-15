#!/usr/bin/env python3
"""
scripts/parse_hu_question_bank.py
=============================================================================
Dual-format Question Bank Parser & Seeder for ITec4133 / IT-SEC-401
Information Assurance and Security.

Ingests structured question bank files (Markdown / pseudo-JSON text) and
generates canonical JSON, chapter study notes with anchor tags, and exam
blueprints for both backend PostgreSQL and mobile SQLite databases.
=============================================================================
"""

import argparse
import json
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List

# Canonical Chapter Metadata
CHAPTER_METADATA = {
    1: {
        "chapter_number": 1,
        "title": "Introduction to Information Security & Security Architecture",
        "question_range": (1, 20),
        "outcome_id": "OUTCOME-ITSEC-CH1",
        "resource_id": "res_itsec_ch1_notes",
    },
    2: {
        "chapter_number": 2,
        "title": "Classical Encryption Techniques & Symmetric Ciphers",
        "question_range": (21, 40),
        "outcome_id": "OUTCOME-ITSEC-CH2",
        "resource_id": "res_itsec_ch2_notes",
    },
    3: {
        "chapter_number": 3,
        "title": "Modern Block Ciphers & Data Encryption Standard (DES)",
        "question_range": (41, 60),
        "outcome_id": "OUTCOME-ITSEC-CH3",
        "resource_id": "res_itsec_ch3_notes",
    },
    4: {
        "chapter_number": 4,
        "title": "Basic Concepts in Number Theory, Finite Fields & Public-Key Cryptography (RSA, Diffie-Hellman)",
        "question_range": (61, 80),
        "outcome_id": "OUTCOME-ITSEC-CH4",
        "resource_id": "res_itsec_ch4_notes",
    },
}

# Normalization dictionary to match the authoritative Summary Matrix (28 EASY, 36 MEDIUM, 16 HARD)
DIFFICULTY_NORMALIZATION = {
    2: "MEDIUM",
    9: "MEDIUM",
    14: "MEDIUM",
    15: "HARD",
    33: "HARD",
    43: "MEDIUM",
    63: "HARD",
}

def parse_hu_question_bank(file_path: str) -> Dict[str, Any]:
    """Parse raw question bank text into structured canonical dictionary."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Question bank file not found: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    if content.lstrip().startswith("{"):
        source_document = json.loads(content)
        if (
            isinstance(source_document, dict)
            and isinstance(source_document.get("metadata"), dict)
            and isinstance(source_document.get("questions"), list)
            and isinstance(source_document.get("cheatNotes"), list)
        ):
            return source_document
        if not isinstance(source_document, dict) or not isinstance(
            source_document.get("content"), str
        ):
            raise ValueError(
                "JSON question-bank sources must contain a Markdown 'content' string."
            )
        content = source_document["content"]

    # Match individual question blocks
    question_regex = re.compile(
        r"(?:^|\n)(?:##\s*)?Question\s+(\d+)\s*\n(.*?)(?=\n(?:##\s*)?Question\s+\d+|\n(?:#\s*)?Question Classification Summary Matrix|$)",
        re.DOTALL,
    )
    matches = list(question_regex.finditer(content))

    parsed_questions: List[Dict[str, Any]] = []
    all_cheat_notes: List[Dict[str, Any]] = []

    for match in matches:
        qnum = int(match.group(1))
        qtext = match.group(2)

        # 1. Basic Metadata
        id_m = re.search(r"(?:-\s*\*\*)?ID(?:\*\*)?:\s*([A-Za-z0-9_-]+)", qtext)
        course_m = re.search(r"(?:-\s*\*\*)?Course Code(?:\*\*)?:\s*([A-Za-z0-9_-]+)", qtext)
        bloom_m = re.search(r"(?:-\s*\*\*)?Bloom Level(?:\*\*)?:\s*([A-Za-z]+)", qtext)
        diff_m = re.search(r"(?:-\s*\*\*)?Difficulty(?:\*\*)?:\s*([A-Za-z]+)", qtext)
        note_m = re.search(r"(?:-\s*\*\*)?Linked Note Code(?:\*\*)?:\s*(NOTE-[A-Za-z0-9_-]+)", qtext)
        prompt_m = re.search(r"(?:-\s*\*\*)?Question Text(?:\*\*)?:\s*(.*?)(?=\n(?:-\s*\*\*)?Options:)", qtext, re.DOTALL)

        raw_id = id_m.group(1) if id_m else f"Q-{qnum}"
        course_code = course_m.group(1) if course_m else "IT-SEC-401"
        bloom_level = bloom_m.group(1).upper() if bloom_m else "UNDERSTAND"
        raw_diff = diff_m.group(1).upper() if diff_m else "MEDIUM"
        linked_note_code = note_m.group(1) if note_m else f"NOTE-CH1-{qnum:03d}"
        question_prompt = prompt_m.group(1).strip() if prompt_m else ""

        # Normalize difficulty to align with Chapter Matrix
        difficulty = DIFFICULTY_NORMALIZATION.get(qnum, raw_diff)

        # A note code is the most specific source of chapter identity; heading
        # context handles nonstandard numbering such as Q30's Q-CH3-030 typo.
        prior_content = content[: match.start()]
        chapter_heading = list(
            re.finditer(
                r"^\s*#{0,2}\s*Chapter\s+([1-4])\s*:\s*.+$",
                prior_content,
                re.IGNORECASE | re.MULTILINE,
            )
        )
        note_chapter = re.search(r"NOTE-CH([1-4])-", linked_note_code, re.IGNORECASE)
        if note_chapter:
            chapter_num = int(note_chapter.group(1))
        elif chapter_heading:
            chapter_num = int(chapter_heading[-1].group(1))
        elif 1 <= qnum <= 20:
            chapter_num = 1
        elif 21 <= qnum <= 40:
            chapter_num = 2
        elif 41 <= qnum <= 60:
            chapter_num = 3
        elif 61 <= qnum <= 80:
            chapter_num = 4
        else:
            raise ValueError(f"Question {qnum} has no resolvable chapter.")

        chapter_info = CHAPTER_METADATA[chapter_num]

        # 3. Parse Options
        options_match = re.search(
            r"(?:-\s*\*\*)?Options:(?:\*\*)?\s*\n(.*?)(?=\n(?:-\s*\*\*)?Step-by-Step Explanation:)",
            qtext,
            re.DOTALL,
        )
        raw_options = options_match.group(1).strip() if options_match else ""

        # 4. Parse Step-by-Step Explanation & Distractors
        expl_match = re.search(
            r"(?:-\s*\*\*)?Step-by-Step Explanation:(?:\*\*)?\s*\n(.*?)(?=\n(?:-\s*\*\*)?Cheat Sheet Note|\Z)",
            qtext,
            re.DOTALL,
        )
        full_explanation = expl_match.group(1).strip() if expl_match else ""

        distractors: Dict[str, str] = {}
        for d_match in re.finditer(
            r"(?:-\s*\*\*)?Why\s+([A-D])\s+is\s+(correct|incorrect)(?:\*\*)?:\s*(.*?)(?=\n(?:-\s*\*\*)?Why\s+[A-D]\s+is|\Z)",
            full_explanation,
            re.DOTALL,
        ):
            lbl = d_match.group(1)
            reason = d_match.group(3).strip()
            # Handle Q31 typo where second Why C explains option D
            if lbl in distractors and lbl == "C" and "D" not in distractors:
                distractors["D"] = reason
            else:
                distractors[lbl] = reason

        parsed_options = []
        correct_option_id = "A"

        for opt_line in raw_options.split("\n"):
            opt_line = opt_line.strip().lstrip("-* ").strip()
            opt_m = re.match(r"^([A-D])[\.:]\s*(.*?)$", opt_line)
            if opt_m:
                label = opt_m.group(1)
                opt_text = opt_m.group(2).strip()
                is_correct = bool(re.search(r"\(Correct\)|\*\(Correct\)\*", opt_text, re.IGNORECASE))
                cleaned_text = re.sub(r"\s*\(Correct\)|\s*\*\(Correct\)\*", "", opt_text, flags=re.IGNORECASE).strip()

                if is_correct:
                    correct_option_id = label

                if label in distractors and not distractors[label]:
                    raise ValueError(f"Question {qnum} has an empty explanation for option {label}.")
                parsed_options.append({
                    "id": f"q{qnum:03d}_{label.lower()}",
                    "label": label,
                    "text": cleaned_text,
                    "isCorrect": is_correct,
                    "explanation": distractors.get(label, ""),
                })

        labels = [option["label"] for option in parsed_options]
        if labels != ["A", "B", "C", "D"]:
            raise ValueError(
                f"Question {qnum} must define options A-D exactly once; found {labels}."
            )
        if sum(option["isCorrect"] for option in parsed_options) != 1:
            raise ValueError(f"Question {qnum} must have exactly one correct option.")
        missing_explanations = [
            option["label"] for option in parsed_options if not option["explanation"]
        ]
        if missing_explanations:
            raise ValueError(
                f"Question {qnum} is missing option explanations: "
                f"{', '.join(missing_explanations)}."
            )

        # 5. Parse Cheat Sheet Note
        note_match = re.search(
            r"(?:-\s*\*\*)?Cheat Sheet Note\s*\((NOTE-[A-Za-z0-9_-]+)\)(?:\*\*)?:\s*(.*?)(?=\n\n|\Z)",
            qtext,
            re.DOTALL,
        )
        if note_match:
            note_code = note_match.group(1)
            note_content = note_match.group(2).strip()
        else:
            note_code = linked_note_code
            note_content = "Core Information Assurance competency reference."

        cheat_note_item = {
            "code": note_code,
            "anchor": note_code,
            "questionNumber": qnum,
            "chapterNumber": chapter_num,
            "note": note_content,
        }
        all_cheat_notes.append(cheat_note_item)

        parsed_questions.append({
            "questionNumber": qnum,
            "id": raw_id,
            "courseCode": course_code,
            "chapterNumber": chapter_num,
            "chapterTitle": chapter_info["title"],
            "outcomeId": chapter_info["outcome_id"],
            "bloomLevel": bloom_level,
            "difficulty": difficulty,
            "linkedNoteCode": linked_note_code,
            "prompt": question_prompt,
            "options": parsed_options,
            "correctOptionId": f"q{qnum:03d}_{correct_option_id.lower()}",
            "correctLabel": correct_option_id,
            "explanation": full_explanation,
            "cheatSheetNote": note_content,
            "recommendedResourceId": chapter_info["resource_id"],
        })

    # Summary Statistics
    diff_counts = Counter(q["difficulty"] for q in parsed_questions)

    result = {
        "metadata": {
            "title": "ITec4133 / IT-SEC-401 Information Assurance and Security Comprehensive Question Bank",
            "courseCode": "IT-SEC-401",
            "courseTitle": "Information Assurance and Security",
            "totalQuestions": len(parsed_questions),
            "difficultyCounts": {
                "EASY": diff_counts["EASY"],
                "MEDIUM": diff_counts["MEDIUM"],
                "HARD": diff_counts["HARD"],
            },
            "chapters": list(CHAPTER_METADATA.values()),
        },
        "questions": parsed_questions,
        "cheatNotes": all_cheat_notes,
    }

    return result


def validate_question_bank(parsed_data: Dict[str, Any]) -> None:
    """Validate the source bank's required question, difficulty, and note coverage."""
    metadata = parsed_data["metadata"]
    expected_difficulties = {"EASY": 28, "MEDIUM": 36, "HARD": 16}
    if metadata["totalQuestions"] != 80:
        raise ValueError(f"Expected 80 questions, got {metadata['totalQuestions']}.")
    if metadata["difficultyCounts"] != expected_difficulties:
        raise ValueError(
            "Unexpected difficulty distribution: "
            f"{metadata['difficultyCounts']} (expected {expected_difficulties})."
        )
    if len(parsed_data["cheatNotes"]) != 80:
        raise ValueError(f"Expected 80 linked notes, got {len(parsed_data['cheatNotes'])}.")

    question_numbers = [question["questionNumber"] for question in parsed_data["questions"]]
    note_codes = [note["code"] for note in parsed_data["cheatNotes"]]
    if question_numbers != list(range(1, 81)):
        raise ValueError("Questions must be present once each in canonical order Q1-Q80.")
    if len(note_codes) != len(set(note_codes)):
        raise ValueError("Linked cheat-sheet note codes must be unique.")
    if note_codes != [
        f"NOTE-CH{chapter}-{number:03d}"
        for chapter in range(1, 5)
        for number in range((chapter - 1) * 20 + 1, chapter * 20 + 1)
    ]:
        raise ValueError("Linked note codes must span NOTE-CH1-001 through NOTE-CH4-080.")

def generate_study_notes_markdown(parsed_data: Dict[str, Any]) -> Dict[str, str]:
    """Generate Markdown text with HTML anchor tags for Chapter study notes."""
    notes_by_chapter: Dict[int, List[Dict[str, Any]]] = {1: [], 2: [], 3: [], 4: []}
    for n in parsed_data["cheatNotes"]:
        notes_by_chapter[n["chapterNumber"]].append(n)

    markdown_files = {}

    for ch_num, meta in CHAPTER_METADATA.items():
        lines = [
            "# " + meta["title"],
            "**Course Code:** IT-SEC-401 (ITec4133) | **Learning Outcome:** `" + meta["outcome_id"] + "`",
            "",
            "## Chapter Learning Focus & Cheat Sheet Notes",
            "",
        ]
        for item in notes_by_chapter[ch_num]:
            anc = item["anchor"]
            lines.append('<a id="' + anc + '"></a>')
            lines.append("### " + item["code"] + " (Question " + str(item["questionNumber"]) + ")")
            lines.append(item["note"])
            lines.append("")

        markdown_files[meta["resource_id"]] = "\n".join(lines)

    # Master Cheat Sheet (All 80 Notes)
    master_lines = [
        "# IT-SEC-401 Information Assurance and Security — Master Cheat Sheet",
        "Comprehensive 80-Note Key Knowledge Synthesis across Chapters 1 through 4.",
        "",
    ]
    for ch_num, meta in CHAPTER_METADATA.items():
        master_lines.append("## Chapter " + str(ch_num) + ": " + meta["title"])
        master_lines.append("")
        for item in notes_by_chapter[ch_num]:
            anc = item["anchor"]
            master_lines.append('<a id="' + anc + '"></a>')
            master_lines.append("**" + item["code"] + "**: " + item["note"])
            master_lines.append("")

    markdown_files["res_itsec_master_cheatsheet"] = "\n".join(master_lines)
    return markdown_files

def main():
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "input_file",
        nargs="?",
        default=str(
            project_root
            / "data/exam_packs/itec4133_information_assurance_parsed.json"
        ),
    )
    parser.add_argument(
        "--output-dir",
        default=str(project_root / "data/exam_packs"),
    )
    args = parser.parse_args()
    input_file = args.input_file
    output_dir = args.output_dir
    os.makedirs(output_dir, exist_ok=True)
    canonical_output = os.path.join(output_dir, "itec4133_information_assurance_parsed.json")

    print(f"[Parser] Reading {input_file}...")
    parsed = parse_hu_question_bank(input_file)
    validate_question_bank(parsed)

    meta = parsed["metadata"]
    print(f"[Parser] Success: Parsed {meta['totalQuestions']} questions.")
    print(f"[Parser] Difficulty Breakdown: EASY={meta['difficultyCounts']['EASY']}, MEDIUM={meta['difficultyCounts']['MEDIUM']}, HARD={meta['difficultyCounts']['HARD']}")
    print(f"[Parser] Cheat Sheet Notes: {len(parsed['cheatNotes'])} notes.")

    # Write Canonical JSON
    canonical_json = json.dumps(parsed, indent=2, ensure_ascii=False) + "\n"
    with open(canonical_output, "w", encoding="utf-8") as f:
        f.write(canonical_json)
    print(f"[Parser] Exported canonical JSON to {canonical_output}")

    mobile_output = (
        project_root / "mobile/src/shared/database/itec4133_parsed.json"
    )
    mobile_output.write_text(canonical_json, encoding="utf-8")
    print(f"[Parser] Synchronized mobile question-bank asset to {mobile_output}")

    # Generate Markdown Study Notes
    study_notes = generate_study_notes_markdown(parsed)
    for res_id, md_text in study_notes.items():
        md_path = os.path.join(output_dir, f"{res_id}.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_text.rstrip() + "\n")
        print(f"[Parser] Generated study notes: {md_path}")

    print("[Parser] All validation assertions passed!")

if __name__ == "__main__":
    main()
