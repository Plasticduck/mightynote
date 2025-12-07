// Create a new site evaluation
const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const data = JSON.parse(event.body);
        
        // Ensure table exists
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
        
        // Insert the evaluation
        const result = await sql`
            INSERT INTO evaluations (location, answers, additional_notes, follow_up_instructions, image_pdf, submitted_by, submitted_at)
            VALUES (${data.location}, ${JSON.stringify(data.answers)}, ${data.additional_notes || null}, ${data.follow_up_instructions || null}, ${data.image_pdf || null}, ${data.submitted_by || null}, ${data.submitted_at || new Date().toISOString()})
            RETURNING id
        `;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, id: result[0].id })
        };
    } catch (error) {
        console.error('Error creating evaluation:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};


