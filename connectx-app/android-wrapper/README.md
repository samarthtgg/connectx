# ConnectX Android wrapper

This Android project packages the existing ConnectX website in an Android WebView.

- Application ID: `com.samarthtgg.connectx`
- Website: `https://connectx-samarthtgg.vercel.app/`
- Internet is required.
- Camera and microphone access are requested by Android only when the website asks for them.

## Build a test APK

Open this folder in Android Studio, allow Gradle sync, then run **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

Or use Gradle from this directory:

```bash
gradle assembleDebug
```

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

## Before public release

1. Test sign-in, messaging, uploads, notifications, calls, camera and microphone on real Android devices.
2. Add a proper ConnectX launcher icon and confirm the app's privacy policy and support details.
3. Create and protect a release signing key. Never commit the keystore or passwords to GitHub.
4. Build and sign a release APK, then test the signed APK before submitting it to an app store.

This wrapper is an initial test build, not yet a store-ready release. Some browser-dependent features may need native Android integration.
