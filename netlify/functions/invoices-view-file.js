// Return the file_data (base64 data URI) for a single invoice
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

    const id = event.queryStringParameters && event.queryStringParameters.id;
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const rows = await sql`
            SELECT file_data, file_name, file_type
            FROM invoices
            WHERE id = ${id}
        `;
        if (!rows.length) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
        }
        return { statusCode: 200, headers, body: JSON.stringify(rows[0]) };
    } catch (error) {
        console.error('Error fetching invoice file:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
