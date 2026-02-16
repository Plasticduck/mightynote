const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const params = event.queryStringParameters || {};
        const noteId = params.id;
        const kind = (params.kind || 'photo').toLowerCase(); // 'photo' (image_pdf) or 'pdf' (pdf_attachment)

        if (!noteId) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'text/html' },
                body: '<html><body><h1>Error</h1><p>Note ID is required</p></body></html>'
            };
        }

        const result = await sql`
            SELECT id,
                   location,
                   department,
                   note_type,
                   image_pdf,
                   pdf_attachment,
                   created_at 
            FROM notes
            WHERE id = ${parseInt(noteId)}
        `;

        if (result.length === 0) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'text/html' },
                body: '<html><body><h1>Not Found</h1><p>Note not found</p></body></html>'
            };
        }

        const note = result[0];

        // Decide which column to use based on kind
        const rawDataUri =
            kind === 'pdf'
                ? note.pdf_attachment || null
                : note.image_pdf || null;

        if (!rawDataUri) {
            const label = kind === 'pdf' ? 'PDF' : 'photo';
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'text/html' },
                body: `<html><body><h1>No ${label}</h1><p>This note does not have an attached ${label}.</p></body></html>`
            };
        }

        // The attachment is stored as a data URI, extract the base64 part
        const base64Match = rawDataUri.match(/^data:application\/pdf;[^,]+,(.+)$/);
        
        if (base64Match) {
            // Return as PDF
            const pdfBuffer = Buffer.from(base64Match[1], 'base64');
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="${kind}_note_${noteId}.pdf"`,
                    'Cache-Control': 'public, max-age=31536000'
                },
                body: pdfBuffer.toString('base64'),
                isBase64Encoded: true
            };
        }

        // Fallback: return the data URI in an HTML page with embedded viewer
        const timestamp = new Date(note.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: true });
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Photo - Note #${noteId}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #000; 
            color: #fff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        header {
            padding: 16px 24px;
            background: #111;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        h1 { font-size: 1.1rem; font-weight: 600; }
        .meta { font-size: 0.85rem; color: #888; }
        .download-btn {
            padding: 8px 16px;
            background: #0a84ff;
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 0.9rem;
            cursor: pointer;
            text-decoration: none;
        }
        .download-btn:hover { background: #0077ed; }
        main { flex: 1; display: flex; }
        iframe { flex: 1; border: none; }
    </style>
</head>
<body>
    <header>
        <div>
            <h1>${kind === 'pdf' ? 'PDF Attachment' : 'Photo Evidence'} - Note #${noteId}</h1>
            <p class="meta">Site ${note.location} | ${note.department} | ${timestamp}</p>
        </div>
        <a href="${rawDataUri}" download="${kind}_note_${noteId}.pdf" class="download-btn">Download PDF</a>
    </header>
    <main>
        <iframe src="${rawDataUri}"></iframe>
    </main>
</body>
</html>
            `
        };
    } catch (error) {
        console.error('Error fetching note image:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'text/html' },
            body: `<html><body><h1>Error</h1><p>${error.message}</p></body></html>`
        };
    }
};






