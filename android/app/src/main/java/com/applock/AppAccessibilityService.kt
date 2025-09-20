package com.applock

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.util.Log
import android.content.SharedPreferences
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper

class AppAccessibilityService : AccessibilityService() {
    private lateinit var prefs: SharedPreferences
    private var lastPackageName: String? = null
    private var lastEventTime: Long = 0
    private val handler = Handler(Looper.getMainLooper())

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d("Accessibility", "Service connected")
        prefs = applicationContext.getSharedPreferences("AppLock", Context.MODE_PRIVATE)
    }


override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    event?.let {
        if (it.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = it.packageName?.toString()
            val className = it.className?.toString()
            
            if (packageName != null && packageName != lastPackageName) {
                lastPackageName = packageName
                Log.d("Accessibility", "App opened: $packageName")
                
                // Check if this app is locked
                val lockedApps = prefs.getStringSet("lockedApps", setOf()) ?: setOf()
                if (lockedApps.contains(packageName)) {
                    Log.d("Accessibility", "Locked app detected: $packageName")
                    
                    // Launch lock screen immediately
                    val intent = Intent(applicationContext, MainActivity::class.java).apply {
                        putExtra("lockedPackage", packageName)
                        putExtra("lockedClass", className)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or 
                                 Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }
                    try {
                        startActivity(intent)
                    } catch (e: Exception) {
                        Log.e("Accessibility", "Error starting activity: ${e.message}")
                    }
                }
            }
        }
    }
}
    
    private fun sendAppOpenedBroadcast(packageName: String, className: String?) {
        val intent = Intent("APP_OPENED_ACTION").apply {
            putExtra("packageName", packageName)
            putExtra("className", className)
            // Restrict broadcast to your app package
            `package` = "com.applock"
        }
        try {
            sendBroadcast(intent)
        } catch (e: Exception) {
            Log.e("Accessibility", "Error sending broadcast: ${e.message}")
        }
    }

    override fun onInterrupt() {
        // Handle interruption
    }
    
    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        Log.d("Accessibility", "Service destroyed")
    }
}