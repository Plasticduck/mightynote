// Get market research entries
const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    let sql;
    try {
        sql = neon(process.env.NETLIFY_DATABASE_URL);
    } catch (dbError) {
        console.error('Database connection error:', dbError);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Database connection failed' })
        };
    }

    try {
        await sql`
            CREATE TABLE IF NOT EXISTS market_research (
                id SERIAL PRIMARY KEY,
                competitor_brand TEXT NOT NULL,
                competitor_address TEXT,
                operation_type TEXT,
                tunnel_length TEXT,
                visit_date_time TIMESTAMP WITH TIME ZONE,
                staffing_levels TEXT,
                staff_professionalism TEXT,
                speed_of_service TEXT,
                queue_length TEXT,
                equipment_condition JSONB,
                technology_used JSONB,
                operational_strengths TEXT,
                operational_weaknesses TEXT,
                customer_service_quality TEXT,
                site_cleanliness TEXT,
                vacuum_area_condition TEXT,
                amenities_offered JSONB,
                upkeep_issues TEXT,
                customer_volume TEXT,
                wash_packages TEXT,
                pricing TEXT,
                membership_pricing TEXT,
                membership_perks JSONB,
                promotional_offers TEXT,
                upgrades_addons TEXT,
                competitor_standout TEXT,
                competitor_strengths JSONB,
                competitor_weaknesses JSONB,
                opportunities TEXT,
                image_pdf TEXT,
                submitted_by TEXT,
                submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        const research = await sql`
            SELECT 
                *,
                CASE WHEN image_pdf IS NOT NULL AND image_pdf != '' THEN true ELSE false END as has_image
            FROM market_research
            ORDER BY submitted_at DESC
        `;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(research)
        };
    } catch (error) {
        console.error('Error fetching market research:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

