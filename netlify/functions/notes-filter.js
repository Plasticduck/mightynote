const { neon } = require('@neondatabase/serverless');

// Regional Manager reporting: only these sites per region (null/corporate = all sites)
const REGION_SITES = {
    lubbock: ['1', '5', '7', '9', '10', '11', '14'],
    permian_a: ['2', '4', '6', '8', '13', '15', '22', '24', '25'],
    permian_b: ['3', '12', '31'],
    new_mexico: ['16', '17', '18', '19', '20', '21', '23', '26'],
    central: ['27', '28', '29', '30', 'Spotless'],
    corporate: null  // all sites
};

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

        let { locations, departments, noteTypes, startDate, endDate, user_id } = filters;

        // Regional Manager restriction: if user has a region, only allow their sites
        if (user_id) {
            const userRows = await sql`SELECT region FROM users WHERE id = ${user_id}`;
            const region = userRows[0]?.region;
            if (region && REGION_SITES[region]) {
                const allowed = REGION_SITES[region];
                if (allowed) {
                    const allowedSet = new Set(allowed.map(s => String(s)));
                    locations = locations && locations.length > 0
                        ? locations.filter(loc => allowedSet.has(String(loc)))
                        : allowed;
                }
            }
        }

        // Normalize locations to strings for comparison
        const normalizedLocations = locations && locations.length > 0 
            ? locations.map(loc => typeof loc === 'number' ? loc.toString() : loc)
            : null;
        
        let notes;
        
        // Start with base query - fetch all notes (indexes will help with performance)
        // We'll apply filters in JavaScript for reliability
        notes = await sql`
            SELECT id, location, department, note_type, other_description, additional_notes, submitted_by, created_at,
                   CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END as has_image
            FROM notes
            ORDER BY id DESC
        `;
        
        // Apply filters in JavaScript (this is safe and works reliably)
        if (normalizedLocations && normalizedLocations.length > 0) {
            notes = notes.filter(n => {
                const nLoc = typeof n.location === 'number' ? n.location.toString() : n.location;
                return normalizedLocations.includes(nLoc);
            });
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
