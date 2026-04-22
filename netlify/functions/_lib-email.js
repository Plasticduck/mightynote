// Shared Resend email helper. Best-effort: errors are logged but never thrown
// to callers so we don't fail the main action (invoice save / approval) on
// email hiccups. Files prefixed with _ are helpers, not endpoints.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, html, text, replyTo }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.INVOICE_FROM_EMAIL || 'onboarding@resend.dev';

    if (!apiKey) {
        console.warn('[email] RESEND_API_KEY not set — skipping email to', to);
        return { sent: false, reason: 'no_api_key' };
    }
    if (!to) {
        console.warn('[email] no recipient — skipping');
        return { sent: false, reason: 'no_recipient' };
    }

    const body = {
        from: from.includes('<') ? from : `MightyOps <${from}>`,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text
    };
    if (replyTo) body.reply_to = replyTo;

    try {
        const res = await fetch(RESEND_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error('[email] Resend error', res.status, data);
            return { sent: false, reason: data.message || `http_${res.status}` };
        }
        return { sent: true, id: data.id };
    } catch (err) {
        console.error('[email] network error', err);
        return { sent: false, reason: 'network_error' };
    }
}

function money(n) {
    const num = parseFloat(n);
    if (isNaN(num)) return '$0.00';
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s) {
    if (!s) return 'N/A';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function invoiceRequestEmail({ assigneeName, invoice, submitter, publicUrl }) {
    const subject = `Invoice approval needed — ${invoice.vendor_name} ${money(invoice.amount)}`;
    const dashboardLink = `${publicUrl}/invoice-approvals-dashboard.html`;
    const greeting = assigneeName ? `Hi ${assigneeName.split(' ')[0]},` : 'Hi,';

    const text = [
        greeting,
        '',
        `${submitter || 'A team member'} submitted an invoice that requires your approval.`,
        '',
        invoice.site ? `Site:    ${invoice.site}` : '',
        `Vendor:  ${invoice.vendor_name}`,
        `Date:    ${fmtDate(invoice.invoice_date)}`,
        `Amount:  ${money(invoice.amount)}`,
        '',
        `Review and approve/reject here: ${dashboardLink}`,
        '',
        '— MightyOps'
    ].filter(Boolean).join('\n');

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
            <div style="padding: 24px 24px 16px; border-bottom: 1px solid #e5e7eb;">
                <h2 style="margin: 0; font-size: 20px; letter-spacing: -0.02em;">Invoice awaiting your approval</h2>
                <p style="margin: 6px 0 0; color: #64748b; font-size: 14px;">Submitted by ${escapeHtml(submitter || 'a team member')}</p>
            </div>
            <div style="padding: 20px 24px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
                    ${invoice.site ? `<tr><td style="padding: 6px 0; color: #64748b; width: 120px;">Site</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(invoice.site)}</td></tr>` : ''}
                    <tr><td style="padding: 6px 0; color: #64748b; width: 120px;">Vendor</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(invoice.vendor_name)}</td></tr>
                    <tr><td style="padding: 6px 0; color: #64748b;">Invoice date</td><td style="padding: 6px 0;">${fmtDate(invoice.invoice_date)}</td></tr>
                    <tr><td style="padding: 6px 0; color: #64748b;">Amount</td><td style="padding: 6px 0; font-weight: 700; color: #0a84ff;">${money(invoice.amount)}</td></tr>
                </table>
                <div style="margin-top: 24px;">
                    <a href="${dashboardLink}" style="display: inline-block; background: #0a84ff; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 15px;">Open Invoice Dashboard</a>
                </div>
            </div>
            <div style="padding: 12px 24px 22px; color: #94a3b8; font-size: 12px;">
                MightyOps · Invoice Approval
            </div>
        </div>
    `;

    return { subject, text, html };
}

function invoiceDecisionEmail({ submitterName, approverName, invoice, status, reason, glCode, publicUrl }) {
    const decision = status === 'Approved' ? 'approved' : 'rejected';
    const subject = `Invoice ${decision} — ${invoice.vendor_name} ${money(invoice.amount)}`;
    const dashboardLink = `${publicUrl}/invoice-approvals-dashboard.html`;
    const greeting = submitterName ? `Hi ${submitterName.split(' ')[0]},` : 'Hi,';
    const color = status === 'Approved' ? '#30d158' : '#ff453a';

    const text = [
        greeting,
        '',
        `${approverName || 'An approver'} has ${decision} your invoice.`,
        '',
        `Vendor:  ${invoice.vendor_name}`,
        `Date:    ${fmtDate(invoice.invoice_date)}`,
        `Amount:  ${money(invoice.amount)}`,
        `Status:  ${status}`,
        glCode ? `GL Code: ${glCode}` : '',
        reason ? `Notes:   ${reason}` : '',
        '',
        `View in dashboard: ${dashboardLink}`
    ].filter(Boolean).join('\n');

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
            <div style="padding: 24px 24px 16px; border-bottom: 1px solid #e5e7eb;">
                <h2 style="margin: 0; font-size: 20px; letter-spacing: -0.02em;">Invoice ${decision}</h2>
                <p style="margin: 6px 0 0; color: #64748b; font-size: 14px;">by ${escapeHtml(approverName || 'an approver')}</p>
            </div>
            <div style="padding: 20px 24px;">
                <div style="display: inline-block; padding: 4px 14px; border-radius: 999px; background: ${color}22; color: ${color}; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 14px;">${status}</div>
                <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
                    <tr><td style="padding: 6px 0; color: #64748b; width: 120px;">Vendor</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(invoice.vendor_name)}</td></tr>
                    <tr><td style="padding: 6px 0; color: #64748b;">Invoice date</td><td style="padding: 6px 0;">${fmtDate(invoice.invoice_date)}</td></tr>
                    <tr><td style="padding: 6px 0; color: #64748b;">Amount</td><td style="padding: 6px 0; font-weight: 700;">${money(invoice.amount)}</td></tr>
                    ${glCode ? `<tr><td style="padding: 6px 0; color: #64748b;">GL Code</td><td style="padding: 6px 0; font-family: 'SF Mono', Menlo, monospace;">${escapeHtml(glCode)}</td></tr>` : ''}
                    ${reason ? `<tr><td style="padding: 6px 0; color: #64748b;">Notes</td><td style="padding: 6px 0;">${escapeHtml(reason)}</td></tr>` : ''}
                </table>
                <div style="margin-top: 22px;">
                    <a href="${dashboardLink}" style="display: inline-block; background: #0a84ff; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px;">Open Dashboard</a>
                </div>
            </div>
        </div>
    `;

    return { subject, text, html };
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

module.exports = { sendEmail, invoiceRequestEmail, invoiceDecisionEmail };
