import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use(::load)
}

fun rawValue(name: String, fallback: String = ""): String =
    localProperties.getProperty(name) ?: System.getenv(name) ?: fallback

fun buildConfigValue(name: String, fallback: String = ""): String =
    rawValue(name, fallback).replace("\\", "\\\\").replace("\"", "\\\"")

val releaseKeystore = rawValue("RELEASE_KEYSTORE_PATH")
val releaseAlias = rawValue("RELEASE_KEY_ALIAS")
val releaseStorePassword = rawValue("RELEASE_KEYSTORE_PASSWORD")
val releaseKeyPassword = rawValue("RELEASE_KEY_PASSWORD")
val releaseSigningConfigured = listOf(
    releaseKeystore,
    releaseAlias,
    releaseStorePassword,
    releaseKeyPassword
).all { it.isNotBlank() }

android {
    namespace = "za.co.stellar.fuelmonitor"
    compileSdk = 35

    defaultConfig {
        applicationId = "za.co.stellar.fuelmonitor"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "3.0-final-poe"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "STELLAR_API_BASE_URL", "\"${buildConfigValue("STELLAR_API_BASE_URL", "http://10.0.2.2:3000/api/")}\"")
        buildConfigField("String", "FIREBASE_API_KEY", "\"${buildConfigValue("FIREBASE_API_KEY")}\"")
        buildConfigField("String", "FIREBASE_APP_ID", "\"${buildConfigValue("FIREBASE_APP_ID")}\"")
        buildConfigField("String", "FIREBASE_PROJECT_ID", "\"${buildConfigValue("FIREBASE_PROJECT_ID")}\"")
        buildConfigField("String", "FIREBASE_MESSAGING_SENDER_ID", "\"${buildConfigValue("FIREBASE_MESSAGING_SENDER_ID")}\"")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${buildConfigValue("GOOGLE_WEB_CLIENT_ID")}\"")
        buildConfigField("String", "PLAY_STORE_PRIVACY_URL", "\"${buildConfigValue("PLAY_STORE_PRIVACY_URL", "https://example.com/privacy")}\"")
    }

    signingConfigs {
        if (releaseSigningConfigured) {
            create("release") {
                storeFile = rootProject.file(releaseKeystore)
                storePassword = releaseStorePassword
                keyAlias = releaseAlias
                keyPassword = releaseKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (releaseSigningConfigured) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.fragment:fragment-ktx:1.8.5")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-messaging")
    implementation("androidx.credentials:credentials:1.5.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.5.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("com.google.code.gson:gson:2.11.0")
}
