// Delete one or more site audits. Site admins only — gated by a valid session
// token whose claims have is_admin = true (the other site-audit endpoints are
// open, so this auth check is the only thing guarding deletion).

const { neon } = require('@neondatabase/serverless');
const { requireAuth } = require('./_lib-auth');
const { isAdmin } = require('./_lib-roles');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
        return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
    }

    const auth = requireAuth(event, headers, { check: isAdmin });
    if (auth.error) return auth.error;

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const body = event.body ? JSON.parse(event.body) : {};
        const ids = Array.isArray(body.ids)
            ? body.ids.map(Number).filter((n) => Number.isInteger(n))
            : (body.id ? [Number(body.id)] : []);

        if (!ids.length) {
            return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'ids required' }) };
        }

        await sql`DELETE FROM site_audits WHERE id = ANY(${ids}::int[])`;
        console.log(`[site-audit-delete] ${auth.user.full_name} deleted ${ids.length} audit(s): ${ids.join(', ')}`);

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: ids.length }) };
    } catch (error) {
        console.error('Error deleting site audits:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
