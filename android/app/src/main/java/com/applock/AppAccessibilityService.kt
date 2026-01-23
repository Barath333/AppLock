package com.applock

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.util.Log
import android.content.SharedPreferences
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import java.util.concurrent.ConcurrentHashMap

class AppAccessibilityService : AccessibilityService() {
    private lateinit var prefs: SharedPreferences
    private var lastPackageName: String? = null
    private val OUR_APP_PACKAGE = "com.applock"
    private val handler = Handler(Looper.getMainLooper())
    private var isLockScreenActive = false
    private var lastLockTime: Long = 0
    private val LOCK_COOLDOWN = 2000L
    
    // Track if we're currently processing our own app
    private var isProcessingOwnApp = false
    private var ownAppLockScreenShown = false
    private var lastLockEventTime: Long = 0
    
    // Track user's current foreground app session
    private var currentForegroundPackage: String? = null
    private var currentForegroundClassName: String? = null
    private var currentForegroundStartTime: Long = 0

    companion object {
        // Apps that are currently unlocked (until app is closed)
        val unlockedApps = ConcurrentHashMap<String, Long>() // packageName -> unlock timestamp
        
        // Track apps that were recently foreground
        private val recentForegroundApps = ConcurrentHashMap<String, Long>() // packageName -> last seen time
        
        // Lock to prevent concurrent modifications
        val lock = Any()
        
        // Timeout for considering an app closed (5 seconds)
        private const val APP_CLOSE_TIMEOUT = 5000L

        // NEW: Companion object methods to access from AppLockModule
        fun unlockApp(packageName: String) {
            synchronized(lock) {
                unlockedApps[packageName] = System.currentTimeMillis()
                recentForegroundApps[packageName] = System.currentTimeMillis()
                Log.d("AppLockDebug", "🔓 UNLOCKED app: $packageName (will lock when closed)")
            }
        }

        fun forceLockApp(packageName: String) {
            synchronized(lock) {
                unlockedApps.remove(packageName)
                recentForegroundApps.remove(packageName)
                Log.d("AppLockDebug", "🔒 FORCE LOCKED app: $packageName")
            }
        }

        fun shouldLockAppOnOpen(packageName: String): Boolean {
            synchronized(lock) {
                // If app is not in unlockedApps, it needs to be locked
                return !unlockedApps.containsKey(packageName)
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d("AppLockDebug", "🟢 Accessibility Service CONNECTED")
        prefs = applicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
        
        val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
        Log.d("AppLockDebug", "📋 Currently locked apps in service: $lockedApps")
        
        // Clear any stale state
        unlockedApps.clear()
        recentForegroundApps.clear()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event?.let {
            // CRITICAL FIX: Skip events that are too frequent to prevent loops
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastLockEventTime < 300) {
                Log.d("AppLockDebug", "⏭️ Event too frequent, skipping to prevent loop")
                return
            }
            
            Log.d("AppLockDebug", "🎯 Accessibility Event: ${event.eventType}, Package: ${event.packageName}")
            
            when (it.eventType) {
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                    handleWindowStateChanged(it)
                }
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                    // Skip content changed events to reduce noise
                    Log.d("AppLockDebug", "⏭️ Skipping content changed event")
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
        
        if (packageName != null) {
            // CRITICAL FIX: Track app lifecycle
            trackAppLifecycle(packageName, className)
            
            // CRITICAL FIX: Add cooldown period to prevent rapid repeated events
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastLockEventTime < 1500) {
                Log.d("AppLockDebug", "⏭️ In cooldown period, skipping")
                return
            }
            
            // CRITICAL FIX: Skip our own app if we're already processing it
            if (packageName == OUR_APP_PACKAGE && isProcessingOwnApp) {
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
                // If switching from unlocked app to system app, check if unlocked app was closed
                checkIfUnlockedAppWasClosed(packageName)
                return
            }
            
            // Check if this app is currently unlocked
            if (isAppCurrentlyUnlocked(packageName)) {
                Log.d("AppLockDebug", "🔓 App is currently unlocked: $packageName")
                return
            }
            
            // Check if this app is locked
            val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
            
            if (lockedApps.contains(packageName)) {
                Log.d("AppLockDebug", "🚨 LOCKED APP DETECTED: $packageName")
                
                // Update last lock event time
                lastLockEventTime = currentTime
                
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
            
            lastPackageName = packageName
        }
    }

    // NEW METHOD: Track app lifecycle to detect when apps are closed
    private fun trackAppLifecycle(newPackageName: String, newClassName: String?) {
        val currentTime = System.currentTimeMillis()
        
        synchronized(lock) {
            // Update recent foreground apps
            recentForegroundApps[newPackageName] = currentTime
            
            // Check if this is a new app (user switched to different app)
            if (currentForegroundPackage != newPackageName) {
                val previousPackage = currentForegroundPackage
                currentForegroundPackage = newPackageName
                currentForegroundClassName = newClassName
                currentForegroundStartTime = currentTime
                
                if (previousPackage != null) {
                    Log.d("AppLockDebug", "🔄 User switched from $previousPackage to $newPackageName")
                    
                    // Check if previous app was unlocked and might be closed
                    if (isAppCurrentlyUnlocked(previousPackage)) {
                        Log.d("AppLockDebug", "📱 Previous unlocked app ($previousPackage) is now in background")
                        // Don't remove from unlocked yet - wait to see if it's actually closed
                    }
                }
            } else {
                // Same app, just different activity - update timestamp
                Log.d("AppLockDebug", "📱 User still in same app: $newPackageName")
            }
            
            // Clean up old entries from recentForegroundApps
            val iterator = recentForegroundApps.entries.iterator()
            while (iterator.hasNext()) {
                val entry = iterator.next()
                if (currentTime - entry.value > APP_CLOSE_TIMEOUT * 2) {
                    iterator.remove()
                }
            }
            
            // Check if any unlocked apps haven't been seen recently (they're closed)
            checkForClosedApps(currentTime)
        }
    }

    // NEW METHOD: Check if unlocked apps have been closed
    private fun checkForClosedApps(currentTime: Long) {
        val iterator = unlockedApps.entries.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            val packageName = entry.key
            
            // If app hasn't been in foreground recently AND it's not the current foreground app
            val lastSeen = recentForegroundApps[packageName]
            if (lastSeen == null || currentTime - lastSeen > APP_CLOSE_TIMEOUT) {
                if (packageName != currentForegroundPackage) {
                    Log.d("AppLockDebug", "🚪 App $packageName appears to be CLOSED (not seen in ${APP_CLOSE_TIMEOUT}ms)")
                    iterator.remove()
                    
                    // Also remove from recent foreground tracking
                    recentForegroundApps.remove(packageName)
                }
            }
        }
    }

    // NEW METHOD: Check if switching to system app means unlocked app was closed
    private fun checkIfUnlockedAppWasClosed(systemPackageName: String) {
        // If switching to system app (home/launcher), check all unlocked apps
        if (isSystemApp(systemPackageName)) {
            val currentTime = System.currentTimeMillis()
            checkForClosedApps(currentTime)
        }
    }

    // NEW METHOD: Check if app is currently unlocked
    private fun isAppCurrentlyUnlocked(packageName: String): Boolean {
        synchronized(lock) {
            return unlockedApps.containsKey(packageName)
        }
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
               packageName == "com.android.systemui" ||
               packageName == "com.sec.android.app.launcher" ||
               packageName == "com.google.android.apps.nexuslauncher")
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
            isProcessingOwnApp = false
            ownAppLockScreenShown = false
        }
    }

    // NEW METHOD: Reset our own app state when unlock is successful
    fun resetOwnAppState() {
        Log.d("AppLockDebug", "🔄 Resetting own app state from service")
        isProcessingOwnApp = false
        ownAppLockScreenShown = false
    }

    override fun onInterrupt() {
        Log.d("AppLockDebug", "⚠️ Accessibility Service Interrupted")
    }
    
    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        unlockedApps.clear()
        recentForegroundApps.clear()
        Log.d("AppLockDebug", "🔴 Accessibility Service Destroyed")
    }
}