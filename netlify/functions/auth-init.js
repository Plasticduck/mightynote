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

        // Create the users table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                can_use_inventory_app BOOLEAN DEFAULT FALSE,
                mightycount_only BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Add can_use_inventory_app column if table exists but column doesn't
        try {
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_use_inventory_app BOOLEAN DEFAULT FALSE`;
        } catch (error) {
            // Column might already exist, ignore error
            if (!error.message.includes('already exists')) {
                console.error('Error adding column:', error);
            }
        }

        // Add mightycount_only column if table exists but column doesn't
        try {
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mightycount_only BOOLEAN DEFAULT FALSE`;
        } catch (error) {
            // Column might already exist, ignore error
            if (!error.message.includes('already exists')) {
                console.error('Error adding column:', error);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Auth tables initialized successfully' })
        };
    } catch (error) {
        console.error('Error initializing auth tables:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
