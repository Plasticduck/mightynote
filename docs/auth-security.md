# Invoice endpoints — authentication & authorization

Until now every invoice serverless function was open to the public internet
(CORS `*`, no auth). Anyone who knew the URL could read **all** invoices
(amounts, vendors, submitter emails), delete any invoice, or approve/reject one,
because roles were enforced only in client-side JavaScript. This change moves
authentication and role enforcement to the **server**.

## What changed

**New shared libs**
- [`_lib-auth.js`](../netlify/functions/_lib-auth.js) — issues and verifies signed
  session tokens (HMAC-SHA256, stateless, 30-day expiry). `requireAuth(event, headers, { check })`
  gates a handler and optionally enforces a role.
- [`_lib-roles.js`](../netlify/functions/_lib-roles.js) — the **single source of truth**
  for the approver/accounting rosters and role helpers (`canManageInbox`, `canViewInvoice`, …).

**Login now issues a token** ([`auth-login.js`](../netlify/functions/auth-login.js))
returns `{ success, token, user }`. The client stores the token and sends it as
`Authorization: Bearer <token>` on every protected call (via
[`auth-client.js`](../auth-client.js)'s `authFetch`).

**Every invoice endpoint now requires a valid token**, and enforces who can do what:

| Endpoint | Requires | Authorization |
|----------|----------|---------------|
| `invoices-get` | sign-in | accounting/admin → all rows; everyone else → only their own (assigned to or submitted by them), filtered server-side |
| `invoices-view-file` | sign-in | only if the caller can view that invoice |
| `invoices-create` | sign-in | submitter identity taken from the token, not the body |
| `invoices-update-status` (approve/reject) | sign-in | only the **assigned approver** or an **admin**; decider taken from the token |
| `invoices-assign` | sign-in + **accounting/admin** | assigner taken from the token |
| `invoices-delete` | sign-in + **accounting/admin** | — |
| `invoices-inbound` | `X-Inbound-Secret` (now constant-time compared) | unchanged — server-to-server |
| `roles-get` (new) | sign-in | returns rosters + the caller's roles for the UI |

The hardcoded approver/accounting lists in the front-end are now **fallback only**;
the dashboard and submit page fetch the authoritative roster from `roles-get`.

## Required: set `AUTH_SECRET` before deploying

The app **fails closed** without it — `auth-login` returns a 500 and no one can
sign in. Set it in **Netlify → Site configuration → Environment variables**:

| Key | Value |
|-----|-------|
| `AUTH_SECRET` | a long random string (≥ 32 chars) |

A freshly generated value you can use (or generate your own with
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`):

```
pt2Wy9SJF6EfkfVLwffqZyLQYyEl8Yr3-zNH8bgxmRzAsiechej9z1O7l7ZO8e1y
```

> Treat it like a password. Rotating it later invalidates all existing
> sessions (everyone re-logs in), which is a fine way to force a global logout.

## One-time consequence: everyone re-logs in

Existing users have a `mightyops_user` in localStorage but no token. On their
next API call `authFetch` gets a 401, clears the session, and redirects to the
login page. They sign in once, get a token, and continue normally.

## Still open (follow-ups, not done here)

- **Password hashing** is still unsalted SHA-256 in `auth-login`/`auth-signup`
  /`auth-change-password`. Move to bcrypt/scrypt/argon2.
- **The other apps** (notes, evaluations, inventory, capital requests, market
  research, staffing, site audit) have the **same** open-endpoint pattern. The
  `requireAuth` helper is generic — apply it there next. Two exceptions already
  use it: `site-audit-delete` (admins only) and `notes-update` (only the author
  of a violation may edit it — ownership is checked against the token claims).
- **Roster in the database**: `_lib-roles.js` still needs a code change + deploy
  to add a person. A `roles` table + admin UI would remove that.
- **CORS** is still `*`. With bearer tokens in localStorage (not cookies) this
  isn't a CSRF risk, but restricting the origin is cheap defense-in-depth.
