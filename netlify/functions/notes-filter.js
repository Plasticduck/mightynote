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

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const filters = JSON.parse(event.body);

        const { locations, departments, noteTypes, startDate, endDate } = filters;

        // Build dynamic query based on filters - use SQL for better performance
        let notes;
        
        // Normalize locations to strings for comparison
        const normalizedLocations = locations && locations.length > 0 
            ? locations.map(loc => typeof loc === 'number' ? loc.toString() : loc)
            : null;
        
        // Build query with conditions
        if (normalizedLocations && normalizedLocations.length > 0 && departments && departments.length > 0) {
            notes = await sql`
                SELECT id, location, department, note_type, other_description, additional_notes, submitted_by, created_at,
                       CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END as has_image
                FROM notes
                WHERE location = ANY(${normalizedLocations})
                AND department = ANY(${departments})
                ${startDate ? sql`AND DATE(created_at) >= ${startDate}` : sql``}
                ${endDate ? sql`AND DATE(created_at) <= ${endDate}` : sql``}
                ${noteTypes && noteTypes.length > 0 ? sql`AND note_type = ANY(${noteTypes})` : sql``}
                ORDER BY id DESC
            `;
        } else if (normalizedLocations && normalizedLocations.length > 0) {
            notes = await sql`
                SELECT id, location, department, note_type, other_description, additional_notes, submitted_by, created_at,
                       CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END as has_image
                FROM notes
                WHERE location = ANY(${normalizedLocations})
                ${departments && departments.length > 0 ? sql`AND department = ANY(${departments})` : sql``}
                ${startDate ? sql`AND DATE(created_at) >= ${startDate}` : sql``}
                ${endDate ? sql`AND DATE(created_at) <= ${endDate}` : sql``}
                ${noteTypes && noteTypes.length > 0 ? sql`AND note_type = ANY(${noteTypes})` : sql``}
                ORDER BY id DESC
            `;
        } else if (departments && departments.length > 0) {
            notes = await sql`
                SELECT id, location, department, note_type, other_description, additional_notes, submitted_by, created_at,
                       CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END as has_image
                FROM notes
                WHERE department = ANY(${departments})
                ${startDate ? sql`AND DATE(created_at) >= ${startDate}` : sql``}
                ${endDate ? sql`AND DATE(created_at) <= ${endDate}` : sql``}
                ${noteTypes && noteTypes.length > 0 ? sql`AND note_type = ANY(${noteTypes})` : sql``}
                ORDER BY id DESC
            `;
        } else {
            // No location/department filters
            notes = await sql`
                SELECT id, location, department, note_type, other_description, additional_notes, submitted_by, created_at,
                       CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END as has_image
                FROM notes
                WHERE 1=1
                ${startDate ? sql`AND DATE(created_at) >= ${startDate}` : sql``}
                ${endDate ? sql`AND DATE(created_at) <= ${endDate}` : sql``}
                ${noteTypes && noteTypes.length > 0 ? sql`AND note_type = ANY(${noteTypes})` : sql``}
                ORDER BY id DESC
            `;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, notes })
        };
    } catch (error) {
        console.error('Error filtering notes:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
