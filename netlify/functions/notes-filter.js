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

        // Build dynamic query based on filters
        let notes;

        // Start with base query - we'll filter in JavaScript for complex conditions
        // This is simpler than building dynamic SQL with Neon's tagged template
        notes = await sql`SELECT * FROM notes ORDER BY id DESC`;

        // Apply filters in JavaScript
        if (locations && locations.length > 0) {
            notes = notes.filter(n => locations.includes(n.location));
        }

        if (departments && departments.length > 0) {
            notes = notes.filter(n => departments.includes(n.department));
        }

        if (noteTypes && noteTypes.length > 0) {
            notes = notes.filter(n => noteTypes.includes(n.note_type));
        }

        if (startDate) {
            const start = new Date(startDate);
            notes = notes.filter(n => new Date(n.created_at) >= start);
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Include the entire end day
            notes = notes.filter(n => new Date(n.created_at) <= end);
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

