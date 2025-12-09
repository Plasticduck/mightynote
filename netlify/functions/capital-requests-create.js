// Create capital improvement request
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
            tableInitialized = true;
        }
    } catch (tableError) {
        console.error('Table creation error:', tableError);
    }

    try {
        const data = JSON.parse(event.body);
        
        const result = await sql`
            INSERT INTO capital_requests (
                location, request_types, equipment_area, description, image_pdf,
                operational_impact, customer_impact, safety_impact, revenue_impact,
                importance_ranking, cost_range, vendor_supplier, operational_requirement,
                recommendation, follow_up_actions, justification, follow_up_deadline,
                submitted_by, submitted_at
            )
            VALUES (
                ${data.location},
                ${JSON.stringify(data.request_types || [])},
                ${data.equipment_area || null},
                ${data.description || null},
                ${data.image_pdf || null},
                ${data.operational_impact || null},
                ${data.customer_impact || null},
                ${data.safety_impact || null},
                ${data.revenue_impact || null},
                ${data.importance_ranking || null},
                ${data.cost_range || null},
                ${data.vendor_supplier || null},
                ${data.operational_requirement || null},
                ${data.recommendation || null},
                ${JSON.stringify(data.follow_up_actions || [])},
                ${data.justification || null},
                ${data.follow_up_deadline || null},
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
        console.error('Error creating capital request:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

