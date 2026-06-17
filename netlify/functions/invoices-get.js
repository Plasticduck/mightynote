// Get invoice approval records
const { neon } = require('@neondatabase/serverless');
const { ensureInvoicesSchema } = require('./_lib-invoices');

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
        await ensureInvoicesSchema(sql);

        const invoices = await sql`
            SELECT
                id, assigned_to, site, vendor_name, invoice_date, amount,
                file_name, file_type, status, decision_reason, decided_by, decided_at,
                gl_code, submitted_by, submitted_by_email, submitted_at,
                source, sender_email, email_subject,
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
