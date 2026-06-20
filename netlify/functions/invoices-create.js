// Create an invoice. Manually-submitted invoices enter the workflow as
// 'Unassigned' (the same entry point as emailed-in invoices), so Accounting
// confirms the site(s)/approver(s) and runs them through the queue. The site /
// approver chosen on the submit form are stored as pre-fill hints. No approver
// email is sent here — that happens when Accounting submits the queue.
const { neon } = require('@neondatabase/serverless');
const { ensureInvoicesSchema } = require('./_lib-invoices');
const { requireAuth } = require('./_lib-auth');

let tableInitialized = false;

function asCleanArray(v) {
    if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
    if (typeof v === 'string' && v.trim()) return [v.trim()];
    return [];
}

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

    // Any signed-in user may submit an invoice. The submitter identity is taken
    // from the verified token below, not from the request body, so it can't be
    // spoofed.
    const auth = requireAuth(event, headers);
    if (auth.error) return auth.error;
    const user = auth.user;

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('Database connection error:', dbError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    try {
        if (!tableInitialized) {
            await ensureInvoicesSchema(sql);
            tableInitialized = true;
        }
    } catch (tableError) {
        console.error('Table creation error:', tableError);
    }

    try {
        const data = JSON.parse(event.body);

        if (!data.vendor_name) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'vendor_name is required' })
            };
        }

        // Submitter is the authenticated user — never trust client-supplied
        // submitted_by / submitted_by_email.
        const submittedBy = user.full_name;
        const submittedByEmail = user.email || null;

        // Site / approver from the form are stored as hints for Accounting.
        const sites = asCleanArray(data.sites != null ? data.sites : data.site);
        const approvers = asCleanArray(data.approvers != null ? data.approvers : data.assigned_to);

        const result = await sql`
            INSERT INTO invoices (
                assigned_to, approvers, site, sites, vendor_name, invoice_date, amount,
                file_data, file_name, file_type,
                status, source, submitted_by, submitted_by_email, submitted_at
            )
            VALUES (
                ${approvers.length ? approvers.join(', ') : null},
                ${approvers.length ? approvers : null},
                ${sites.length ? sites.join(', ') : null},
                ${sites.length ? sites : null},
                ${data.vendor_name},
                ${data.invoice_date || null},
                ${data.amount || null},
                ${data.file_data || null},
                ${data.file_name || null},
                ${data.file_type || null},
                'Unassigned',
                'manual',
                ${submittedBy},
                ${submittedByEmail},
                ${data.submitted_at || new Date().toISOString()}
            )
            RETURNING id
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, id: result[0].id, status: 'Unassigned' })
        };
    } catch (error) {
        console.error('Error creating invoice:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
