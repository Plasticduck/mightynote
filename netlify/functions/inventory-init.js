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

        // Create inventory_items table (master catalog)
        await sql`
            CREATE TABLE IF NOT EXISTS inventory_items (
                id SERIAL PRIMARY KEY,
                category TEXT NOT NULL,
                brand TEXT NOT NULL,
                item TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(category, brand, item)
            )
        `;

        // Create inventory_counts table (actual counts submitted)
        await sql`
            CREATE TABLE IF NOT EXISTS inventory_counts (
                id SERIAL PRIMARY KEY,
                category TEXT NOT NULL,
                brand TEXT NOT NULL,
                item TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                submitted_by TEXT,
                user_id INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create index for faster queries
        await sql`
            CREATE INDEX IF NOT EXISTS idx_inventory_counts_category 
            ON inventory_counts(category, created_at DESC)
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Inventory database initialized successfully' })
        };
    } catch (error) {
        console.error('Error initializing inventory database:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
