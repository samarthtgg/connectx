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

### Verified checks (2026-11-26)
- GitHub Actions quality run [#31](https://github.com/samarthtgg/connectx/actions/runs/45764431883) passed for commit `34c201544aad83d2eccb2825bbac827e3081c987`; its lint, type-check, and production-build job completed successfully.
- Vercel reported a READY production deployment for that same commit: [deployment details](https://vercel.com/samarthtgg/connectx/tTLQZdEXQuxB6sPanhzu1mYx4YR3).
- Vercel project metadata lists `connectx-samarthtgg.vercel.app` and `connectx-sandy.vercel.app`; the latest deployment's alias list returned only `connectx-git-main-samarthtgg.vercel.app`. Both requested custom-domain mappings to the latest deployment therefore remain unverified.
- The repository contains a debug-APK workflow, but the referenced `connectx-app/android-wrapper` source directory is absent from the current Git tree. No production signing configuration was verified.
- No privacy-policy file or route was found in the repository tree. `SECURITY.md` provides vulnerability-reporting guidance, not a general user-support channel; a user-facing support contact/page was not identified.
- The requested home-screen image is not yet committed at `docs/screenshots/home-screen.png`; the README preview section is therefore not yet added.
- No versioned GitHub release is listed. The app package reports version `0.1.1`; this changelog does not declare a new release.

### Remaining release gates
- Supply browser/WebView version details and sanitized real-device evidence for the owner-reported tests.
- Restore/add the actual Android wrapper project and configure a verified production signing workflow without committing signing secrets.
- Publish an accurate privacy policy and user-facing support information.
- Verify both custom domains resolve to the intended production deployment and smoke-test them in a browser/device.
- Commit the real home-screen screenshot and verify its README rendering on GitHub.
