const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const { signToken } = require('./_lib-auth');

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

        // Find user by email (region used for Site Violations reporting permissions)
        const users = await sql`
            SELECT id, full_name, email, password_hash, can_use_inventory_app, mightycount_only, is_admin, region, created_at 
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

        // Block MightyCount-only users from accessing MightyOps
        if (user.mightycount_only === true) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ success: false, error: 'This account is only authorized for MightyCount. Please use the MightyCount app to sign in.' })
            };
        }

        // Issue a signed session token. If AUTH_SECRET isn't configured this
        // throws and we 500 — the app must not "log in" without a valid token.
        let token;
        try {
            token = signToken(user);
        } catch (e) {
            console.error('Error signing token:', e.message);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'Server auth is not configured. Please contact an administrator.' })
            };
        }

        // Return user info (without password hash) plus the bearer token.
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                token,
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    email: user.email,
                    can_use_inventory_app: user.can_use_inventory_app,
                    is_admin: user.is_admin || false,
                    region: user.region || null,
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
