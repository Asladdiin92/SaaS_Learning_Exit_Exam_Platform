export const CREATE_13_TABLES_SCHEMA = `
-- 1. local_themes
CREATE TABLE IF NOT EXISTS local_themes (
  theme_id INTEGER PRIMARY KEY,
  theme_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  total_credit_hours INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_sequence INTEGER NOT NULL DEFAULT 0
);

-- 2. local_courses
CREATE TABLE IF NOT EXISTS local_courses (
  course_id INTEGER PRIMARY KEY,
  theme_id INTEGER NOT NULL REFERENCES local_themes(theme_id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  credit_hours INTEGER NOT NULL,
  general_objective TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_sequence INTEGER NOT NULL DEFAULT 0
);

-- 3. local_outcomes
CREATE TABLE IF NOT EXISTS local_outcomes (
  outcome_id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES local_courses(course_id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'COGNITIVE',
  level TEXT NOT NULL DEFAULT 'REMEMBER',
  version INTEGER NOT NULL DEFAULT 1
);

-- 4. local_resources
CREATE TABLE IF NOT EXISTS local_resources (
  resource_id TEXT PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES local_courses(course_id) ON DELETE CASCADE,
  tenant_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  package_id TEXT,
  access_state TEXT NOT NULL DEFAULT 'AVAILABLE',
  version INTEGER NOT NULL DEFAULT 1
);

-- 5. download_packages
CREATE TABLE IF NOT EXISTS download_packages (
  package_id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  encrypted_path TEXT NOT NULL,
  sha256_checksum TEXT,
  size_bytes INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING',
  grant_id TEXT,
  license_expiry TEXT,
  last_opened_at TEXT,
  last_error TEXT
);

-- 6. local_exam_packages
CREATE TABLE IF NOT EXISTS local_exam_packages (
  exam_package_id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  course_id INTEGER,
  blueprint_version INTEGER NOT NULL DEFAULT 1,
  question_snapshot_json TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  grant_id TEXT,
  license_expiry TEXT,
  state TEXT NOT NULL DEFAULT 'READY'
);

-- 7. local_exam_attempts
CREATE TABLE IF NOT EXISTS local_exam_attempts (
  local_attempt_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT,
  exam_package_id TEXT NOT NULL REFERENCES local_exam_packages(exam_package_id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  started_at TEXT NOT NULL,
  elapsed_monotonic_sec INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT,
  server_attempt_id TEXT
);

-- 8. local_answer_events (Transactional <16ms writes)
CREATE TABLE IF NOT EXISTS local_answer_events (
  event_id TEXT PRIMARY KEY,
  local_attempt_id TEXT NOT NULL REFERENCES local_exam_attempts(local_attempt_id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  selected_option_id TEXT,
  text_or_code_answer TEXT,
  is_flagged INTEGER NOT NULL DEFAULT 0,
  sequence_no INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 9. sync_operations (Durable outbox)
CREATE TABLE IF NOT EXISTS sync_operations (
  operation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'QUEUED',
  retry_count INTEGER NOT NULL DEFAULT 0,
  reason_code TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL
);

-- 10. sync_state (Opaque monotonic cursor)
CREATE TABLE IF NOT EXISTS sync_state (
  scope_key TEXT PRIMARY KEY,
  opaque_cursor TEXT,
  last_pull_at TEXT,
  last_push_at TEXT
);

-- 11. local_bookmarks
CREATE TABLE IF NOT EXISTS local_bookmarks (
  bookmark_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  page_or_position TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- 12. local_progress_cache
CREATE TABLE IF NOT EXISTS local_progress_cache (
  cache_key TEXT PRIMARY KEY,
  mastery_json TEXT NOT NULL,
  mastery_score REAL DEFAULT 0,
  last_calculated_at TEXT NOT NULL,
  pending_local_attempts_count INTEGER NOT NULL DEFAULT 0
);

-- 13. device_profile
CREATE TABLE IF NOT EXISTS device_profile (
  device_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  os_version TEXT,
  app_version TEXT,
  biometric_enabled INTEGER NOT NULL DEFAULT 0,
  storage_quota_mb INTEGER NOT NULL DEFAULT 2048,
  wifi_only_downloads INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT NOT NULL
);

-- Fast Composite Indexes for Sub-16ms Query Latency
CREATE INDEX IF NOT EXISTS idx_local_courses_theme ON local_courses(theme_id);
CREATE INDEX IF NOT EXISTS idx_local_outcomes_course ON local_outcomes(course_id);
CREATE INDEX IF NOT EXISTS idx_local_resources_course ON local_resources(course_id);
CREATE INDEX IF NOT EXISTS idx_local_answer_events_attempt ON local_answer_events(local_attempt_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_sync_operations_state ON sync_operations(state, created_at);
CREATE INDEX IF NOT EXISTS idx_download_packages_state ON download_packages(state);
CREATE INDEX IF NOT EXISTS idx_local_exam_attempts_user_status ON local_exam_attempts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_local_bookmarks_user ON local_bookmarks(user_id, resource_id);
`;
