-- Migration: Seed Canonical B2C Products and Entitlement Specifications

INSERT INTO public.products (
    product_id, code, title, is_recurring, billing_interval_days,
    price_amount, currency, entitlement_spec, is_active
) VALUES
(
    '11111111-1111-4111-a111-111111111111',
    'SUB-MONTHLY',
    'Student Monthly Pass',
    TRUE,
    30,
    250.00,
    'ETB',
    '{
        "scope_type": "GLOBAL",
        "offline_download_allowed": true,
        "offline_grace_days": 7,
        "storage_quota_mb": 2048,
        "ai_monthly_quota": 50,
        "features": ["ALL_COURSES", "UNLIMITED_PRACTICE", "AI_TUTOR_50"]
    }'::jsonb,
    TRUE
),
(
    '22222222-2222-4222-a222-222222222222',
    'SUB-SEMESTER',
    'Semester Exam Prep Pass',
    TRUE,
    120,
    600.00,
    'ETB',
    '{
        "scope_type": "GLOBAL",
        "offline_download_allowed": true,
        "offline_grace_days": 14,
        "storage_quota_mb": 4096,
        "ai_monthly_quota": 150,
        "features": ["ALL_COURSES", "UNLIMITED_PRACTICE", "AI_TUTOR_150", "OFFLINE_UNLIMITED"]
    }'::jsonb,
    TRUE
),
(
    '33333333-3333-4333-a333-333333333333',
    'SUB-ANNUAL',
    'Annual Full Exit Exam Access',
    TRUE,
    365,
    1200.00,
    'ETB',
    '{
        "scope_type": "GLOBAL",
        "offline_download_allowed": true,
        "offline_grace_days": 30,
        "storage_quota_mb": 10240,
        "ai_monthly_quota": 500,
        "features": ["ALL_COURSES", "UNLIMITED_PRACTICE", "AI_TUTOR_500", "VIP_OFFLINE_STORAGE"]
    }'::jsonb,
    TRUE
),
(
    '44444444-4444-4444-a444-444444444444',
    'BUNDLE-EXIT-2023',
    'National Exit Exam Simulation Pack',
    FALSE,
    NULL,
    350.00,
    'ETB',
    '{
        "scope_type": "GLOBAL",
        "offline_download_allowed": true,
        "offline_grace_days": 180,
        "storage_quota_mb": 2048,
        "ai_monthly_quota": 100,
        "features": ["HU_2023_EXAM", "PRACTICE_SIMULATIONS"]
    }'::jsonb,
    TRUE
),
(
    '55555555-5555-4555-a555-555555555555',
    'BUNDLE-THEME5-SEC',
    'Theme 5: Information Assurance Deep Dive',
    FALSE,
    NULL,
    200.00,
    'ETB',
    '{
        "scope_type": "THEME",
        "scope_target_id": "5",
        "offline_download_allowed": true,
        "offline_grace_days": 90,
        "storage_quota_mb": 1024,
        "ai_monthly_quota": 50,
        "features": ["IT_IASC_401", "ITEC4133_QUESTION_BANK"]
    }'::jsonb,
    TRUE
)
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    price_amount = EXCLUDED.price_amount,
    currency = EXCLUDED.currency,
    entitlement_spec = EXCLUDED.entitlement_spec,
    is_active = EXCLUDED.is_active;
