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

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        
        const params = event.queryStringParameters || {};
        const location = params.location;
        const date = params.date;

        let query;
        
        if (location && date) {
            query = sql`
                SELECT id, location, initial_observations, primary_section, secondary_section, 
                       priority_section, final_thoughts, photos, section_comments, explanation, 
                       submitted_by, user_id, created_at
                FROM site_audits
                WHERE location = ${location} AND DATE(created_at) = ${date}
                ORDER BY created_at DESC
            `;
        } else if (location) {
            query = sql`
                SELECT id, location, initial_observations, primary_section, secondary_section, 
                       priority_section, final_thoughts, photos, section_comments, explanation, 
                       submitted_by, user_id, created_at
                FROM site_audits
                WHERE location = ${location}
                ORDER BY created_at DESC
            `;
        } else if (date) {
            query = sql`
                SELECT id, location, initial_observations, primary_section, secondary_section, 
                       priority_section, final_thoughts, photos, section_comments, explanation, 
                       submitted_by, user_id, created_at
                FROM site_audits
                WHERE DATE(created_at) = ${date}
                ORDER BY created_at DESC
            `;
        } else {
            query = sql`
                SELECT id, location, initial_observations, primary_section, secondary_section, 
                       priority_section, final_thoughts, photos, section_comments, explanation, 
                       submitted_by, user_id, created_at
                FROM site_audits
                ORDER BY created_at DESC
            `;
        }

        const audits = await query;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, audits })
        };
    } catch (error) {
        console.error('Error fetching site audits:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
