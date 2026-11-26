# ConnectX Android WebView wrapper

Minimal Android shell for the public ConnectX web app.

- Package: `com.samarth.connectx`
- Version: `0.1.1` (versionCode 1)
- Minimum Android: 6.0 / API 23
- Compile/target SDK: 35
- Java: 17
- Gradle: 8.9 (installed by GitHub Actions)

The app loads the primary ConnectX URL over HTTPS. Navigation between the two ConnectX hosts remains inside the app; other HTTP(S) links open in the browser. JavaScript and DOM storage are enabled. Camera/microphone permissions are requested only when the page requests those resources. The file picker supports single and multiple file selection.

## Build

Open this directory in Android Studio or run `gradle assembleDebug`. The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

## Scope

This is a debug/test wrapper, not a signed production release. It does not include push-notification integration, custom deep-link routing, offline message storage, or release signing. Camera, microphone, file upload, and login still require physical-device testing against the live site. Never commit signing keys or credentials.
