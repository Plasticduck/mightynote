// Initialize evaluations table
const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        
        // Create evaluations table
        await sql`
            CREATE TABLE IF NOT EXISTS evaluations (
                id SERIAL PRIMARY KEY,
                location TEXT NOT NULL,
                answers JSONB NOT NULL,
                additional_notes TEXT,
                follow_up_instructions TEXT,
                image_pdf TEXT,
                submitted_by TEXT,
                submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Evaluations table initialized' })
        };
    } catch (error) {
        console.error('Error initializing evaluations table:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

