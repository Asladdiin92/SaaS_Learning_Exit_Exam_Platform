CREATE TABLE IF NOT EXISTS download_grant_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES course_resources(resource_id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES user_devices(device_id) ON DELETE CASCADE,
    grant_id UUID NOT NULL UNIQUE,
    package_id UUID NOT NULL,
    version INT NOT NULL,
    idempotency_key VARCHAR(255),
    request_fingerprint CHAR(64) NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_download_grant_idempotency
    ON download_grant_events(user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_download_grant_events_user_created
    ON download_grant_events(user_id, created_at DESC);

ALTER TABLE download_grant_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_grant_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_download_grant_events_owner ON download_grant_events;
CREATE POLICY rls_download_grant_events_owner ON download_grant_events
    FOR SELECT
    USING (
        user_id = public.current_app_user_id()
        AND (tenant_id IS NULL OR tenant_id = public.current_app_tenant_id())
    );

DROP POLICY IF EXISTS rls_download_grant_events_insert ON download_grant_events;
CREATE POLICY rls_download_grant_events_insert ON download_grant_events
    FOR INSERT
    WITH CHECK (
        user_id = public.current_app_user_id()
        AND (tenant_id IS NULL OR tenant_id = public.current_app_tenant_id())
    );

GRANT SELECT, INSERT ON TABLE download_grant_events TO authenticated;
