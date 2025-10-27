package com.applock

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.util.Log
import android.content.SharedPreferences
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper

class AppAccessibilityService : AccessibilityService() {
    private lateinit var prefs: SharedPreferences
    private var lastPackageName: String? = null
    private val OUR_APP_PACKAGE = "com.applock"
    private val handler = Handler(Looper.getMainLooper())
    private var isLockScreenActive = false
    private var lastLockTime: Long = 0
    private val LOCK_COOLDOWN = 2000L
    
    // Track foreground app changes
    private var currentForegroundApp: String? = null
    private var previousForegroundApp: String? = null

    companion object {
        val temporarilyUnlockedApps = mutableSetOf<String>()
        val permanentlyUnlockedApps = mutableSetOf<String>() // Apps unlocked until closed
        
        // Track app launch state to detect when apps are freshly opened
        val appLaunchState = mutableMapOf<String, Boolean>()
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d("AppLockDebug", "🟢 Accessibility Service CONNECTED")
        prefs = applicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
        
        val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
        Log.d("AppLockDebug", "📋 Currently locked apps in service: $lockedApps")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event?.let {
            // CRITICAL FIX: Skip events that are too frequent to prevent loops
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastLockTime < 300) {
                return
            }
            
            Log.d("AppLockDebug", "🎯 Accessibility Event: ${event.eventType}, Package: ${event.packageName}")
            
            when (it.eventType) {
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                    handleWindowStateChanged(it)
                }
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                    // Skip content changed events to reduce noise
                }
                else -> {
                    // Handle other events if needed
                }
            }
        }
    }

    private fun handleWindowStateChanged(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString()
        val className = event.className?.toString()
        
        if (packageName != null) {
            Log.d("AppLockDebug", "🏠 Window State Changed - Package: $packageName, Class: $className")
            
            // Track app transitions
            previousForegroundApp = currentForegroundApp
            currentForegroundApp = packageName
            
            // Check if this is a fresh app launch (app wasn't previously in foreground)
            val isFreshLaunch = previousForegroundApp != packageName && 
                               !isSystemApp(packageName) && 
                               !isOurApp(packageName)
            
            if (isFreshLaunch) {
                Log.d("AppLockDebug", "🚀 Fresh app launch detected: $packageName")
                // Reset app launch state for this package
                appLaunchState[packageName] = true
            }
            
            // CRITICAL FIX: Add cooldown period to prevent rapid repeated events
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastLockTime < 1500) {
                Log.d("AppLockDebug", "⏭️ In cooldown period, skipping")
                return
            }
            
            // CRITICAL FIX: Skip our own app if we're already processing it
            if (packageName == OUR_APP_PACKAGE && isLockScreenActive) {
                Log.d("AppLockDebug", "⏭️ Already processing our own app, skipping")
                return
            }
            
            // Skip if lock screen is already active to prevent loops
            if (isLockScreenActive) {
                Log.d("AppLockDebug", "⏭️ Lock screen already active, skipping")
                return
            }
            
            // Skip system/launcher apps
            if (isSystemApp(packageName)) {
                Log.d("AppLockDebug", "⏭️ Skipping system app: $packageName")
                return
            }
            
            // Skip our own app when not in lock screen mode
            if (isOurApp(packageName) && !isLockScreenActive) {
                Log.d("AppLockDebug", "⏭️ Skipping our own app (not in lock screen mode): $packageName")
                return
            }
            
            // Check if this app is permanently unlocked (until app is closed)
            if (isAppPermanentlyUnlocked(packageName)) {
                Log.d("AppLockDebug", "🔓 App is permanently unlocked until closed: $packageName")
                return
            }
            
            // Check if this app is temporarily unlocked
            if (isAppTemporarilyUnlocked(packageName)) {
                Log.d("AppLockDebug", "🔓 App is temporarily unlocked: $packageName")
                return
            }
            
            // Check if this app is locked
            val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
            
            if (lockedApps.contains(packageName)) {
                Log.d("AppLockDebug", "🚨 LOCKED APP DETECTED: $packageName")
                
                // Update last lock time
                lastLockTime = currentTime
                
                isLockScreenActive = true
                showLockScreen(packageName, className)
            } else {
                Log.d("AppLockDebug", "✅ App $packageName is not locked")
            }
            
            lastPackageName = packageName
        }
    }

    // NEW METHOD: Check if package is our app
    private fun isOurApp(packageName: String): Boolean {
        return packageName == OUR_APP_PACKAGE
    }

    // NEW METHOD: Mark app as permanently unlocked (until app is closed)
    private fun isAppPermanentlyUnlocked(packageName: String): Boolean {
        return permanentlyUnlockedApps.contains(packageName)
    }

    // NEW METHOD: Permanently unlock app until it's closed
    fun permanentlyUnlockApp(packageName: String) {
        permanentlyUnlockedApps.add(packageName)
        Log.d("AppLockDebug", "🔓 PERMANENTLY unlocked app until closed: $packageName")
        
        // Remove from temporary unlocks if present
        temporarilyUnlockedApps.remove(packageName)
    }

    // NEW METHOD: Close app session (when app is no longer in foreground)
    fun closeAppSession(packageName: String) {
        permanentlyUnlockedApps.remove(packageName)
        appLaunchState.remove(packageName)
        Log.d("AppLockDebug", "🔚 Closed app session for: $packageName")
    }

    // NEW METHOD: Check if app was freshly launched
    fun isAppFreshlyLaunched(packageName: String): Boolean {
        return appLaunchState[packageName] == true
    }

    // NEW METHOD: Mark app as no longer freshly launched
    fun markAppAsOpened(packageName: String) {
        appLaunchState[packageName] = false
    }

    private fun isAppTemporarilyUnlocked(packageName: String): Boolean {
        // Check in-memory temporary unlocks
        if (temporarilyUnlockedApps.contains(packageName)) {
            Log.d("AppLockDebug", "🔓 App $packageName is temporarily unlocked in memory")
            return true
        }
        
        return false
    }

    private fun isSystemApp(packageName: String): Boolean {
        return (packageName.contains("android") || 
               packageName.contains("google") || 
               packageName.contains("system") || 
               packageName.contains("launcher") ||
               packageName.contains("sec.android") ||
               packageName.contains("com.samsung") ||
               packageName.contains("com.orange") ||
               packageName.startsWith("com.android.") ||
               packageName.startsWith("com.sec.") ||
               packageName.startsWith("com.google.android.") ||
               packageName == "com.android.settings" ||
               packageName == "com.android.systemui")
    }

    private fun showLockScreen(packageName: String, className: String?) {
        Log.d("AppLockDebug", "🚀 STARTING LOCK SCREEN for: $packageName")
        
        // CRITICAL: Always create a completely fresh instance
        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            putExtra("lockedPackage", packageName)
            putExtra("lockedClass", className)
            putExtra("isLockScreen", true)
            putExtra("timestamp", System.currentTimeMillis())
            // CRITICAL FLAGS: Ensure fresh instance every time
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY)
            addFlags(Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
        }
        
        try {
            startActivity(intent)
            Log.d("AppLockDebug", "✅ Lock Screen Activity STARTED for: $packageName")
            
            // Reset the active flag quickly
            handler.postDelayed({
                isLockScreenActive = false
                Log.d("AppLockDebug", "🔄 Reset lock screen active flag")
            }, 1000)
        } catch (e: Exception) {
            Log.e("AppLockDebug", "❌ FAILED to start lock screen: ${e.message}", e)
            isLockScreenActive = false
        }
    }

    override fun onInterrupt() {
        Log.d("AppLockDebug", "⚠️ Accessibility Service Interrupted")
    }
    
    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        Log.d("AppLockDebug", "🔴 Accessibility Service Destroyed")
    }
}