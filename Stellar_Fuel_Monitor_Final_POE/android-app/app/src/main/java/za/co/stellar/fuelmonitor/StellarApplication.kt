package za.co.stellar.fuelmonitor

import android.app.Application
import android.util.Log
import za.co.stellar.fuelmonitor.firebase.FirebaseBootstrap
import za.co.stellar.fuelmonitor.notifications.NotificationSupport

class StellarApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        Log.i("StellarLifecycle", "Application created")
        FirebaseBootstrap.initialise(this)
        NotificationSupport.createChannel(this)
        container = AppContainer(this)
    }
}
