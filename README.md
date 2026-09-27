# РемонтPRO

Android/Capacitor project for the РемонтPRO renovation estimator.

## GitHub APK build

The workflow **Build RemontPRO APK** automatically builds a debug APK on every push to `main` and can also be started manually from GitHub Actions.

The APK is published as the workflow artifact:

`RemontPRO-v14-debug-apk`

## Local build

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

Then build the APK from Android Studio.

## Version

v14.0.0 — editable rates with pencil buttons and saved prices.
