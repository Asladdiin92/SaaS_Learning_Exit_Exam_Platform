-- Day 15: durable sync results, bookmark/support persistence, and change feed triggers.
ALTER TABLE sync_operations_log
    ADD COLUMN IF NOT EXISTS result_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS sync_bookmarks (
    bookmark_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    bookmark_key VARCHAR(255) NOT NULL,
    fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    field_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE NULLS NOT DISTINCT (user_id, tenant_id, bookmark_key)
);

CREATE TABLE IF NOT EXISTS support_cases (
    support_case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE sync_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_bookmarks FORCE ROW LEVEL SECURITY;
ALTER TABLE support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_cases FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_sync_bookmarks_owner ON sync_bookmarks;
CREATE POLICY rls_sync_bookmarks_owner ON sync_bookmarks
    FOR ALL
    USING (
        user_id = public.current_app_user_id()
        AND (tenant_id IS NULL OR tenant_id = public.current_app_tenant_id())
    )
    WITH CHECK (
        user_id = public.current_app_user_id()
        AND (tenant_id IS NULL OR tenant_id = public.current_app_tenant_id())
    );

DROP POLICY IF EXISTS rls_support_cases_owner ON support_cases;
CREATE POLICY rls_support_cases_owner ON support_cases
    FOR ALL
    USING (
        user_id = public.current_app_user_id()
        AND (tenant_id IS NULL OR tenant_id = public.current_app_tenant_id())
    )
    WITH CHECK (
        user_id = public.current_app_user_id()
        AND (tenant_id IS NULL OR tenant_id = public.current_app_tenant_id())
    );

ALTER TABLE sync_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_sync_changes_visible_scope ON sync_changes;
CREATE POLICY rls_sync_changes_visible_scope ON sync_changes
    FOR SELECT
    USING (
        (tenant_id IS NULL OR tenant_id = public.current_app_tenant_id())
        AND (user_id IS NULL OR user_id = public.current_app_user_id())
    );

CREATE OR REPLACE FUNCTION public.record_sync_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_row JSONB;
    v_entity_id TEXT;
    v_tenant_id UUID;
    v_user_id UUID;
    v_entity_type TEXT := TG_ARGV[0];
    v_operation TEXT := 'UPSERT';
    v_version INT := 1;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_row := to_jsonb(OLD);
        v_operation := 'TOMBSTONE';
    ELSE
        v_row := to_jsonb(NEW);
        IF TG_ARGV[0] = 'resource' AND v_row->>'published_at' IS NULL THEN
            v_operation := 'TOMBSTONE';
        ELSIF TG_ARGV[0] = 'entitlement' AND v_row->>'revoked_at' IS NOT NULL THEN
            v_operation := 'TOMBSTONE';
        END IF;
    END IF;

    v_entity_id := CASE v_entity_type
        WHEN 'course' THEN v_row->>'course_id'
        WHEN 'resource' THEN v_row->>'resource_id'
        WHEN 'exam_blueprint' THEN v_row->>'exam_id'
        WHEN 'entitlement' THEN v_row->>'entitlement_id'
    END;
    v_tenant_id := NULLIF(v_row->>'tenant_id', '')::UUID;
    v_user_id := CASE
        WHEN TG_ARGV[0] = 'entitlement' THEN NULLIF(v_row->>'user_id', '')::UUID
        ELSE NULL
    END;
    v_version := COALESCE(NULLIF(v_row->>'version', '')::INT, 1);

    INSERT INTO sync_changes (
        tenant_id, user_id, entity_type, entity_id, operation, version, payload
    ) VALUES (
        v_tenant_id,
        v_user_id,
        v_entity_type,
        v_entity_id,
        v_operation,
        v_version,
        v_row
    );
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_courses ON courses;
CREATE TRIGGER trg_sync_courses
AFTER INSERT OR UPDATE OR DELETE ON courses
FOR EACH ROW EXECUTE FUNCTION public.record_sync_change('course');

DROP TRIGGER IF EXISTS trg_sync_course_resources ON course_resources;
CREATE TRIGGER trg_sync_course_resources
AFTER INSERT OR UPDATE OR DELETE ON course_resources
FOR EACH ROW EXECUTE FUNCTION public.record_sync_change('resource');

DROP TRIGGER IF EXISTS trg_sync_exam_blueprints ON exam_blueprints;
CREATE TRIGGER trg_sync_exam_blueprints
AFTER INSERT OR UPDATE OR DELETE ON exam_blueprints
FOR EACH ROW EXECUTE FUNCTION public.record_sync_change('exam_blueprint');

DROP TRIGGER IF EXISTS trg_sync_feature_entitlements ON feature_entitlements;
CREATE TRIGGER trg_sync_feature_entitlements
AFTER INSERT OR UPDATE OR DELETE ON feature_entitlements
FOR EACH ROW EXECUTE FUNCTION public.record_sync_change('entitlement');

GRANT SELECT, INSERT, UPDATE, DELETE ON sync_bookmarks, support_cases TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON sync_changes FROM anon, authenticated;
GRANT SELECT ON sync_changes TO authenticated;
