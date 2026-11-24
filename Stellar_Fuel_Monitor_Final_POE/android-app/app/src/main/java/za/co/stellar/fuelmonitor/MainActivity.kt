package za.co.stellar.fuelmonitor

import android.os.Bundle
import android.util.Log
import androidx.activity.compose.setContent
import androidx.fragment.app.FragmentActivity
import za.co.stellar.fuelmonitor.ui.StellarRoot
import za.co.stellar.fuelmonitor.ui.theme.StellarTheme

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i("StellarLifecycle", "MainActivity.onCreate")
        val container = (application as StellarApplication).container
        setContent {
            StellarTheme {
                StellarRoot(container)
            }
        }
    }

    override fun onStart() { super.onStart(); Log.d("StellarLifecycle", "MainActivity.onStart") }
    override fun onResume() { super.onResume(); Log.d("StellarLifecycle", "MainActivity.onResume") }
    override fun onPause() { Log.d("StellarLifecycle", "MainActivity.onPause"); super.onPause() }
    override fun onStop() { Log.d("StellarLifecycle", "MainActivity.onStop"); super.onStop() }
}
