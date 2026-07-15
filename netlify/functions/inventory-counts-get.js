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
        const startDate = params.startDate; // Optional: filter from this date (inclusive)
        const endDate = params.endDate;     // Optional: filter to this date (inclusive)

        let counts;

        if (!category && !startDate && !endDate) {
            // Default view: latest count per item (most recent count for each)
            counts = await sql`
                SELECT DISTINCT ON (category, brand, item)
                    id, category, brand, item, quantity, submitted_by, created_at
                FROM inventory_counts
                ORDER BY category, brand, item, created_at DESC
            `;
        } else {
            // Build a filtered query from whichever filters are present.
            const conditions = [];
            const values = [];
            if (category) { values.push(category); conditions.push(`category = $${values.length}`); }
            if (startDate) { values.push(startDate); conditions.push(`DATE(created_at) >= $${values.length}`); }
            if (endDate) { values.push(endDate); conditions.push(`DATE(created_at) <= $${values.length}`); }

            const where = `WHERE ${conditions.join(' AND ')}`;
            // When filtering by category, show newest first; otherwise group by category.
            const orderBy = category
                ? 'ORDER BY created_at DESC, brand ASC, item ASC'
                : 'ORDER BY category ASC, brand ASC, item ASC';

            counts = await sql.query(
                `SELECT id, category, brand, item, quantity, submitted_by, created_at
                 FROM inventory_counts
                 ${where}
                 ${orderBy}`,
                values
            );
        }

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
