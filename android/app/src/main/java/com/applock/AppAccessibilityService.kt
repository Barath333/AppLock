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
    private val LOCK_COOLDOWN = 1000L
    
    // Track if we're currently processing our own app
    private var isProcessingOwnApp = false
    private var ownAppLockScreenShown = false

    companion object {
        val temporarilyUnlockedApps = mutableSetOf<String>()
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
            Log.d("AppLockDebug", "🎯 Accessibility Event: ${event.eventType}, Package: ${event.packageName}")
            
            when (it.eventType) {
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                    handleWindowStateChanged(it)
                }
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                    handleWindowContentChanged(it)
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
        
        Log.d("AppLockDebug", "🏠 Window State Changed - Package: $packageName, Class: $className")
        
        if (packageName != null && packageName != lastPackageName) {
            lastPackageName = packageName
            
            // CRITICAL FIX: Reset own app state when switching to other apps
            if (packageName != OUR_APP_PACKAGE) {
                isProcessingOwnApp = false
                ownAppLockScreenShown = false
                Log.d("AppLockDebug", "🔄 Reset own app state - switched to: $packageName")
            }
            
            // CRITICAL FIX: Skip if we're already processing our own app's lock screen
            if (isProcessingOwnApp && packageName == OUR_APP_PACKAGE) {
                Log.d("AppLockDebug", "⏭️ Skipping - already processing our own app lock screen")
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
            
            // Check if this app is temporarily unlocked
            if (isAppTemporarilyUnlocked(packageName)) {
                Log.d("AppLockDebug", "🔓 App is temporarily unlocked: $packageName")
                return
            }
            
            // Check if this app is locked
            val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
            
            if (lockedApps.contains(packageName)) {
                Log.d("AppLockDebug", "🚨 LOCKED APP DETECTED: $packageName")
                
                // SPECIAL HANDLING FOR OUR OWN APP
                if (packageName == OUR_APP_PACKAGE) {
                    if (ownAppLockScreenShown) {
                        Log.d("AppLockDebug", "⏭️ Our own app lock screen already shown, skipping")
                        return
                    }
                    isProcessingOwnApp = true
                    ownAppLockScreenShown = true
                    Log.d("AppLockDebug", "🔒 Handling our own app lock")
                }
                
                isLockScreenActive = true
                lastLockTime = System.currentTimeMillis()
                showLockScreen(packageName, className)
            } else {
                Log.d("AppLockDebug", "✅ App $packageName is not locked")
            }
        }
    }

    private fun handleWindowContentChanged(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString()
        
        // For some apps, we might only get CONTENT_CHANGED events
        if (packageName != null && packageName != lastPackageName) {
            lastPackageName = packageName
            
            // CRITICAL FIX: Skip if we're already processing our own app
            if (isProcessingOwnApp && packageName == OUR_APP_PACKAGE) {
                Log.d("AppLockDebug", "⏭️ Skipping content changed - processing our own app")
                return
            }
            
            checkAndShowLockScreen(packageName, null)
        }
    }

    private fun checkAndShowLockScreen(packageName: String, className: String?) {
        // Skip if lock screen is already active to prevent loops
        if (isLockScreenActive) {
            Log.d("AppLockDebug", "⏭️ Lock screen already active, skipping")
            return
        }
        
        // CRITICAL FIX: Skip if we're already processing our own app
        if (isProcessingOwnApp && packageName == OUR_APP_PACKAGE) {
            Log.d("AppLockDebug", "⏭️ Skipping check - processing our own app")
            return
        }
        
        // Skip system/launcher apps
        if (isSystemApp(packageName)) {
            Log.d("AppLockDebug", "⏭️ Skipping system app: $packageName")
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
            
            // SPECIAL HANDLING FOR OUR OWN APP
            if (packageName == OUR_APP_PACKAGE) {
                if (ownAppLockScreenShown) {
                    Log.d("AppLockDebug", "⏭️ Our own app lock screen already shown, skipping")
                    return
                }
                isProcessingOwnApp = true
                ownAppLockScreenShown = true
                Log.d("AppLockDebug", "🔒 Handling our own app lock")
            }
            
            isLockScreenActive = true
            lastLockTime = System.currentTimeMillis()
            showLockScreen(packageName, className)
        } else {
            Log.d("AppLockDebug", "✅ App $packageName is not locked")
        }
    }

    private fun isAppTemporarilyUnlocked(packageName: String): Boolean {
        // Check in-memory temporary unlocks
        if (temporarilyUnlockedApps.contains(packageName)) {
            Log.d("AppLockDebug", "🔓 App $packageName is temporarily unlocked in memory")
            return true
        }
        
        // Check SharedPreferences temporary unlocks
        val tempUnlockedApps = prefs.getStringSet("tempUnlockedApps", setOf()) ?: setOf()
        if (tempUnlockedApps.contains(packageName)) {
            Log.d("AppLockDebug", "🔓 App $packageName is temporarily unlocked in SharedPreferences")
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
            }, 500)
        } catch (e: Exception) {
            Log.e("AppLockDebug", "❌ FAILED to start lock screen: ${e.message}", e)
            isLockScreenActive = false
            isProcessingOwnApp = false
            
            // Try again after short delay
            handler.postDelayed({
                showLockScreen(packageName, className)
            }, 100)
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