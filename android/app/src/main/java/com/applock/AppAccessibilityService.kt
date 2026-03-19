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

    private var isProcessingOwnApp = false
    private var ownAppLockScreenShown = false
    private var lastLockEventTime: Long = 0

    private val packageCooldown = ConcurrentHashMap<String, Long>()

    private var currentForegroundPackage: String? = null
    private var currentForegroundClassName: String? = null
    private var currentForegroundStartTime: Long = 0

    companion object {
        val unlockedApps = ConcurrentHashMap<String, Long>()
        private val recentForegroundApps = ConcurrentHashMap<String, Long>()
        val lock = Any()
        private const val APP_CLOSE_TIMEOUT = 5000L

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
                if (bypassed) Log.d("AppLockDebug", "⏭️ Own app lock is currently bypassed")
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
        unlockedApps.clear()
        recentForegroundApps.clear()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event?.let {
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastLockEventTime < 300) {
                Log.d("AppLockDebug", "⏭️ Event too frequent, skipping to prevent loop")
                return
            }
            Log.d("AppLockDebug", "🎯 Accessibility Event: ${event.eventType}, Package: ${event.packageName}")
            when (it.eventType) {
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> handleWindowStateChanged(it)
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> Log.d("AppLockDebug", "⏭️ Skipping content changed event")
                else -> { }
            }
        }
    }

    private fun handleWindowStateChanged(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString()
        val className = event.className?.toString()
        Log.d("AppLockDebug", "🏠 Window State Changed - Package: $packageName, Class: $className")

        if (packageName != null) {
            trackAppLifecycle(packageName)
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastLockEventTime < 1500) {
                Log.d("AppLockDebug", "⏭️ In cooldown period, skipping")
                return
            }

            val cooldownExpiry = packageCooldown[packageName]
            if (cooldownExpiry != null && currentTime < cooldownExpiry) {
                Log.d("AppLockDebug", "⏭️ Package $packageName is in cooldown, skipping")
                return
            }

            if (packageName == OUR_APP_PACKAGE) {
                if (isOwnAppBypassed()) {
                    Log.d("AppLockDebug", "⏭️ Our own app is temporarily bypassed, skipping lock")
                    isProcessingOwnApp = false
                    ownAppLockScreenShown = false
                    return
                }
                if (isAppCurrentlyUnlocked(packageName)) {
                    Log.d("AppLockDebug", "🔓 Our own app is already unlocked, skipping")
                    return
                }
                if (isProcessingOwnApp) {
                    Log.d("AppLockDebug", "⏭️ Already processing our own app, skipping")
                    return
                }
            }

            if (isLockScreenActive) {
                Log.d("AppLockDebug", "⏭️ Lock screen already active, skipping")
                return
            }

            if (isSystemApp(packageName)) {
                Log.d("AppLockDebug", "⏭️ Skipping system app: $packageName")
                if (isHomeLauncher(packageName)) checkForClosedApps(currentTime)
                return
            }

            if (isAppCurrentlyUnlocked(packageName)) {
                Log.d("AppLockDebug", "🔓 App is currently unlocked: $packageName")
                return
            }

            val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
            if (lockedApps.contains(packageName)) {
                Log.d("AppLockDebug", "🚨 LOCKED APP DETECTED: $packageName")
                packageCooldown[packageName] = currentTime + 3000
                lastLockEventTime = currentTime

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

    private fun trackAppLifecycle(newPackageName: String) {
        val currentTime = System.currentTimeMillis()
        synchronized(lock) {
            recentForegroundApps[newPackageName] = currentTime
            if (currentForegroundPackage != newPackageName) {
                val previousPackage = currentForegroundPackage
                currentForegroundPackage = newPackageName
                currentForegroundStartTime = currentTime
                if (previousPackage != null) {
                    Log.d("AppLockDebug", "🔄 User switched from $previousPackage to $newPackageName")
                }
            } else {
                recentForegroundApps[newPackageName] = currentTime
            }
            if (currentTime % 3000 < 100) checkForClosedApps(currentTime)
        }
    }

    private fun checkForClosedApps(currentTime: Long) {
        synchronized(lock) {
            val iterator = unlockedApps.entries.iterator()
            while (iterator.hasNext()) {
                val entry = iterator.next()
                val packageName = entry.key
                val lastSeen = recentForegroundApps[packageName]
                if (lastSeen == null || currentTime - lastSeen > APP_CLOSE_TIMEOUT) {
                    if (packageName != currentForegroundPackage) {
                        Log.d("AppLockDebug", "🚪 App $packageName appears to be CLOSED (not seen in ${APP_CLOSE_TIMEOUT}ms)")
                        iterator.remove()
                        recentForegroundApps.remove(packageName)
                    }
                }
            }
            val recentIterator = recentForegroundApps.entries.iterator()
            while (recentIterator.hasNext()) {
                val entry = recentIterator.next()
                if (currentTime - entry.value > APP_CLOSE_TIMEOUT * 2) recentIterator.remove()
            }
        }
    }

    private fun isAppCurrentlyUnlocked(packageName: String): Boolean {
        synchronized(lock) { return unlockedApps.containsKey(packageName) }
    }

    private fun isSystemApp(packageName: String): Boolean {
        return (packageName.contains(".launcher") ||
                packageName.contains("launcher.") ||
                packageName == "com.android.launcher3" ||
                packageName == "com.google.android.apps.nexuslauncher" ||
                packageName == "com.sec.android.app.launcher" ||
                packageName == "com.android.systemui" ||
                packageName == "com.android.settings" ||
                packageName.startsWith("com.google.android.googlequicksearchbox"))
    }

    private fun isHomeLauncher(packageName: String): Boolean {
        return (packageName.contains(".launcher") ||
                packageName.contains("launcher.") ||
                packageName == "com.android.launcher3" ||
                packageName == "com.google.android.apps.nexuslauncher" ||
                packageName == "com.sec.android.app.launcher")
    }

    private fun showLockScreen(packageName: String, className: String?) {
        Log.d("AppLockDebug", "🚀 STARTING LOCK SCREEN for: $packageName")
        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            putExtra("lockedPackage", packageName)
            putExtra("lockedClass", className)
            putExtra("isLockScreen", true)
            putExtra("timestamp", System.currentTimeMillis())
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY)
            addFlags(Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
            addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION)
        }
        try {
            startActivity(intent)
            Log.d("AppLockDebug", "✅ Lock Screen Activity STARTED for: $packageName")
            handler.postDelayed({ isLockScreenActive = false }, 1000)
        } catch (e: Exception) {
            Log.e("AppLockDebug", "❌ FAILED to start lock screen: ${e.message}", e)
            isLockScreenActive = false
            isProcessingOwnApp = false
            ownAppLockScreenShown = false
        }
    }

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