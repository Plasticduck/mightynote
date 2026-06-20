// Stateless session auth for MightyOps serverless functions.
//
// Login (auth-login.js) issues a signed token; every protected endpoint calls
// requireAuth(event, headers) to verify it. Tokens are HMAC-SHA256 signed with
// the AUTH_SECRET env var, so verification needs no DB lookup and there's no
// session table to manage. Files prefixed with _ are helpers, not endpoints.
//
// Token format (compact, JWT-like but minimal):  base64url(payload).base64url(sig)
//   payload = { id, full_name, email, is_admin, region, exp }
//
// REQUIRED ENV VAR:  AUTH_SECRET  — a long random string (>= 32 chars).
// Without it, signing and verification both fail closed (no token is valid),
// which means the app cannot log anyone in until it's set. That is intentional:
// a missing secret must never silently degrade to "no auth".

const crypto = require('crypto');

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret() {
    const s = process.env.AUTH_SECRET;
    if (!s || s.length < 32) {
        throw new Error('AUTH_SECRET env var is missing or too short (need >= 32 chars)');
    }
    return s;
}

function b64url(buf) {
    return Buffer.from(buf)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function b64urlToString(str) {
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function hmac(secret, body) {
    return b64url(crypto.createHmac('sha256', secret).update(body).digest());
}

// Build a signed token for a freshly authenticated user.
function signToken(user) {
    const secret = getSecret();
    const payload = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        is_admin: user.is_admin === true,
        region: user.region || null,
        exp: Date.now() + TOKEN_TTL_MS
    };
    const body = b64url(JSON.stringify(payload));
    return `${body}.${hmac(secret, body)}`;
}

// Verify a token; returns the claims object or null if invalid/expired/tampered.
function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const dot = token.indexOf('.');
    if (dot < 1) return null;

    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    let secret;
    try {
        secret = getSecret();
    } catch (e) {
        // Misconfiguration — fail closed.
        console.error('[auth] verifyToken:', e.message);
        return null;
    }

    const expected = hmac(secret, body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    let claims;
    try {
        claims = JSON.parse(b64urlToString(body));
    } catch (e) {
        return null;
    }
    if (!claims || typeof claims.exp !== 'number' || Date.now() > claims.exp) return null;
    return claims;
}

// Pull a bearer token off the Authorization header (case-insensitive).
function getBearer(event) {
    const h = event.headers || {};
    const raw = h.authorization || h.Authorization || '';
    const m = /^Bearer\s+(.+)$/i.exec(raw);
    return m ? m[1].trim() : null;
}

// Gate a handler. Returns either { user } (authenticated claims) or
// { error } (a ready-to-return HTTP response). Optional opts.check is a
// predicate (user) => boolean for role enforcement; failing it yields 403.
//
//   const auth = requireAuth(event, headers, { check: canManageInbox });
//   if (auth.error) return auth.error;
//   const user = auth.user;
function requireAuth(event, headers, opts = {}) {
    const user = verifyToken(getBearer(event));
    if (!user) {
        return {
            error: {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Authentication required' })
            }
        };
    }
    if (typeof opts.check === 'function' && !opts.check(user)) {
        return {
            error: {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'You do not have permission to perform this action' })
            }
        };
    }
    return { user };
}

module.exports = { signToken, verifyToken, getBearer, requireAuth, TOKEN_TTL_MS };
