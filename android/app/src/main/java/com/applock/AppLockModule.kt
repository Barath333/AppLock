package com.applock

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class AppLockModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val reactContext: ReactApplicationContext = reactContext

    override fun getName(): String = "AppLockModule"

    @ReactMethod
    fun addListener(eventName: String) {
        Log.d("AppLockModule", "addListener called for: $eventName")
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        Log.d("AppLockModule", "removeListeners called with count: $count")
    }

    @ReactMethod
    fun bringToFront() {
        try {
            Log.d("AppLockModule", "🚀 Bringing app to front")
            val activity = currentActivity
            activity?.runOnUiThread {
                try {
                    val intent = android.content.Intent(activity, activity::class.java).apply {
                        addFlags(android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                                android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                                android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    }
                    activity.startActivity(intent)
                    Log.d("AppLockModule", "✅ App brought to front successfully")
                } catch (e: Exception) {
                    Log.e("AppLockModule", "❌ Error bringing app to front: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error in bringToFront: ${e.message}")
        }
    }

    @ReactMethod
    fun closeLockScreen() {
        try {
            val activity = currentActivity
            activity?.runOnUiThread {
                activity.finish()
            }
            Log.d("AppLockModule", "✅ Lock screen closed")
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error closing lock screen: ${e.message}")
        }
    }

    @ReactMethod
    fun isAccessibilityServiceRunning(promise: Promise) {
        try {
            val accessibilityEnabled = android.provider.Settings.Secure.getInt(
                reactApplicationContext.contentResolver,
                android.provider.Settings.Secure.ACCESSIBILITY_ENABLED
            ) == 1

            if (accessibilityEnabled) {
                val services = android.provider.Settings.Secure.getString(
                    reactApplicationContext.contentResolver,
                    android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
                )
                val expectedService = "${reactApplicationContext.packageName}/com.applock.AppAccessibilityService"
                val isEnabled = services?.contains(expectedService) ?: false
                Log.d("AppLockModule", "♿ Accessibility service enabled: $isEnabled")
                promise.resolve(isEnabled)
            } else {
                Log.d("AppLockModule", "♿ Accessibility service disabled")
                promise.resolve(false)
            }
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error checking accessibility: ${e.message}")
            promise.reject("ACCESSIBILITY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getLockedApps(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
            val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
            
            Log.d("AppLockModule", "📋 Getting locked apps from native: $lockedApps")
            
            val result = WritableNativeArray()
            lockedApps.forEach { packageName ->
                result.pushString(packageName)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error getting locked apps: ${e.message}")
            promise.reject("LOCKED_APPS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setLockedApps(lockedApps: ReadableArray, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
            val editor = prefs.edit()
            val appsSet = mutableSetOf<String>()
            
            Log.d("AppLockModule", "💾 Setting locked apps in native: ${lockedApps.size()}")
            
            for (i in 0 until lockedApps.size()) {
                val packageName = lockedApps.getString(i)
                if (packageName != null) {
                    appsSet.add(packageName)
                    Log.d("AppLockModule", "   - $packageName")
                }
            }
            
            editor.putStringSet("lockedApps", appsSet)
            editor.apply()
            
            Log.d("AppLockModule", "✅ Locked apps saved successfully")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error setting locked apps: ${e.message}")
            promise.reject("SET_LOCKED_APPS_ERROR", e.message)
        }
    }

    // Method to send events to React Native
    fun sendAppLockedEvent(packageName: String, className: String?) {
        try {
            Log.d("AppLockModule", "📤 Sending onAppLocked event to React Native: $packageName")
            
            val params = WritableNativeMap().apply {
                putString("packageName", packageName)
                putString("className", className)
                putString("timestamp", System.currentTimeMillis().toString())
            }
            
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onAppLocked", params)
                
            Log.d("AppLockModule", "✅ Event sent successfully")
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error sending event: ${e.message}")
        }
    }
}