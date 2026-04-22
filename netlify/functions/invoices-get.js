// Get invoice approval records
const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('Database connection error:', dbError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    try {
        await sql`
            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                assigned_to TEXT NOT NULL,
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
        // Ensure new columns exist on older tables
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

        const invoices = await sql`
            SELECT
                id, assigned_to, vendor_name, invoice_date, amount,
                file_name, file_type, status, decision_reason, decided_by, decided_at,
                submitted_by, submitted_by_email, submitted_at,
                CASE WHEN file_data IS NOT NULL AND file_data != '' THEN true ELSE false END as has_file
            FROM invoices
            ORDER BY submitted_at DESC
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(invoices)
        };
    } catch (error) {
        console.error('Error fetching invoices:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
