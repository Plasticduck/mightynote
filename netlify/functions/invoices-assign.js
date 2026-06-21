// Assign an Unassigned (emailed-in) invoice to site(s) + approver(s) and put it
// in the QUEUE. This does NOT notify anyone — accounting batches assignments and
// later calls invoices-submit-queue, which flips Queued -> Assigned and sends a
// single summary email per approver.
//
// An invoice can be assigned to MULTIPLE sites and MULTIPLE approvers. Only one
// approver needs to act for it to be approved (handled in invoices-update-status).

const { neon } = require('@neondatabase/serverless');
const { ensureInvoicesSchema } = require('./_lib-invoices');
const { requireAuth } = require('./_lib-auth');
const { canManageInbox } = require('./_lib-roles');

function asCleanArray(v) {
    if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
    if (typeof v === 'string' && v.trim()) return [v.trim()];
    return [];
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // Only accounting/admins may assign/queue invoices.
    const auth = requireAuth(event, headers, { check: canManageInbox });
    if (auth.error) return auth.error;
    const user = auth.user;

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('[assign] DB connection error:', dbError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    try {
        await ensureInvoicesSchema(sql);

        const data = JSON.parse(event.body || '{}');
        const { id, vendor_name, amount, invoice_date } = data;

        // Accept arrays (sites/approvers) or legacy singletons (site/assigned_to).
        const sites = asCleanArray(data.sites != null ? data.sites : data.site);
        const approvers = asCleanArray(data.approvers != null ? data.approvers : data.assigned_to);

        if (!id) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'id is required' }) };
        }
        if (!approvers.length) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'At least one approver is required' }) };
        }
        // Site(s) are optional at assign time — the submitter or approver may not
        // know the site yet; the approver can set/correct it at review.

        const amountVal = (amount === '' || amount === null || amount === undefined) ? null : parseFloat(amount);
        // Legacy joined values kept in sync for any code/CSV that still reads them.
        const assignedJoined = approvers.join(', ');
        const sitesParam = sites.length ? sites : null;
        const sitesJoined = sites.length ? sites.join(', ') : null;
        const now = new Date().toISOString();

        // Only queue rows currently Unassigned (or already Queued — allows
        // editing an assignment before submission). The status guard makes this
        // safe to retry and prevents re-routing an invoice that's already out
        // for approval.
        const updated = await sql`
            UPDATE invoices
            SET sites = ${sitesParam},
                approvers = ${approvers},
                assigned_to = ${assignedJoined},
                site = ${sitesJoined},
                vendor_name = COALESCE(NULLIF(${vendor_name || null}, ''), vendor_name),
                amount = ${amountVal},
                invoice_date = ${invoice_date || null},
                status = 'Queued',
                queued_by = ${user.full_name},
                queued_at = ${now},
                viewed_by = '{}'::text[]
            WHERE id = ${id} AND status IN ('Unassigned', 'Queued')
            RETURNING id, sites, approvers, assigned_to, site, vendor_name, invoice_date, amount,
                      file_name, file_type, status, queued_by, queued_at,
                      submitted_by, submitted_by_email, submitted_at,
                      source, sender_email, email_subject,
                      CASE WHEN file_data IS NOT NULL AND file_data != '' THEN true ELSE false END as has_file
        `;

        if (!updated.length) {
            return { statusCode: 409, headers, body: JSON.stringify({ error: 'Invoice not found or no longer assignable (already submitted/approved/cancelled).' }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, invoice: updated[0] }) };
    } catch (error) {
        console.error('[assign] error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
