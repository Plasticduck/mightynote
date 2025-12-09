// Get capital improvement requests
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
            CREATE TABLE IF NOT EXISTS capital_requests (
                id SERIAL PRIMARY KEY,
                location TEXT NOT NULL,
                request_types JSONB,
                equipment_area TEXT,
                description TEXT,
                image_pdf TEXT,
                operational_impact TEXT,
                customer_impact TEXT,
                safety_impact TEXT,
                revenue_impact TEXT,
                importance_ranking TEXT,
                cost_range TEXT,
                vendor_supplier TEXT,
                operational_requirement TEXT,
                recommendation TEXT,
                follow_up_actions JSONB,
                justification TEXT,
                follow_up_deadline DATE,
                submitted_by TEXT,
                submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        const requests = await sql`
            SELECT 
                *,
                CASE WHEN image_pdf IS NOT NULL AND image_pdf != '' THEN true ELSE false END as has_image
            FROM capital_requests
            ORDER BY submitted_at DESC
        `;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(requests)
        };
    } catch (error) {
        console.error('Error fetching requests:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

