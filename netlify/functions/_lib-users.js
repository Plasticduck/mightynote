// Shared helper for looking up a user by display name.
// Handles exact match, then first-name prefix match (Matt -> Matthew).
// Files starting with _ are treated as helpers by Netlify, not exposed as endpoints.

async function findUserByName(sql, fullName) {
    if (!fullName) return null;
    const name = fullName.trim();

    // Exact (case-insensitive)
    const exact = await sql`
        SELECT id, full_name, email
        FROM users
        WHERE LOWER(full_name) = LOWER(${name})
        LIMIT 1
    `;
    if (exact.length) return exact[0];

    // Split into parts — try first-name-starts-with + last-name-exact
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
        const first = parts[0];
        const last = parts.slice(1).join(' ');
        const fuzzy = await sql`
            SELECT id, full_name, email
            FROM users
            WHERE LOWER(full_name) LIKE LOWER(${first + '%'})
              AND LOWER(full_name) LIKE LOWER(${'%' + last})
            LIMIT 1
        `;
        if (fuzzy.length) return fuzzy[0];
    }

    return null;
}

module.exports = { findUserByName };
