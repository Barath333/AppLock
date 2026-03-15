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

    // NEW: Per-package cooldown to prevent duplicate events for the same app
    private val packageCooldown = ConcurrentHashMap<String, Long>() // packageName -> expiry time

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

        // Temporary bypass for our own app to prevent immediate re‑lock
        private var ownAppBypassUntil: Long = 0
        private val bypassLock = Any()

        fun setOwnAppBypass(durationMs: Long) {
            synchronized(bypassLock) {
                ownAppBypassUntil = System.currentTimeMillis() + durationMs
                Log.d("AppLockDebug", "⏱️ Own app lock bypass set until $ownAppBypassUntil")
            }
        }

        fun isOwnAppBypassed(): Boolean {
            synchronized(bypassLock) {
                val bypassed = System.currentTimeMillis() < ownAppBypassUntil
                if (bypassed) {
                    Log.d("AppLockDebug", "⏭️ Own app lock is currently bypassed")
                }
                return bypassed
            }
        }

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
            trackAppLifecycle(packageName)

            // CRITICAL FIX: Add cooldown period to prevent rapid repeated events
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastLockEventTime < 1500) {
                Log.d("AppLockDebug", "⏭️ In cooldown period, skipping")
                return
            }

            // NEW: Per-package cooldown check
            val cooldownExpiry = packageCooldown[packageName]
            if (cooldownExpiry != null && currentTime < cooldownExpiry) {
                Log.d("AppLockDebug", "⏭️ Package $packageName is in cooldown, skipping")
                return
            }

            // SPECIAL HANDLING FOR OUR OWN APP – check bypass first
            if (packageName == OUR_APP_PACKAGE) {
                if (isOwnAppBypassed()) {
                    Log.d("AppLockDebug", "⏭️ Our own app is temporarily bypassed, skipping lock")
                    // Reset processing flags
                    isProcessingOwnApp = false
                    ownAppLockScreenShown = false
                    return
                }
                // NEW: If our own app is already unlocked, skip
                if (isAppCurrentlyUnlocked(packageName)) {
                    Log.d("AppLockDebug", "🔓 Our own app is already unlocked, skipping")
                    return
                }
                // CRITICAL FIX: Skip our own app if we're already processing it
                if (isProcessingOwnApp) {
                    Log.d("AppLockDebug", "⏭️ Already processing our own app, skipping")
                    return
                }
            }

            // Skip if lock screen is already active to prevent loops
            if (isLockScreenActive) {
                Log.d("AppLockDebug", "⏭️ Lock screen already active, skipping")
                return
            }

            // Skip system/launcher apps
            if (isSystemApp(packageName)) {
                Log.d("AppLockDebug", "⏭️ Skipping system app: $packageName")
                // Only check for closed apps when going to HOME/LAUNCHER, not other system apps
                if (isHomeLauncher(packageName)) {
                    checkForClosedApps(currentTime)
                }
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

                // NEW: Set per-package cooldown to prevent duplicate events
                packageCooldown[packageName] = currentTime + 2000

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

    // SIMPLIFIED METHOD: Track app lifecycle
    private fun trackAppLifecycle(newPackageName: String) {
        val currentTime = System.currentTimeMillis()

        synchronized(lock) {
            // Always update recent foreground apps
            recentForegroundApps[newPackageName] = currentTime

            // Only update current foreground if it's a different app (not just different activity in same app)
            if (currentForegroundPackage != newPackageName) {
                val previousPackage = currentForegroundPackage
                currentForegroundPackage = newPackageName
                currentForegroundStartTime = currentTime

                if (previousPackage != null) {
                    Log.d("AppLockDebug", "🔄 User switched from $previousPackage to $newPackageName")
                }
            } else {
                // Same app, just different activity - update timestamp
                recentForegroundApps[newPackageName] = currentTime
            }

            // Check if any unlocked apps haven't been seen recently (they're closed)
            // Only check every few seconds to reduce overhead
            if (currentTime % 3000 < 100) { // Check approximately every 3 seconds
                checkForClosedApps(currentTime)
            }
        }
    }

    // NEW METHOD: Check if unlocked apps have been closed
    private fun checkForClosedApps(currentTime: Long) {
        synchronized(lock) {
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

            // Clean up old entries from recentForegroundApps
            val recentIterator = recentForegroundApps.entries.iterator()
            while (recentIterator.hasNext()) {
                val entry = recentIterator.next()
                if (currentTime - entry.value > APP_CLOSE_TIMEOUT * 2) {
                    recentIterator.remove()
                }
            }
        }
    }

    // NEW METHOD: Check if app is currently unlocked
    private fun isAppCurrentlyUnlocked(packageName: String): Boolean {
        synchronized(lock) {
            return unlockedApps.containsKey(packageName)
        }
    }

    // IMPROVED METHOD: More precise system app detection
    private fun isSystemApp(packageName: String): Boolean {
        // Only consider true system/launcher apps, not all system services
        return (packageName.contains(".launcher") ||
                packageName.contains("launcher.") ||
                packageName == "com.android.launcher3" ||
                packageName == "com.google.android.apps.nexuslauncher" ||
                packageName == "com.sec.android.app.launcher" ||
                packageName == "com.android.systemui" ||
                packageName == "com.android.settings" ||
                packageName.startsWith("com.google.android.googlequicksearchbox"))
    }

    // NEW METHOD: Check if it's a home launcher (more specific)
    private fun isHomeLauncher(packageName: String): Boolean {
        return (packageName.contains(".launcher") ||
                packageName.contains("launcher.") ||
                packageName == "com.android.launcher3" ||
                packageName == "com.google.android.apps.nexuslauncher" ||
                packageName == "com.sec.android.app.launcher")
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