// Create a new site evaluation
const { neon } = require('@neondatabase/serverless');

// Cache the table creation promise
let tableInitialized = false;

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

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('Database connection error:', dbError);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Database connection failed' })
        };
    }

    try {
        // Ensure table exists (only once per cold start)
        if (!tableInitialized) {
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
            tableInitialized = true;
        }
    } catch (tableError) {
        console.error('Table creation error:', tableError);
        // Continue anyway - table might already exist
    }

    try {
        const data = JSON.parse(event.body);
        
        // Insert the evaluation
        const result = await sql`
            INSERT INTO evaluations (location, answers, additional_notes, follow_up_instructions, image_pdf, submitted_by, submitted_at)
            VALUES (
                ${data.location}, 
                ${JSON.stringify(data.answers)}, 
                ${data.additional_notes || null}, 
                ${data.follow_up_instructions || null}, 
                ${data.image_pdf || null}, 
                ${data.submitted_by || null}, 
                ${data.submitted_at || new Date().toISOString()}
            )
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
