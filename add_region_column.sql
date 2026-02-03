-- Add region column for Site Violations reporting permissions (Regional Managers see only their region's sites)
-- Run in Neon SQL editor.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'region'
    ) THEN
        ALTER TABLE users ADD COLUMN region TEXT;
        RAISE NOTICE 'Column region added.';
    ELSE
        RAISE NOTICE 'Column region already exists.';
    END IF;
END $$;

-- Region values: 'corporate' | 'lubbock' | 'permian_a' | 'permian_b' | 'new_mexico' | 'central'
-- Example: assign regions (update emails as needed)
-- UPDATE users SET region = 'lubbock' WHERE email = 'matt.canales@example.com';
-- UPDATE users SET region = 'central' WHERE email = 'aaron.messina@example.com';
-- UPDATE users SET region = 'permian_a' WHERE email = 'isabel.castaneda@example.com';
-- UPDATE users SET region = 'permian_b' WHERE email = 'lester.young@example.com';
-- UPDATE users SET region = 'new_mexico' WHERE email = 'rance.breed@example.com';
-- NULL or 'corporate' = can see all sites.
