// Delete invoice approval record(s)
const { neon } = require('@neondatabase/serverless');
const { requireAuth } = require('./_lib-auth');
const { canManageInbox } = require('./_lib-roles');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // Deletion is destructive — restrict to accounting/admins.
    const auth = requireAuth(event, headers, { check: canManageInbox });
    if (auth.error) return auth.error;

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
