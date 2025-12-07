// Delete site evaluations
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
        const { ids } = JSON.parse(event.body);
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No IDs provided' })
            };
        }
        
        // Delete evaluations by IDs
        await sql`
            DELETE FROM evaluations
            WHERE id = ANY(${ids}::int[])
        `;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, deleted: ids.length })
        };
    } catch (error) {
        console.error('Error deleting evaluations:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

