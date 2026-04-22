// Delete invoice approval record(s)
const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const body = event.body ? JSON.parse(event.body) : {};
        const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);

        if (!ids.length) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'ids required' }) };
        }

        await sql`DELETE FROM invoices WHERE id = ANY(${ids}::int[])`;

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: ids.length }) };
    } catch (error) {
        console.error('Error deleting invoices:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
