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
        const { email, password } = JSON.parse(event.body);

        // Validate required fields
        if (!email || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Email and password are required' })
            };
        }

        // Find user by email
        const users = await sql`
            SELECT id, full_name, email, password_hash, created_at 
            FROM users 
            WHERE email = ${email.toLowerCase()}
        `;

        if (users.length === 0) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: 'Invalid email or password' })
            };
        }

        const user = users[0];

        // Check password
        const password_hash = hashPassword(password);
        if (password_hash !== user.password_hash) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: 'Invalid email or password' })
            };
        }

        // Return user info (without password hash)
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    email: user.email,
                    created_at: user.created_at
                }
            })
        };
    } catch (error) {
        console.error('Error logging in:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
