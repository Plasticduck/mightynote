// Approve or deny an assigned invoice.
//
// Rules enforced here (not just in the UI):
//   - Caller must be one of the invoice's assigned approvers (or an admin).
//   - Caller must have VIEWED the invoice file first (recorded by
//     invoices-view-file in viewed_by[]).
//   - Only one approver needs to act: the first decision wins. A status guard
//     (WHERE status = 'Assigned') makes concurrent decisions safe.
//   - Approve  -> status 'Approved'        (APPROVED tab)
//   - Deny     -> status 'NeedsAttention'  (NEEDS ATTENTION tab); reason required.
// The submitter is emailed the outcome.

const { neon } = require('@neondatabase/serverless');
const { findUserByName } = require('./_lib-users');
const { sendEmail, invoiceDecisionEmail } = require('./_lib-email');
const { requireAuth } = require('./_lib-auth');
const { isAdmin, isAssignedApprover, hasViewed } = require('./_lib-roles');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const auth = requireAuth(event, headers);
    if (auth.error) return auth.error;
    const user = auth.user;

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const data = JSON.parse(event.body);
        const { id, status, reason, gl_code } = data;
        // The decider is the authenticated user — never trust a client value.
        const decided_by = user.full_name;

        // The approver may correct the site(s) Accounting assigned. An empty list
        // leaves the existing sites untouched (COALESCE below), so a decision never
        // accidentally wipes the site.
        const sitesUpdate = Array.isArray(data.sites)
            ? data.sites.map((s) => String(s).trim()).filter(Boolean) : [];
        const sitesParam = sitesUpdate.length ? sitesUpdate : null;
        const siteJoined = sitesUpdate.length ? sitesUpdate.join(', ') : null;

        // 'Approved' and 'Rejected' come from the UI; map 'Rejected' -> deny.
        const isApprove = status === 'Approved';
        const isDeny = status === 'Rejected' || status === 'Denied' || status === 'NeedsAttention';

        if (!id || !status) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and status required' }) };
        }
        if (!isApprove && !isDeny) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid status' }) };
        }
        if (isDeny && !(reason && reason.trim())) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'A reason is required when denying an invoice.' }) };
        }

        // Ensure gl_code column exists (safety for older DBs)
        try {
            const exists = await sql`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'invoices' AND column_name = 'gl_code'
            `;
            if (!exists.length) await sql`ALTER TABLE invoices ADD COLUMN gl_code TEXT`;
        } catch (e) { console.error('gl_code column ensure failed', e); }

        // Load the invoice for authorization + view-gate checks.
        const rows = await sql`
            SELECT id, status, approvers, assigned_to, viewed_by
            FROM invoices WHERE id = ${id}
        `;
        if (!rows.length) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'invoice not found' }) };
        }
        const inv = rows[0];

        if (!isAdmin(user) && !isAssignedApprover(user, inv)) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'This invoice is not assigned to you.' }) };
        }
        // Mandatory view-before-decide (admins exempt — they can override).
        if (!isAdmin(user) && !hasViewed(user, inv)) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'You must open and view the invoice before approving or denying it.' }) };
        }

        const newStatus = isApprove ? 'Approved' : 'NeedsAttention';
        const now = new Date().toISOString();

        // First decision wins: only act while still 'Assigned'. (Admins may also
        // override an already-decided invoice — they aren't bound by the guard.)
        const updated = isAdmin(user)
            ? await sql`
                UPDATE invoices
                SET status = ${newStatus},
                    decision_reason = ${reason || null},
                    decided_by = ${decided_by},
                    decided_at = ${now},
                    gl_code = ${isApprove ? (gl_code || null) : null},
                    sites = COALESCE(${sitesParam}::text[], sites),
                    site = COALESCE(${siteJoined}, site)
                WHERE id = ${id}
                RETURNING id, assigned_to, approvers, sites, vendor_name, invoice_date, amount,
                          status, decision_reason, decided_by, decided_at, gl_code,
                          submitted_by, submitted_by_email
              `
            : await sql`
                UPDATE invoices
                SET status = ${newStatus},
                    decision_reason = ${reason || null},
                    decided_by = ${decided_by},
                    decided_at = ${now},
                    gl_code = ${isApprove ? (gl_code || null) : null},
                    sites = COALESCE(${sitesParam}::text[], sites),
                    site = COALESCE(${siteJoined}, site)
                WHERE id = ${id} AND status = 'Assigned'
                RETURNING id, assigned_to, approvers, sites, vendor_name, invoice_date, amount,
                          status, decision_reason, decided_by, decided_at, gl_code,
                          submitted_by, submitted_by_email
              `;

        if (!updated.length) {
            // Lost the race (another approver already decided) or wrong state.
            return { statusCode: 409, headers, body: JSON.stringify({ error: 'This invoice has already been decided or is not awaiting approval.' }) };
        }

        const invoice = updated[0];

        // Notify the submitter of the decision (best-effort, awaited).
        try {
            let submitterEmail = invoice.submitted_by_email;
            if (!submitterEmail && invoice.submitted_by) {
                const sub = await findUserByName(sql, invoice.submitted_by);
                if (sub) submitterEmail = sub.email;
            }
            if (submitterEmail) {
                const { subject, text, html } = invoiceDecisionEmail({
                    submitterName: invoice.submitted_by,
                    approverName: decided_by,
                    invoice,
                    status: isApprove ? 'Approved' : 'Denied',
                    reason,
                    glCode: invoice.gl_code,
                    publicUrl: process.env.PUBLIC_URL || 'https://mightyops.washlyfe.com'
                });
                const mailResult = await sendEmail({ to: submitterEmail, subject, text, html });
                console.log(`[invoice ${id}] decision email to ${submitterEmail}:`, mailResult);
            }
        } catch (err) {
            console.error(`[invoice ${id}] decision email failed:`, err);
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, invoice }) };
    } catch (error) {
        console.error('Error updating invoice status:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
