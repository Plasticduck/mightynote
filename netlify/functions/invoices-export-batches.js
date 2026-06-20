// List past QuickBooks export batches (for the EXPORTED tab), or re-download one.
//   GET                -> list of batches (no CSV payload)
//   GET ?id=<batchId>  -> that batch's CSV + metadata; bumps the re-export
//                         counter so the dashboard can warn about duplicates.
// Accounting/admin only.

const { neon } = require('@neondatabase/serverless');
const { ensureExportBatchesSchema } = require('./_lib-invoices');
const { requireAuth } = require('./_lib-auth');
const { canManageInbox } = require('./_lib-roles');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    const auth = requireAuth(event, headers, { check: canManageInbox });
    if (auth.error) return auth.error;
    const user = auth.user;

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('[export-batches] DB connection error:', dbError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    try {
        await ensureExportBatchesSchema(sql);

        const id = event.queryStringParameters && event.queryStringParameters.id;

        // Re-download a specific batch (records the re-export for the dup warning).
        if (id) {
            const now = new Date().toISOString();
            const rows = await sql`
                UPDATE export_batches
                SET export_count = export_count + 1,
                    last_exported_by = ${user.full_name},
                    last_exported_at = ${now}
                WHERE id = ${id}
                RETURNING id, file_name, invoice_count, total_amount, csv_data,
                          exported_by, exported_at, last_exported_by, last_exported_at, export_count
            `;
            if (!rows.length) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Batch not found' }) };
            }
            return { statusCode: 200, headers, body: JSON.stringify(rows[0]) };
        }

        // List batches (omit csv_data to keep the payload light).
        const batches = await sql`
            SELECT id, file_name, invoice_count, total_amount,
                   exported_by, exported_at, last_exported_by, last_exported_at, export_count
            FROM export_batches
            ORDER BY exported_at DESC
        `;
        return { statusCode: 200, headers, body: JSON.stringify(batches) };
    } catch (error) {
        console.error('[export-batches] error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
