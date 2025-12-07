const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

// Simple password hashing (for production, use bcrypt)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
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

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const { full_name, email, password } = JSON.parse(event.body);

        // Validate required fields
        if (!full_name || !email || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'All fields are required' })
            };
        }

        if (password.length < 6) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Password must be at least 6 characters' })
            };
        }

        // Check if email already exists
        const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
        if (existing.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Email already registered' })
            };
        }

        // Hash password and create user
        const password_hash = hashPassword(password);
        const result = await sql`
            INSERT INTO users (full_name, email, password_hash)
            VALUES (${full_name}, ${email.toLowerCase()}, ${password_hash})
            RETURNING id, full_name, email, created_at
        `;

        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ 
                success: true, 
                user: result[0]
            })
        };
    } catch (error) {
        console.error('Error signing up:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
