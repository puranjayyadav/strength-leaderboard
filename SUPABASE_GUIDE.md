# Supabase Migration & Testing Guide

This project has been migrated from MySQL to **Supabase (PostgreSQL)**. Follow these steps to set up, run, and test the application.

## 1. Supabase Project Setup

1.  **Database Connection**: Get your PostgreSQL connection string from [Supabase Settings > Database](https://supabase.com/dashboard/project/_/settings/database). Use the "Connection string" (Transaction mode, port 6543, or Session mode, port 5432).
2.  **API Keys**: Get your `service_role` key and `anon` key from [Supabase Settings > API](https://supabase.com/dashboard/project/_/settings/api).

## 2. Environment Variables

Create a `.env` file in the root directory (or update your existing one) with the following values:

```env
# Database
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres"

# Supabase Auth & Client
VITE_SUPABASE_URL="https://[PROJECT_ID].supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# App
PORT=3000
NODE_ENV=development
```

## 3. Database Schema Setup

Push the schema to your Supabase project using Drizzle:

```bash
# Push schema directly to Supabase
npx drizzle-kit push
```

Alternatively, you can run the SQL manually in the Supabase SQL Editor.

## 4. Run the Application

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

## 5. Testing Authentication

1.  Navigate to `http://localhost:3000/auth`.
2.  Enter your email to receive a **Magic Link**, or use the **Google** login button (ensure Google Auth is enabled in Supabase).
3.  Once logged in, you will be redirected to the Leaderboard.
4.  The server will automatically sync your Supabase user data into the `users` table on first login.

## 6. Testing Data Import

If you have an Excel file with athlete data:

```bash
# Run the import script
python import_data.py path/to/StrengthLevel.xlsx "your-database-url"
```

## Troubleshooting

- **Auth Redirects**: If you get a redirect error, ensure the Site URL in Supabase is set to `http://localhost:3000` (Supabase Dashboard > Authentication > URL Configuration).
- **Drizzle Errors**: Ensure `DATABASE_URL` is correct and accessible from your network.
