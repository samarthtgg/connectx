# ConnectX v1.0 — Release Master Plan

Status: In development  
Release branch: `release/v1.0`  
Current development package version: `1.0.0-beta.1`  
Production remains on the last verified release until v1.0 passes the release gate.

## Release promise

ConnectX v1.0 is a major product release focused on dependable communication, privacy, speed, and a consistent experience across mobile and desktop. A feature is not considered shipped until its UI, database behavior, permissions, failure states, and production behavior have been tested.

## Workstreams

### 1. Stability and foundations
- Audit all routes, components, Supabase tables, policies, storage buckets, and scheduled jobs.
- Resolve existing build regressions before adding high-risk features.
- Add reliable loading, empty, offline, retry, and error states.
- Check responsive layouts and accessibility on mobile and desktop.
- Verify authentication, account recovery, passkeys, and session handling.

### 2. Messaging
- Verify direct and group messaging, replies, edits, deletes, reactions, media, voice messages, drafts, pins, archive, blocking, disappearing messages, and scheduled messages.
- Improve search and media discovery.
- Verify scheduled delivery, cancellation, timezone handling, and failure reporting end to end.

### 3. Calls and presence
- Test audio/video call setup, permissions, reconnects, missed calls, and call termination.
- Improve call-state feedback and mobile controls.
- Verify presence and last-seen privacy rules.

### 4. Privacy and account safety
- Audit row-level security and storage access for every user-owned resource.
- Review blocked-user behavior across direct messages, groups, and requests.
- Add device/session visibility and revocation only with a secure server-backed design.
- Do not advertise end-to-end encryption unless a complete, independently reviewed implementation is actually shipped.

### 5. Personalisation and accessibility
- Verify all supported translations across the entire app, including navigation, dialogs, notifications, and errors.
- Review profile controls, themes, notification preferences, and Puppy behavior.
- Check keyboard, screen-reader, contrast, and reduced-motion behavior.

### 6. Performance and quality
- Measure startup, navigation, chat rendering, image loading, and large conversation performance.
- Reduce avoidable queries and re-renders without weakening data correctness.
- Test common mobile browsers and desktop browsers.

## Release gates

- [ ] Full repository and database audit completed.
- [ ] Critical and high-severity security issues resolved.
- [ ] Production build and lint/type checks pass.
- [ ] Existing core flows pass regression testing.
- [ ] Scheduled messages verified end to end, including background delivery.
- [ ] Both production URLs serve the exact same READY deployment.
- [ ] Mobile and desktop smoke tests pass.
- [ ] Release notes, version, and rollback deployment are prepared.

## Deployment policy

All v1.0 development happens on `release/v1.0`. Do not move either production alias while the release is unfinished. Promote one verified READY deployment to both:
- https://connectx-samarthtgg.vercel.app/
- https://connectx-sandy.vercel.app/

Record the deployment ID, commit SHA, build result, and alias verification before announcing v1.0.

## Scope discipline

Workstreams above are targets, not claims that features already exist or are complete. Audit first, prioritize defects and security, then implement in small verified changes. Keep unfinished or unverified features out of the final release announcement.
