const { neon } = require('@neondatabase/serverless');

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
        const data = JSON.parse(event.body);

        const { counts, submitted_by, user_id } = data;

        if (!counts || !Array.isArray(counts) || counts.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No counts provided' })
            };
        }

        // Filter out items with no quantity or quantity <= 0
        const validCounts = counts.filter(c => c.quantity && c.quantity > 0);

        if (validCounts.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No valid counts to submit' })
            };
        }

        // Insert all counts in a transaction
        const insertPromises = validCounts.map(count => 
            sql`
                INSERT INTO inventory_counts (category, brand, item, quantity, submitted_by, user_id)
                VALUES (${count.category}, ${count.brand}, ${count.item}, ${count.quantity}, ${submitted_by || null}, ${user_id || null})
            `
        );

        await Promise.all(insertPromises);

        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: `Submitted ${validCounts.length} inventory count(s)`,
                count: validCounts.length
            })
        };
    } catch (error) {
        console.error('Error submitting inventory counts:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
