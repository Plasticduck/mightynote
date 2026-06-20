// Export all Approved (not-yet-exported) invoices to a QuickBooks Desktop CSV.
//
// For each invoice, AI-extracts the QuickBooks fields from the attached document
// (cached in invoices.ai_extract so re-runs don't re-call the model), builds the
// CSV, records an export_batch (storing the CSV so it can be re-downloaded), and
// flips the invoices to status='Exported'. Accounting/admin only.

const { neon } = require('@neondatabase/serverless');
const { ensureInvoicesSchema, ensureExportBatchesSchema } = require('./_lib-invoices');
const { requireAuth } = require('./_lib-auth');
const { canManageInbox } = require('./_lib-roles');
const { extractInvoiceFields } = require('./_lib-ai-extract');
const { buildCsv } = require('./_lib-quickbooks-csv');

// Cap per run so the function stays within Netlify's execution window — AI
// extraction is the slow part. Anything beyond this is left for the next run
// (and logged) rather than silently dropped.
const MAX_PER_EXPORT = 25;

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
    const user = auth.user;

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('[export] DB connection error:', dbError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    try {
        await ensureInvoicesSchema(sql);
        await ensureExportBatchesSchema(sql);

        // Approved invoices that haven't been exported yet, oldest first, with
        // file_data (needed for AI extraction).
        const invoices = await sql`
            SELECT id, vendor_name, amount, invoice_date, sites, site, gl_code,
                   file_data, file_name, file_type, ai_extract
            FROM invoices
            WHERE status = 'Approved' AND export_batch_id IS NULL
            ORDER BY decided_at ASC NULLS LAST, id ASC
            LIMIT ${MAX_PER_EXPORT}
        `;

        if (!invoices.length) {
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, exported: 0, message: 'No approved invoices to export.' }) };
        }

        // Extract fields (cached). Run in parallel — each is one model call.
        const aiById = {};
        await Promise.all(invoices.map(async (inv) => {
            if (inv.ai_extract) { aiById[inv.id] = inv.ai_extract; return; }
            const ai = await extractInvoiceFields(inv);
            if (ai) {
                aiById[inv.id] = ai;
                try {
                    await sql`UPDATE invoices SET ai_extract = ${JSON.stringify(ai)}::jsonb WHERE id = ${inv.id}`;
                } catch (e) {
                    console.error(`[export] cache ai_extract for ${inv.id} failed:`, e.message);
                }
            }
        }));

        const csv = buildCsv(invoices, aiById);
        const ids = invoices.map((i) => i.id);
        const total = invoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const now = new Date();
        const fileName = `AP_Batch_${now.toISOString().slice(0, 10)}.csv`;

        // Record the batch (stores the CSV for re-download / duplicate warning).
        const batchRows = await sql`
            INSERT INTO export_batches (
                file_name, invoice_ids, invoice_count, total_amount, csv_data,
                exported_by, exported_at, last_exported_by, last_exported_at, export_count
            )
            VALUES (
                ${fileName}, ${ids}, ${ids.length}, ${total}, ${csv},
                ${user.full_name}, ${now.toISOString()}, ${user.full_name}, ${now.toISOString()}, 1
            )
            RETURNING id, file_name, invoice_count, total_amount, exported_by, exported_at
        `;
        const batch = batchRows[0];

        // Move the invoices to the Exported tab.
        await sql`
            UPDATE invoices
            SET status = 'Exported', exported_at = ${now.toISOString()}, export_batch_id = ${batch.id}
            WHERE id = ANY(${ids}::int[])
        `;

        const aiUsed = Object.keys(aiById).length;
        console.log(`[export] batch ${batch.id}: ${ids.length} invoice(s), AI fields for ${aiUsed}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                exported: ids.length,
                ai_extracted: aiUsed,
                batch,
                file_name: fileName,
                csv
            })
        };
    } catch (error) {
        console.error('[export] error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
