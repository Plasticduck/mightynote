// Shared database connection for Neon PostgreSQL
const { neon } = require('@neondatabase/serverless');

// Get the database URL from environment variable
const getDatabaseUrl = () => {
    const url = process.env.NETLIFY_DATABASE_URL;
    if (!url) {
        throw new Error('NETLIFY_DATABASE_URL environment variable is not set');
    }
    return url;
};

// Create SQL query function
const sql = neon(getDatabaseUrl());

// Initialize database schema
const initSchema = async () => {
    await sql`
        CREATE TABLE IF NOT EXISTS notes (
            id SERIAL PRIMARY KEY,
            location INTEGER NOT NULL,
            department TEXT NOT NULL,
            note_type TEXT NOT NULL,
            other_description TEXT,
            additional_notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    `;
};

module.exports = { sql, initSchema, getDatabaseUrl };

