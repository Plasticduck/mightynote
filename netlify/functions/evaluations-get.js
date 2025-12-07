// Get all site evaluations
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

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        
        // Get all evaluations (excluding full image data for performance)
        const evaluations = await sql`
            SELECT 
                id,
                location,
                answers,
                additional_notes,
                follow_up_instructions,
                submitted_by,
                submitted_at,
                CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END as has_image
            FROM evaluations
            ORDER BY submitted_at DESC
        `;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(evaluations)
        };
    } catch (error) {
        console.error('Error fetching evaluations:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};


