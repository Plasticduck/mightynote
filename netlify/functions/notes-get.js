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

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        
        // Parse query parameters
        const params = event.queryStringParameters || {};
        const location = params.location;
        const department = params.department;

        let query;
        
        if (location && department) {
            query = sql`
                SELECT * FROM notes 
                WHERE location = ${parseInt(location)} 
                AND department = ${department}
                ORDER BY id DESC
            `;
        } else if (location) {
            query = sql`
                SELECT * FROM notes 
                WHERE location = ${parseInt(location)}
                ORDER BY id DESC
            `;
        } else if (department) {
            query = sql`
                SELECT * FROM notes 
                WHERE department = ${department}
                ORDER BY id DESC
            `;
        } else {
            query = sql`SELECT * FROM notes ORDER BY id DESC`;
        }

        const notes = await query;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, notes })
        };
    } catch (error) {
        console.error('Error fetching notes:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};

