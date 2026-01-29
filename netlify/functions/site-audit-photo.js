const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const baseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: baseHeaders,
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { ...baseHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const params = event.queryStringParameters || {};
        const id = params.id;
        const section = params.section;
        const indexStr = params.index;

        if (!id || !section || typeof indexStr === 'undefined') {
            return {
                statusCode: 400,
                headers: { ...baseHeaders, 'Content-Type': 'text/html' },
                body: '<html><body><h1>Error</h1><p>id, section, and index are required.</p></body></html>'
            };
        }

        const index = parseInt(indexStr, 10);
        if (Number.isNaN(index) || index < 0) {
            return {
                statusCode: 400,
                headers: { ...baseHeaders, 'Content-Type': 'text/html' },
                body: '<html><body><h1>Error</h1><p>index must be a non-negative integer.</p></body></html>'
            };
        }

        const results = await sql`
            SELECT location, photos, created_at, submitted_by
            FROM site_audits
            WHERE id = ${id}
        `;

        if (!results || results.length === 0) {
            return {
                statusCode: 404,
                headers: { ...baseHeaders, 'Content-Type': 'text/html' },
                body: '<html><body><h1>Not Found</h1><p>Audit not found.</p></body></html>'
            };
        }

        const audit = results[0];
        let photoData = null;

        try {
            // Neon returns JSONB as an object; only parse if it's a string
            let photos = null;
            if (audit.photos != null) {
                photos = typeof audit.photos === 'string' ? JSON.parse(audit.photos) : audit.photos;
            }
            if (photos && typeof photos === 'object' && photos[section]) {
                const sectionPhotos = photos[section];
                // index from URL is string; section may use numeric or string keys
                photoData = sectionPhotos[index] ?? sectionPhotos[String(index)];
            }
        } catch (parseErr) {
            console.error('Error parsing photos JSON for site audit:', parseErr);
        }

        if (!photoData) {
            return {
                statusCode: 404,
                headers: { ...baseHeaders, 'Content-Type': 'text/html' },
                body: '<html><body><h1>No Photo</h1><p>No photo found for this item.</p></body></html>'
            };
        }

        // Basic validation that we have a data URL
        if (!photoData.startsWith('data:image/')) {
            return {
                statusCode: 415,
                headers: { ...baseHeaders, 'Content-Type': 'text/html' },
                body: '<html><body><h1>Unsupported</h1><p>Photo is not a supported image type.</p></body></html>'
            };
        }

        const timestamp = new Date(audit.created_at).toLocaleString('en-US', {
            timeZone: 'America/Chicago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const safeLocation = audit.location || 'Unknown Site';
        const safeSubmittedBy = audit.submitted_by || 'Unknown';

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Site Audit Photo - ${safeLocation}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      color: #fff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      padding: 16px 24px;
      background: rgba(0,0,0,0.9);
      border-bottom: 1px solid rgba(255,255,255,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .info h1 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .info p {
      font-size: 0.85rem;
      color: rgba(255,255,255,0.7);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s ease;
    }
    .btn-primary {
      background: #0a84ff;
      color: #fff;
    }
    .btn-primary:hover {
      background: #0077ed;
    }
    main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    img {
      max-width: 100%;
      max-height: calc(100vh - 120px);
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    }
  </style>
</head>
<body>
  <header>
    <div class="info">
      <h1>${safeLocation} - Site Audit Photo</h1>
      <p>${timestamp} • ${safeSubmittedBy}</p>
    </div>
    <div class="actions">
      <a href="${photoData}" download="site_audit_photo_${id}_${section}_${index}.jpg" class="btn btn-primary">
        Download
      </a>
    </div>
  </header>
  <main>
    <img src="${photoData}" alt="Site audit photo" />
  </main>
</body>
</html>`;

        return {
            statusCode: 200,
            headers: { ...baseHeaders, 'Content-Type': 'text/html' },
            body: html
        };
    } catch (err) {
        console.error('Error serving site audit photo:', err);
        return {
            statusCode: 500,
            headers: { ...baseHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

