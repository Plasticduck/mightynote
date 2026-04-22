// Create invoice approval record + email the assignee
const { neon } = require('@neondatabase/serverless');
const { findUserByName } = require('./_lib-users');
const { sendEmail, invoiceRequestEmail } = require('./_lib-email');

let tableInitialized = false;

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('Database connection error:', dbError);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    try {
        if (!tableInitialized) {
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
            // Add columns to existing tables if they don't exist
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
            tableInitialized = true;
        }
    } catch (tableError) {
        console.error('Table creation error:', tableError);
    }

    try {
        const data = JSON.parse(event.body);

        if (!data.assigned_to || !data.vendor_name) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'assigned_to and vendor_name are required' })
            };
        }

        const result = await sql`
            INSERT INTO invoices (
                assigned_to, vendor_name, invoice_date, amount,
                file_data, file_name, file_type,
                submitted_by, submitted_by_email, submitted_at
            )
            VALUES (
                ${data.assigned_to},
                ${data.vendor_name},
                ${data.invoice_date || null},
                ${data.amount || null},
                ${data.file_data || null},
                ${data.file_name || null},
                ${data.file_type || null},
                ${data.submitted_by || null},
                ${data.submitted_by_email || null},
                ${data.submitted_at || new Date().toISOString()}
            )
            RETURNING id
        `;

        const invoiceId = result[0].id;

        // Fire email to assignee (best-effort — never blocks response)
        (async () => {
            try {
                const assignee = await findUserByName(sql, data.assigned_to);
                if (!assignee || !assignee.email) {
                    console.warn(`[invoice ${invoiceId}] no user row for "${data.assigned_to}" — skipping email`);
                    return;
                }
                const { subject, text, html } = invoiceRequestEmail({
                    assigneeName: assignee.full_name,
                    invoice: data,
                    submitter: data.submitted_by,
                    publicUrl: process.env.PUBLIC_URL || 'https://mightyops.washlyfe.com'
                });
                await sendEmail({
                    to: assignee.email,
                    subject, text, html,
                    replyTo: data.submitted_by_email || undefined
                });
            } catch (err) {
                console.error(`[invoice ${invoiceId}] email dispatch failed:`, err);
            }
        })();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, id: invoiceId })
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
