// Scheduled poller for the payables@washlyfe.com Microsoft 365 shared mailbox.
// Runs on a cron schedule (see netlify.toml). Uses Microsoft Graph app-only
// (client-credentials) auth to read unread messages that have attachments,
// imports each PDF/image attachment as an "Unassigned" invoice (via the shared
// _lib-invoice-intake helper), then marks the message read so it's not re-imported.
//
// Required Netlify env vars:
//   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET  — Azure app registration
//   PAYABLES_MAILBOX   — e.g. payables@washlyfe.com
//   NETLIFY_DATABASE_URL — (already set) Neon connection string

const { neon } = require('@neondatabase/serverless');
const { createInboundInvoices } = require('./_lib-invoice-intake');

const GRAPH = 'https://graph.microsoft.com/v1.0';
const MAX_MESSAGES_PER_RUN = 25;

async function getGraphToken() {
    const tenant = process.env.GRAPH_TENANT_ID;
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: 'POST',
        body: new URLSearchParams({
            client_id: process.env.GRAPH_CLIENT_ID,
            client_secret: process.env.GRAPH_CLIENT_SECRET,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials'
        })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Graph token error ${res.status}: ${data.error_description || data.error || 'unknown'}`);
    }
    return data.access_token;
}

async function graphGet(token, url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(`Graph GET ${url} → ${res.status}: ${JSON.stringify(data.error || data)}`);
    return data;
}

exports.handler = async () => {
    const required = ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'PAYABLES_MAILBOX', 'NETLIFY_DATABASE_URL'];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
        console.error('[poll] missing env vars:', missing.join(', '));
        return { statusCode: 200, body: `skipped — missing env: ${missing.join(', ')}` };
    }

    const mailbox = encodeURIComponent(process.env.PAYABLES_MAILBOX);
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    let token;
    try {
        token = await getGraphToken();
    } catch (err) {
        console.error('[poll]', err.message);
        return { statusCode: 200, body: 'token error' };
    }

    // Unread messages that have attachments. ($orderby is omitted on purpose —
    // Graph rejects it combined with this $filter without an index.)
    const listUrl = `${GRAPH}/users/${mailbox}/mailFolders/inbox/messages`
        + `?$filter=${encodeURIComponent('isRead eq false and hasAttachments eq true')}`
        + `&$select=id,subject,from,internetMessageId&$top=${MAX_MESSAGES_PER_RUN}`;

    let messages;
    try {
        const data = await graphGet(token, listUrl);
        messages = data.value || [];
    } catch (err) {
        console.error('[poll]', err.message);
        return { statusCode: 200, body: 'list error' };
    }

    let imported = 0;
    for (const msg of messages) {
        try {
            const attData = await graphGet(token, `${GRAPH}/users/${mailbox}/messages/${msg.id}/attachments`);
            const attachments = (attData.value || [])
                .filter((a) => a['@odata.type'] === '#microsoft.graph.fileAttachment' && !a.isInline && a.contentBytes)
                .map((a) => ({ filename: a.name, contentType: a.contentType, base64: a.contentBytes }));

            const { created, skipped } = await createInboundInvoices(sql, {
                from: (msg.from && msg.from.emailAddress && msg.from.emailAddress.address) || '',
                subject: msg.subject || '',
                messageId: msg.internetMessageId || msg.id,
                attachments
            });
            imported += created.length;
            console.log(`[poll] msg "${msg.subject}" → created ${created.length}, skipped ${skipped.length}`);

            // Mark read so we don't re-process it next run.
            const patch = await fetch(`${GRAPH}/users/${mailbox}/messages/${msg.id}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ isRead: true })
            });
            if (!patch.ok) console.error(`[poll] failed to mark message ${msg.id} read: ${patch.status}`);
        } catch (err) {
            // One bad message shouldn't abort the whole run; leave it unread to retry.
            console.error(`[poll] error on message ${msg.id}:`, err.message);
        }
    }

    console.log(`[poll] done — ${messages.length} message(s) checked, ${imported} invoice(s) imported`);
    return { statusCode: 200, body: `checked ${messages.length}, imported ${imported}` };
};
