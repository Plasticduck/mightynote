// Shared schema management for the `invoices` table and the `export_batches`
// table. Centralizes the CREATE TABLE + incremental column migrations so every
// endpoint sees an identical, up-to-date schema. Files prefixed with _ are
// helpers, not exposed as endpoints.
//
// Workflow / status model (see docs/invoice-workflow.md):
//   Unassigned  -> emailed in, not yet assigned                (UNASSIGNED tab)
//   Queued      -> accounting set site(s)+approver(s), in queue (QUEUE tab, accounting only)
//   Assigned    -> queue submitted, approvers notified         (ASSIGNED tab)
//   Approved    -> one approver approved                       (APPROVED tab)
//   Exported    -> included in a QuickBooks CSV export batch    (EXPORTED tab)
//   NeedsAttention -> an approver denied it                    (NEEDS ATTENTION tab)
//   Cancelled   -> accounting/admin cancelled it               (CANCELLED tab)

// Ensures the invoices table exists and has every column the app expects.
// Safe to call on every request — all operations are idempotent.
async function ensureInvoicesSchema(sql) {
    await sql`
        CREATE TABLE IF NOT EXISTS invoices (
            id SERIAL PRIMARY KEY,
            assigned_to TEXT,
            vendor_name TEXT NOT NULL,
            invoice_date DATE,
            amount NUMERIC(12, 2),
            file_data TEXT,
            file_name TEXT,
            file_type TEXT,
            status TEXT DEFAULT 'Pending',
            decision_reason TEXT,
            decided_by TEXT,
            decided_at TIMESTAMP WITH TIME ZONE,
            submitted_by TEXT,
            submitted_by_email TEXT,
            submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    `;

    // Add any column missing on older tables.
    const ensureCol = async (col, ddl) => {
        const exists = await sql`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'invoices' AND column_name = ${col}
        `;
        if (!exists.length) await sql(`ALTER TABLE invoices ADD COLUMN ${col} ${ddl}`);
    };

    await ensureCol('decision_reason', 'TEXT');
    await ensureCol('decided_by', 'TEXT');
    await ensureCol('decided_at', 'TIMESTAMP WITH TIME ZONE');
    await ensureCol('submitted_by_email', 'TEXT');
    await ensureCol('gl_code', 'TEXT');
    await ensureCol('site', 'TEXT');

    // Email-intake columns (invoices forwarded to payables@washlyfe.com).
    await ensureCol('source', "TEXT DEFAULT 'manual'");   // 'manual' | 'email'
    await ensureCol('sender_email', 'TEXT');
    await ensureCol('email_subject', 'TEXT');
    await ensureCol('email_message_id', 'TEXT');

    // --- Multi-site / multi-approver workflow ---------------------------------
    // sites[] / approvers[] supersede the legacy single site / assigned_to
    // columns (which are still written, joined, for backward compatibility).
    await ensureCol('sites', 'TEXT[]');
    await ensureCol('approvers', 'TEXT[]');
    // Approvers who have opened the invoice file — enforces "must view before
    // approving/denying".
    await ensureCol('viewed_by', 'TEXT[]');

    // Queue lifecycle.
    await ensureCol('queued_by', 'TEXT');
    await ensureCol('queued_at', 'TIMESTAMP WITH TIME ZONE');
    await ensureCol('queue_submitted_at', 'TIMESTAMP WITH TIME ZONE');

    // Export lifecycle.
    await ensureCol('exported_at', 'TIMESTAMP WITH TIME ZONE');
    await ensureCol('export_batch_id', 'INTEGER');
    // Cached AI-extracted QuickBooks fields, so re-export doesn't re-call the model.
    await ensureCol('ai_extract', 'JSONB');

    // Cancellation.
    await ensureCol('cancelled_by', 'TEXT');
    await ensureCol('cancelled_at', 'TIMESTAMP WITH TIME ZONE');

    // Inbound invoices arrive with no assignee yet (status='Unassigned'),
    // so assigned_to must be nullable. Older tables created it NOT NULL.
    try {
        await sql`ALTER TABLE invoices ALTER COLUMN assigned_to DROP NOT NULL`;
    } catch (e) {
        // Already nullable, or insufficient privileges — non-fatal.
        console.error('ensureInvoicesSchema: drop NOT NULL on assigned_to failed', e.message);
    }
}

// Records of QuickBooks CSV exports. The generated CSV is stored so a batch can
// be re-downloaded byte-identical, and so the dashboard can warn that a batch
// was already exported (re-importing would create duplicate bills).
async function ensureExportBatchesSchema(sql) {
    await sql`
        CREATE TABLE IF NOT EXISTS export_batches (
            id SERIAL PRIMARY KEY,
            file_name TEXT NOT NULL,
            invoice_ids INTEGER[] NOT NULL,
            invoice_count INTEGER NOT NULL DEFAULT 0,
            total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
            csv_data TEXT,
            exported_by TEXT,
            exported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_exported_by TEXT,
            last_exported_at TIMESTAMP WITH TIME ZONE,
            export_count INTEGER NOT NULL DEFAULT 1
        )
    `;
}

module.exports = { ensureInvoicesSchema, ensureExportBatchesSchema };
