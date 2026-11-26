# Changelog

All notable, verified repository changes are recorded here.

## Unreleased

### Documentation and project readiness
- Added a real-device testing plan at `docs/REAL_DEVICE_TEST_PLAN.md`.
- Recorded the project owner's 2026-11-26 report that the real-device test areas passed; browser/WebView version details and sanitized evidence remain outstanding.
- Updated the README with testing and release-readiness guidance.
- Added the MIT License and updated the README to identify the project license.
- Added structured bug-report and feature-request issue forms.
- Updated the quality workflow to run on every push to `main` and `release/**`, rather than only app/workflow-path changes.

### Verification notes
- The quality workflow was updated to trigger on documentation-only pushes as well. Its lint, TypeScript and production-build result for the latest commit must be checked in GitHub Actions before release.
- The latest known successful quality run before this workflow change was run [#28](https://github.com/samarthtgg/connectx/actions/runs/45759685899), on commit `81d9645`.
- No versioned GitHub release is listed. The app package currently reports version `0.1.1`; this changelog does not declare a new release.
- A Vercel deployment status is separate from the GitHub Actions quality checks.
