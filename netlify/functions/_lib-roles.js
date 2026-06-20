// Server-authoritative invoice roles.
//
// These lists used to live ONLY in invoice-approvals-dashboard.js (client side),
// where they were trivially bypassable. They now live here and are enforced on
// the server; the client fetches them via roles-get.js for display only. Files
// prefixed with _ are helpers, not endpoints.
//
// To add/remove a person: edit a list here and redeploy. (A DB-backed roster
// with an admin UI would be the next step.)

// Approvers receive invoices assigned to them and can approve/deny those.
const APPROVERS = [
    'Matt Canales', 'Isabel Castaneda', 'Lester Young', 'Rance Breed',
    'Aaron Messina', 'Justin Gamboa', 'Kevan Jowers', 'Ernest Contreras'
];

// Accounting can see every invoice and its status, assign site(s)+approver(s),
// submit the queue, export to QuickBooks, and cancel invoices.
const ACCOUNTING = [
    'Mikala Niemeyer', 'Rebecca Hipp', 'Elda Pineda',
    'Heather Murry', 'Berhl Robertson', 'Rebecca Jowers'
];

// Flexible name match: exact, else first-name-prefix + same last name
// (so "Matt" -> "Matthew Canales", "Mikayla" -> "Mikala Niemeyer").
// Mirrors the client-side matcher so server decisions agree with the UI.
function namesMatch(a, b) {
    if (!a || !b) return false;
    const aN = a.trim().toLowerCase();
    const bN = b.trim().toLowerCase();
    if (aN === bN) return true;
    const aParts = aN.split(/\s+/);
    const bParts = bN.split(/\s+/);
    if (aParts.length >= 2 && bParts.length >= 2) {
        const aLast = aParts[aParts.length - 1];
        const bLast = bParts[bParts.length - 1];
        if (aLast === bLast && (aParts[0].startsWith(bParts[0]) || bParts[0].startsWith(aParts[0]))) return true;
    }
    return false;
}

// Does `name` match any entry in a list (string[] | null)?
function nameInList(name, list) {
    return Array.isArray(list) && list.some((n) => namesMatch(n, name));
}

function isAdmin(user) {
    return !!user && user.is_admin === true;
}
function isApprover(user) {
    return !!user && APPROVERS.some((n) => namesMatch(n, user.full_name));
}
function isAccounting(user) {
    return !!user && ACCOUNTING.some((n) => namesMatch(n, user.full_name));
}
// Accounting + admins manage the workflow (assign / queue / export / cancel) and
// see every invoice.
function canManageInbox(user) {
    return isAccounting(user) || isAdmin(user);
}

// Is this user one of the invoice's assigned approvers?
function isAssignedApprover(user, invoice) {
    if (!user || !invoice) return false;
    if (nameInList(user.full_name, invoice.approvers)) return true;
    // Legacy single-assignee fallback.
    return namesMatch(invoice.assigned_to, user.full_name);
}

// Has this user opened (viewed) the invoice file? Required before deciding.
function hasViewed(user, invoice) {
    return !!user && nameInList(user.full_name, invoice && invoice.viewed_by);
}

// Can this user see a specific invoice row?
function canViewInvoice(user, invoice) {
    if (canManageInbox(user)) return true;
    if (!invoice) return false;
    if (isAssignedApprover(user, invoice)) return true;
    if (namesMatch(invoice.submitted_by, user.full_name)) return true;
    if (user.email && invoice.submitted_by_email &&
        invoice.submitted_by_email.toLowerCase() === user.email.toLowerCase()) return true;
    return false;
}

module.exports = {
    APPROVERS, ACCOUNTING,
    namesMatch, nameInList,
    isAdmin, isApprover, isAccounting, canManageInbox,
    isAssignedApprover, hasViewed, canViewInvoice
};
