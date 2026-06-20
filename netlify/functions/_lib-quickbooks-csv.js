// Builds the QuickBooks Desktop bill-import CSV from approved invoices.
// Header matches the sample the client provided (INV-QUICKBOOKSDESKTOP-*.csv).
// One header row per file; one expense line per (invoice × site) so multi-site
// invoices split across QuickBooks Classes. Files prefixed with _ are helpers.

const HEADER = [
    'Bill No', 'Vendor', 'Date', 'Due Date', 'Terms', 'Email', 'Phone',
    'Address Line 1', 'Address Line 2', 'City', 'Country', 'State', 'Postal Code',
    'AP Account', 'Memo', 'Expense Account', 'Expense Amount', 'Expense  Memo',
    'Expense Customer', 'Expense Sales Rep', 'Expense Billable', 'Expense Class',
    'Product/Service', 'Product/Service Quantity', 'Product/Service Rate',
    'Product/Service Amount', 'Unit of Measure', 'Serial No', 'Lot No',
    'Inventory Site', 'Inventory BIN', 'Product/Service Description',
    'Product/Service Customer', 'Product/Service Billable',
    'Product/Service Sales Rep', 'Product/Service  Class', 'Currency', 'Exchange Rate'
];

function csvEscape(value) {
    const s = value == null ? '' : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Format a date as M/D/YYYY. Pass through a value already in that shape, and
// handle YYYY-MM-DD by component (avoids the UTC-parse → local-shift that turns
// 2026-02-03 into 2/2/2026 in a negative-offset timezone).
function fmtDate(value) {
    if (!value) return '';
    const s = String(value);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
    const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (ymd) return `${Number(ymd[2])}/${Number(ymd[3])}/${ymd[1]}`;
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

// Split an amount across N sites evenly, putting any rounding remainder on the
// first line so the lines sum exactly to the total.
function splitAmount(total, n) {
    const t = round2(total);
    if (n <= 1) return [t];
    const each = round2(t / n);
    const parts = Array(n).fill(each);
    const drift = round2(t - each * n);
    parts[0] = round2(parts[0] + drift);
    return parts;
}

// Build one or more CSV rows (string[][]) for a single invoice. `ai` is the
// AI-extracted field object (may be null). DB values take precedence for the
// fields accounting controls (vendor, amount, date, sites).
function rowsForInvoice(invoice, ai) {
    ai = ai || {};
    const sites = Array.isArray(invoice.sites) && invoice.sites.length
        ? invoice.sites
        : (invoice.site ? [invoice.site] : ['']);
    const amounts = splitAmount(invoice.amount, sites.length);

    const billNo = ai.bill_no || `INV-${invoice.id}`;
    const vendor = invoice.vendor_name || ai.vendor || '';
    const date = fmtDate(invoice.invoice_date) || fmtDate(ai.date);
    const dueDate = fmtDate(ai.due_date);
    const currency = ai.currency || 'USD';

    return sites.map((site, i) => {
        const row = new Array(HEADER.length).fill('');
        row[0] = billNo;                 // Bill No
        row[1] = vendor;                 // Vendor
        row[2] = date;                   // Date
        row[3] = dueDate;                // Due Date
        row[4] = ai.terms || '';         // Terms
        row[5] = ai.email || '';         // Email
        row[6] = ai.phone || '';         // Phone
        row[7] = ai.address_line_1 || ''; // Address Line 1
        row[8] = ai.address_line_2 || ''; // Address Line 2
        row[9] = ai.city || '';          // City
        row[10] = ai.country || '';      // Country
        row[11] = ai.state || '';        // State
        row[12] = ai.postal_code || '';  // Postal Code
        row[14] = invoice.gl_code || ''; // Memo (carry the approver's GL code)
        row[15] = invoice.gl_code || ''; // Expense Account (GL code if present)
        row[16] = amounts[i].toFixed(2); // Expense Amount
        row[21] = site;                  // Expense Class (the site)
        row[36] = currency;              // Currency
        return row;
    });
}

// Build a full CSV string from invoices + a map of id -> ai-extract object.
function buildCsv(invoices, aiById) {
    const lines = [HEADER.map(csvEscape).join(',')];
    for (const inv of invoices) {
        const rows = rowsForInvoice(inv, aiById && aiById[inv.id]);
        for (const row of rows) lines.push(row.map(csvEscape).join(','));
    }
    return lines.join('\r\n') + '\r\n';
}

module.exports = { HEADER, buildCsv, rowsForInvoice, fmtDate, splitAmount };
