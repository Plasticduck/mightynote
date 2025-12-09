// Create staffing, leadership & culture notes
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
                CREATE TABLE IF NOT EXISTS staffing_culture_notes (
                    id SERIAL PRIMARY KEY,
                    location TEXT NOT NULL,
                    staffing_levels TEXT,
                    skill_level TEXT,
                    staffing_concerns JSONB,
                    high_potential_employees TEXT,
                    employees_needing_coaching TEXT,
                    staffing_summary TEXT,
                    leadership_presence TEXT,
                    leadership_behaviors JSONB,
                    gm_performance TEXT,
                    gm_notes TEXT,
                    leadership_follow_up TEXT,
                    potential_leaders TEXT,
                    team_morale TEXT,
                    culture_observed JSONB,
                    customer_interactions TEXT,
                    customer_interactions_notes TEXT,
                    recognition_moments TEXT,
                    culture_issues TEXT,
                    overall_culture TEXT,
                    key_takeaways TEXT,
                    follow_up_actions JSONB,
                    follow_up_instructions TEXT,
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
            INSERT INTO staffing_culture_notes (
                location, staffing_levels, skill_level, staffing_concerns,
                high_potential_employees, employees_needing_coaching, staffing_summary,
                leadership_presence, leadership_behaviors, gm_performance, gm_notes,
                leadership_follow_up, potential_leaders, team_morale, culture_observed,
                customer_interactions, customer_interactions_notes, recognition_moments,
                culture_issues, overall_culture, key_takeaways, follow_up_actions,
                follow_up_instructions, submitted_by, submitted_at
            )
            VALUES (
                ${data.location},
                ${data.staffing_levels || null},
                ${data.skill_level || null},
                ${JSON.stringify(data.staffing_concerns || [])},
                ${data.high_potential_employees || null},
                ${data.employees_needing_coaching || null},
                ${data.staffing_summary || null},
                ${data.leadership_presence || null},
                ${JSON.stringify(data.leadership_behaviors || [])},
                ${data.gm_performance || null},
                ${data.gm_notes || null},
                ${data.leadership_follow_up || null},
                ${data.potential_leaders || null},
                ${data.team_morale || null},
                ${JSON.stringify(data.culture_observed || [])},
                ${data.customer_interactions || null},
                ${data.customer_interactions_notes || null},
                ${data.recognition_moments || null},
                ${data.culture_issues || null},
                ${data.overall_culture || null},
                ${data.key_takeaways || null},
                ${JSON.stringify(data.follow_up_actions || [])},
                ${data.follow_up_instructions || null},
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
        console.error('Error creating staffing culture note:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

