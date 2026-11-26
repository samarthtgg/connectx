# Changelog

All notable, verified repository changes are recorded here.

## Unreleased

### Documentation and project readiness
- Added a real-device testing plan at `docs/REAL_DEVICE_TEST_PLAN.md`.
- Recorded the project owner's 2026-11-26 real-device test report as owner-reported rather than independently reproduced; browser/WebView version details and sanitized evidence remain outstanding.
- Updated the README with testing and release-readiness guidance.
- Added the MIT License and updated the README to identify the project license.
- Added structured bug-report and feature-request issue forms.
- Updated the quality workflow to run on every push to `main` and `release/**`, including documentation-only changes.
- Added the supplied actual ConnectX home-screen screenshot at `docs/screenshots/home-screen.png` and a README Home Screen Preview section. No other screen images were added.

### Verified checks (2026-11-26)
- GitHub Actions quality run [#32](https://github.com/samarthtgg/connectx/actions/runs/45769815082) passed for commit `ce64e50680bd228f6a1b2157494603761660ac50`; dependency installation, ESLint, TypeScript checking, and the production build all completed successfully.
- Vercel reported a READY production deployment for that same commit: [deployment details](https://vercel.com/samarthtgg/connectx/8a8fjbgosh2HGkRr4sLCDaQy4uaX).
- Vercel project metadata lists `connectx-sandy.vercel.app` as a verified project domain, but the latest deployment alias list contains only `connectx-git-main-samarthtgg.vercel.app`. The `connectx-samarthtgg.vercel.app` domain lookup returned not found. Neither requested custom domain is confirmed as an alias of the latest deployment.
- Public page fetches for both requested deployment URLs could not be completed in this review; browser/device smoke tests remain outstanding.
- The Android workflow references `connectx-app/android-wrapper`, but that directory and Android Gradle project files are absent from the current Git tree. The workflow is configured for a debug APK only; no production signing configuration or signed release artifact was verified.
- No privacy-policy file or route was found in the repository tree. `SECURITY.md` provides vulnerability-reporting guidance, not a general user-support channel; no user-facing support contact/page was identified.
- Owner-reported real-device tests are recorded as owner-reported, not independently verified; browser/WebView version details and sanitized evidence remain outstanding.
- No versioned GitHub release is listed. The app package reports version `0.1.1`; this changelog does not declare a new release.

### Remaining release gates
- Supply browser/WebView version details and sanitized real-device evidence for the owner-reported tests.
- Restore/add the actual Android wrapper project and configure a verified production signing workflow without committing signing secrets.
- Publish an accurate privacy policy and user-facing support information based on owner-confirmed practices.
- Map both requested custom domains to the intended production deployment and smoke-test them in a browser/device.
- Verify that the screenshot and README preview render correctly on GitHub after the documentation commit.
