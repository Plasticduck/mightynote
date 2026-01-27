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

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const data = JSON.parse(event.body);

        const { 
            location, 
            initial_observations, 
            primary_section, 
            secondary_section, 
            priority_section, 
            final_thoughts, 
            photos,
            section_comments, 
            explanation, 
            submitted_by, 
            user_id 
        } = data;

        if (!location) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Location is required' })
            };
        }

        const result = await sql`
            INSERT INTO site_audits (
                location, 
                initial_observations, 
                primary_section, 
                secondary_section, 
                priority_section, 
                final_thoughts, 
                photos,
                section_comments, 
                explanation, 
                submitted_by, 
                user_id
            )
            VALUES (
                ${location}, 
                ${initial_observations || null}, 
                ${JSON.stringify(primary_section) || null}, 
                ${JSON.stringify(secondary_section) || null}, 
                ${JSON.stringify(priority_section) || null}, 
                ${JSON.stringify(final_thoughts) || null}, 
                ${JSON.stringify(photos) || null},
                ${JSON.stringify(section_comments) || null}, 
                ${explanation || null}, 
                ${submitted_by || null}, 
                ${user_id || null}
            )
            RETURNING id, location, created_at
        `;

        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ success: true, audit: result[0] })
        };
    } catch (error) {
        console.error('Error creating site audit:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
