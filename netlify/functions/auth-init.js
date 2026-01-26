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
        const databaseUrl = process.env.NETLIFY_DATABASE_URL;
        if (!databaseUrl) {
            throw new Error('NETLIFY_DATABASE_URL environment variable is not set');
        }
        const sql = neon(databaseUrl);

        // Create the users table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                can_use_inventory_app BOOLEAN DEFAULT FALSE,
                mightycount_only BOOLEAN DEFAULT FALSE,
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Add can_use_inventory_app column if table exists but column doesn't
        try {
            const columnCheck = await sql`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'can_use_inventory_app'
            `;
            if (columnCheck.length === 0) {
                await sql`ALTER TABLE users ADD COLUMN can_use_inventory_app BOOLEAN DEFAULT FALSE`;
                console.log('Added can_use_inventory_app column');
            }
        } catch (error) {
            console.error('Error adding can_use_inventory_app column:', error);
        }

        // Add mightycount_only column if table exists but column doesn't
        try {
            const columnCheck = await sql`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'mightycount_only'
            `;
            if (columnCheck.length === 0) {
                await sql`ALTER TABLE users ADD COLUMN mightycount_only BOOLEAN DEFAULT FALSE`;
                console.log('Added mightycount_only column');
            }
        } catch (error) {
            console.error('Error adding mightycount_only column:', error);
        }

        // Add is_admin column if table exists but column doesn't
        try {
            const columnCheck = await sql`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'is_admin'
            `;
            if (columnCheck.length === 0) {
                await sql`ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE`;
                console.log('Added is_admin column');
            }
        } catch (error) {
            console.error('Error adding is_admin column:', error);
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
