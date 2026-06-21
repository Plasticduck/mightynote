const { neon } = require('@neondatabase/serverless');

// Photos are large base64 blobs stored in the `photos` JSONB column. The list
// view does NOT need the image data — it only checks whether a photo exists (to
// show a "View Photo" link) and loads the actual image via the site-audit-photo
// endpoint by id/section/index. Returning the full base64 for every audit made
// this response exceed the serverless size limit once enough audits with photos
// accumulated, returning a 502. Replace each photo's data with a tiny truthy
// marker while keeping the structure (section keys + indices) intact.
function stripPhotoData(value) {
    if (typeof value === 'string') return value ? '1' : value;
    if (Array.isArray(value)) return value.map(stripPhotoData);
    if (value && typeof value === 'object') {
        const out = {};
        for (const k of Object.keys(value)) out[k] = stripPhotoData(value[k]);
        return out;
    }
    return value;
}

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

        // Drop the heavy base64 photo data before sending (see stripPhotoData).
        const slimAudits = audits.map((a) => (
            a.photos ? Object.assign({}, a, { photos: stripPhotoData(a.photos) }) : a
        ));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, audits: slimAudits })
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
