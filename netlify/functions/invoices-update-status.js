// Approve or reject an invoice. Also notifies the submitter by email.
const { neon } = require('@neondatabase/serverless');
const { findUserByName } = require('./_lib-users');
const { sendEmail, invoiceDecisionEmail } = require('./_lib-email');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const data = JSON.parse(event.body);
        const { id, status, reason, decided_by, gl_code } = data;

        if (!id || !status) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and status required' }) };
        }
        if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid status' }) };
        }
        if (status === 'Rejected' && !(reason && reason.trim())) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'A reason is required when rejecting an invoice.' }) };
        }

        // Ensure gl_code column exists (safety for older DBs)
        try {
            const exists = await sql`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'invoices' AND column_name = 'gl_code'
            `;
            if (!exists.length) await sql`ALTER TABLE invoices ADD COLUMN gl_code TEXT`;
        } catch (e) { console.error('gl_code column ensure failed', e); }

        const now = new Date().toISOString();
        const updated = await sql`
            UPDATE invoices
            SET status = ${status},
                decision_reason = ${reason || null},
                decided_by = ${decided_by || null},
                decided_at = ${status === 'Pending' ? null : now},
                gl_code = ${status === 'Approved' ? (gl_code || null) : null}
            WHERE id = ${id}
            RETURNING id, assigned_to, vendor_name, invoice_date, amount,
                      status, decision_reason, decided_by, decided_at, gl_code,
                      submitted_by, submitted_by_email
        `;

        if (!updated.length) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'invoice not found' }) };
        }

        const invoice = updated[0];

        // Fire submitter notification (best-effort)
        if (status === 'Approved' || status === 'Rejected') {
            (async () => {
                try {
                    let submitterEmail = invoice.submitted_by_email;
                    if (!submitterEmail && invoice.submitted_by) {
                        const sub = await findUserByName(sql, invoice.submitted_by);
                        if (sub) submitterEmail = sub.email;
                    }
                    if (!submitterEmail) {
                        console.warn(`[invoice ${id}] no submitter email — skipping decision notification`);
                        return;
                    }
                    const { subject, text, html } = invoiceDecisionEmail({
                        submitterName: invoice.submitted_by,
                        approverName: decided_by,
                        invoice,
                        status,
                        reason,
                        glCode: invoice.gl_code,
                        publicUrl: process.env.PUBLIC_URL || 'https://mightyops.washlyfe.com'
                    });
                    await sendEmail({ to: submitterEmail, subject, text, html });
                } catch (err) {
                    console.error(`[invoice ${id}] decision email failed:`, err);
                }
            })();
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, invoice }) };
    } catch (error) {
        console.error('Error updating invoice status:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
