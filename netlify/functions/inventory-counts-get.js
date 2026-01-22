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
        const date = params.date; // Optional: filter by date

        let query;
        
        if (category && date) {
            query = sql`
                SELECT id, category, brand, item, quantity, submitted_by, created_at
                FROM inventory_counts
                WHERE category = ${category} AND DATE(created_at) = ${date}
                ORDER BY brand ASC, item ASC
            `;
        } else if (category) {
            query = sql`
                SELECT id, category, brand, item, quantity, submitted_by, created_at
                FROM inventory_counts
                WHERE category = ${category}
                ORDER BY created_at DESC, brand ASC, item ASC
            `;
        } else if (date) {
            query = sql`
                SELECT id, category, brand, item, quantity, submitted_by, created_at
                FROM inventory_counts
                WHERE DATE(created_at) = ${date}
                ORDER BY category ASC, brand ASC, item ASC
            `;
        } else {
            // Get latest counts grouped by category, brand, item (most recent count for each)
            query = sql`
                SELECT DISTINCT ON (category, brand, item)
                    id, category, brand, item, quantity, submitted_by, created_at
                FROM inventory_counts
                ORDER BY category, brand, item, created_at DESC
            `;
        }

        const counts = await query;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, counts })
        };
    } catch (error) {
        console.error('Error fetching inventory counts:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
