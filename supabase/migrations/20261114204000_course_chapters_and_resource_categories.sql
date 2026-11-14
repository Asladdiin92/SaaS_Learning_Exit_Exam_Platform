CREATE TABLE IF NOT EXISTS course_chapters (
    chapter_id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    chapter_number INT NOT NULL CHECK (chapter_number > 0),
    title VARCHAR(255) NOT NULL,
    academic_year_label VARCHAR(32) NOT NULL,
    semester SMALLINT NOT NULL CHECK (semester IN (1, 2)),
    description TEXT,
    version INT NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_course_chapters_number UNIQUE (course_id, chapter_number),
    CONSTRAINT uq_course_chapters_id_course UNIQUE (chapter_id, course_id),
    CONSTRAINT ck_course_chapters_academic_year_not_blank
        CHECK (length(trim(academic_year_label)) > 0)
);

CREATE TABLE IF NOT EXISTS resource_categories (
    category_id SERIAL PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_resource_categories_slug_not_blank
        CHECK (length(trim(slug)) > 0),
    CONSTRAINT ck_resource_categories_name_not_blank
        CHECK (length(trim(name)) > 0)
);

ALTER TABLE course_resources
    ADD COLUMN IF NOT EXISTS chapter_id INT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_course_resources_chapter_course'
          AND conrelid = 'course_resources'::regclass
    ) THEN
        ALTER TABLE course_resources
            ADD CONSTRAINT fk_course_resources_chapter_course
            FOREIGN KEY (chapter_id, course_id)
            REFERENCES course_chapters (chapter_id, course_id)
            ON DELETE SET NULL (chapter_id);
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS course_resource_categories (
    resource_id UUID NOT NULL REFERENCES course_resources(resource_id) ON DELETE CASCADE,
    category_id INT NOT NULL REFERENCES resource_categories(category_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (resource_id, category_id)
);

ALTER TABLE course_resource_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_course_resource_categories_visible_resources
    ON course_resource_categories;
CREATE POLICY rls_course_resource_categories_visible_resources
    ON course_resource_categories
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM course_resources resource
            WHERE resource.resource_id = course_resource_categories.resource_id
        )
    );

CREATE INDEX IF NOT EXISTS idx_course_chapters_course_term
    ON course_chapters (course_id, academic_year_label, semester, chapter_number);
CREATE INDEX IF NOT EXISTS idx_course_resources_chapter
    ON course_resources (chapter_id)
    WHERE chapter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_course_resource_categories_category
    ON course_resource_categories (category_id, resource_id);

GRANT SELECT ON TABLE
    course_chapters,
    resource_categories,
    course_resource_categories
TO authenticated;
