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

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        
        const params = event.queryStringParameters || {};
        const category = params.category;
        const brand = params.brand;

        let query;
        
        if (category && brand) {
            // Get items for a specific category and brand
            query = sql`
                SELECT id, category, brand, item
                FROM inventory_items
                WHERE category = ${category} AND brand = ${brand}
                ORDER BY item ASC
            `;
        } else if (category) {
            // Get brands for a specific category
            query = sql`
                SELECT DISTINCT brand
                FROM inventory_items
                WHERE category = ${category}
                ORDER BY brand ASC
            `;
        } else {
            // Get all categories
            query = sql`
                SELECT DISTINCT category
                FROM inventory_items
                ORDER BY category ASC
            `;
        }

        const results = await query;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: results })
        };
    } catch (error) {
        console.error('Error fetching inventory items:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
