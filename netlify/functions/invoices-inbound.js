// Inbound email intake HTTP endpoint.
// Lets an external email parser (e.g. a Cloudflare Email Worker) POST a parsed
// invoice email; each PDF/image attachment becomes one "Unassigned" invoice in
// the dashboard Inbox. The actual row creation lives in _lib-invoice-intake.js
// so the scheduled M365/Graph poller (poll-payables-mailbox.js) shares it.
//
// Auth: requires the X-Inbound-Secret header to match INBOUND_EMAIL_SECRET.
// (All other invoice endpoints are open + CORS '*', so this gate matters — it's
// the only thing standing between the public internet and invoice creation.)

const { neon } = require('@neondatabase/serverless');
const { createInboundInvoices } = require('./_lib-invoice-intake');

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
        const data = JSON.parse(event.body || '{}');
        const { created, skipped } = await createInboundInvoices(sql, {
            from: data.from,
            subject: data.subject,
            messageId: data.message_id,
            attachments: data.attachments
        });

        console.log(`[inbound] from=${data.from} subject="${data.subject}" created=${created.length} skipped=${skipped.length}`);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, created, skipped }) };
    } catch (error) {
        console.error('[inbound] error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
