# ConnectX

ConnectX is a chat-app project built with Next.js, React, TypeScript, and Supabase Auth.

## Current status

- Email/password signup and login are connected to Supabase.
- The sample chat dashboard is at `/chat-preview` on branch `feature/connectx-chat-dashboard`.
- The preview uses sample conversations and temporary in-memory messages only. It does not deliver messages to other users or save them to a database.
- Friends, real-time messaging, uploads, and notifications are not implemented yet.

## Run in GitHub Codespaces

```bash
git fetch origin
git switch feature/connectx-chat-dashboard
cd connectx-app
npm install
npm run dev -- --hostname 0.0.0.0
```

Open the forwarded port 3000 URL and append `/chat-preview`. In the Codespaces Ports tab, make sure port 3000 is forwarded and set to Public if external access is needed. If port 3000 is already running, use its existing URL rather than starting a second server.

## Environment setup

Create `.env.local` inside `connectx-app/` using `.env.example` as a template. The Supabase URL must be the base project URL (no `/rest/v1` or `/auth/v1` suffix).

Never commit `.env.local`, service-role keys, database passwords, or other secrets. Configure Supabase Row Level Security before storing user data.

## Routes

- `/` — signup and login
- `/chat-preview` — sample chat dashboard (preview only)

## Next milestones

1. Confirm Supabase project URL/DNS and authentication.
2. Add user profiles and friend requests.
3. Add conversations/messages tables with RLS policies.
4. Add Supabase Realtime subscriptions.
5. Add file storage, unread counts, and notification preferences.
6. Add build checks and production deployment.

Do not treat the preview as a production messaging service until backend authorization and end-to-end tests are complete.
