const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);

        // Create site_audits table
        await sql`
            CREATE TABLE IF NOT EXISTS site_audits (
                id SERIAL PRIMARY KEY,
                location TEXT NOT NULL,
                initial_observations TEXT,
                primary_section JSONB,
                secondary_section JSONB,
                priority_section JSONB,
                final_thoughts JSONB,
                photos JSONB,
                section_comments JSONB,
                explanation TEXT,
                submitted_by TEXT,
                user_id INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        // Add photos column if it doesn't exist
        await sql`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'site_audits' AND column_name = 'photos'
                ) THEN
                    ALTER TABLE site_audits ADD COLUMN photos JSONB;
                END IF;
            END $$;
        `;

        // Create index for faster queries
        await sql`
            CREATE INDEX IF NOT EXISTS idx_site_audits_location 
            ON site_audits(location, created_at DESC)
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Site audits database initialized successfully' })
        };
    } catch (error) {
        console.error('Error initializing site audits database:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
