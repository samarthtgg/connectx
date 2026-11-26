# ConnectX

**A mobile-first messaging app for staying connected with friends.**

ConnectX brings direct conversations, group chats, status updates, and calling into one web app. The project is built with Next.js, React, TypeScript, and Supabase.

<p align="center">
  <a href="https://connectx-samarthtgg.vercel.app">Open ConnectX</a>
  ·
  <a href="https://connectx-samarthtgg.vercel.app/chat-preview">Open chat preview</a>
  ·
  <a href="https://github.com/samarthtgg/connectx/issues">Report a bug</a>
</p>

## Try it

| Deployment | Link |
| --- | --- |
| Primary deployment | [connectx-samarthtgg.vercel.app](https://connectx-samarthtgg.vercel.app) |
| Primary chat preview | [Open chat preview](https://connectx-samarthtgg.vercel.app/chat-preview) |
| Alternate deployment | [connectx-sandy.vercel.app](https://connectx-sandy.vercel.app) |
| Alternate chat preview | [Open chat preview](https://connectx-sandy.vercel.app/chat-preview) |

Both URLs are listed as intended ConnectX entry points. The latest Vercel production deployment's aliases must be checked before assuming either custom domain points to that deployment.

## Home Screen Preview

![ConnectX home screen](docs/screenshots/home-screen.png)

## What it includes

The current project includes:

- Account sign-up, sign-in, sign-out, and password-reset flows powered by Supabase Auth.
- Direct conversations and group conversations.
- Status updates and social connection features.
- Voice and video calling experiences.
- A responsive interface designed with mobile use in mind.
- A Next.js application and Supabase integration.
- An Android WebView test-wrapper workflow that can build a debug APK artifact through GitHub Actions.

Feature availability can depend on account state, browser/device permissions, and Supabase project configuration. The Android wrapper is a test build, not a Play Store-ready release.

## Technology

- [Next.js](https://nextjs.org/) 16
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Supabase](https://supabase.com/) for authentication and backend services
- [Tailwind CSS](https://tailwindcss.com/) 4

## Repository layout

```text
.
├── .github/
│   └── workflows/
│       └── android-apk.yml
├── README.md
└── connectx-app/
    ├── app/                 # Next.js routes and UI
    ├── components/          # Shared React components
    ├── data/                # App data and local knowledge assets
    ├── lib/                 # Supabase client and shared utilities
    ├── supabase/
    │   ├── functions/       # Supabase Edge Functions
    │   └── migrations/      # Database migrations
    ├── android-wrapper/     # Intended Android WebView wrapper location
    ├── package.json
    └── README.md
```

## Run locally

### Requirements

- Node.js 20.9 or later
- npm
- A Supabase project

### 1. Clone the repository

```bash
git clone https://github.com/samarthtgg/connectx.git
cd connectx/connectx-app
npm install
```

### 2. Configure environment variables

Create `.env.local` inside `connectx-app/`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Use the project URL and publishable key from your own Supabase project. The publishable key is intended for browser use; protect data with correctly configured Row Level Security (RLS) policies. **Never put a Supabase service-role key or other secret in a `NEXT_PUBLIC_*` variable or commit secrets to Git.**

### 3. Configure Supabase

- Apply the SQL files in `connectx-app/supabase/migrations/` to your Supabase database in filename order.
- Deploy the Edge Functions you intend to use.
- Configure authentication URL allowlists and redirect URLs for localhost and your deployed domains.
- Review table policies, storage policies, and function permissions before using real accounts or data.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Check the production build

```bash
npm run lint
npm run build
```

## Testing and release readiness

The repository's CI checks validate code quality and production compilation. They do not prove that every feature works on physical devices. Follow the [real-device test plan](docs/REAL_DEVICE_TEST_PLAN.md) and track outstanding verification in [issue #2](https://github.com/samarthtgg/connectx/issues/2).

Do not treat the Android debug APK as a production release. Physical-device testing, release signing, privacy/support details, and release configuration still need review.

## Android test build

The workflow at `.github/workflows/android-apk.yml` is configured to build a debug APK from `connectx-app/android-wrapper` when manually dispatched or when Android wrapper files change. The expected wrapper directory and Gradle project are not currently present in the checked-in Git tree, so this workflow cannot yet produce a verified artifact from the current repository.

This workflow does not create a signed release APK or publish an app to Google Play. Test authentication, media upload, permissions, notifications, deep links, and calling on physical Android devices before treating the wrapper as release-ready.

## Security and privacy

- Keep private keys and service-role credentials out of source control.
- Use Row Level Security for every user-owned table and storage bucket.
- Validate authorization on the server/database; hiding a UI control is not access control.
- Do not commit real user data, credentials, tokens, or production exports.
- Please report suspected vulnerabilities privately. See [SECURITY.md](SECURITY.md).

## Contributing

Bug reports, focused fixes, and documentation improvements are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Project status

ConnectX is actively developed. Some features may be experimental or depend on external Supabase configuration. Check the issue tracker and latest commits for current work rather than assuming every roadmap idea is already implemented.

## License

ConnectX is released under the [MIT License](LICENSE). You may use, copy, modify, distribute, sublicense, and sell copies of the software, subject to the license notice and disclaimer.
