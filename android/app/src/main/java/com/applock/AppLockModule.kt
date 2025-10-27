package com.applock

import android.content.Context
import android.content.SharedPreferences
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.content.pm.ApplicationInfo

class AppLockModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val reactContext: ReactApplicationContext = reactContext
    private val handler = Handler(Looper.getMainLooper())
    private val OUR_APP_PACKAGE = "com.applock"
    private lateinit var prefs: SharedPreferences

    override fun getName(): String = "AppLockModule"

    override fun initialize() {
        super.initialize()
        prefs = reactApplicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
    }

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
                    val intent = Intent(activity, activity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                                Intent.FLAG_ACTIVITY_NEW_TASK or
                                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                                Intent.FLAG_ACTIVITY_CLEAR_TOP)
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
            
            // CRITICAL FIX: Permanently unlock the app until it's closed
            permanentlyUnlockApp(packageName)
            
            handler.post {
                try {
                    // SPECIAL HANDLING FOR OUR OWN APP
                    if (packageName == OUR_APP_PACKAGE) {
                        Log.d("AppLockModule", "🏠 Launching our own app after unlock")
                        
                        // Just finish the current activity (lock screen)
                        currentActivity?.finish()
                        return@post
                    }
                    
                    // Get the launch intent for the original app
                    val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(packageName)
                    if (launchIntent != null) {
                        // Clear any existing flags and set proper ones
                        launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                                           Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                           Intent.FLAG_ACTIVITY_SINGLE_TOP
                        
                        // Start the original app
                        reactContext.startActivity(launchIntent)
                        Log.d("AppLockModule", "✅ Original app launched: $packageName")
                        
                        // Close our lock screen activity after a short delay
                        handler.postDelayed({
                            try {
                                currentActivity?.finish()
                                Log.d("AppLockModule", "✅ Lock screen closed after app launch")
                            } catch (e: Exception) {
                                Log.e("AppLockModule", "❌ Error closing lock screen: ${e.message}")
                            }
                        }, 500)
                        
                    } else {
                        Log.e("AppLockModule", "❌ No launch intent found for: $packageName")
                        // Fallback: just close our app
                        currentActivity?.finish()
                    }
                } catch (e: Exception) {
                    Log.e("AppLockModule", "❌ Error launching app: ${e.message}", e)
                    // Fallback: just close our app
                    currentActivity?.finish()
                }
            }
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error in launchApp: ${e.message}", e)
        }
    }

    // NEW METHOD: Permanently unlock app until it's closed (called AFTER successful PIN verification)
    fun permanentlyUnlockApp(packageName: String) {
        try {
            AppAccessibilityService.permanentlyUnlockedApps.add(packageName)
            Log.d("AppLockModule", "🔓 PERMANENTLY unlocked app until closed: $packageName")
            
            // Also add to temporary unlocks as backup
            temporarilyUnlockApp(packageName)
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error permanently unlocking app: ${e.message}")
        }
    }

    // NEW METHOD: Close app session (call this when app goes to background or is closed)
    @ReactMethod
    fun closeAppSession(packageName: String) {
        try {
            AppAccessibilityService.permanentlyUnlockedApps.remove(packageName)
            AppAccessibilityService.appLaunchState.remove(packageName)
            Log.d("AppLockModule", "🔚 Closed app session for: $packageName")
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error closing app session: ${e.message}")
        }
    }

    // NEW METHOD: Check if app is freshly launched
    @ReactMethod
    fun isAppFreshlyLaunched(packageName: String, promise: Promise) {
        try {
            val isFresh = AppAccessibilityService.isAppFreshlyLaunched(packageName)
            Log.d("AppLockModule", "🔍 App $packageName freshly launched: $isFresh")
            promise.resolve(isFresh)
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error checking app launch state: ${e.message}")
            promise.resolve(false)
        }
    }

    // NEW METHOD: Mark app as no longer freshly launched
    @ReactMethod
    fun markAppAsOpened(packageName: String) {
        try {
            AppAccessibilityService.markAppAsOpened(packageName)
            Log.d("AppLockModule", "📝 Marked app as opened: $packageName")
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error marking app as opened: ${e.message}")
        }
    }

    @ReactMethod
    fun temporarilyUnlockApp(packageName: String) {
        try {
            Log.d("AppLockModule", "🔓 Temporarily unlocking app: $packageName")
            
            // Use in-memory unlock for immediate effect
            AppAccessibilityService.temporarilyUnlockedApps.add(packageName)
            
            Log.d("AppLockModule", "✅ Temporarily unlocked app: $packageName")
            
            // Remove temporary unlock after longer duration (as backup)
            handler.postDelayed({
                try {
                    AppAccessibilityService.temporarilyUnlockedApps.remove(packageName)
                    Log.d("AppLockModule", "⏰ Temporary unlock REMOVED for: $packageName")
                } catch (e: Exception) {
                    Log.e("AppLockModule", "❌ Error removing temp unlock: ${e.message}")
                }
            }, 30000L) // 30 seconds as backup
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error temporarily unlocking app: ${e.message}")
        }
    }

    @ReactMethod
    fun closeLockScreen() {
        try {
            val activity = currentActivity
            activity?.runOnUiThread {
                try {
                    activity.finish()
                    Log.d("AppLockModule", "✅ Lock screen closed")
                } catch (e: Exception) {
                    Log.e("AppLockModule", "❌ Error closing lock screen: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error in closeLockScreen: ${e.message}")
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

    @ReactMethod
    fun getAutoLockNewApps(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
            val autoLockNewApps = prefs.getBoolean("autoLockNewApps", true)
            Log.d("AppLockModule", "🔄 Auto-lock new apps setting: $autoLockNewApps")
            promise.resolve(autoLockNewApps)
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error getting auto-lock setting: ${e.message}")
            promise.reject("AUTO_LOCK_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setAutoLockNewApps(enabled: Boolean, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
            val editor = prefs.edit()
            editor.putBoolean("autoLockNewApps", enabled)
            editor.apply()
            Log.d("AppLockModule", "🔄 Auto-lock new apps set to: $enabled")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error setting auto-lock: ${e.message}")
            promise.reject("SET_AUTO_LOCK_ERROR", e.message)
        }
    }

    @ReactMethod
    fun addNewAppToLockedApps(packageName: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
            val autoLockNewApps = prefs.getBoolean("autoLockNewApps", true)
            
            if (autoLockNewApps) {
                val lockedApps = prefs.getStringSet("lockedApps", mutableSetOf()) ?: mutableSetOf()
                if (!lockedApps.contains(packageName)) {
                    lockedApps.add(packageName)
                    val editor = prefs.edit()
                    editor.putStringSet("lockedApps", lockedApps)
                    editor.apply()
                    Log.d("AppLockModule", "🔒 Auto-locked new app: $packageName")
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error auto-locking new app: ${e.message}")
            promise.reject("AUTO_LOCK_APP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun debugLockedApps(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
            val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
            
            val result = WritableNativeMap().apply {
                putArray("lockedApps", {
                    val array = WritableNativeArray()
                    lockedApps.forEach { array.pushString(it) }
                    array
                }())
                putArray("memoryUnlockedApps", {
                    val array = WritableNativeArray()
                    AppAccessibilityService.temporarilyUnlockedApps.forEach { array.pushString(it) }
                    array
                }())
                putArray("permanentlyUnlockedApps", {
                    val array = WritableNativeArray()
                    AppAccessibilityService.permanentlyUnlockedApps.forEach { array.pushString(it) }
                    array
                }())
                putArray("appLaunchState", {
                    val array = WritableNativeArray()
                    AppAccessibilityService.appLaunchState.forEach { (pkg, state) ->
                        val map = WritableNativeMap()
                        map.putString("package", pkg)
                        map.putBoolean("fresh", state)
                        array.pushMap(map)
                    }
                    array
                }())
            }
            
            Log.d("AppLockModule", "🐛 DEBUG - Locked Apps: $lockedApps")
            Log.d("AppLockModule", "🐛 DEBUG - Temp Unlocked Apps: ${AppAccessibilityService.temporarilyUnlockedApps}")
            Log.d("AppLockModule", "🐛 DEBUG - Permanent Unlocked Apps: ${AppAccessibilityService.permanentlyUnlockedApps}")
            Log.d("AppLockModule", "🐛 DEBUG - App Launch State: ${AppAccessibilityService.appLaunchState}")
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error in debugLockedApps: ${e.message}")
            promise.reject("DEBUG_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getInstalledAppsNotInLocked(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
            val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
            
            val packageManager = reactApplicationContext.packageManager
            val apps = packageManager.getInstalledApplications(PackageManager.GET_META_DATA)
            val result = WritableNativeArray()

            for (app in apps) {
                // Skip system apps and our own app
                if ((app.flags and ApplicationInfo.FLAG_SYSTEM == 0) && 
                    app.packageName != "com.applock" &&
                    !lockedApps.contains(app.packageName)) {
                    
                    val appInfo = WritableNativeMap()
                    appInfo.putString("name", app.loadLabel(packageManager).toString())
                    appInfo.putString("packageName", app.packageName)
                    result.pushMap(appInfo)
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("UNLOCKED_APPS_ERROR", "Failed to get unlocked apps: ${e.message}")
        }
    }

    @ReactMethod
    fun forceDetectApp(packageName: String) {
        try {
            Log.d("AppLockModule", "🔍 Force detecting app: $packageName")
            
            val prefs = reactApplicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
            val lockedApps = prefs.getStringSet("lockedApps", setOf<String>()) ?: setOf<String>()
            
            if (lockedApps.contains(packageName)) {
                Log.d("AppLockModule", "🚨 Force detected LOCKED app: $packageName")
                sendAppLockedEvent(packageName, null)
            } else {
                Log.d("AppLockModule", "✅ Force detected UNLOCKED app: $packageName")
            }
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error force detecting app: ${e.message}")
        }
    }

    @ReactMethod
    fun clearTemporaryUnlocks() {
        try {
            Log.d("AppLockModule", "🧹 Clearing all temporary unlocks")
            
            AppAccessibilityService.temporarilyUnlockedApps.clear()
            AppAccessibilityService.permanentlyUnlockedApps.clear()
            AppAccessibilityService.appLaunchState.clear()
            
            Log.d("AppLockModule", "✅ All temporary unlocks cleared")
        } catch (e: Exception) {
            Log.e("AppLockModule", "❌ Error clearing temporary unlocks: ${e.message}")
        }
    }

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