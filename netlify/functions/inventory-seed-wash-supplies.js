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

    // Support both GET and POST
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);

        // WASH SUPPLIES data from spreadsheet
        const washSuppliesItems = [
            { brand: 'CAR WASH SUPERSTORE', item: 'Sponges' },
            { brand: 'CAR WASH SUPERSTORE', item: 'Spray Bottles' },
            { brand: 'CAR WASH SUPERSTORE', item: 'Spray Nozzles' },
            { brand: 'CAR WASH SUPERSTORE', item: 'Paper Matts' },
            { brand: 'CAR WASH SUPERSTORE', item: 'Towels' },
            { brand: 'CAR WASH SUPERSTORE', item: 'Wash Mitts' },
            { brand: 'CAR WASH SUPERSTORE', item: 'Wire Brushes' }
        ];

        const category = 'WASH SUPPLIES';

        // Insert all items
        const insertPromises = washSuppliesItems.map(({ brand, item }) =>
            sql`
                INSERT INTO inventory_items (category, brand, item)
                VALUES (${category}, ${brand}, ${item})
                ON CONFLICT (category, brand, item) DO NOTHING
            `
        );

        await Promise.all(insertPromises);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: `Seeded ${washSuppliesItems.length} items for ${category}`,
                count: washSuppliesItems.length
            })
        };
    } catch (error) {
        console.error('Error seeding wash supplies data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
