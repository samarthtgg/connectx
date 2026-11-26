# ConnectX real-device test plan

This checklist tracks verification needed before calling ConnectX or its Android WebView wrapper release-ready. CI success and an owner-confirmed debug-APK test are useful evidence, but they do not replace the remaining release checks.

## Owner-reported application tests

On 2026-11-26, the project owner confirmed that the web app login and direct-message send/receive flows work on both production URLs. Earlier owner reports also cover an iQOO Z10x running Android 16 and two-device testing for offline messaging and voice/video calling. These are owner-reported results, not independently reproduced end-to-end tests.

The owner has also confirmed that the newly built Android debug APK works on their device. The exact APK installation/test timestamp, browser version, Android System WebView version, and sanitized screenshots/recordings have not been supplied.

## Android and browser basics

- [x] Test on a current Android phone (owner-reported; iQOO Z10x / Android 16).
- [x] Test narrow and wide layouts, portrait and landscape (owner-reported).
- [x] Check keyboard resizing, scrolling, safe areas, and back navigation (owner-reported).
- [x] Check slow and interrupted network behavior (owner-reported).

## Accounts and privacy

- [x] Sign up, sign in, sign out, and password reset (owner-reported).
- [x] Verify username uniqueness and profile visibility rules (owner-reported).
- [x] Verify private-account friend acceptance rules (owner-reported).
- [x] Confirm one account cannot read or modify another account's private data (owner-reported).

## Messaging and media

- [x] Send and receive direct messages in both directions (owner-confirmed).
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

- [x] Android wrapper source added under `connectx-app/android-wrapper`.
- [x] GitHub Actions Android debug-APK build completed successfully (run [#5](https://github.com/samarthtgg/connectx/actions/runs/45776960135), commit `0797ba7672bf2279dd0423b12796432f0233b304`).
- [x] Build produced the `ConnectX-debug-apk` artifact (about 2.1 MB; artifact expires 2027-02-24).
- [x] Project owner installed/tested the newly built APK and confirmed it works.
- [ ] Record the exact phone model, Android version, Chrome version, Android System WebView version, and test date/time for this APK build.
- [ ] Attach sanitized evidence of the new APK test; do not include passwords, tokens, personal data, or real chat contents.

The wrapper currently supports the ConnectX web app in Android WebView, file selection, and on-demand camera/microphone permission handling. It is a debug/test shell. Push-notification integration, custom deep-link routing, offline storage, and production release signing are not implemented in this wrapper. Older owner-reported WebView tests should not be treated as proof that these features exist in the newly added wrapper.

## CI and deployment verification

- [x] GitHub Actions quality workflow passed for commit `66034f9bae176fa7a3cb74a5465ad2f43a7c6eaa` (run [#35](https://github.com/samarthtgg/connectx/actions/runs/45772221084)).
- [x] Android debug-APK workflow passed (run [#5](https://github.com/samarthtgg/connectx/actions/runs/45776960135)).
- [x] Both production aliases were read back on the same READY Vercel deployment: `connectx-samarthtgg.vercel.app` and `connectx-sandy.vercel.app`.
- [x] Independent browser smoke test loaded both public URLs and the chat-preview route; initial page load produced no page-level JavaScript errors.
- [x] Project owner confirmed login and send/receive messaging work on both URLs.
- [ ] Re-check both aliases after future production deployments and confirm they still resolve to the same deployment.

The browser smoke test was an unauthenticated UI check; it did not independently reproduce account login or message delivery. Those functional results above are owner-confirmed.

## Browser/WebView version and evidence record

| Field | Recorded value |
|---|---|
| Test date | 2026-11-26; exact APK test time not supplied |
| Device | iQOO Z10x (owner-reported) |
| Android version | Android 16 (owner-reported) |
| Browser name/version | Not supplied |
| Android System WebView version | Not supplied |
| Second test device/model/OS | Not supplied |
| Screenshots or recording | Not supplied; add sanitized evidence only |
| Test account | Use dedicated test accounts; never record passwords, tokens, or real chat content |

To complete this record, capture Chrome's version from Settings > About Chrome and Android System WebView's version from Settings > Apps > Android System WebView > App details.

## Privacy and support review

- [ ] Publish and review an accurate privacy policy based on actual data collection, use, sharing, retention, security, and account-deletion behavior. Policy details must come from the project owner rather than being guessed.
- [ ] Provide a user-facing support contact or support page. `SECURITY.md` is for vulnerability reporting, not general customer support.

## Evidence and release gate

- [ ] Record exact browser/WebView versions, test date/time, device details, and sanitized supporting evidence.
- [ ] Add production release signing only when a protected signing process is available; keep keys out of source control.
- [ ] Review and resolve release-blocking defects; retain retest evidence.
- [ ] Complete privacy-policy and user-support review before publishing.
- [ ] Decide whether to publish a GitHub Release after the release checks and signing decision.

## Current release status

The Android debug build passes and the project owner confirms that the newly built APK works. Both production URLs have been verified on the same deployment, and the owner confirms login and message send/receive on both. The project is not yet a production-signed Android release: exact device/browser evidence, privacy-policy and support details, and a protected release-signing process remain outstanding. Keep issue #2 open until its release gates are genuinely complete.
