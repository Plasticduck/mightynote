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
-- Assign regions so Regional Managers can only pull reports for their region's sites.
-- Run these after the column exists (emails are case-insensitive; use lower if your DB stores them that way).

UPDATE users SET region = 'lubbock' WHERE LOWER(email) = 'mcanales@mighty-wash.com';      -- Matt Canales: 1,5,7,9,10,11,14
UPDATE users SET region = 'central' WHERE LOWER(email) = 'amessina@mighty-wash.com';      -- Aaron Messina: 27,28,29,30,Spotless
UPDATE users SET region = 'permian_a' WHERE LOWER(email) = 'isabel@mighty-wash.com';       -- Isabel Castaneda: 2,4,6,8,13,15,22,24,25
UPDATE users SET region = 'permian_b' WHERE LOWER(email) = 'lester@mighty-wash.com';    -- Lester Young: 3,12,31
UPDATE users SET region = 'new_mexico' WHERE LOWER(email) = 'rbreed@mighty-wash.com';    -- Rance Breed: 16,17,18,19,20,21,23,26

-- Leave region NULL or set to 'corporate' for users who may see all sites.
