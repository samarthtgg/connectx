# ConnectX real-device test plan

This checklist tracks the checks needed before calling ConnectX or its Android WebView wrapper release-ready. A CI build passing does not replace testing on physical devices.

## Android and browser basics

- [ ] Test on a current Android phone using Chrome.
- [ ] Test narrow and wide layouts, portrait and landscape.
- [ ] Check keyboard resizing, scrolling, safe areas, and back navigation.
- [ ] Check slow and interrupted network behavior.

## Accounts and privacy

- [ ] Sign up, sign in, sign out, and password reset.
- [ ] Verify username uniqueness and profile visibility rules.
- [ ] Verify private-account friend acceptance rules.
- [ ] Confirm one account cannot read or modify another account's private data.

## Messaging and media

- [ ] Send and receive direct messages in both directions.
- [ ] Test group creation, membership, roles, and message permissions.
- [ ] Test image and video upload, preview, download, and expiry cleanup.
- [ ] Test reply, forward, delete, archive, pin, and disappearing-message behavior.
- [ ] Test offline send/retry and duplicate prevention.

## Status and calling

- [ ] Create, view, react to, and reply to status updates.
- [ ] Test camera and microphone permission prompts.
- [ ] Test voice and video calls on two real devices and on different networks.
- [ ] Verify permissions are not requested before a feature needs them.

## Android WebView wrapper

- [ ] Install the debug APK from the Actions artifact.
- [ ] Test login redirects, file picker, camera, microphone, and media playback.
- [ ] Test notification behavior and deep links.
- [ ] Test app pause/resume, process restart, and back button behavior.
- [ ] Confirm the wrapper handles unavailable network and expired sessions clearly.

## Evidence and release gate

- [ ] Record device model, Android version, browser/WebView version, and test date.
- [ ] Attach screenshots or short recordings with private data removed.
- [ ] Fix release-blocking defects and rerun the relevant checks.
- [ ] Do not publish a signed release until signing, privacy/support information, and release permissions are reviewed.
