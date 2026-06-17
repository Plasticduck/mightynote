// Inbound email intake for payables@washlyfe.com.
// Called by the Cloudflare Email Worker (cloudflare/payables-worker) after it
// parses a forwarded invoice email. Each PDF/image attachment becomes one
// invoice row in the "Unassigned" state, which surfaces in the dashboard Inbox
// for Accounting/Admins to fill in and assign to an approver.
//
// Auth: requires the X-Inbound-Secret header to match INBOUND_EMAIL_SECRET.
// (All other invoice endpoints are open + CORS '*', so this gate matters — it's
// the only thing standing between the public internet and invoice creation.)

const { neon } = require('@neondatabase/serverless');
const { ensureInvoicesSchema } = require('./_lib-invoices');

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB per attachment

// Attachment content-types we treat as an invoice document.
function isInvoiceAttachment(contentType) {
    if (!contentType) return false;
    const t = contentType.toLowerCase();
    return t === 'application/pdf' || t.startsWith('image/');
}

// Approximate decoded byte size of a base64 string without allocating a Buffer.
function base64Bytes(b64) {
    if (!b64) return 0;
    const len = b64.length;
    const padding = b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0);
    return Math.floor((len * 3) / 4) - padding;
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Inbound-Secret',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // --- Shared-secret gate -------------------------------------------------
    const expected = process.env.INBOUND_EMAIL_SECRET;
    if (!expected) {
        console.error('[inbound] INBOUND_EMAIL_SECRET not configured');
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Inbound intake not configured' }) };
    }
    const provided = event.headers['x-inbound-secret'] || event.headers['X-Inbound-Secret'];
    if (provided !== expected) {
        console.warn('[inbound] rejected request with bad/missing secret');
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('[inbound] DB connection error:', dbError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    try {
        await ensureInvoicesSchema(sql);

        const data = JSON.parse(event.body || '{}');
        const from = (data.from || '').toString().slice(0, 320) || null;
        const subject = (data.subject || '').toString().slice(0, 500) || null;
        const messageId = (data.message_id || '').toString().slice(0, 500) || null;
        const attachments = Array.isArray(data.attachments) ? data.attachments : [];

        // Placeholder vendor name (vendor_name is NOT NULL). Edited at assign time.
        const placeholderVendor = (subject || from || 'Emailed invoice').toString().slice(0, 300);
        const submittedAt = new Date().toISOString();

        const docs = attachments.filter((a) => isInvoiceAttachment(a && a.contentType));
        const created = [];
        const skipped = [];

        const insertRow = async ({ fileData, fileName, fileType }) => {
            // Idempotency: Cloudflare may retry delivery. Skip a row we already
            // imported for this (message_id, file_name) pair.
            if (messageId) {
                const dup = await sql`
                    SELECT id FROM invoices
                    WHERE email_message_id = ${messageId}
                      AND COALESCE(file_name, '') = ${fileName || ''}
                    LIMIT 1
                `;
                if (dup.length) {
                    skipped.push({ file_name: fileName, reason: 'duplicate', id: dup[0].id });
                    return;
                }
            }
            const result = await sql`
                INSERT INTO invoices (
                    assigned_to, site, vendor_name, invoice_date, amount,
                    file_data, file_name, file_type,
                    status, source, sender_email, email_subject, email_message_id,
                    submitted_by, submitted_by_email, submitted_at
                )
                VALUES (
                    NULL, NULL, ${placeholderVendor}, NULL, NULL,
                    ${fileData}, ${fileName}, ${fileType},
                    'Unassigned', 'email', ${from}, ${subject}, ${messageId},
                    ${from}, ${from}, ${submittedAt}
                )
                RETURNING id
            `;
            created.push(result[0].id);
        };

        if (docs.length === 0) {
            // No usable attachment (invoice inline or linked). Still create a
            // visible row so nothing is silently dropped — just with no file.
            await insertRow({ fileData: null, fileName: null, fileType: null });
        } else {
            for (const a of docs) {
                const bytes = base64Bytes(a.base64);
                if (bytes > MAX_ATTACHMENT_BYTES) {
                    console.warn(`[inbound] skipping oversized attachment ${a.filename} (${bytes} bytes)`);
                    skipped.push({ file_name: a.filename, reason: 'too_large' });
                    continue;
                }
                if (!a.base64) {
                    skipped.push({ file_name: a.filename, reason: 'empty' });
                    continue;
                }
                await insertRow({
                    fileData: `data:${a.contentType};base64,${a.base64}`,
                    fileName: a.filename || 'invoice',
                    fileType: a.contentType
                });
            }
            // Every attachment was oversized/empty → still record one fileless row.
            if (created.length === 0 && skipped.every((s) => s.reason !== 'duplicate')) {
                await insertRow({ fileData: null, fileName: null, fileType: null });
            }
        }

        console.log(`[inbound] from=${from} subject="${subject}" created=${created.length} skipped=${skipped.length}`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, created, skipped })
        };
    } catch (error) {
        console.error('[inbound] error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
