# First Android build / physical-device checklist

## Required software

- Android Studio
- Android SDK Platform 35
- JDK 17
- Internet connection for the first Gradle dependency sync

## Open the project

Open **`android-app/`**, not the repository root.

## Configure local values

Copy:

`android-app/local.properties.example`

to:

`android-app/local.properties`

For an emulator, the default API URL can use `10.0.2.2`. For a physical phone, use either:

- the hosted HTTPS API URL, or
- the development PC's LAN IP while phone and PC are on the same Wi-Fi.

## If Android Studio asks for Gradle configuration

The project build scripts are complete. GitHub Actions uses Gradle 8.10.2 directly. On Windows, generate the missing standard wrapper once from the `android-app/` terminal:

```text
powershell -ExecutionPolicy Bypass -File .\setup-gradle-wrapper.ps1
```

Then the usual `gradlew` / `gradlew.bat` commands become available.

## Physical phone

Enable Developer Options + USB debugging, connect the phone, select it in Android Studio and Run `app`.

Do not consider Part 2 ready until every required workflow has been tested on the physical device.
