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
    private val temporarilyUnlockedApps = mutableSetOf<String>()
    private val TEMPORARY_UNLOCK_DURATION = 10000L // 10 seconds

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d("AppLockDebug", "🟢 Accessibility Service CONNECTED")
        prefs = applicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
        
        // Log current locked apps
        val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
        Log.d("AppLockDebug", "📋 Currently locked apps in service: $lockedApps")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event?.let {
            Log.d("AppLockDebug", "🎯 Accessibility Event Received: ${getEventTypeName(it.eventType)}")
            
            when (it.eventType) {
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                    handleWindowStateChanged(it)
                }
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                    // Sometimes content change indicates app switch
                    val packageName = it.packageName?.toString()
                    if (packageName != null && packageName != lastPackageName) {
                        Log.d("AppLockDebug", "📱 Content Changed - Possible app switch to: $packageName")
                    }
                }
                else -> {
                    Log.d("AppLockDebug", "📝 Other Event - Type: ${it.eventType}, Package: ${it.packageName}")
                }
            }
        }
    }

    private fun handleWindowStateChanged(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString()
        val className = event.className?.toString()
        
        Log.d("AppLockDebug", "🏠 Window State Changed:")
        Log.d("AppLockDebug", "   📦 Package: $packageName")
        Log.d("AppLockDebug", "   🏷️ Class: $className")
        
        if (packageName != null && packageName != lastPackageName) {
            lastPackageName = packageName
            Log.d("AppLockDebug", "🎯 New App Detected: $packageName")
            
            // Skip our own app
            if (packageName == OUR_APP_PACKAGE) {
                Log.d("AppLockDebug", "⏭️ Skipping our own app")
                return
            }
            
            // Skip system/launcher apps
            if (isSystemApp(packageName)) {
                Log.d("AppLockDebug", "⏭️ Skipping system app: $packageName")
                return
            }
            
            // Check if this app is temporarily unlocked (in memory)
            if (temporarilyUnlockedApps.contains(packageName)) {
                Log.d("AppLockDebug", "🔓 App is temporarily unlocked (memory): $packageName")
                return
            }
            
            // Check if this app is temporarily unlocked (in SharedPreferences)
            val tempUnlockedApps = prefs.getStringSet("tempUnlockedApps", setOf()) ?: setOf()
            if (tempUnlockedApps.contains(packageName)) {
                Log.d("AppLockDebug", "🔓 App is temporarily unlocked (SharedPreferences): $packageName")
                return
            }
            
            // Check if this app is locked
            val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
            Log.d("AppLockDebug", "🔒 Checking against ${lockedApps.size} locked apps")
            
            if (lockedApps.contains(packageName)) {
                Log.d("AppLockDebug", "🚨 LOCKED APP DETECTED: $packageName")
                showLockScreen(packageName, className)
            } else {
                Log.d("AppLockDebug", "✅ App $packageName is not locked")
            }
        }
    }

    private fun isSystemApp(packageName: String): Boolean {
        return packageName.contains("android") || 
               packageName.contains("google") || 
               packageName.contains("system") || 
               packageName.contains("launcher") ||
               packageName.contains("sec.android") ||
               packageName.contains("com.samsung") ||
               packageName.contains("com.orange") ||
               packageName.startsWith("com.android.")
    }

    private fun showLockScreen(packageName: String, className: String?) {
        Log.d("AppLockDebug", "🚀 Preparing to show lock screen for: $packageName")
        
        // Start lock screen activity with FLAG_ACTIVITY_NEW_TASK and clear task
        startLockScreenActivity(packageName, className)
    }

    private fun startLockScreenActivity(packageName: String, className: String?) {
        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            putExtra("lockedPackage", packageName)
            putExtra("lockedClass", className)
            putExtra("isLockScreen", true)
            putExtra("timestamp", System.currentTimeMillis())
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK) // Clear any existing instances
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION) // No animation for immediate show
        }
        
        try {
            Log.d("AppLockDebug", "🎬 Starting Lock Screen Activity...")
            startActivity(intent)
            Log.d("AppLockDebug", "✅ Lock Screen Activity Started")
        } catch (e: Exception) {
            Log.e("AppLockDebug", "❌ Failed to start lock screen: ${e.message}", e)
        }
    }

    // Method to temporarily unlock an app
    fun temporarilyUnlockApp(packageName: String) {
        Log.d("AppLockDebug", "🔓 Temporarily unlocking app: $packageName")
        temporarilyUnlockedApps.add(packageName)
        
        // Remove from temporary unlock after duration
        handler.postDelayed({
            temporarilyUnlockedApps.remove(packageName)
            Log.d("AppLockDebug", "⏰ Temporary unlock expired for: $packageName")
        }, TEMPORARY_UNLOCK_DURATION)
    }

    private fun getEventTypeName(eventType: Int): String {
        return when (eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> "WINDOW_STATE_CHANGED"
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> "WINDOW_CONTENT_CHANGED"
            AccessibilityEvent.TYPE_VIEW_CLICKED -> "VIEW_CLICKED"
            else -> "UNKNOWN($eventType)"
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