// Create market research entry
const { neon } = require('@neondatabase/serverless');

let tableInitialized = false;

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
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
        if (!tableInitialized) {
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
            tableInitialized = true;
        }
    } catch (tableError) {
        console.error('Table creation error:', tableError);
    }

    try {
        const data = JSON.parse(event.body);
        
        const result = await sql`
            INSERT INTO market_research (
                competitor_brand, competitor_address, operation_type, tunnel_length, visit_date_time,
                staffing_levels, staff_professionalism, speed_of_service, queue_length,
                equipment_condition, technology_used, operational_strengths, operational_weaknesses,
                customer_service_quality, site_cleanliness, vacuum_area_condition, amenities_offered,
                upkeep_issues, customer_volume, wash_packages, pricing, membership_pricing,
                membership_perks, promotional_offers, upgrades_addons, competitor_standout,
                competitor_strengths, competitor_weaknesses, opportunities, image_pdf,
                submitted_by, submitted_at
            )
            VALUES (
                ${data.competitor_brand || null},
                ${data.competitor_address || null},
                ${data.operation_type || null},
                ${data.tunnel_length || null},
                ${data.visit_date_time || null},
                ${data.staffing_levels || null},
                ${data.staff_professionalism || null},
                ${data.speed_of_service || null},
                ${data.queue_length || null},
                ${JSON.stringify(data.equipment_condition || [])},
                ${JSON.stringify(data.technology_used || [])},
                ${data.operational_strengths || null},
                ${data.operational_weaknesses || null},
                ${data.customer_service_quality || null},
                ${data.site_cleanliness || null},
                ${data.vacuum_area_condition || null},
                ${JSON.stringify(data.amenities_offered || [])},
                ${data.upkeep_issues || null},
                ${data.customer_volume || null},
                ${data.wash_packages || null},
                ${data.pricing || null},
                ${data.membership_pricing || null},
                ${JSON.stringify(data.membership_perks || [])},
                ${data.promotional_offers || null},
                ${data.upgrades_addons || null},
                ${data.competitor_standout || null},
                ${JSON.stringify(data.competitor_strengths || [])},
                ${JSON.stringify(data.competitor_weaknesses || [])},
                ${data.opportunities || null},
                ${data.image_pdf || null},
                ${data.submitted_by || null},
                ${data.submitted_at || new Date().toISOString()}
            )
            RETURNING id
        `;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, id: result[0].id })
        };
    } catch (error) {
        console.error('Error creating market research:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

