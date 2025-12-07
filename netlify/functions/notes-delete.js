const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
        const { ids } = data;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Note IDs are required' })
            };
        }

        // Delete notes by IDs
        const deleteCount = await sql`
            DELETE FROM notes WHERE id = ANY(${ids}::int[])
            RETURNING id
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                deleted: deleteCount.length,
                message: `Deleted ${deleteCount.length} note(s)`
            })
        };
    } catch (error) {
        console.error('Error deleting notes:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};


