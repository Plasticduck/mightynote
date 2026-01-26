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
        
        // Build WHERE conditions array
        const conditions = [];
        const queryParams = [];
        
        if (normalizedLocations && normalizedLocations.length > 0) {
            conditions.push(`location = ANY($${queryParams.length + 1})`);
            queryParams.push(normalizedLocations);
        }
        
        if (departments && departments.length > 0) {
            conditions.push(`department = ANY($${queryParams.length + 1})`);
            queryParams.push(departments);
        }
        
        if (startDate) {
            conditions.push(`DATE(created_at) >= DATE($${queryParams.length + 1})`);
            queryParams.push(startDate);
        }
        
        if (endDate) {
            conditions.push(`DATE(created_at) <= DATE($${queryParams.length + 1})`);
            queryParams.push(endDate);
        }
        
        if (noteTypes && noteTypes.length > 0) {
            conditions.push(`note_type = ANY($${queryParams.length + 1})`);
            queryParams.push(noteTypes);
        }
        
        // Build the query
        let query = `
            SELECT id, location, department, note_type, other_description, additional_notes, submitted_by, created_at,
                   CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END as has_image
            FROM notes
        `;
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY id DESC`;
        
        // Execute with parameters using sql.unsafe for dynamic queries
        if (queryParams.length > 0) {
            // Replace placeholders with actual values (safely)
            let finalQuery = query;
            queryParams.forEach((param, idx) => {
                const placeholder = `$${idx + 1}`;
                if (Array.isArray(param)) {
                    // For arrays, format as PostgreSQL array literal
                    const arrayStr = `ARRAY[${param.map(p => `'${String(p).replace(/'/g, "''")}'`).join(',')}]`;
                    finalQuery = finalQuery.replace(placeholder, arrayStr);
                } else {
                    // For single values
                    const value = typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : param;
                    finalQuery = finalQuery.replace(placeholder, value);
                }
            });
            notes = await sql.unsafe(finalQuery);
        } else {
            notes = await sql.unsafe(query);
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
