// Return the file_data (base64 data URI) for a single invoice.
// Side effect: records the caller in viewed_by[] if they're an assigned
// approver, which is what enforces "must view before approving/denying".
const { neon } = require('@neondatabase/serverless');
const { requireAuth } = require('./_lib-auth');
const { canViewInvoice, isAssignedApprover, nameInList } = require('./_lib-roles');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Must be signed in, and may only view a file on an invoice they're allowed
    // to see (assigned to / submitted by them, or accounting/admin).
    const auth = requireAuth(event, headers);
    if (auth.error) return auth.error;
    const user = auth.user;

    const id = event.queryStringParameters && event.queryStringParameters.id;
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const rows = await sql`
            SELECT file_data, file_name, file_type,
                   assigned_to, approvers, viewed_by, submitted_by, submitted_by_email
            FROM invoices
            WHERE id = ${id}
        `;
        if (!rows.length) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
        }
        const row = rows[0];
        if (!canViewInvoice(user, row)) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'You do not have access to this invoice.' }) };
        }

        // Record the view for assigned approvers (idempotent) so the decision
        // endpoint can require it. Doesn't apply to accounting/admin viewers.
        if (isAssignedApprover(user, row) && !nameInList(user.full_name, row.viewed_by)) {
            try {
                await sql`
                    UPDATE invoices
                    SET viewed_by = array_append(COALESCE(viewed_by, '{}'::text[]), ${user.full_name})
                    WHERE id = ${id}
                `;
            } catch (e) {
                console.error('[view-file] failed to record view:', e.message);
            }
        }

        const { file_data, file_name, file_type } = row;
        return { statusCode: 200, headers, body: JSON.stringify({ file_data, file_name, file_type }) };
    } catch (error) {
        console.error('Error fetching invoice file:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
