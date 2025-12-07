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
        const { user_id, current_password, new_password } = JSON.parse(event.body);

        // Validate required fields
        if (!user_id || !current_password || !new_password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'All fields are required' })
            };
        }

        if (new_password.length < 6) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'New password must be at least 6 characters' })
            };
        }

        // Find user by id
        const users = await sql`
            SELECT id, password_hash 
            FROM users 
            WHERE id = ${user_id}
        `;

        if (users.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ success: false, error: 'User not found' })
            };
        }

        const user = users[0];

        // Verify current password
        const current_hash = hashPassword(current_password);
        if (current_hash !== user.password_hash) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: 'Current password is incorrect' })
            };
        }

        // Update password
        const new_hash = hashPassword(new_password);
        await sql`
            UPDATE users 
            SET password_hash = ${new_hash}
            WHERE id = ${user_id}
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Password changed successfully' })
        };
    } catch (error) {
        console.error('Error changing password:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
