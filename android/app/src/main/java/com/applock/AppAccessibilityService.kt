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
    private val LOCK_COOLDOWN = 1000L // 1 second cooldown

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
            
            // Skip if lock screen is already active to prevent loops
            if (isLockScreenActive) {
                Log.d("AppLockDebug", "⏭️ Lock screen already active, skipping")
                return
            }
            
            // Cooldown period to prevent rapid successive locks
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastLockTime < LOCK_COOLDOWN) {
                Log.d("AppLockDebug", "⏳ In cooldown period, skipping")
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
            
            // Check if this app is locked - INCLUDING OUR OWN APP
            val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
            
            if (lockedApps.contains(packageName)) {
                Log.d("AppLockDebug", "🚨 LOCKED APP DETECTED: $packageName")
                isLockScreenActive = true
                lastLockTime = currentTime
                showLockScreen(packageName, className)
            } else {
                Log.d("AppLockDebug", "✅ App $packageName is not locked")
            }
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
        // REMOVED: && packageName != OUR_APP_PACKAGE - We want to handle our own app
    }

    private fun showLockScreen(packageName: String, className: String?) {
        Log.d("AppLockDebug", "🚀 Starting lock screen for: $packageName")
        
        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            putExtra("lockedPackage", packageName)
            putExtra("lockedClass", className)
            putExtra("isLockScreen", true)
            putExtra("timestamp", System.currentTimeMillis())
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        
        try {
            startActivity(intent)
            Log.d("AppLockDebug", "✅ Lock Screen Activity Started for: $packageName")
            
            // Reset lock screen active flag after a delay
            handler.postDelayed({
                isLockScreenActive = false
                Log.d("AppLockDebug", "🔄 Reset lock screen active flag")
            }, 3000)
        } catch (e: Exception) {
            Log.e("AppLockDebug", "❌ Failed to start lock screen: ${e.message}", e)
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