import fs from 'fs';
import path from 'path';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest
    .fn()
    .mockRejectedValue(new Error('Native SQLite disabled in Node test environment')),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'itec4133-test-uuid'),
}));

import { database } from '../shared/database/db';
import {
  generateStudyNotesMarkdown,
  getQuestionsForBlueprint,
  ITEC4133_BLUEPRINTS,
  parseHuQuestionBankText,
  seedItec4133ToDatabase,
} from '../shared/database/parseHuQuestionBank';

const rawSourcePath = path.resolve(
  __dirname,
  '../../../data/exam_packs/hu_question_ITec4133_Information_Assurance_and_Security.json'
);
const canonicalPath = path.resolve(
  __dirname,
  '../../../data/exam_packs/itec4133_information_assurance_parsed.json'
);

describe('ITec4133 question bank integration', () => {
  test('loads the complete canonical bank and parses the structured Markdown source', () => {
    const rawSource = fs.readFileSync(rawSourcePath, 'utf8');
    const source = fs.readFileSync(canonicalPath, 'utf8');
    expect(parseHuQuestionBankText(rawSource).questions).toHaveLength(1);
    const first = parseHuQuestionBankText(source);
    const second = parseHuQuestionBankText(source);

    expect(first).toEqual(second);
    expect(first.metadata.totalQuestions).toBe(80);
    expect(first.metadata.difficultyCounts).toEqual({
      EASY: 28,
      MEDIUM: 36,
      HARD: 16,
    });
    expect(first.cheatNotes).toHaveLength(80);
    expect(first.cheatNotes[0].code).toBe('NOTE-CH1-001');
    expect(first.cheatNotes[79].code).toBe('NOTE-CH4-080');

    const question30 = first.questions.find((question) => question.questionNumber === 30);
    expect(question30?.id).toBe('Q-CH3-030');
    expect(question30?.chapterNumber).toBe(2);
    expect(question30?.linkedNoteCode).toBe('NOTE-CH2-030');

    for (const question of first.questions) {
      expect(question.options.map((option) => option.label)).toEqual(['A', 'B', 'C', 'D']);
      expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1);
      for (const option of question.options) {
        expect(option.explanation.length).toBeGreaterThan(0);
      }
    }

    const notes = generateStudyNotesMarkdown(first);
    expect(notes).toHaveLength(5);
    expect(notes.find((resource) => resource.id === 'res_itsec_ch2_notes')?.markdown)
      .toContain('<a id="NOTE-CH2-030"></a>');
    expect(notes.find((resource) => resource.id === 'res_itsec_master_cheatsheet')?.markdown)
      .toContain('<a id="NOTE-CH4-080"></a>');
  });

  test('provides all five required package blueprints and correct chapter question sets', () => {
    expect(ITEC4133_BLUEPRINTS.map((blueprint) => blueprint.id)).toEqual([
      'ITEC4133-FULL-80',
      'ITEC4133-CH1-20',
      'ITEC4133-CH2-20',
      'ITEC4133-CH3-20',
      'ITEC4133-CH4-20',
    ]);
    expect(ITEC4133_BLUEPRINTS.map((blueprint) => blueprint.title)).toContain(
      'ITec4133 Information Assurance & Security — Comprehensive Exam (80 Qs, 120 mins)'
    );
    for (let chapter = 1; chapter <= 4; chapter += 1) {
      expect(getQuestionsForBlueprint(`ITEC4133-CH${chapter}-20`)).toHaveLength(20);
      expect(
        getQuestionsForBlueprint(`ITEC4133-CH${chapter}-20`).every(
          (question) => question.chapterNumber === chapter
        )
      ).toBe(true);
    }
  });

  test('seeds local resources and package snapshots idempotently with full explanations', async () => {
    if (database.reset) await database.reset();
    await database.init();

    await seedItec4133ToDatabase();
    await seedItec4133ToDatabase();

    const [courses] = await database.query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM local_courses WHERE code = 'IT-IASC-401';"
    );
    const [outcomes] = await database.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM local_outcomes WHERE outcome_id IN (40201, 40202, 40203, 40204);'
    );
    const [resources] = await database.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM local_resources;'
    );
    const [packages] = await database.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM local_exam_packages;'
    );
    expect(courses.count).toBe(1);
    expect(outcomes.count).toBe(4);
    expect(resources.count).toBe(5);
    expect(packages.count).toBe(5);

    const chapterTwoResource = await database.query<{
      content_markdown: string;
    }>(
      `SELECT content_markdown FROM local_resources
       WHERE resource_id = ? LIMIT 1;`,
      ['res_itsec_ch2_notes']
    );
    expect(chapterTwoResource[0].content_markdown).toContain(
      '<a id="NOTE-CH2-030"></a>'
    );

    const fullPackage = await database.query<{
      question_snapshot_json: string;
    }>(
      `SELECT question_snapshot_json FROM local_exam_packages
       WHERE exam_package_id = ? LIMIT 1;`,
      ['ITEC4133-FULL-80']
    );
    const snapshot = JSON.parse(fullPackage[0].question_snapshot_json);
    expect(snapshot.questions).toHaveLength(80);
    expect(snapshot.questions[0].explanation).toBeTruthy();
    expect(snapshot.questions[0].options[0].explanation).toBeTruthy();
    expect(snapshot.questions[0].linkedNoteCode).toBe('NOTE-CH1-001');
  });
});
