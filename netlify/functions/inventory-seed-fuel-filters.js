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

        // FUEL FILTERS data from spreadsheet
        const fuelFiltersItems = [
            { brand: 'SERVICE CHAMP', item: 'FF56083' },
            { brand: 'SERVICE CHAMP', item: 'FF56085' },
            { brand: 'SERVICE CHAMP', item: 'FF56088' },
            { brand: 'SERVICE CHAMP', item: 'FD46151' },
            { brand: 'SERVICE CHAMP', item: 'FD46241' },
            { brand: 'SERVICE CHAMP', item: 'LFF6012' },
            { brand: 'SERVICE CHAMP', item: '46174' }
        ];

        const category = 'FUEL FILTERS';

        // Insert all items
        const insertPromises = fuelFiltersItems.map(({ brand, item }) =>
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
                message: `Seeded ${fuelFiltersItems.length} items for ${category}`,
                count: fuelFiltersItems.length
            })
        };
    } catch (error) {
        console.error('Error seeding fuel filters data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
