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

        // WASH CHEMICALS data from spreadsheet
        const washChemicalsItems = [
            // ROBBIES
            { brand: 'ROBBIES', item: 'Tire Shine' },
            { brand: 'ROBBIES', item: 'Glass Cleaner' },
            { brand: 'ROBBIES', item: 'Aluminum Brightener' },
            { brand: 'ROBBIES', item: 'Purple Wash & Wax' },
            { brand: 'ROBBIES', item: 'Waxy Suds' },
            { brand: 'ROBBIES', item: 'Kwik Solv' },
            { brand: 'ROBBIES', item: 'Kleen All/Chrome' },
            { brand: 'ROBBIES', item: 'Water Spot Removal' },
            { brand: 'ROBBIES', item: 'Foamee Spray' },
            { brand: 'ROBBIES', item: 'Nu-Glo' },
            { brand: 'ROBBIES', item: 'Degreaser' },
            
            // SPRAY WAY
            { brand: 'SPRAY WAY', item: 'Leather Cleaner' },
            
            // SCOTTIES
            { brand: 'SCOTTIES', item: 'Leather Conditioner' }
        ];

        const category = 'WASH CHEMICALS';

        // Insert all items
        const insertPromises = washChemicalsItems.map(({ brand, item }) =>
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
                message: `Seeded ${washChemicalsItems.length} items for ${category}`,
                count: washChemicalsItems.length
            })
        };
    } catch (error) {
        console.error('Error seeding wash chemicals data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
