package com.applock

import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
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
                                android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP or
                                android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP)
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
    fun getPendingLockedApp(promise: Promise) {
        try {
            Log.d("AppLockModule", "🔍 Checking for pending locked app")
            val packageName = getPendingLockedAppFromPrefs()
            val className = getPendingLockedClassFromPrefs()
            
            if (packageName != null) {
                Log.d("AppLockModule", "📦 Found pending locked app: $packageName")
                val result = WritableNativeMap().apply {
                    putString("packageName", packageName)
                    putString("className", className)
                    putString("timestamp", System.currentTimeMillis().toString())
                }
                promise.resolve(result)
                
                // Clear the pending app after retrieving
                clearPendingLockedApp()
            } else {
                Log.d("AppLockModule", "📭 No pending locked app found")
                promise.resolve(null)
            }
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error getting pending locked app: ${e.message}")
            promise.reject("PENDING_APP_ERROR", e.message)
        }
    }

    private fun getPendingLockedAppFromPrefs(): String? {
        return try {
            val prefs = reactContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
            val packageName = prefs.getString("pendingLockedPackage", null)
            val timestamp = prefs.getLong("pendingLockedTimestamp", 0)
            
            // Only return if it's recent (within 30 seconds)
            if (packageName != null && System.currentTimeMillis() - timestamp < 30000) {
                packageName
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error getting pending locked app from prefs: ${e.message}")
            null
        }
    }

    private fun getPendingLockedClassFromPrefs(): String? {
        return try {
            val prefs = reactContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
            prefs.getString("pendingLockedClass", null)
        } catch (e: Exception) {
            null
        }
    }

    private fun clearPendingLockedApp() {
        try {
            val prefs = reactContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
            val editor = prefs.edit()
            editor.remove("pendingLockedPackage")
            editor.remove("pendingLockedClass")
            editor.remove("pendingLockedTimestamp")
            editor.apply()
            Log.d("AppLockModule", "🧹 Cleared pending locked app")
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error clearing pending locked app: ${e.message}")
        }
    }

    @ReactMethod
    fun launchApp(packageName: String) {
        try {
            Log.d("AppLockModule", "🚀 Launching original app: $packageName")
            
            // Temporarily unlock the app in accessibility service
            temporarilyUnlockApp(packageName)
            
            val activity = currentActivity
            
            Handler(Looper.getMainLooper()).post {
                try {
                    // Get the launch intent for the original app
                    val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(packageName)
                    if (launchIntent != null) {
                        // Use standard flags for launching app
                        launchIntent.flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                                           android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK
                        
                        // Start the original app
                        reactContext.startActivity(launchIntent)
                        Log.d("AppLockModule", "✅ Original app launched: $packageName")
                        
                        // Move our app to background after a short delay
                        Handler(Looper.getMainLooper()).postDelayed({
                            moveTaskToBack(activity)
                        }, 300)
                    } else {
                        Log.e("AppLockModule", "❌ No launch intent found for: $packageName")
                        // Fallback: move to background
                        moveTaskToBack(activity)
                    }
                } catch (e: Exception) {
                    Log.e("AppLockModule", "❌ Error launching app: ${e.message}", e)
                    // Fallback: move to background
                    moveTaskToBack(activity)
                }
            }
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error in launchApp: ${e.message}", e)
        }
    }

    private fun temporarilyUnlockApp(packageName: String) {
        try {
            // Store in SharedPreferences for accessibility service
            val prefs = reactContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
            val editor = prefs.edit()
            val tempUnlockedApps = prefs.getStringSet("tempUnlockedApps", mutableSetOf()) ?: mutableSetOf()
            tempUnlockedApps.add(packageName)
            editor.putStringSet("tempUnlockedApps", tempUnlockedApps)
            editor.apply()
            Log.d("AppLockModule", "🔓 Temporarily unlocked app in SharedPreferences: $packageName")
            
            // Remove after 10 seconds
            Handler(Looper.getMainLooper()).postDelayed({
                val updatedPrefs = reactContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
                val updatedEditor = updatedPrefs.edit()
                val updatedTempUnlockedApps = updatedPrefs.getStringSet("tempUnlockedApps", mutableSetOf()) ?: mutableSetOf()
                updatedTempUnlockedApps.remove(packageName)
                updatedEditor.putStringSet("tempUnlockedApps", updatedTempUnlockedApps)
                updatedEditor.apply()
                Log.d("AppLockModule", "⏰ Temporary unlock expired for: $packageName")
            }, 10000)
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error temporarily unlocking app: ${e.message}")
        }
    }

    private fun moveTaskToBack(activity: android.app.Activity?) {
        try {
            activity?.moveTaskToBack(true)
            Log.d("AppLockModule", "📱 App moved to background")
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error moving app to background: ${e.message}")
            activity?.finish()
        }
    }

    @ReactMethod
    fun closeLockScreen() {
        try {
            val activity = currentActivity
            activity?.runOnUiThread {
                moveTaskToBack(activity)
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