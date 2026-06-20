// Cancel an invoice. Accounting/admin only (enforced here, not just in the UI).
// Cancellable from any active state except already-Exported (it's in QuickBooks)
// or already-Cancelled. A cancelled invoice can later be restarted via
// invoices-resend.

const { neon } = require('@neondatabase/serverless');
const { ensureInvoicesSchema } = require('./_lib-invoices');
const { requireAuth } = require('./_lib-auth');
const { canManageInbox } = require('./_lib-roles');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const auth = requireAuth(event, headers, { check: canManageInbox });
    if (auth.error) return auth.error;
    const user = auth.user;

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('[cancel] DB connection error:', dbError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    try {
        await ensureInvoicesSchema(sql);
        const data = JSON.parse(event.body || '{}');
        const { id, reason } = data;
        if (!id) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'id is required' }) };
        }

        const now = new Date().toISOString();
        const updated = await sql`
            UPDATE invoices
            SET status = 'Cancelled',
                cancelled_by = ${user.full_name},
                cancelled_at = ${now},
                decision_reason = COALESCE(NULLIF(${reason || null}, ''), decision_reason)
            WHERE id = ${id} AND status NOT IN ('Exported', 'Cancelled')
            RETURNING id, status, cancelled_by, cancelled_at
        `;

        if (!updated.length) {
            return { statusCode: 409, headers, body: JSON.stringify({ error: 'Invoice cannot be cancelled (already exported or cancelled, or not found).' }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, invoice: updated[0] }) };
    } catch (error) {
        console.error('[cancel] error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
