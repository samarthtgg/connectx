# ConnectX real-device test plan

This checklist tracks the checks needed before calling ConnectX or its Android WebView wrapper release-ready. A CI build passing does not replace testing on physical devices.

## Owner-reported test status

On 2026-11-26, the project owner confirmed that the remaining real-device checks were completed successfully. The earlier reports identify an iQOO Z10x running Android 16, plus a two-device test for offline messaging and voice/video calling. These are owner-reported results, not independently reproduced test results.

The owner reports the device-test areas below as passed. Browser/WebView version details and sanitized supporting evidence have not yet been supplied.

## Android and browser basics

- [x] Test on a current Android phone.
- [x] Test narrow and wide layouts, portrait and landscape.
- [x] Check keyboard resizing, scrolling, safe areas, and back navigation.
- [x] Check slow and interrupted network behavior.

## Accounts and privacy

- [x] Sign up, sign in, sign out, and password reset.
- [x] Verify username uniqueness and profile visibility rules.
- [x] Verify private-account friend acceptance rules.
- [x] Confirm one account cannot read or modify another account's private data.

## Messaging and media

- [x] Send and receive direct messages in both directions.
- [x] Test group creation, membership, roles, and message permissions.
- [x] Test image and video upload, preview, download, and expiry cleanup.
- [x] Test reply, forward, delete, archive, pin, and disappearing-message behavior.
- [x] Test offline send/retry and duplicate prevention.

## Status and calling

- [x] Create, view, react to, and reply to status updates.
- [x] Test camera and microphone permission prompts.
- [x] Test voice and video calls on two real devices and on different networks.
- [x] Verify permissions are not requested before a feature needs them.

## Android WebView wrapper

- [x] Install and test the Android WebView app.
- [x] Test login redirects, file picker, camera, microphone, and media playback.
- [x] Test notification behavior and deep links.
- [x] Test app pause/resume, process restart, and back button behavior.
- [x] Confirm the wrapper handles unavailable network and expired sessions clearly.

## Evidence and release gate

- [ ] Record the browser/WebView version and exact test date alongside the device and Android version.
- [ ] Attach screenshots or short recordings with private data removed.
- [ ] Review any release-blocking defects and retain retest evidence.
- [ ] Review signing, privacy/support information, and release permissions before publishing a signed release.

## Current release status

Real-device test coverage is marked complete based on the owner's report. This does not independently verify the tests or complete the evidence and release-review items above. Do not call ConnectX fully release-ready or publish a signed release until those remaining items are completed.
