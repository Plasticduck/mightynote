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

        // BULK OIL data from spreadsheet
        const bulkOilItems = [
            // GOLDENWEST
            { brand: 'GOLDENWEST', item: '5W-30' },
            { brand: 'GOLDENWEST', item: '5W-20' },
            { brand: 'GOLDENWEST', item: '10W-30' },
            
            // MOBIL SUPER
            { brand: 'MOBIL SUPER', item: '5W-30' },
            { brand: 'MOBIL SUPER', item: '5W-20' },
            { brand: 'MOBIL SUPER', item: '0W-20' },
            
            // SHELL ROTELLA
            { brand: 'SHELL ROTELLA', item: '15W-40' },
            
            // ROYAL PURPLE
            { brand: 'ROYAL PURPLE', item: '5W-20' },
            { brand: 'ROYAL PURPLE', item: '5W-30' },
            { brand: 'ROYAL PURPLE', item: '15W-40' }
        ];

        const category = 'BULK OIL';

        // Insert all items
        const insertPromises = bulkOilItems.map(({ brand, item }) =>
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
                message: `Seeded ${bulkOilItems.length} items for ${category}`,
                count: bulkOilItems.length
            })
        };
    } catch (error) {
        console.error('Error seeding bulk oil data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
