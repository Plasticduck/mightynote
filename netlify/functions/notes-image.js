const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const noteId = event.queryStringParameters?.id;

        if (!noteId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Note ID is required' })
            };
        }

        const result = await sql`
            SELECT id, image_pdf FROM notes WHERE id = ${parseInt(noteId)}
        `;

        if (result.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ success: false, error: 'Note not found' })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                hasImage: !!result[0].image_pdf,
                image_pdf: result[0].image_pdf 
            })
        };
    } catch (error) {
        console.error('Error fetching note image:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};






