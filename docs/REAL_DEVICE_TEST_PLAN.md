# ConnectX real-device test plan

This checklist tracks the checks needed before calling ConnectX or its Android WebView wrapper release-ready. A CI build passing does not replace testing on physical devices.

## Owner-reported test status

On 2026-11-26, the project owner confirmed that the real-device checks were completed successfully. Earlier reports identify an iQOO Z10x running Android 16, plus a two-device test for offline messaging and voice/video calling. These are owner-reported results, not independently reproduced test results.

The owner reports the device-test areas below as passed. Browser/WebView version details, exact test date details, and sanitized supporting evidence have not been supplied.

## Android and browser basics

- [x] Test on a current Android phone (owner-reported).
- [x] Test narrow and wide layouts, portrait and landscape (owner-reported).
- [x] Check keyboard resizing, scrolling, safe areas, and back navigation (owner-reported).
- [x] Check slow and interrupted network behavior (owner-reported).

## Accounts and privacy

- [x] Sign up, sign in, sign out, and password reset (owner-reported).
- [x] Verify username uniqueness and profile visibility rules (owner-reported).
- [x] Verify private-account friend acceptance rules (owner-reported).
- [x] Confirm one account cannot read or modify another account's private data (owner-reported).

## Messaging and media

- [x] Send and receive direct messages in both directions (owner-reported).
- [x] Test group creation, membership, roles, and message permissions (owner-reported).
- [x] Test image and video upload, preview, download, and expiry cleanup (owner-reported).
- [x] Test reply, forward, delete, archive, pin, and disappearing-message behavior (owner-reported).
- [x] Test offline send/retry and duplicate prevention (owner-reported).

## Status and calling

- [x] Create, view, react to, and reply to status updates (owner-reported).
- [x] Test camera and microphone permission prompts (owner-reported).
- [x] Test voice and video calls on two real devices and on different networks (owner-reported).
- [x] Verify permissions are not requested before a feature needs them (owner-reported).

## Android WebView wrapper

- [x] Install and test the Android WebView app (owner-reported).
- [x] Test login redirects, file picker, camera, microphone, and media playback (owner-reported).
- [x] Test notification behavior and deep links (owner-reported).
- [x] Test app pause/resume, process restart, and back button behavior (owner-reported).
- [x] Confirm the wrapper handles unavailable network and expired sessions clearly (owner-reported).

**Repository verification note (2026-11-26):** The recursive Git tree does not contain `connectx-app/android-wrapper` or any Android Gradle project files, although `.github/workflows/android-apk.yml` points to that directory and runs `gradle assembleDebug`. The workflow only describes a debug APK. No production release build configuration, signing configuration, or signed release artifact can be verified from the current repository.

## CI and deployment verification

- [x] GitHub Actions quality workflow passed on 2026-11-26 for commit `37dc529f1d40806878f44f6ce782c23c18861633` (run [#33](https://github.com/samarthtgg/connectx/actions/runs/45770620503), job "Lint, type-check and production build", conclusion: success). Dependency installation, ESLint, TypeScript checking, and the production build all completed successfully.
- [x] Vercel reported a READY production deployment for commit `37dc529f1d40806878f44f6ce782c23c18861633`: [deployment details](https://vercel.com/samarthtgg/connectx/Be1P6naQpykdGqaYo83kDh9i9Qv7).
- [ ] Both requested custom domains are confirmed on the latest deployment. Vercel accepted alias-assignment requests for `connectx-samarthtgg.vercel.app` and `connectx-sandy.vercel.app`, but a subsequent deployment read-back still listed only `connectx-git-main-samarthtgg.vercel.app`; the custom aliases are therefore not treated as verified.
- [ ] Independently load and smoke-test both public deployment URLs from a normal browser/device. Automated page fetches could not retrieve either URL in this review.

## Privacy and support review

- [ ] Publish and review an accurate privacy policy based on actual data collection, use, sharing, retention, security, and account-deletion behavior. No privacy-policy document or route was found in the repository tree during this review; policy details must be supplied by the project owner rather than guessed.
- [ ] Provide a user-facing support contact or support page. The repository has `SECURITY.md` for vulnerability reporting, but that is not a general customer-support channel.

## Evidence and release gate

- [ ] Record the browser/WebView version and exact test date alongside the device and Android version.
- [ ] Attach sanitized screenshots or short recordings; do not include real chat content, credentials, tokens, or private user data.
- [ ] Review and resolve release-blocking defects; retain retest evidence.
- [ ] Restore/add the Android wrapper project and its Gradle configuration. Then verify a production release build and signing workflow. Keep the signing key outside source control; use local signing or protected GitHub Actions secrets without paid services or a payment card.
- [ ] Complete privacy-policy and user-support review before publishing.
- [x] Add the supplied actual ConnectX home-screen screenshot at `docs/screenshots/home-screen.png` and reference only that screenshot in the README preview section.

## Current release status

The owner reports the real-device test coverage as complete, but those results have not been independently reproduced and the supporting evidence/version details remain outstanding. GitHub Actions quality checks and a Vercel production deployment are independently verified for commit `37dc529`. Alias-assignment requests were accepted, but Vercel read-back did not show either requested custom domain on the latest deployment, so domain sync is still unresolved. Android release signing, privacy/support readiness, public URL smoke tests, and test evidence remain release gates. Do not call ConnectX fully release-ready, close issue #2, or publish a signed release until all remaining release gates are completed.
