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

        // AUTO ACCESSORIES data from spreadsheets
        const autoAccessoriesItems = [
            // BULLDOG COOLERS
            { brand: 'BULLDOG COOLERS', item: 'Ice Chest: 80060' },
            
            // UWS Toolboxes
            { brand: 'UWS', item: 'Toolbox: TBV-34-LP' },
            { brand: 'UWS', item: 'Toolbox: TBV-49' },
            { brand: 'UWS', item: 'Toolbox: DS-18' },
            { brand: 'UWS', item: 'Toolbox: DS-18-BLK' },
            { brand: 'UWS', item: 'Toolbox: DS-22' },
            { brand: 'UWS', item: 'Toolbox: DS-22-BLK' },
            { brand: 'UWS', item: 'Toolbox: TBC-55-WN' },
            { brand: 'UWS', item: 'Toolbox: TBC-55-WN-BLK' },
            { brand: 'UWS', item: 'Toolbox: TBC-60-N' },
            { brand: 'UWS', item: 'Toolbox: TBC-60-N-BLK' },
            { brand: 'UWS', item: 'Toolbox: TBS-72' },
            { brand: 'UWS', item: 'Toolbox: TBS-72-BLK' },
            { brand: 'UWS', item: 'Toolbox: TBS-72-LP' },
            { brand: 'UWS', item: 'Toolbox: TBS-72-LP-MB' },
            
            // WEATHER GUARD Toolboxes
            { brand: 'WEATHER GUARD', item: 'Toolbox: 655-3-01' },
            { brand: 'WEATHER GUARD', item: 'Toolbox: 655-5-01' },
            { brand: 'WEATHER GUARD', item: 'Toolbox: 126-3-04' },
            { brand: 'WEATHER GUARD', item: 'Toolbox: 126-5-04' },
            { brand: 'WEATHER GUARD', item: 'Toolbox: WEA538302' },
            { brand: 'WEATHER GUARD', item: 'Toolbox: WEA538502' },
            
            // BNW Receiver Hitches
            { brand: 'BNW', item: 'Receiver Hitch (6): BNWTS10047B' },
            { brand: 'BNW', item: 'Receiver Hitch (8): BNWTS10048B' },
            { brand: 'BNW', item: 'Receiver Hitch (10): BNWTS10049B' },
            { brand: 'BNW', item: 'Receiver Hitch (12): BNWTS10050B' },
            { brand: 'BNW', item: 'Receiver Hitch (2): BNWTS10055B' },
            { brand: 'BNW', item: 'Receiver Hitch (2V): BNWTS20048C' },
            { brand: 'BNW', item: 'Receiver Hitch (3V): BNWTS30048B' },
            
            // RDS Tool & Fuel Tanks
            { brand: 'RDS', item: 'Tool & Fuel Tank: RDS-74026' },
            { brand: 'RDS', item: 'Tool & Fuel Tank: RDS-72746' },
            { brand: 'RDS', item: 'Tool & Fuel Tank: RDS-74026PC' },
            { brand: 'RDS', item: 'Tool & Fuel Tank: RDS-72746PC' },
            
            // RDS Auxiliary Fuel Kits
            { brand: 'RDS', item: 'Auxiliary Fuel Kit: 011408' },
            { brand: 'RDS', item: 'Auxiliary Fuel Kit: 011404' },
            { brand: 'RDS', item: 'Auxiliary Fuel Kit: 011029' },
            { brand: 'RDS', item: 'Auxiliary Fuel Kit: 011025' },
            
            // Bedcovers
            { brand: 'BAKFLIP', item: 'Bedcover' },
            { brand: 'ROLL-N-LOCK', item: 'Bedcover' },
            { brand: 'RETRAX', item: 'Bedcover' },
            { brand: 'RETRAX-MX', item: 'Bedcover' },
            { brand: 'UNDERCOVER', item: 'Bedcover' },
            
            // Floor Mats
            { brand: 'WEATHERTECH', item: 'Floor mats' },
            { brand: 'HUSKY', item: 'Floor mats' },
            
            // Seat Covers
            { brand: 'COVERCRAFT', item: 'Seat Covers' },
            
            // Other Accessories
            { brand: 'GPI', item: 'Transfer Pump - GPI-110000' },
            { brand: 'RANCH HAND', item: 'Grille Guard' },
            { brand: 'RANCH HAND', item: 'Front Bumper' },
            { brand: 'RANCH HAND', item: 'Rear Bumper' },
            { brand: 'AMP RESEARCH', item: 'Truck Steps' },
            { brand: 'UNSELFISH SCENTS', item: 'Air Freshener' },
            { brand: 'SYLVANIA', item: 'Light Bulbs' },
            { brand: 'BULLDOG', item: 'Winch' },
            { brand: 'ESCORT', item: 'Max Cam' }
        ];

        const category = 'AUTO ACCESSORIES';

        // Remove duplicates by creating a Set of unique brand-item combinations
        const uniqueItems = [];
        const seen = new Set();
        
        autoAccessoriesItems.forEach(({ brand, item }) => {
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
        console.error('Error seeding auto accessories data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
