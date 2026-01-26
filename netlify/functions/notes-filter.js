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
        
        // Build query conditions using Neon's tagged template syntax
        if (locations && locations.length > 0 && departments && departments.length > 0) {
            // Both location and department filters
            notes = await sql`
                SELECT id, location, department, note_type, other_description, additional_notes, submitted_by, created_at,
                       CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END as has_image
                FROM notes
                WHERE location = ANY(${locations.map(l => typeof l === 'number' ? l.toString() : l)})
                AND department = ANY(${departments})
                ${startDate ? sql`AND DATE(created_at) >= DATE(${startDate})` : sql``}
                ${endDate ? sql`AND DATE(created_at) <= DATE(${endDate})` : sql``}
                ${noteTypes && noteTypes.length > 0 ? sql`AND note_type = ANY(${noteTypes})` : sql``}
                ORDER BY id DESC
            `;
        } else if (locations && locations.length > 0) {
            // Only location filter
            notes = await sql`
                SELECT id, location, department, note_type, other_description, additional_notes, submitted_by, created_at,
                       CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END as has_image
                FROM notes
                WHERE location = ANY(${locations.map(l => typeof l === 'number' ? l.toString() : l)})
                ${startDate ? sql`AND DATE(created_at) >= DATE(${startDate})` : sql``}
                ${endDate ? sql`AND DATE(created_at) <= DATE(${endDate})` : sql``}
                ${departments && departments.length > 0 ? sql`AND department = ANY(${departments})` : sql``}
                ${noteTypes && noteTypes.length > 0 ? sql`AND note_type = ANY(${noteTypes})` : sql``}
                ORDER BY id DESC
            `;
        } else if (departments && departments.length > 0) {
            // Only department filter
            notes = await sql`
                SELECT id, location, department, note_type, other_description, additional_notes, submitted_by, created_at,
                       CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END as has_image
                FROM notes
                WHERE department = ANY(${departments})
                ${startDate ? sql`AND DATE(created_at) >= DATE(${startDate})` : sql``}
                ${endDate ? sql`AND DATE(created_at) <= DATE(${endDate})` : sql``}
                ${noteTypes && noteTypes.length > 0 ? sql`AND note_type = ANY(${noteTypes})` : sql``}
                ORDER BY id DESC
            `;
        } else {
            // No location/department filters - apply date and note type filters
            notes = await sql`
                SELECT id, location, department, note_type, other_description, additional_notes, submitted_by, created_at,
                       CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END as has_image
                FROM notes
                WHERE 1=1
                ${startDate ? sql`AND DATE(created_at) >= DATE(${startDate})` : sql``}
                ${endDate ? sql`AND DATE(created_at) <= DATE(${endDate})` : sql``}
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
