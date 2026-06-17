// Shared schema management for the `invoices` table.
// Centralizes the CREATE TABLE + incremental column migrations that were
// previously duplicated in invoices-get.js and invoices-create.js, so every
// endpoint (get / create / inbound / assign) sees an identical, up-to-date
// schema. Files prefixed with _ are helpers, not exposed as endpoints.

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

    // Inbound invoices arrive with no assignee yet (status='Unassigned'),
    // so assigned_to must be nullable. Older tables created it NOT NULL.
    try {
        await sql`ALTER TABLE invoices ALTER COLUMN assigned_to DROP NOT NULL`;
    } catch (e) {
        // Already nullable, or insufficient privileges — non-fatal.
        console.error('ensureInvoicesSchema: drop NOT NULL on assigned_to failed', e.message);
    }
}

module.exports = { ensureInvoicesSchema };
