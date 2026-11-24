package za.co.stellar.fuelmonitor.auth

import android.app.Activity
import android.content.Context
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.OAuthProvider
import kotlinx.coroutines.tasks.await
import za.co.stellar.fuelmonitor.BuildConfig
import za.co.stellar.fuelmonitor.firebase.FirebaseBootstrap

/** Firebase Google/Microsoft Single Sign-On with secrets supplied outside source control. */
class AuthManager(private val context: Context) {
    private val firebaseApp: FirebaseApp? = FirebaseBootstrap.initialise(context)
    private val auth: FirebaseAuth? = firebaseApp?.let(FirebaseAuth::getInstance)

    val isConfigured: Boolean
        get() = firebaseApp != null && BuildConfig.GOOGLE_WEB_CLIENT_ID.isNotBlank()

    val currentUser: UserSession?
        get() = auth?.currentUser?.let {
            UserSession(
                uid = it.uid,
                displayName = it.displayName ?: "Stellar user",
                email = it.email ?: "",
                photoUrl = it.photoUrl?.toString(),
                provider = it.providerData.getOrNull(1)?.providerId ?: "firebase"
            )
        }

    suspend fun idToken(): String? = runCatching {
        auth?.currentUser?.getIdToken(false)?.await()?.token
    }.getOrNull()

    suspend fun signInWithGoogle(activity: Activity): Result<UserSession> = runCatching {
        val firebaseAuth = auth ?: error(configurationMessage())
        check(BuildConfig.GOOGLE_WEB_CLIENT_ID.isNotBlank()) { configurationMessage() }

        Log.i(TAG, "Starting Google SSO")
        val credentialManager = CredentialManager.create(activity)
        val googleOption = GetGoogleIdOption.Builder()
            .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .setFilterByAuthorizedAccounts(false)
            .setAutoSelectEnabled(false)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleOption)
            .build()

        val result = try {
            credentialManager.getCredential(activity, request)
        } catch (e: GetCredentialException) {
            Log.w(TAG, "Google credential request failed: ${e.type}", e)
            throw e
        }

        val credential = result.credential
        check(credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            "Google returned an unsupported credential type"
        }

        val googleCredential = GoogleIdTokenCredential.createFrom(credential.data)
        val firebaseCredential = GoogleAuthProvider.getCredential(googleCredential.idToken, null)
        val authResult = firebaseAuth.signInWithCredential(firebaseCredential).await()
        val user = authResult.user ?: error("Firebase sign-in did not return a user")
        Log.i(TAG, "Google SSO success for uid=${user.uid}")
        UserSession(user.uid, user.displayName ?: "Stellar user", user.email ?: "", user.photoUrl?.toString(), "google.com")
    }.onFailure { Log.e(TAG, "Google SSO failed", it) }

    suspend fun signInWithMicrosoft(activity: Activity): Result<UserSession> = runCatching {
        val firebaseAuth = auth ?: error(configurationMessage())
        Log.i(TAG, "Starting Microsoft SSO")
        val provider = OAuthProvider.newBuilder("microsoft.com")
        provider.addCustomParameter("prompt", "select_account")
        val authResult = firebaseAuth.pendingAuthResult?.await()
            ?: firebaseAuth.startActivityForSignInWithProvider(activity, provider.build()).await()
        val user = authResult.user ?: error("Microsoft sign-in did not return a user")
        Log.i(TAG, "Microsoft SSO success for uid=${user.uid}")
        UserSession(user.uid, user.displayName ?: "Stellar user", user.email ?: "", user.photoUrl?.toString(), "microsoft.com")
    }.onFailure { Log.e(TAG, "Microsoft SSO failed", it) }

    fun signOut() {
        Log.i(TAG, "Signing out current user")
        auth?.signOut()
    }

    private fun configurationMessage() =
        "Firebase SSO needs this group's Firebase values in android-app/local.properties. See FINAL_POE_SETUP.md."

    companion object {
        private const val TAG = "StellarAuth"
    }
}

data class UserSession(
    val uid: String,
    val displayName: String,
    val email: String,
    val photoUrl: String?,
    val provider: String
)
