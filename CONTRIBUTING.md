# Contributing to ConnectX

Thanks for taking the time to improve ConnectX. Focused bug fixes, security improvements, accessibility fixes, and clear documentation are useful contributions.

## Before you start

1. Read the project setup in [README.md](README.md).
2. Check open issues and existing pull requests to avoid duplicate work.
3. For a substantial change, open an issue first to discuss the proposed behavior.
4. Do not include secrets, production credentials, private user data, or real chat exports in commits or screenshots.

## Development

The Next.js application is in `connectx-app/`.

```bash
cd connectx-app
npm install
npm run dev
```

Before submitting a change, run:

```bash
npm run lint
npm run build
```

If a check cannot be run, say so in the pull request instead of reporting it as passed.

## Pull requests

A useful pull request should:

- Explain the problem and the intended fix.
- Keep changes focused and avoid unrelated formatting churn.
- Include reproduction steps for bug fixes.
- Include screenshots or a short recording for visible UI changes, when practical.
- Describe any required Supabase migration, Edge Function, environment variable, or dashboard configuration.
- Note what was tested and what remains untested.

## Security-sensitive changes

Do not weaken authentication, authorization, Row Level Security, Storage policies, or function checks to make a feature work. Never add service-role keys or other secrets to client-side code. For suspected vulnerabilities, follow [SECURITY.md](SECURITY.md) rather than opening a public issue.
