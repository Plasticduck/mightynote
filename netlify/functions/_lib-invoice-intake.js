// Shared invoice email-intake logic, used by BOTH:
//   - invoices-inbound.js     (HTTP endpoint, e.g. a Cloudflare Email Worker POSTs to it)
//   - poll-payables-mailbox.js (scheduled M365/Graph poller)
// so the two intake paths create identical "Unassigned" invoice rows.
// Files prefixed with _ are helpers, not exposed as endpoints.

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

// Create one Unassigned invoice per qualifying attachment for a single email.
//   payload = { from, subject, messageId, attachments: [{ filename, contentType, base64 }] }
// Returns { created: [ids], skipped: [{file_name, reason}] }. Idempotent on
// (email_message_id, file_name) so re-delivery / re-polling won't duplicate rows.
async function createInboundInvoices(sql, payload) {
    await ensureInvoicesSchema(sql);

    const from = (payload.from || '').toString().slice(0, 320) || null;
    const subject = (payload.subject || '').toString().slice(0, 500) || null;
    const messageId = (payload.messageId || '').toString().slice(0, 500) || null;
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

    // Placeholder vendor name (vendor_name is NOT NULL). Edited at assign time.
    const placeholderVendor = (subject || from || 'Emailed invoice').toString().slice(0, 300);
    const submittedAt = new Date().toISOString();

    const docs = attachments.filter((a) => isInvoiceAttachment(a && a.contentType));
    const created = [];
    const skipped = [];

    const insertRow = async ({ fileData, fileName, fileType }) => {
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
        // No usable attachment — still create a visible (fileless) row.
        await insertRow({ fileData: null, fileName: null, fileType: null });
    } else {
        for (const a of docs) {
            const bytes = base64Bytes(a.base64);
            if (!a.base64) {
                skipped.push({ file_name: a.filename, reason: 'empty' });
                continue;
            }
            if (bytes > MAX_ATTACHMENT_BYTES) {
                console.warn(`[intake] skipping oversized attachment ${a.filename} (${bytes} bytes)`);
                skipped.push({ file_name: a.filename, reason: 'too_large' });
                continue;
            }
            await insertRow({
                fileData: `data:${a.contentType};base64,${a.base64}`,
                fileName: a.filename || 'invoice',
                fileType: a.contentType
            });
        }
        // Every attachment was oversized/empty (and none were duplicates) →
        // still record one fileless row so the email isn't silently dropped.
        if (created.length === 0 && skipped.every((s) => s.reason !== 'duplicate')) {
            await insertRow({ fileData: null, fileName: null, fileType: null });
        }
    }

    return { created, skipped };
}

module.exports = { createInboundInvoices, isInvoiceAttachment, base64Bytes };
