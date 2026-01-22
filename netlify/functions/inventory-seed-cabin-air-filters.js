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

        // CABIN AIR FILTERS data from spreadsheet
        const cabinAirFiltersItems = [
            { brand: 'B-LINE', item: 'CF2150' },
            { brand: 'B-LINE', item: 'CF1185' },
            { brand: 'B-LINE', item: 'CF25858' },
            { brand: 'B-LINE', item: 'CFFP92' }
        ];

        const category = 'CABIN AIR FILTERS';

        // Insert all items
        const insertPromises = cabinAirFiltersItems.map(({ brand, item }) =>
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
                message: `Seeded ${cabinAirFiltersItems.length} items for ${category}`,
                count: cabinAirFiltersItems.length
            })
        };
    } catch (error) {
        console.error('Error seeding cabin air filters data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
