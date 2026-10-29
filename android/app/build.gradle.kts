import java.util.Properties
plugins { id("com.android.application") }
val appVersion = Properties().apply { rootProject.file("../version.properties").inputStream().use { load(it) } }
android {
    namespace = "com.projectlist.aiworkjob"
    compileSdk = 36
    defaultConfig { applicationId = "com.projectlist.aiworkjob"; minSdk = 26; targetSdk = 36; versionCode = appVersion.getProperty("versionCode").toInt(); versionName = appVersion.getProperty("versionName") }
    sourceSets.getByName("main").assets.srcDir("../../web")
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    buildTypes { release { isMinifyEnabled = false } }
}
