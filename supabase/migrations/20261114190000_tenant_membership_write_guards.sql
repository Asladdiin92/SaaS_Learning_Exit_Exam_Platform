DROP POLICY IF EXISTS rls_memberships_user_scope ON tenant_memberships;
DROP POLICY IF EXISTS rls_memberships_select_scope ON tenant_memberships;
DROP POLICY IF EXISTS rls_memberships_admin_insert ON tenant_memberships;
DROP POLICY IF EXISTS rls_memberships_admin_update ON tenant_memberships;
DROP POLICY IF EXISTS rls_memberships_admin_delete ON tenant_memberships;

CREATE POLICY rls_memberships_select_scope ON tenant_memberships
    FOR SELECT
    USING (
        user_id = public.current_app_user_id()
        OR public.is_current_tenant_admin(tenant_id)
    );

CREATE POLICY rls_memberships_admin_insert ON tenant_memberships
    FOR INSERT
    WITH CHECK (public.is_current_tenant_admin(tenant_id));

CREATE POLICY rls_memberships_admin_update ON tenant_memberships
    FOR UPDATE
    USING (public.is_current_tenant_admin(tenant_id))
    WITH CHECK (public.is_current_tenant_admin(tenant_id));

CREATE POLICY rls_memberships_admin_delete ON tenant_memberships
    FOR DELETE
    USING (public.is_current_tenant_admin(tenant_id));

CREATE OR REPLACE FUNCTION public.create_tenant_with_admin(
    p_user_id UUID,
    p_organization_name VARCHAR,
    p_slug VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    IF public.current_app_user_id() IS NULL
       OR public.current_app_user_id() <> p_user_id THEN
        RAISE EXCEPTION 'Tenant creator must be the authenticated user'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.tenants (organization_name, slug, status)
    VALUES (p_organization_name, p_slug, 'ACTIVE')
    RETURNING tenant_id INTO v_tenant_id;

    INSERT INTO public.tenant_memberships (
        user_id, tenant_id, role, status, cohort_name
    )
    VALUES (p_user_id, v_tenant_id, 'TENANT_ADMIN', 'ACTIVE', 'Administration');

    RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_tenant_member(
    p_tenant_id UUID,
    p_user_id UUID,
    p_role membership_role,
    p_cohort_name VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_membership_id UUID;
BEGIN
    IF NOT public.is_current_tenant_admin(p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant administrator permission required'
            USING ERRCODE = '42501';
    END IF;
    IF p_role NOT IN ('STUDENT', 'INSTRUCTOR') THEN
        RAISE EXCEPTION 'Only students and instructors can be invited'
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.tenant_memberships (
        user_id, tenant_id, role, status, cohort_name
    )
    VALUES (p_user_id, p_tenant_id, p_role, 'ACTIVE', p_cohort_name)
    ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = 'ACTIVE',
        cohort_name = COALESCE(EXCLUDED.cohort_name, tenant_memberships.cohort_name)
    RETURNING membership_id INTO v_membership_id;

    RETURN v_membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tenant_with_admin(UUID, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invite_tenant_member(UUID, UUID, membership_role, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tenant_with_admin(UUID, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_tenant_member(UUID, UUID, membership_role, VARCHAR) TO authenticated;
