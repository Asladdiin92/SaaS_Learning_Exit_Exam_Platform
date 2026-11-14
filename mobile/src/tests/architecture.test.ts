import { lightColors, darkColors, spacing } from '../shared/theme/tokens';
import { typography } from '../shared/theme/typography';
import { CREATE_13_TABLES_SCHEMA } from '../shared/database/schema';

describe('Mobile Architecture & Design System Invariants', () => {
  test('Touch target minimum conforms to 48dp NFR rule', () => {
    expect(spacing.minTouchTarget).toBe(48);
  });

  test('WCAG semantic color tokens are defined for Light and Dark modes', () => {
    expect(lightColors.surface.primary).toBe('#F8FAFC');
    expect(lightColors.surface.card).toBe('#FFFFFF');
    expect(lightColors.brand.primary).toBe('#1D4ED8');
    expect(lightColors.status.online).toBe('#15803D');
    expect(lightColors.status.offline).toBe('#B45309');

    expect(darkColors.surface.primary).toBe('#0F172A');
    expect(darkColors.surface.card).toBe('#1E293B');
    expect(darkColors.brand.primary).toBe('#3B82F6');
    expect(darkColors.status.online).toBe('#22C55E');
    expect(darkColors.status.offline).toBe('#F59E0B');
  });

  test('Typography scale matches specification', () => {
    expect(typography.h1.fontSize).toBe(22);
    expect(typography.h1.lineHeight).toBe(28);
    expect(typography.h2.fontSize).toBe(18);
    expect(typography.h2.lineHeight).toBe(24);
    expect(typography.h3.fontSize).toBe(16);
    expect(typography.labelSm.fontSize).toBe(12);
  });

  test('Local SQLite/SQLCipher schema contains all 13 required offline tables', () => {
    const requiredTables = [
      'local_themes',
      'local_courses',
      'local_outcomes',
      'local_resources',
      'download_packages',
      'local_exam_packages',
      'local_exam_attempts',
      'local_answer_events',
      'sync_operations',
      'sync_state',
      'local_bookmarks',
      'local_progress_cache',
      'device_profile',
    ];

    for (const table of requiredTables) {
      expect(CREATE_13_TABLES_SCHEMA).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  test('Sub-16ms indexes exist on critical offline tables', () => {
    expect(CREATE_13_TABLES_SCHEMA).toContain('idx_local_courses_theme');
    expect(CREATE_13_TABLES_SCHEMA).toContain('idx_local_outcomes_course');
    expect(CREATE_13_TABLES_SCHEMA).toContain('idx_local_answer_events_attempt');
    expect(CREATE_13_TABLES_SCHEMA).toContain('idx_sync_operations_state');
  });
});
