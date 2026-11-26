# ConnectX

**A mobile-first messaging app for staying connected with friends.**

ConnectX brings direct conversations, group chats, status updates, and calling into one web app. The project is built with Next.js, React, TypeScript, and Supabase.

<p align="center">
  <a href="https://connectx-samarthtgg.vercel.app">Open ConnectX</a>
  ·
  <a href="https://connectx-samarthtgg.vercel.app/chat-preview">Open chat preview</a>
  ·
  <a href="open-lab/">Explore Open Lab</a>
  ·
  <a href="https://github.com/samarthtgg/connectx/issues">Report a bug</a>
</p>

## Try it

| Experience | Link |
| --- | --- |
| Primary deployment | [connectx-samarthtgg.vercel.app](https://connectx-samarthtgg.vercel.app) |
| Primary chat preview | [Open chat preview](https://connectx-samarthtgg.vercel.app/chat-preview) |
| Alternate deployment | [connectx-sandy.vercel.app](https://connectx-sandy.vercel.app) |
| Alternate chat preview | [Open chat preview](https://connectx-sandy.vercel.app/chat-preview) |
| **Interactive repository lab** | [ConnectX Open Lab](open-lab/) |

The two production aliases were verified on the same READY Vercel deployment on 2026-11-26. Re-check the alias mapping after future production deployments.

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
- An Android WebView test wrapper with a GitHub Actions debug-APK build.

Feature availability can depend on account state, browser/device permissions, and Supabase project configuration. The Android wrapper is a debug/test build, not a Play Store-ready release.

## ConnectX Open Lab

The Open Lab is a public, no-login playground for exploring messaging concepts safely. It includes a simulated direct conversation, a group chat sandbox, a message lifecycle explorer, a conceptual system map, and privacy/safety notes.

**All people, messages, and events in the lab are fictional.** The playground runs locally in the browser and does not connect to production accounts, Supabase, or real user data. It is an educational simulation, not a production feature test.

[Launch ConnectX Open Lab](open-lab/)

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
│       ├── android-apk.yml
│       └── contributors.yml
├── open-lab/
│   └── index.html             # Interactive, simulated repository playground
├── README.md
└── connectx-app/
    ├── app/                 # Next.js routes and UI
    ├── components/          # Shared React components
    ├── data/                # App data and local knowledge assets
    ├── lib/                 # Supabase client and shared utilities
    ├── supabase/
    │   ├── functions/       # Supabase Edge Functions
    │   └── migrations/      # Database migrations
    ├── android-wrapper/     # Android WebView test wrapper
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

The Android debug APK workflow completed successfully on 2026-11-26 (run [#5](https://github.com/samarthtgg/connectx/actions/runs/45776960135)). The project owner subsequently confirmed that the newly built APK works on their device. This is a debug/test APK, not a production-signed release.

## Android test build

The workflow at `.github/workflows/android-apk.yml` builds a debug APK from `connectx-app/android-wrapper` when manually dispatched or when Android wrapper files change. The latest successful run produced the `ConnectX-debug-apk` artifact. GitHub Actions artifacts expire; check the workflow run for the current download.

The wrapper is a minimal WebView shell. It supports ConnectX host navigation, file selection, and on-demand camera/microphone permission handling. It does not currently implement production release signing, push-notification integration, custom deep-link routing, or offline storage.

This workflow does not publish an app to Google Play. Test the built APK on physical Android devices and complete the release checklist before treating the wrapper as release-ready.

## Security and privacy

- Keep private keys and service-role credentials out of source control.
- Use Row Level Security for every user-owned table and storage bucket.
- Validate authorization on the server/database; hiding a UI control is not access control.
- Do not commit real user data, credentials, tokens, or production exports.
- Please report suspected vulnerabilities privately. See [SECURITY.md](SECURITY.md).

## Contributors

ConnectX is built in public. This wall is refreshed automatically from GitHub contributor data after updates to the default branch and once each week. Every card links to its contributor's GitHub profile. If the wall is empty, be the first to appear here.

<!-- readme: contributors,bots/- -start -->
<p align="center">
  <a href="https://github.com/samarthtgg" title="Samarth Kumbhar" aria-label="Samarth Kumbhar"><img src=".github/faces/samarthtgg.svg" width="87" height="99" alt="Samarth Kumbhar" /></a>
</p>
<!-- readme: contributors,bots/- -end -->

## Contributing

Bug reports, focused fixes, and documentation improvements are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Project status

ConnectX is actively developed. Some features may be experimental or depend on external Supabase configuration. Check the issue tracker and latest commits for current work rather than assuming every roadmap idea is already implemented.

## License

ConnectX is released under the [MIT License](LICENSE). You may use, copy, modify, distribute, sublicense, and sell copies of the software, subject to the license notice and disclaimer.
