// Returns the invoice approver/accounting rosters and the caller's derived
// roles, so the client can build dropdowns and show/hide UI from a single
// server-authoritative source (see _lib-roles.js) instead of a hardcoded copy.
// Requires a valid session token. This is display data only — every privileged
// action is independently re-checked on its own endpoint.

const { requireAuth } = require('./_lib-auth');
const {
    APPROVERS, ACCOUNTING,
    isAdmin, isApprover, isAccounting, canManageInbox
} = require('./_lib-roles');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const auth = requireAuth(event, headers);
    if (auth.error) return auth.error;
    const user = auth.user;

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            approvers: APPROVERS,
            accounting: ACCOUNTING,
            me: {
                full_name: user.full_name,
                is_admin: isAdmin(user),
                is_approver: isApprover(user),
                is_accounting: isAccounting(user),
                can_manage_inbox: canManageInbox(user)
            }
        })
    };
};
