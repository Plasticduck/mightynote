// Create invoice approval record
const { neon } = require('@neondatabase/serverless');

let tableInitialized = false;

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('Database connection error:', dbError);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Database connection failed' })
        };
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
                    submitted_by TEXT,
                    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `;
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
                submitted_by, submitted_at
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
                ${data.submitted_at || new Date().toISOString()}
            )
            RETURNING id
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, id: result[0].id })
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
