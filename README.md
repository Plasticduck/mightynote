# Mighty Note

A Progressive Web App (PWA) for note management with Neon PostgreSQL database hosted on Netlify.

## Setup Instructions

### 1. Neon Database (via Netlify Integration)

This app uses the Netlify Neon integration. The environment variable `NETLIFY_DATABASE_URL` is automatically provided by Netlify when you connect a Neon database to your site.

### 2. Deploy to Netlify

#### Option A: Deploy via Netlify CLI

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Netlify CLI globally:
   ```bash
   npm install -g netlify-cli
   ```

3. Login to Netlify:
   ```bash
   netlify login
   ```

4. Create a new site:
   ```bash
   netlify init
   ```

5. Deploy:
   ```bash
   netlify deploy --prod
   ```

#### Option B: Deploy via Netlify Dashboard

1. Push your code to GitHub
2. Go to [Netlify](https://netlify.com) and sign up/login
3. Click "Add new site" > "Import an existing project"
4. Connect your GitHub repository
5. Configure build settings:
   - Build command: (leave empty)
   - Publish directory: `.`
6. Connect Neon database via Netlify integrations (the `NETLIFY_DATABASE_URL` env var will be set automatically)

### 3. Initialize the Database

After deployment, visit your site and the database table will be created automatically on first load.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your Neon connection string:
   ```
   NETLIFY_DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:8888 in your browser

## Features

- **Create Notes**: Document violations and incidents by site, department, and type
- **View Records**: Filter and browse all notes
- **Reports Dashboard**: Generate reports with filters for sites, departments, note types, and date ranges
- **Quick Reports**: Monthly and yearly report shortcuts
- **Export to Excel**: Download reports as spreadsheets
- **PWA**: Install as an app on your device
- **Cloud Sync**: All data syncs across devices via Neon PostgreSQL

## Tech Stack

- Frontend: HTML, CSS, JavaScript (Vanilla)
- Backend: Netlify Functions (Serverless)
- Database: Neon PostgreSQL
- Export: SheetJS (xlsx)

