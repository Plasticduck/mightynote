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

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const data = JSON.parse(event.body);

        const { location, department, note_type, other_description, additional_notes, image_pdf } = data;

        // Validate required fields
        if (!location || !department || !note_type) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Missing required fields' })
            };
        }

        const result = await sql`
            INSERT INTO notes (location, department, note_type, other_description, additional_notes, image_pdf)
            VALUES (${parseInt(location)}, ${department}, ${note_type}, ${other_description || null}, ${additional_notes || null}, ${image_pdf || null})
            RETURNING id, location, department, note_type, other_description, additional_notes, created_at
        `;

        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ success: true, note: result[0] })
        };
    } catch (error) {
        console.error('Error creating note:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};

