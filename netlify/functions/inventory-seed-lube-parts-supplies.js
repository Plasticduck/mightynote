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

        // LUBE PARTS/SUPPLIES data from spreadsheet
        const lubePartsSuppliesItems = [
            { brand: 'BULK VENDOR', item: 'Washer Fluid' },
            { brand: 'GOLDENWEST', item: 'Diesel Exhaust Fluid' },
            { brand: 'OREILLY\'S', item: 'Brake Cleaner' },
            { brand: 'UNITED OIL AND GREASE', item: 'Rubber Gloves' }
        ];

        const category = 'LUBE PARTS/SUPPLIES';

        // Insert all items
        const insertPromises = lubePartsSuppliesItems.map(({ brand, item }) =>
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
                message: `Seeded ${lubePartsSuppliesItems.length} items for ${category}`,
                count: lubePartsSuppliesItems.length
            })
        };
    } catch (error) {
        console.error('Error seeding lube parts/supplies data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
