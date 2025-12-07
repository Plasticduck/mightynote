const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);

        // Create the notes table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                location INTEGER NOT NULL,
                department TEXT NOT NULL,
                note_type TEXT NOT NULL,
                other_description TEXT,
                additional_notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        // Add image_pdf column if it doesn't exist
        await sql`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'notes' AND column_name = 'image_pdf'
                ) THEN
                    ALTER TABLE notes ADD COLUMN image_pdf TEXT;
                END IF;
            END $$;
        `;
        
        // Add submitted_by column if it doesn't exist
        await sql`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'notes' AND column_name = 'submitted_by'
                ) THEN
                    ALTER TABLE notes ADD COLUMN submitted_by TEXT;
                END IF;
            END $$;
        `;
        
        // Add user_id column if it doesn't exist
        await sql`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'notes' AND column_name = 'user_id'
                ) THEN
                    ALTER TABLE notes ADD COLUMN user_id INTEGER;
                END IF;
            END $$;
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Database initialized successfully' })
        };
    } catch (error) {
        console.error('Error initializing database:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
