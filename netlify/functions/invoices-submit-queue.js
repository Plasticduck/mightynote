// Submit the queue: flip every Queued invoice to Assigned and email each
// approver ONE summary of all invoices now awaiting their review.
//
// Accounting builds up the queue during the day (invoices-assign sets status
// 'Queued') and calls this once — typically end of day. Optionally a subset of
// queued ids can be passed; otherwise all Queued invoices are submitted.

const { neon } = require('@neondatabase/serverless');
const { ensureInvoicesSchema } = require('./_lib-invoices');
const { requireAuth } = require('./_lib-auth');
const { canManageInbox, namesMatch } = require('./_lib-roles');
const { findUserByName } = require('./_lib-users');
const { sendEmail, invoiceQueueSummaryEmail } = require('./_lib-email');

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
        console.error('[submit-queue] DB connection error:', dbError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    try {
        await ensureInvoicesSchema(sql);
        const data = JSON.parse(event.body || '{}');
        const ids = Array.isArray(data.ids) ? data.ids.map(Number).filter((n) => !Number.isNaN(n)) : null;

        const now = new Date().toISOString();

        // Flip Queued -> Assigned. The status guard makes this idempotent.
        const submitted = ids && ids.length
            ? await sql`
                UPDATE invoices
                SET status = 'Assigned', queue_submitted_at = ${now}
                WHERE status = 'Queued' AND id = ANY(${ids}::int[])
                RETURNING id, vendor_name, amount, sites, approvers, invoice_date
              `
            : await sql`
                UPDATE invoices
                SET status = 'Assigned', queue_submitted_at = ${now}
                WHERE status = 'Queued'
                RETURNING id, vendor_name, amount, sites, approvers, invoice_date
              `;

        if (!submitted.length) {
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, submitted: 0, emails: [] }) };
        }

        // Group invoices by approver name so each approver gets one email.
        const byApprover = new Map(); // approverName -> invoice[]
        for (const inv of submitted) {
            const approvers = Array.isArray(inv.approvers) ? inv.approvers : [];
            for (const name of approvers) {
                if (!byApprover.has(name)) byApprover.set(name, []);
                byApprover.get(name).push(inv);
            }
        }

        const publicUrl = process.env.PUBLIC_URL || 'https://mightyops.washlyfe.com';
        const emails = [];
        for (const [approverName, invoices] of byApprover.entries()) {
            try {
                const approver = await findUserByName(sql, approverName);
                if (!approver || !approver.email) {
                    console.warn(`[submit-queue] no email for approver "${approverName}" — skipping`);
                    emails.push({ approver: approverName, sent: false, reason: 'no_email' });
                    continue;
                }
                const { subject, text, html } = invoiceQueueSummaryEmail({
                    approverName: approver.full_name,
                    invoices,
                    publicUrl
                });
                const res = await sendEmail({ to: approver.email, subject, text, html });
                emails.push({ approver: approverName, sent: !!res.sent, count: invoices.length });
            } catch (err) {
                console.error(`[submit-queue] email to "${approverName}" failed:`, err.message);
                emails.push({ approver: approverName, sent: false, reason: 'error' });
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, submitted: submitted.length, emails })
        };
    } catch (error) {
        console.error('[submit-queue] error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
