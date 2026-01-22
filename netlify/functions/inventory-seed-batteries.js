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

        // BATTERIES data from spreadsheets
        const batteriesItems = [
            // Duralast
            { brand: 'Duralast', item: '58-DL' },
            { brand: 'Duralast', item: '79-DL' },
            { brand: 'Duralast', item: '40R-DL' },
            { brand: 'Duralast', item: 'T6-DL' },
            { brand: 'Duralast', item: '75-DL' },
            { brand: 'Duralast', item: '31-750' },
            { brand: 'Duralast', item: '1-6VOLT640-DL' },
            { brand: 'Duralast', item: '5D-DL' },
            { brand: 'Duralast', item: 'H7-DL' },
            { brand: 'Duralast', item: '56-DL' },
            { brand: 'Duralast', item: '27F-DL' },
            { brand: 'Duralast', item: '66-DL' },
            { brand: 'Duralast', item: 'H4-DL' },
            { brand: 'Duralast', item: '26R-DL' },
            { brand: 'Duralast', item: 'H6-DL' },
            { brand: 'Duralast', item: '25-DL' },
            { brand: 'Duralast', item: '86-DL' },
            { brand: 'Duralast', item: '65-DL' },
            { brand: 'Duralast', item: '22NF-DL' },
            { brand: 'Duralast', item: 'T7-DL' },
            { brand: 'Duralast', item: '51R-DL' },
            { brand: 'Duralast', item: 'U1-1' },
            { brand: 'Duralast', item: '124-DL' },
            { brand: 'Duralast', item: '34DT-DL' },
            
            // Duralast Gold - First image
            { brand: 'Duralast Gold', item: '34-DLG' },
            { brand: 'Duralast Gold', item: 'H6R-DLG' },
            { brand: 'Duralast Gold', item: 'AZX14' },
            { brand: 'Duralast Gold', item: 'AZX15L' },
            { brand: 'Duralast Gold', item: '51R-DLG' },
            { brand: 'Duralast Gold', item: 'AZX10S' },
            { brand: 'Duralast Gold', item: '27-DLG' },
            { brand: 'Duralast Gold', item: '59-DLG' },
            { brand: 'Duralast Gold', item: 'AZX16L' },
            { brand: 'Duralast Gold', item: 'AZX15' },
            { brand: 'Duralast Gold', item: '75-DLG' },
            { brand: 'Duralast Gold', item: '86FT-DLG' },
            { brand: 'Duralast Gold', item: 'U1-3' },
            { brand: 'Duralast Gold', item: 'H6-DLG' },
            
            // Duralast Gold - Second image
            { brand: 'Duralast Gold', item: 'H9-DLG' },
            { brand: 'Duralast Gold', item: 'H7-DLG' },
            { brand: 'Duralast Gold', item: 'AZX12' },
            { brand: 'Duralast Gold', item: 'U1R-3' },
            { brand: 'Duralast Gold', item: 'AZX20L' },
            { brand: 'Duralast Gold', item: 'AZX30LA' },
            { brand: 'Duralast Gold', item: '65-DLG' },
            { brand: 'Duralast Gold', item: 'AZX18L' },
            { brand: 'Duralast Gold', item: '96R-DLG' },
            { brand: 'Duralast Gold', item: 'AZX7S' }
        ];

        const category = 'BATTERIES';

        // Remove duplicates by creating a Set of unique brand-item combinations
        const uniqueItems = [];
        const seen = new Set();
        
        batteriesItems.forEach(({ brand, item }) => {
            const key = `${brand}|${item}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueItems.push({ brand, item });
            }
        });

        // Insert all unique items
        const insertPromises = uniqueItems.map(({ brand, item }) =>
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
                message: `Seeded ${uniqueItems.length} items for ${category}`,
                count: uniqueItems.length
            })
        };
    } catch (error) {
        console.error('Error seeding batteries data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
