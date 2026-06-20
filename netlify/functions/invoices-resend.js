// Restart a cancelled invoice: reset it back to the Unassigned tab so accounting
// can re-assign site(s) + approver(s) and run it through the queue again. Clears
// the prior assignment, decision, views, and queue/export state. The original
// file and email metadata are kept. Accounting/admin only.

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

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('[resend] DB connection error:', dbError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    try {
        await ensureInvoicesSchema(sql);
        const data = JSON.parse(event.body || '{}');
        const { id } = data;
        if (!id) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'id is required' }) };
        }

        const updated = await sql`
            UPDATE invoices
            SET status = 'Unassigned',
                sites = NULL, approvers = NULL, assigned_to = NULL, site = NULL,
                viewed_by = '{}'::text[],
                decided_by = NULL, decided_at = NULL, decision_reason = NULL, gl_code = NULL,
                queued_by = NULL, queued_at = NULL, queue_submitted_at = NULL,
                cancelled_by = NULL, cancelled_at = NULL
            WHERE id = ${id} AND status = 'Cancelled'
            RETURNING id, status
        `;

        if (!updated.length) {
            return { statusCode: 409, headers, body: JSON.stringify({ error: 'Only cancelled invoices can be restarted.' }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, invoice: updated[0] }) };
    } catch (error) {
        console.error('[resend] error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
