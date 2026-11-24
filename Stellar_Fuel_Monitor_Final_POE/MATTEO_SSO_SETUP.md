# Matteo — Final SSO setup before the demo

The Kotlin SSO code is already implemented. These are account/project values that cannot safely be invented or committed by someone else.

## Firebase setup

1. Open Firebase Console and create/select the group's Stellar project.
2. Add an **Android app** with package name:
   `za.co.stellar.fuelmonitor`
3. In Firebase Authentication, enable **Google**.
4. If Microsoft will be demonstrated, enable the **Microsoft** provider and complete its Azure/Microsoft OAuth setup.
5. In Google Cloud/Firebase, obtain the OAuth **Web client ID** used as the ID-token audience.
6. In `android-app/`, copy `local.properties.example` to `local.properties`.
7. Fill in:
   - `FIREBASE_API_KEY`
   - `FIREBASE_APP_ID`
   - `FIREBASE_PROJECT_ID`
   - `GOOGLE_WEB_CLIENT_ID`
8. Do not commit `local.properties`.

No `google-services.json` is required in this assessment copy because Firebase is initialised programmatically from local-only BuildConfig values.

## Test sequence

1. Launch app.
2. Tap **Sign in with Google**.
3. Select an account.
4. Confirm Dashboard opens.
5. Close/reopen app and confirm Firebase restores the session.
6. Open More > Settings and change preferences.
7. Reopen Settings and confirm values persist.
8. Open More > Profile and Sign out.
9. Confirm the Login screen returns.

The debug-only local-preview button disappears as soon as valid Firebase values are configured and is not a substitute for the required SSO demonstration.
