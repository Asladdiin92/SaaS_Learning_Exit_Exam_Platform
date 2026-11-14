-- Day 3 auth replay tracking and tenant-admin invitation permissions.

CREATE TABLE IF NOT EXISTS refresh_token_history (
    token_hash CHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES user_devices(device_id) ON DELETE CASCADE,
    family_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_history_family
    ON refresh_token_history(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_history_expiry
    ON refresh_token_history(expires_at);

REVOKE ALL ON TABLE refresh_token_history FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_current_tenant_admin(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.tenant_memberships
        WHERE tenant_id = p_tenant_id
          AND user_id = public.current_app_user_id()
          AND role IN ('TENANT_ADMIN', 'SUPER_ADMIN')
          AND status = 'ACTIVE'
    );
$$;

REVOKE ALL ON FUNCTION public.is_current_tenant_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_tenant_admin(UUID) TO authenticated;

DROP POLICY IF EXISTS rls_memberships_user_scope ON tenant_memberships;
CREATE POLICY rls_memberships_user_scope ON tenant_memberships
    FOR ALL
    USING (
        user_id = public.current_app_user_id()
        OR public.is_current_tenant_admin(tenant_id)
    )
    WITH CHECK (
        user_id = public.current_app_user_id()
        OR public.is_current_tenant_admin(tenant_id)
    );
