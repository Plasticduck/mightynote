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

        // WIPERS data from spreadsheet
        const wipersItems = [
            { brand: 'Rain-X', item: '5079274-2 (16 in)' },
            { brand: 'Rain-X', item: '5079275-2 (18 in)' },
            { brand: 'Rain-X', item: '5079276-2 (19 in)' },
            { brand: 'Rain-X', item: '5079277-2 (20 in)' },
            { brand: 'Rain-X', item: '5079278-2 (21 in)' },
            { brand: 'Rain-X', item: '5079279-2 (22 in)' },
            { brand: 'Rain-X', item: '5079280-2 (24 in)' },
            { brand: 'Rain-X', item: '5079281-2 (26 in)' },
            { brand: 'Rain-X', item: '5079282-2 (28 in)' },
            { brand: 'Rain-X', item: '5079283-1 (17 in)' }
        ];

        const category = 'WIPERS';

        // Insert all items
        const insertPromises = wipersItems.map(({ brand, item }) =>
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
                message: `Seeded ${wipersItems.length} items for ${category}`,
                count: wipersItems.length
            })
        };
    } catch (error) {
        console.error('Error seeding wipers data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
