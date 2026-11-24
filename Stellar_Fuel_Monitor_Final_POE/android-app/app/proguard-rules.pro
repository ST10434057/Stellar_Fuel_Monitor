# Retrofit/Gson models are reflected at runtime.
-keepattributes Signature
-keepattributes *Annotation*
-keep class za.co.stellar.fuelmonitor.data.** { *; }
-keep interface za.co.stellar.fuelmonitor.network.** { *; }
-dontwarn org.conscrypt.**
