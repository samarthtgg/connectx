# ConnectX v1.0 — Release Master Plan

Status: **Released — production aliases assigned; post-release hardening remains open**  
Release name: **ConnectX 1.0 — Bumpy**  
Release branch: `release/v1.0`  
Release package version: `1.0.0`  
Release commit: `a40f3616987e9074e4147b3ba11d7ffe69e3c8cd`  
Vercel deployment: `dpl_HzaNvASixx3T5hH4fagS4zEREDrY`  
Deployment URL: https://connectx-fiq6duif5-samarthtgg.vercel.app/

## Production promotion record

The READY deployment above was assigned to both production aliases on 12 November 2026:
- https://connectx-samarthtgg.vercel.app/
- https://connectx-sandy.vercel.app/

Vercel's deployment-alias listing confirmed both aliases on the release deployment. Both production URLs were also fetched successfully after promotion and returned ConnectX content.

This records the deployment and alias promotion only. It does **not** mean every v1.0 workstream or release gate below has passed.

## Release promise

ConnectX v1.0 is a major product release focused on dependable communication, privacy, speed, and a consistent experience across mobile and desktop. A feature is not considered fully verified until its UI, database behavior, permissions, failure states, and production behavior have been tested.

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

## Release gates and post-release verification

- [ ] Full repository and database audit completed.
- [ ] Critical and high-severity security issues resolved.
- [x] Production build and TypeScript checks passed on the release commit. Lint and full regression testing remain open.
- [ ] Existing core flows pass regression testing.
- [ ] Scheduled messages verified end to end, including background delivery.
- [x] Both production aliases assigned to the same READY deployment and checked after promotion.
- [ ] Mobile and desktop smoke tests pass.
- [ ] Release notes and rollback procedure fully documented and verified.

## Deployment policy

The v1.0 release was built from `release/v1.0`. The production aliases listed above were assigned to the same READY deployment. For future releases, promote only a verified READY deployment to both aliases, then record its deployment ID, commit SHA, build result, and alias verification here.

## Scope discipline

Workstreams above are targets, not claims that features already exist or are complete. The production release is live, but unfinished or unverified functionality must remain explicitly marked as such. Continue with small, tested post-release hardening changes; do not mark a gate complete without evidence.

## Initial audit findings — 12 November 2026

- The v1.0 release commit deployed successfully to a READY Vercel deployment.
- The package and lockfile release version were updated to `1.0.0`.
- The production database has RLS enabled on the inspected public tables.
- Supabase security advisors report six authenticated-callable SECURITY DEFINER RPC functions. Their current bodies include `auth.uid()` checks and ownership/group-membership checks; these still need targeted abuse tests before changing grants or execution mode.
- Supabase Auth leaked-password protection is disabled. This is a dashboard-level security setting and remains an open security task.
- Performance advisors report several unindexed foreign keys and multiple permissive RLS policies. Review query patterns and policy semantics before applying indexes or consolidating policies.
- The scheduled-message flow exists, but actual background delivery and cancellation still require end-to-end verification.

These are audit findings, not a declaration that the listed risks are already fixed.
