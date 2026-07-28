const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        
        // Parse query parameters
        const params = event.queryStringParameters || {};
        const location = params.location;
        const department = params.department;

        let query;
        
        // Select all fields except full attachment data, but include whether photo/pdf exist
        // Handle both numeric locations and text locations like "Spotless"
        const locationParam = location && !isNaN(parseInt(location)) ? parseInt(location).toString() : location;
        
        if (location && department) {
            query = sql`
                SELECT id,
                       location,
                       department,
                       note_type,
                       other_description,
                       additional_notes,
                       submitted_by,
                       user_id,
                       created_at,
                       updated_at,
                       CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END AS has_photo,
                       CASE WHEN pdf_attachment IS NOT NULL THEN true ELSE false END AS has_pdf,
                       -- Backward-compatible flag: any kind of attachment
                       CASE WHEN image_pdf IS NOT NULL OR pdf_attachment IS NOT NULL THEN true ELSE false END AS has_image
                FROM notes 
                WHERE location = ${locationParam} 
                AND department = ${department}
                ORDER BY id DESC
            `;
        } else if (location) {
            query = sql`
                SELECT id,
                       location,
                       department,
                       note_type,
                       other_description,
                       additional_notes,
                       submitted_by,
                       user_id,
                       created_at,
                       updated_at,
                       CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END AS has_photo,
                       CASE WHEN pdf_attachment IS NOT NULL THEN true ELSE false END AS has_pdf,
                       CASE WHEN image_pdf IS NOT NULL OR pdf_attachment IS NOT NULL THEN true ELSE false END AS has_image
                FROM notes 
                WHERE location = ${locationParam}
                ORDER BY id DESC
            `;
        } else if (department) {
            query = sql`
                SELECT id,
                       location,
                       department,
                       note_type,
                       other_description,
                       additional_notes,
                       submitted_by,
                       user_id,
                       created_at,
                       updated_at,
                       CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END AS has_photo,
                       CASE WHEN pdf_attachment IS NOT NULL THEN true ELSE false END AS has_pdf,
                       CASE WHEN image_pdf IS NOT NULL OR pdf_attachment IS NOT NULL THEN true ELSE false END AS has_image
                FROM notes 
                WHERE department = ${department}
                ORDER BY id DESC
            `;
        } else {
            query = sql`
                SELECT id,
                       location,
                       department,
                       note_type,
                       other_description,
                       additional_notes,
                       submitted_by,
                       user_id,
                       created_at,
                       updated_at,
                       CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END AS has_photo,
                       CASE WHEN pdf_attachment IS NOT NULL THEN true ELSE false END AS has_pdf,
                       CASE WHEN image_pdf IS NOT NULL OR pdf_attachment IS NOT NULL THEN true ELSE false END AS has_image
                FROM notes
                ORDER BY id DESC
            `;
        }

        const notes = await query;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, notes })
        };
    } catch (error) {
        console.error('Error fetching notes:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
