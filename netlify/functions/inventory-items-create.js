const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const data = JSON.parse(event.body);

        const { category, brand, item } = data;

        if (!category || !brand || !item) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Missing required fields' })
            };
        }

        // Insert or ignore if duplicate
        const result = await sql`
            INSERT INTO inventory_items (category, brand, item)
            VALUES (${category}, ${brand}, ${item})
            ON CONFLICT (category, brand, item) DO NOTHING
            RETURNING id, category, brand, item
        `;

        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ success: true, item: result[0] || { category, brand, item } })
        };
    } catch (error) {
        console.error('Error creating inventory item:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
