# ConnectX real-device test plan

This checklist tracks the checks needed before calling ConnectX or its Android WebView wrapper release-ready. A CI build passing does not replace testing on physical devices.

## Owner-reported test status

On 2026-11-26, the project owner confirmed that the remaining real-device checks were completed successfully. Earlier reports identify an iQOO Z10x running Android 16, plus a two-device test for offline messaging and voice/video calling. These are owner-reported results, not independently reproduced test results.

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

- [x] GitHub Actions quality workflow passed on 2026-11-26 for commit `ce64e50680bd228f6a1b2157494603761660ac50` (run [#32](https://github.com/samarthtgg/connectx/actions/runs/45769815082), job "Lint, type-check and production build", conclusion: success). The dependency install, ESLint, TypeScript check, and production build steps all completed successfully.
- [x] Vercel reported a READY production deployment for the same commit: [deployment details](https://vercel.com/samarthtgg/connectx/8a8fjbgosh2HGkRr4sLCDaQy4uaX).
- [ ] The latest deployment alias list contains only `connectx-git-main-samarthtgg.vercel.app`. Vercel lists `connectx-sandy.vercel.app` as a verified project domain, but it is not attached as an alias to that latest deployment. The `connectx-samarthtgg.vercel.app` project-domain lookup returned not found and it is not in the current project-domain list.
- [ ] Independently load and smoke-test both public deployment URLs from a normal browser/device. Automated page fetches in this review could not retrieve either URL, so their page content and end-user behavior are not confirmed.

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

The owner reports the real-device test coverage as complete, but those results have not been independently reproduced and the supporting evidence/version details remain outstanding. The GitHub Actions quality check and a Vercel production deployment were independently verified for commit `ce64e50680bd228f6a1b2157494603761660ac50`. The supplied home-screen screenshot is now included in the repository documentation. Android release signing, privacy/support readiness, custom-domain mappings, and public URL smoke tests are not yet verified. Do not call ConnectX fully release-ready, close issue #2, or publish a signed release until all remaining release gates are completed.
