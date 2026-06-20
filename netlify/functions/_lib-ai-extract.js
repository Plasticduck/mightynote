// AI extraction of QuickBooks bill fields from an invoice document.
//
// Sends the stored invoice file (PDF or image, as a base64 data URL) to the
// Claude Messages API and asks for the structured fields the QuickBooks Desktop
// bill-import CSV needs. Uses raw fetch to stay consistent with the rest of this
// codebase (Graph / Resend are called the same way) — no SDK dependency.
//
// REQUIRED ENV VAR: ANTHROPIC_API_KEY. Optional: ANTHROPIC_MODEL (defaults to
// claude-opus-4-8). If the key is missing or the call fails, extract() returns
// null and the exporter falls back to the fields already in the database.
// Files prefixed with _ are helpers, not endpoints.

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

// Parse a `data:<mediaType>;base64,<data>` URL into its parts.
function parseDataUrl(dataUrl) {
    if (typeof dataUrl !== 'string') return null;
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
    if (!m) return null;
    return { mediaType: m[1].toLowerCase(), base64: m[2] };
}

// JSON schema for the fields we want Claude to pull off the invoice. Every
// property is required + additionalProperties:false (structured-output rules);
// fields that aren't present should come back as empty strings.
const EXTRACT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        bill_no: { type: 'string', description: 'Invoice number / bill number on the document' },
        vendor: { type: 'string', description: 'Vendor / supplier name' },
        date: { type: 'string', description: 'Invoice date as M/D/YYYY' },
        due_date: { type: 'string', description: 'Payment due date as M/D/YYYY, if shown' },
        terms: { type: 'string', description: 'Payment terms, e.g. Net 30' },
        email: { type: 'string', description: 'Vendor email address' },
        phone: { type: 'string', description: 'Vendor phone number' },
        address_line_1: { type: 'string' },
        address_line_2: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string', description: 'State or province' },
        postal_code: { type: 'string' },
        country: { type: 'string' },
        total_amount: { type: 'string', description: 'Invoice total as a plain number, no currency symbol' },
        currency: { type: 'string', description: 'ISO currency code, e.g. USD' }
    },
    required: [
        'bill_no', 'vendor', 'date', 'due_date', 'terms', 'email', 'phone',
        'address_line_1', 'address_line_2', 'city', 'state', 'postal_code',
        'country', 'total_amount', 'currency'
    ]
};

const PROMPT =
    'You are extracting fields from a vendor invoice to import into QuickBooks ' +
    'Desktop as a bill. Read the attached invoice and return the fields defined ' +
    'by the schema. Use empty strings for anything not present on the document. ' +
    'Format dates as M/D/YYYY. Return amounts as plain numbers with no currency symbol or commas.';

// Extract fields from one invoice's file. Returns the parsed object, or null if
// extraction is unavailable (no API key, no usable file, or an API/parse error).
async function extractInvoiceFields(invoice) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const parsed = parseDataUrl(invoice && invoice.file_data);
    if (!parsed) return null;

    let block;
    if (parsed.mediaType === 'application/pdf') {
        block = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: parsed.base64 } };
    } else if (parsed.mediaType.startsWith('image/')) {
        block = { type: 'image', source: { type: 'base64', media_type: parsed.mediaType, data: parsed.base64 } };
    } else {
        return null; // Unsupported attachment type.
    }

    const body = {
        model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
        max_tokens: 1024,
        output_config: { format: { type: 'json_schema', schema: EXTRACT_SCHEMA } },
        messages: [
            { role: 'user', content: [block, { type: 'text', text: PROMPT }] }
        ]
    };

    try {
        const res = await fetch(ANTHROPIC_ENDPOINT, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error('[ai-extract] API error', res.status, data && data.error);
            return null;
        }
        if (data.stop_reason === 'refusal') {
            console.warn('[ai-extract] request refused');
            return null;
        }
        const textBlock = Array.isArray(data.content) && data.content.find((b) => b.type === 'text');
        if (!textBlock) return null;
        return JSON.parse(textBlock.text);
    } catch (err) {
        console.error('[ai-extract] failed:', err.message);
        return null;
    }
}

module.exports = { extractInvoiceFields, parseDataUrl, EXTRACT_SCHEMA };
