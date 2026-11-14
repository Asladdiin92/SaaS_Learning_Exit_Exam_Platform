CREATE OR REPLACE FUNCTION public.revoke_refresh_token_family(
    p_family_id UUID,
    p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF public.current_app_user_id() IS NOT NULL
       AND public.current_app_user_id() <> p_user_id THEN
        RAISE EXCEPTION 'Cannot revoke another user refresh-token family'
            USING ERRCODE = '42501';
    END IF;

    UPDATE public.user_devices
    SET revoked_at = CURRENT_TIMESTAMP,
        refresh_token_hash = NULL
    WHERE refresh_token_family_id = p_family_id
      AND user_id = p_user_id;

    UPDATE public.refresh_token_history
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE family_id = p_family_id
      AND user_id = p_user_id
      AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_refresh_token_family(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_refresh_token_family(UUID, UUID) TO authenticated;
