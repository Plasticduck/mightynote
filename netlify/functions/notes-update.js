// Edit an existing violation. Only the person who submitted it may change it —
// ownership is checked server-side against the session token's claims, never
// against anything the client sends in the body.
//
// Older rows (created before notes.user_id existed) fall back to matching
// submitted_by against the caller's full name so their authors aren't locked out.

const { neon } = require('@neondatabase/serverless');
const { requireAuth } = require('./_lib-auth');

const DEPARTMENTS = ['Operations', 'Safety', 'Accounting', 'Human Resources', 'IT'];

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
    }

    const auth = requireAuth(event, headers);
    if (auth.error) return auth.error;

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        const data = event.body ? JSON.parse(event.body) : {};

        const id = Number(data.id);
        const { location, department, note_type, other_description, additional_notes, image_pdf } = data;

        // 'keep' (default) leaves the existing attachment alone, 'replace' swaps in
        // image_pdf, 'remove' clears it.
        const attachmentAction = data.attachment_action || 'keep';
        if (!['keep', 'replace', 'remove'].includes(attachmentAction)) {
            return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Unknown attachment action' }) };
        }
        if (attachmentAction === 'replace' && !image_pdf) {
            return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'No attachment was provided to save' }) };
        }

        if (!Number.isInteger(id)) {
            return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'A valid note id is required' }) };
        }

        if (!location || !department || !note_type) {
            return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Site, department and violation type are required' }) };
        }

        if (!DEPARTMENTS.includes(department)) {
            return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Unknown department' }) };
        }

        if (note_type === 'Other' && !String(other_description || '').trim()) {
            return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Please describe the violation' }) };
        }

        const existing = await sql`SELECT id, user_id, submitted_by FROM notes WHERE id = ${id}`;
        if (existing.length === 0) {
            return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Violation not found' }) };
        }

        const note = existing[0];
        const isAuthor = note.user_id != null
            ? Number(note.user_id) === Number(auth.user.id)
            : !!note.submitted_by && note.submitted_by === auth.user.full_name;

        if (!isAuthor) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ success: false, error: 'Only the person who submitted this violation can edit it' })
            };
        }

        // "Other" description only belongs on an "Other" violation.
        const otherDesc = note_type === 'Other' ? String(other_description).trim() : null;
        const locationStr = typeof location === 'number' ? location.toString() : String(location);

        // Attachments live in image_pdf (what the submit form writes); pdf_attachment
        // is the legacy inbound column, cleared whenever the author sets a new file.
        let result;
        if (attachmentAction === 'replace') {
            result = await sql`
                UPDATE notes
                SET location = ${locationStr},
                    department = ${department},
                    note_type = ${note_type},
                    other_description = ${otherDesc},
                    additional_notes = ${additional_notes || null},
                    image_pdf = ${image_pdf},
                    pdf_attachment = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING id, location, department, note_type, other_description, additional_notes,
                          submitted_by, user_id, created_at, updated_at,
                          CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END AS has_photo,
                          CASE WHEN pdf_attachment IS NOT NULL THEN true ELSE false END AS has_pdf,
                          CASE WHEN image_pdf IS NOT NULL OR pdf_attachment IS NOT NULL THEN true ELSE false END AS has_image
            `;
        } else if (attachmentAction === 'remove') {
            result = await sql`
                UPDATE notes
                SET location = ${locationStr},
                    department = ${department},
                    note_type = ${note_type},
                    other_description = ${otherDesc},
                    additional_notes = ${additional_notes || null},
                    image_pdf = NULL,
                    pdf_attachment = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING id, location, department, note_type, other_description, additional_notes,
                          submitted_by, user_id, created_at, updated_at,
                          CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END AS has_photo,
                          CASE WHEN pdf_attachment IS NOT NULL THEN true ELSE false END AS has_pdf,
                          CASE WHEN image_pdf IS NOT NULL OR pdf_attachment IS NOT NULL THEN true ELSE false END AS has_image
            `;
        } else {
            result = await sql`
                UPDATE notes
                SET location = ${locationStr},
                    department = ${department},
                    note_type = ${note_type},
                    other_description = ${otherDesc},
                    additional_notes = ${additional_notes || null},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING id, location, department, note_type, other_description, additional_notes,
                          submitted_by, user_id, created_at, updated_at,
                          CASE WHEN image_pdf IS NOT NULL THEN true ELSE false END AS has_photo,
                          CASE WHEN pdf_attachment IS NOT NULL THEN true ELSE false END AS has_pdf,
                          CASE WHEN image_pdf IS NOT NULL OR pdf_attachment IS NOT NULL THEN true ELSE false END AS has_image
            `;
        }

        console.log(`[notes-update] ${auth.user.full_name} edited violation ${id}`);

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, note: result[0] }) };
    } catch (error) {
        console.error('Error updating note:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
