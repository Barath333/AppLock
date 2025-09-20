package com.applock

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import android.provider.Settings
import android.content.ComponentName
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class AppLockModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val reactContext: ReactApplicationContext = reactContext
    private var receiver: BroadcastReceiver? = null

    override fun getName(): String = "AppLockModule"

    @ReactMethod
    fun addListener(eventName: String) {
        if (eventName == "onAppOpened") {
            setupReceiver()
        }
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        if (count == 0) {
            removeReceiver()
        }
    }

    private fun setupReceiver() {
        if (receiver == null) {
            receiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) {
                    if (intent.action == "APP_OPENED_ACTION") {
                        val packageName = intent.getStringExtra("packageName")
                        val className = intent.getStringExtra("className")
                        
                        Log.d("AppLockModule", "Received broadcast for package: $packageName")
                        
                        val params: WritableMap = Arguments.createMap()
                        params.putString("packageName", packageName)
                        params.putString("className", className)
                        
                        sendEvent("onAppOpened", params)
                    }
                }
            }
            
            val filter = IntentFilter("APP_OPENED_ACTION")
            
            // For Android 14+ we need to specify the receiver flags
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                reactContext.registerReceiver(receiver, filter)
            }
            
            Log.d("AppLockModule", "Broadcast receiver registered")
        }
    }

    private fun removeReceiver() {
        receiver?.let {
            reactContext.unregisterReceiver(it)
            receiver = null
            Log.d("AppLockModule", "Broadcast receiver unregistered")
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
            Log.d("AppLockModule", "Event sent: $eventName")
        } catch (e: Exception) {
            Log.e("AppLockModule", "Error sending event: ${e.message}")
        }
    }

    @ReactMethod
    fun bringToFront() {
        try {
            val activity = currentActivity
            activity?.runOnUiThread {
                try {
                    val intent = Intent(activity, activity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    }
                    activity.startActivity(intent)
                } catch (e: Exception) {
                    Log.e("AppLockModule", "Error bringing app to front: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e("AppLockModule", "Error in bringToFront: ${e.message}")
        }
    }

    @ReactMethod
    fun isAccessibilityServiceRunning(promise: Promise) {
        try {
            val accessibilityEnabled = Settings.Secure.getInt(
                reactApplicationContext.contentResolver,
                Settings.Secure.ACCESSIBILITY_ENABLED
            ) == 1
            
            if (accessibilityEnabled) {
                val services = Settings.Secure.getString(
                    reactApplicationContext.contentResolver,
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
                )
                val expectedService = ComponentName(
                    reactApplicationContext,
                    AppAccessibilityService::class.java
                ).flattenToString()
                
                promise.resolve(services?.contains(expectedService) ?: false)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("ACCESSIBILITY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isAppInForeground(promise: Promise) {
        try {
            val activity = currentActivity
            promise.resolve(activity != null && !activity.isFinishing)
        } catch (e: Exception) {
            promise.reject("APP_STATE_ERROR", e.message)
        }
    }
}