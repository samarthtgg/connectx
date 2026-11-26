# ConnectX real-device test plan

This checklist tracks the checks needed before calling ConnectX or its Android WebView wrapper release-ready. A CI build passing does not replace testing on physical devices.

## Owner-reported test status

On 2026-11-26, the project owner confirmed that the real-device checks were completed successfully. Earlier reports identify an iQOO Z10x running Android 16, plus a two-device test for offline messaging and voice/video calling. These are owner-reported results, not independently reproduced test results.

The owner reports the device-test areas below as passed. Browser/WebView version details and sanitized supporting evidence have not been supplied.

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

- [x] GitHub Actions quality workflow passed for commit `66034f9bae176fa7a3cb74a5465ad2f43a7c6eaa` (run [#35](https://github.com/samarthtgg/connectx/actions/runs/45772221084), conclusion: success).
- [x] Vercel reports a READY production deployment for latest reviewed commit `2ac10505ad671a6569e42a45830ac24e7c688df7`: deployment `dpl_S5ZxNffqncpCivN4g6xqTEJEAjCT` ([deployment details](https://vercel.com/samarthtgg/connectx/S5ZxNffqncpCivN4g6xqTEJEAjCT)).
- [x] Vercel deployment alias list confirms both `connectx-samarthtgg.vercel.app` and `connectx-sandy.vercel.app` are assigned to that READY deployment (read-back checked 2026-11-26).
- [ ] Independently load and smoke-test both public URLs in a normal browser/device. Vercel deployment lookup resolves both hostnames to the same READY deployment, but an interactive browser/device smoke test remains outstanding.

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

The owner reports the real-device test coverage as complete, but those results have not been independently reproduced and browser/WebView version details plus sanitized evidence remain outstanding. GitHub Actions quality checks passed for commit `66034f9`. Vercel reports a READY production deployment for commit `2ac1050`, and its deployment alias read-back confirms both requested URLs are assigned to that deployment. Android release signing, privacy/support readiness, public browser/device smoke tests, and test evidence remain release gates. Do not call ConnectX fully release-ready, close issue #2, or publish a signed release until all remaining release gates are completed.
