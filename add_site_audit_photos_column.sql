-- SQL script to add photos column to site_audits table
-- Run this in your Neon database console if the column doesn't exist

-- Check if column exists and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'site_audits'
        AND column_name = 'photos'
    ) THEN
        ALTER TABLE site_audits ADD COLUMN photos JSONB;
        RAISE NOTICE 'Column photos added successfully';
    ELSE
        RAISE NOTICE 'Column photos already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'site_audits'
AND column_name = 'photos';

-- Example structure of photos JSONB:
-- {
--   "primary": {
--     "0": "data:image/jpeg;base64,...",
--     "1": "data:image/jpeg;base64,...",
--     ...
--   },
--   "secondary": {
--     "0": "data:image/jpeg;base64,...",
--     ...
--   },
--   "priority": {
--     "0": "data:image/jpeg;base64,...",
--     ...
--   },
--   "final_thoughts": {
--     "0": "data:image/jpeg;base64,...",
--     ...
--   }
-- }
