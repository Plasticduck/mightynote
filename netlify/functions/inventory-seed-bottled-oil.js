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

        // BOTTLED OIL data from spreadsheets
        const bottledOilItems = [
            // Mobil 1 Advanced Clean
            { brand: 'Mobil 1 Advanced Clean', item: '0W-20' },
            { brand: 'Mobil 1 Advanced Clean', item: '5W-20' },
            { brand: 'Mobil 1 Advanced Clean', item: '5W-30' },
            
            // Mobil 1
            { brand: 'Mobil 1', item: '5W-20' },
            { brand: 'Mobil 1', item: '5W-30' },
            { brand: 'Mobil 1', item: '10W-30' },
            { brand: 'Mobil 1', item: '15W-50' },
            
            // Mobil 1 High Mileage
            { brand: 'Mobil 1 High Mileage', item: '0W-20' },
            { brand: 'Mobil 1 High Mileage', item: '5W-20' },
            { brand: 'Mobil 1 High Mileage', item: '5W-30' },
            { brand: 'Mobil 1 High Mileage', item: '10W-30' },
            { brand: 'Mobil 1 High Mileage', item: '10W-40' },
            
            // Mobil 1 Extended Performance
            { brand: 'Mobil 1 Extended Performance', item: '0W-20' },
            { brand: 'Mobil 1 Extended Performance', item: '5W-20' },
            { brand: 'Mobil 1 Extended Performance', item: '5W-30' },
            { brand: 'Mobil 1 Extended Performance', item: '10W-30' },
            
            // Mobil 1 Extended Performance High Mileage
            { brand: 'Mobil 1 Extended Performance High Mileage', item: '0W-20' },
            { brand: 'Mobil 1 Extended Performance High Mileage', item: '5W-20' },
            { brand: 'Mobil 1 Extended Performance High Mileage', item: '5W-30' },
            
            // Mobil 1 Advanced Fuel Economy
            { brand: 'Mobil 1 Advanced Fuel Economy', item: '0W-8' },
            { brand: 'Mobil 1 Advanced Fuel Economy', item: '0W-16' },
            { brand: 'Mobil 1 Advanced Fuel Economy', item: '0W-20' },
            { brand: 'Mobil 1 Advanced Fuel Economy', item: '0W-30' },
            
            // Mobil 1 Truck & SUV
            { brand: 'Mobil 1 Truck & SUV', item: '0W-20' },
            { brand: 'Mobil 1 Truck & SUV', item: '5W-20' },
            { brand: 'Mobil 1 Truck & SUV', item: '5W-30' },
            
            // Mobil 1 Hybrid
            { brand: 'Mobil 1 Hybrid', item: '0W-20' },
            
            // Mobil 1 ESP
            { brand: 'Mobil 1 ESP', item: '0W-20' },
            { brand: 'Mobil 1 ESP', item: '0W-30' },
            { brand: 'Mobil 1 ESP', item: '0W-40' },
            { brand: 'Mobil 1 ESP', item: '5W-30' },
            
            // Mobil 1 FS European Car Formula
            { brand: 'Mobil 1 FS European Car Formula', item: '0W-40' },
            { brand: 'Mobil 1 FS European Car Formula', item: '5W-30' },
            { brand: 'Mobil 1 FS European Car Formula', item: '5W-40' },
            { brand: 'Mobil 1 FS European Car Formula', item: '5W-50' },
            
            // Mobil 1 Supercar
            { brand: 'Mobil 1 Supercar', item: '0W-40' },
            { brand: 'Mobil 1 Supercar', item: '5W-50' },
            
            // Mobil 1 Classic Car
            { brand: 'Mobil 1 Classic Car', item: '10W-30' },
            
            // Mobil 1 C40 GT
            { brand: 'Mobil 1 C40 GT', item: '0W-40' },
            
            // Mobil 1 Turbo Diesel Truck
            { brand: 'Mobil 1 Turbo Diesel Truck', item: '5W-40' },
            
            // Mobil 1 Racing Oils
            { brand: 'Mobil 1 Racing Oils', item: '0W-30' },
            { brand: 'Mobil 1 Racing Oils', item: '0W-50' },
            
            // Mobil 1 Racing 4T
            { brand: 'Mobil 1 Racing 4T', item: '10W-40' },
            
            // Mobil 1 V-Twin
            { brand: 'Mobil 1 V-Twin', item: '20W-50' },
            
            // Pennzoil
            { brand: 'Pennzoil', item: '0W-16' },
            { brand: 'Pennzoil', item: '0W-20' },
            { brand: 'Pennzoil', item: '0W-30' },
            { brand: 'Pennzoil', item: '0W-40' },
            { brand: 'Pennzoil', item: '5W-20' },
            { brand: 'Pennzoil', item: '5W-30' },
            { brand: 'Pennzoil', item: '5W-40' },
            { brand: 'Pennzoil', item: '10W-30' },
            { brand: 'Pennzoil', item: '10W-40' },
            { brand: 'Pennzoil', item: '20W-50' },
            { brand: 'Pennzoil', item: 'SAE 30' },
            { brand: 'Pennzoil', item: 'SAE 40' },
            
            // Quaker State
            { brand: 'Quaker State', item: '0W-20' },
            { brand: 'Quaker State', item: '0W-30' },
            { brand: 'Quaker State', item: '5W-20' },
            { brand: 'Quaker State', item: '5W-30' },
            { brand: 'Quaker State', item: '5W-40' },
            { brand: 'Quaker State', item: '5W-50' },
            { brand: 'Quaker State', item: '10W-30' },
            { brand: 'Quaker State', item: '10W-40' },
            { brand: 'Quaker State', item: '20W-50' },
            
            // Valvoline
            { brand: 'Valvoline', item: '0W-8' },
            { brand: 'Valvoline', item: '0W-16' },
            { brand: 'Valvoline', item: '0W-20' },
            { brand: 'Valvoline', item: '0W-30' },
            { brand: 'Valvoline', item: '0W-40' },
            { brand: 'Valvoline', item: '5W-20' },
            { brand: 'Valvoline', item: '5W-30' },
            { brand: 'Valvoline', item: '5W-30 XL-III' },
            { brand: 'Valvoline', item: '5W-40' },
            { brand: 'Valvoline', item: '10W-30' },
            { brand: 'Valvoline', item: '10W-40' },
            { brand: 'Valvoline', item: '20W-50' },
            { brand: 'Valvoline', item: 'SAE 30' },
            { brand: 'Valvoline', item: 'SAE 30 (Non-Detergent)' },
            
            // Castrol
            { brand: 'Castrol', item: '0W-8' },
            { brand: 'Castrol', item: '0W-16' },
            { brand: 'Castrol', item: '0W-20' },
            { brand: 'Castrol', item: '0W-30' },
            { brand: 'Castrol', item: '0W-40' },
            { brand: 'Castrol', item: '5W-20' },
            { brand: 'Castrol', item: '5W-30' },
            { brand: 'Castrol', item: '5W-40' },
            { brand: 'Castrol', item: '5W-50' },
            { brand: 'Castrol', item: '10W-30' },
            { brand: 'Castrol', item: '10W-40' },
            { brand: 'Castrol', item: '10W-60' },
            { brand: 'Castrol', item: '15W-40' },
            { brand: 'Castrol', item: '20W-50' },
            
            // Motorcraft
            { brand: 'Motorcraft', item: '5W-20' },
            { brand: 'Motorcraft', item: '5W-30' },
            { brand: 'Motorcraft', item: '10W-30 Diesel' },
            { brand: 'Motorcraft', item: '15W-40 Diesel' },
            { brand: 'Motorcraft', item: '5W-30 Diesel' },
            
            // Dello
            { brand: 'Dello', item: '15W-40' },
            
            // AC Delco
            { brand: 'AC Delco', item: '0W-20 Diesel' }
        ];

        const category = 'BOTTLED OIL';

        // Remove duplicates by creating a Set of unique brand-item combinations
        const uniqueItems = [];
        const seen = new Set();
        
        bottledOilItems.forEach(({ brand, item }) => {
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
        console.error('Error seeding bottled oil data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
