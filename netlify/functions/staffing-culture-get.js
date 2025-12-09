// Get staffing, leadership & culture notes
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
        
        const notes = await sql`
            SELECT * FROM staffing_culture_notes
            ORDER BY submitted_at DESC
        `;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(notes)
        };
    } catch (error) {
        console.error('Error fetching notes:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};



