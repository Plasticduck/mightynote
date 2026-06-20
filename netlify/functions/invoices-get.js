// Get invoice approval records (scoped to the caller's role).
const { neon } = require('@neondatabase/serverless');
const { ensureInvoicesSchema } = require('./_lib-invoices');
const { requireAuth } = require('./_lib-auth');
const { canManageInbox, canViewInvoice } = require('./_lib-roles');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Must be signed in. Accounting/admins see everything; everyone else sees
    // only invoices assigned to or submitted by them (filtered below).
    const auth = requireAuth(event, headers);
    if (auth.error) return auth.error;
    const user = auth.user;

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('Database connection error:', dbError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    try {
        await ensureInvoicesSchema(sql);

        const invoices = await sql`
            SELECT
                id, assigned_to, approvers, site, sites, vendor_name, invoice_date, amount,
                file_name, file_type, status, decision_reason, decided_by, decided_at,
                gl_code, viewed_by, submitted_by, submitted_by_email, submitted_at,
                queued_by, queued_at, queue_submitted_at,
                exported_at, export_batch_id, cancelled_by, cancelled_at,
                source, sender_email, email_subject,
                CASE WHEN file_data IS NOT NULL AND file_data != '' THEN true ELSE false END as has_file
            FROM invoices
            ORDER BY submitted_at DESC
        `;

        // Scope server-side: a non-privileged caller must never receive rows
        // that aren't theirs, regardless of what the client asks for. The fuzzy
        // name match (first-name prefixes) is easier in JS than SQL, and the
        // result set is small, so we filter here.
        const visible = canManageInbox(user)
            ? invoices
            : invoices.filter((r) => canViewInvoice(user, r));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(visible)
        };
    } catch (error) {
        console.error('Error fetching invoices:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
