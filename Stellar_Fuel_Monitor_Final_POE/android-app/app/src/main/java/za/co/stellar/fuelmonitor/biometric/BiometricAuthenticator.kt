package za.co.stellar.fuelmonitor.biometric

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

data class BiometricCapability(
    val available: Boolean,
    val message: String
)

/** Native Android biometric gate used after SSO and when the app resumes. */
class BiometricAuthenticator {
    private val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG

    fun capability(activity: FragmentActivity): BiometricCapability {
        val code = BiometricManager.from(activity).canAuthenticate(authenticators)
        return when (code) {
            BiometricManager.BIOMETRIC_SUCCESS -> BiometricCapability(true, "Fingerprint / face authentication is ready")
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> BiometricCapability(false, "No fingerprint or face is enrolled on this phone")
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> BiometricCapability(false, "This phone has no supported biometric hardware")
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> BiometricCapability(false, "Biometric hardware is temporarily unavailable")
            else -> BiometricCapability(false, "Biometric authentication is not available on this phone")
        }
    }

    suspend fun authenticate(activity: FragmentActivity): Result<Unit> = suspendCancellableCoroutine { continuation ->
        val capability = capability(activity)
        if (!capability.available) {
            continuation.resume(Result.failure(IllegalStateException(capability.message)))
            return@suspendCancellableCoroutine
        }

        val executor = ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    if (continuation.isActive) continuation.resume(Result.success(Unit))
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    if (continuation.isActive) {
                        continuation.resume(Result.failure(IllegalStateException(errString.toString())))
                    }
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock Stellar Fuel Monitor")
            .setSubtitle("Verify with your enrolled fingerprint or face")
            .setAllowedAuthenticators(authenticators)
            .setConfirmationRequired(false)
            .setNegativeButtonText("Cancel")
            .build()

        prompt.authenticate(promptInfo)
        continuation.invokeOnCancellation { prompt.cancelAuthentication() }
    }
}
