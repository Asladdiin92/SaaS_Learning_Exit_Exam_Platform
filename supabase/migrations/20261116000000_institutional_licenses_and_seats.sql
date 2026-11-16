-- Phase 11: Institutional Licensing & Seat Management (ADR-003, ADR-008)
CREATE TABLE IF NOT EXISTS institution_licenses (
    license_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    contract_reference VARCHAR(128) NOT NULL,
    licensed_seats INT NOT NULL CHECK (licensed_seats > 0),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMPTZ NOT NULL,
    offline_download_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seat_assignments (
    seat_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES institution_licenses(license_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    UNIQUE (license_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_inst_licenses_tenant ON institution_licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_license ON seat_assignments(license_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_user ON seat_assignments(user_id);

-- Ensure Haramaya University - CCI tenant exists
DO $$
DECLARE
    hu_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO hu_tenant_id FROM tenants WHERE slug = 'hu-cci-exit-exam' LIMIT 1;
    IF hu_tenant_id IS NULL THEN
        INSERT INTO tenants (tenant_id, organization_name, slug, status, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'Haramaya University — CCI',
            'hu-cci-exit-exam',
            'ACTIVE',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        RETURNING tenant_id INTO hu_tenant_id;
    END IF;

    -- Seed an active institutional license if none exists
    IF NOT EXISTS (SELECT 1 FROM institution_licenses WHERE tenant_id = hu_tenant_id) THEN
        INSERT INTO institution_licenses (
            license_id,
            tenant_id,
            contract_reference,
            licensed_seats,
            valid_from,
            valid_until,
            offline_download_allowed
        )
        VALUES (
            gen_random_uuid(),
            hu_tenant_id,
            'HU-CCI-ENT-2026-001',
            250,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + INTERVAL '180 days',
            TRUE
        );
    END IF;
END $$;
