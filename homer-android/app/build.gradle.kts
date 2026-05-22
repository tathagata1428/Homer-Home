import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

// Load secrets from local.properties (not committed)
val localProps = Properties().also { props ->
    val f = rootProject.file("local.properties")
    if (f.exists()) props.load(f.inputStream())
}

android {
    namespace = "ro.b4it.homer"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.homer.com"
        minSdk = 26
        targetSdk = 35
        versionCode = 7
        versionName = "1.3.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Supabase credentials — set in local.properties:
        //   SUPABASE_URL=https://fwzxxrldxnlhcyulkwrg.supabase.co
        //   SUPABASE_ANON_KEY=eyJ...
        buildConfigField("String", "SUPABASE_URL",
            "\"${localProps["SUPAB" +
                    "ASE_URL"] ?: "https://fwzxxrldxnlhcyulkwrg.supabase.co"}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY",
            "\"${localProps["SUPABASE_ANON_KEY"] ?: ""}\"")

        // AI gateway (OpenRouter)
        buildConfigField("String", "OC_GATEWAY_URL",
            "\"${localProps["OC_GATEWAY_URL"] ?: "https://openrouter.ai/api/v1"}\"")
        buildConfigField("String", "OC_GATEWAY_TOKEN",
            "\"${localProps["OC_GATEWAY_TOKEN"] ?: ""}\"")
        buildConfigField("String", "OC_MODEL",
            "\"${localProps["OC_MODEL"] ?: "inclusionai/ring-2.6-1t:free"}\"")
        // Ollama gateway for nemotron models (Debian server); set in local.properties
        buildConfigField("String", "NEMOCLAW_GATEWAY_URL",
            "\"${localProps["NEMOCLAW_GATEWAY_URL"] ?: ""}\"")
        buildConfigField("String", "NEMOCLAW_GATEWAY_TOKEN",
            "\"${localProps["NEMOCLAW_GATEWAY_TOKEN"] ?: ""}\"");

        // Homer website base URL
        buildConfigField("String", "HOMER_BASE_URL",
            "\"${localProps["HOMER_BASE_URL"] ?: "https://b4it.ro"}\"")

        // Supabase auto sign-in credentials (set in local.properties, never committed)
        buildConfigField("String", "SUPABASE_SYNC_EMAIL",
            "\"${localProps["SUPABASE_SYNC_EMAIL"] ?: ""}\"")
        buildConfigField("String", "SUPABASE_SYNC_PASSWORD",
            "\"${localProps["SUPABASE_SYNC_PASSWORD"] ?: ""}\"")
    }

    val keystorePath = localProps["KEYSTORE_PATH"] as String? ?: ""
    if (keystorePath.isNotEmpty()) {
        signingConfigs {
            create("release") {
                storeFile     = file(keystorePath)
                storePassword = localProps["KEYSTORE_PASSWORD"] as String? ?: ""
                keyAlias      = localProps["KEY_ALIAS"] as String? ?: ""
                keyPassword   = localProps["KEY_PASSWORD"] as String? ?: ""
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (keystorePath.isNotEmpty()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

dependencies {
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.splashscreen)

    // Compose
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    // Navigation
    implementation(libs.androidx.navigation.compose)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Room
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // DataStore
    implementation(libs.datastore.preferences)

    // Supabase — BOM pins all module versions; core makes SupabaseClient visible to KSP
    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.core)
    implementation(libs.supabase.postgrest)
    implementation(libs.supabase.auth)
    implementation(libs.supabase.realtime)
    implementation(libs.supabase.storage)
    implementation(libs.ktor.client.android)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.json)

    // Serialization + Coroutines
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    // Coil
    implementation(libs.coil.compose)

    // WorkManager + Hilt-Work
    implementation(libs.workmanager.ktx)
    implementation(libs.hilt.work)
    ksp(libs.hilt.work.compiler)

    // Media3
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.ui)
    implementation(libs.media3.session)

    // Security
    implementation(libs.security.crypto)

    // Accompanist
    implementation(libs.accompanist.permissions)
    implementation(libs.accompanist.systemuicontroller)

    // OkHttp
    implementation(libs.okhttp)

    // Location
    implementation(libs.play.services.location)

    // Chrome Custom Tabs
    implementation(libs.browser)
}
