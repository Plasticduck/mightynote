// Assign an Unassigned (emailed-in) invoice to an approver.
// Promotes a dashboard Inbox row to a normal Pending invoice: fills in the
// details Accounting entered, sets the assignee, flips status to Pending, and
// notifies the approver by email — reusing the same path as invoices-create.

const { neon } = require('@neondatabase/serverless');
const { findUserByName } = require('./_lib-users');
const { sendEmail, invoiceRequestEmail } = require('./_lib-email');
const { ensureInvoicesSchema } = require('./_lib-invoices');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

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
        const { id, assigned_to, vendor_name, amount, invoice_date, site, assigned_by } = data;

        if (!id || !assigned_to) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and assigned_to are required' }) };
        }

        const amountVal = (amount === '' || amount === null || amount === undefined) ? null : parseFloat(amount);

        // Only assign rows currently in the Inbox. The status guard makes this
        // safe to retry and prevents re-routing an already-assigned invoice.
        const updated = await sql`
            UPDATE invoices
            SET assigned_to = ${assigned_to},
                vendor_name = COALESCE(NULLIF(${vendor_name || null}, ''), vendor_name),
                amount = ${amountVal},
                invoice_date = ${invoice_date || null},
                site = ${site || null},
                status = 'Pending'
            WHERE id = ${id} AND status = 'Unassigned'
            RETURNING id, assigned_to, site, vendor_name, invoice_date, amount,
                      file_name, file_type, status, decision_reason, decided_by, decided_at,
                      gl_code, submitted_by, submitted_by_email, submitted_at,
                      source, sender_email, email_subject,
                      CASE WHEN file_data IS NOT NULL AND file_data != '' THEN true ELSE false END as has_file
        `;

        if (!updated.length) {
            // Either the id doesn't exist or it's no longer Unassigned.
            return { statusCode: 409, headers, body: JSON.stringify({ error: 'Invoice not found or already assigned' }) };
        }

        const invoice = updated[0];

        // Notify the assigned approver. Awaited so the Lambda doesn't freeze
        // before Resend responds; best-effort (never throws).
        try {
            const assignee = await findUserByName(sql, assigned_to);
            if (!assignee || !assignee.email) {
                console.warn(`[assign ${id}] no user row for "${assigned_to}" — skipping email`);
            } else {
                const { subject, text, html } = invoiceRequestEmail({
                    assigneeName: assignee.full_name,
                    invoice,
                    submitter: assigned_by || invoice.submitted_by,
                    publicUrl: process.env.PUBLIC_URL || 'https://mightyops.washlyfe.com'
                });
                const mailResult = await sendEmail({ to: assignee.email, subject, text, html });
                console.log(`[assign ${id}] email to ${assignee.email}:`, mailResult);
            }
        } catch (err) {
            console.error(`[assign ${id}] email dispatch failed:`, err);
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, invoice }) };
    } catch (error) {
        console.error('[assign] error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
