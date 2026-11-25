# ConnectX application

This directory contains the Next.js application for [ConnectX](https://connectx-samarthtgg.vercel.app), a mobile-first messaging app.

The repository-level guide is the primary documentation: [ConnectX README](../README.md). It covers setup, environment variables, Supabase configuration, Android test builds, security, and contributing.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth and backend services

## Local development

Requirements: Node.js 20.9 or later and npm.

```bash
npm install
```

Create `.env.local` in this directory:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm run lint
npm run build
```

## Important configuration notes

- Configure Supabase Auth redirect URLs for every environment you use.
- Apply the SQL migrations in `supabase/migrations/` to your Supabase project.
- Deploy and configure Edge Functions separately.
- Never expose a Supabase service-role key in browser code or a `NEXT_PUBLIC_*` variable.
- Ensure database and Storage access is protected by appropriate Row Level Security policies.

For the full setup and security notes, see [../README.md](../README.md).
