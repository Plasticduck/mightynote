// On-demand AI extraction for a single invoice (used by the Assign modal to
// auto-fill amount + invoice date from the document). Reads the invoice file,
// asks Claude for the QuickBooks fields, caches the result in invoices.ai_extract
// so the later QuickBooks export reuses it. Accounting/admin only.

const { neon } = require('@neondatabase/serverless');
const { ensureInvoicesSchema } = require('./_lib-invoices');
const { requireAuth } = require('./_lib-auth');
const { canManageInbox } = require('./_lib-roles');
const { extractInvoiceFields } = require('./_lib-ai-extract');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    const auth = requireAuth(event, headers, { check: canManageInbox });
    if (auth.error) return auth.error;

    const id = event.queryStringParameters && event.queryStringParameters.id;
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
    }

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('[extract] DB connection error:', dbError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    try {
        await ensureInvoicesSchema(sql);
        const rows = await sql`
            SELECT id, ai_extract, file_data, file_name, file_type
            FROM invoices WHERE id = ${id}
        `;
        if (!rows.length) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
        }
        const inv = rows[0];

        // Return the cached extraction if we already have it.
        if (inv.ai_extract) {
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, ai: inv.ai_extract, cached: true }) };
        }
        if (!inv.file_data) {
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, ai: null, reason: 'no_file' }) };
        }

        const ai = await extractInvoiceFields(inv);
        if (ai) {
            try {
                await sql`UPDATE invoices SET ai_extract = ${JSON.stringify(ai)}::jsonb WHERE id = ${id}`;
            } catch (e) {
                console.error('[extract] cache write failed:', e.message);
            }
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, ai: ai || null }) };
    } catch (error) {
        console.error('[extract] error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
