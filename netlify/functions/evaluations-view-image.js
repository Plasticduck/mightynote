// View image PDF for a site evaluation
const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const { id } = event.queryStringParameters || {};
        
        if (!id) {
            return {
                statusCode: 400,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'ID required' })
            };
        }
        
        // Get the evaluation with image
        const results = await sql`
            SELECT location, image_pdf, submitted_at, submitted_by
            FROM evaluations
            WHERE id = ${id}
        `;
        
        if (results.length === 0 || !results[0].image_pdf) {
            return {
                statusCode: 404,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Image not found' })
            };
        }
        
        const evaluation = results[0];
        
        // Format timestamp for CST 12-hour
        const timestamp = new Date(evaluation.submitted_at).toLocaleString('en-US', {
            timeZone: 'America/Chicago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        // Return HTML page with embedded PDF viewer
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Site Review Photo - ${evaluation.location}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #000;
            color: #fff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .header {
            padding: 16px 24px;
            background: rgba(0,0,0,0.8);
            border-bottom: 1px solid rgba(255,255,255,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }
        .info h1 {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .info p {
            font-size: 0.85rem;
            color: rgba(255,255,255,0.6);
        }
        .actions {
            display: flex;
            gap: 8px;
        }
        .btn {
            padding: 8px 16px;
            font-size: 0.9rem;
            font-weight: 500;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #0a84ff;
            color: #fff;
        }
        .btn-primary:hover {
            background: #0077ed;
        }
        .btn-secondary {
            background: rgba(255,255,255,0.1);
            color: #fff;
        }
        .btn-secondary:hover {
            background: rgba(255,255,255,0.15);
        }
        .viewer {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        iframe {
            width: 100%;
            max-width: 900px;
            height: calc(100vh - 120px);
            border: none;
            border-radius: 12px;
            background: #111;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="info">
            <h1>${evaluation.location}</h1>
            <p>${timestamp} • ${evaluation.submitted_by || 'Unknown'}</p>
        </div>
        <div class="actions">
            <a href="${evaluation.image_pdf}" download="site-review-photo.pdf" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
            </a>
            <a href="javascript:window.close()" class="btn btn-secondary">Close</a>
        </div>
    </div>
    <div class="viewer">
        <iframe src="${evaluation.image_pdf}" title="Site Review Photo"></iframe>
    </div>
</body>
</html>`;
        
        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'text/html' },
            body: html
        };
    } catch (error) {
        console.error('Error viewing image:', error);
        return {
            statusCode: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

