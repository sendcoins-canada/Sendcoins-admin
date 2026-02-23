-- Add platform fee setting (used by main sendcoins backend for conversion fee %)
INSERT INTO "system_settings" ("setting_key", "setting_value", "setting_type", "description", "updated_by")
VALUES (
    'platform_fee_percentage',
    '1.2',
    'number',
    'Platform fee percentage applied to crypto-to-fiat conversions (e.g. 1.2 = 1.2%). Used by main Sendcoins backend.',
    'system'
) ON CONFLICT ("setting_key") DO NOTHING;
