-- SQL script to add is_admin column to users table
-- Run this in your Neon database console if the column doesn't exist

-- Check if column exists and add it if it doesn't
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'is_admin'
    ) THEN
        ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Column is_admin added successfully';
    ELSE
        RAISE NOTICE 'Column is_admin already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name = 'is_admin';

-- Example: Set a user as admin (replace email with actual email)
-- UPDATE users SET is_admin = TRUE WHERE email = 'admin@example.com';
