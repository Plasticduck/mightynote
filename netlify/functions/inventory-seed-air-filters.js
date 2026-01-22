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

        // AIR FILTERS data from spreadsheet
        const airFiltersItems = [
            { brand: 'B-LINE', item: 'A3141' },
            { brand: 'B-LINE', item: 'A3248' },
            { brand: 'B-LINE', item: 'A3244' },
            { brand: 'B-LINE', item: 'A2883' },
            { brand: 'B-LINE', item: 'A8837' },
            { brand: 'B-LINE', item: 'A1950' },
            { brand: 'B-LINE', item: 'A2031' }
        ];

        const category = 'AIR FILTERS';

        // Insert all items
        const insertPromises = airFiltersItems.map(({ brand, item }) =>
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
                message: `Seeded ${airFiltersItems.length} items for ${category}`,
                count: airFiltersItems.length
            })
        };
    } catch (error) {
        console.error('Error seeding air filters data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
