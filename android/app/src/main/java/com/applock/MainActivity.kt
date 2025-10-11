package com.applock

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class MainActivity : ReactActivity() {
    private var isLockScreenMode = false
    private var lockedPackageName: String? = null
    private var lockedClassName: String? = null
    private lateinit var prefs: SharedPreferences
    private val handler = Handler(Looper.getMainLooper())
    private var hasHandledCurrentIntent = false
    private var isReactNativeReady = false

    companion object {
        private const val TAG = "AppLockDebug"
        private const val OUR_APP_PACKAGE = "com.applock"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "🏠 MainActivity onCreate - Starting fresh instance")
        
        prefs = getSharedPreferences("AppLock", Context.MODE_PRIVATE)
        
        // CRITICAL: Always handle the intent in onCreate
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        Log.d(TAG, "🔄 MainActivity onNewIntent - New intent received")
        setIntent(intent) // Update current intent
        hasHandledCurrentIntent = false
        handleIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        Log.d(TAG, "🔄 MainActivity onResume - isLockScreenMode: $isLockScreenMode")
        
        // Check if React Native is ready
        if (!isReactNativeReady && reactInstanceManager?.currentReactContext != null) {
            isReactNativeReady = true
            Log.d(TAG, "✅ React Native is now ready")
            
            // If we're in lock screen mode but haven't sent the event, send it now
            if (isLockScreenMode && lockedPackageName != null) {
                sendLockEventToReactNative(lockedPackageName!!, lockedClassName)
            }
        }
        
        // If we haven't handled the current intent yet, process it
        if (!hasHandledCurrentIntent) {
            handleIntent(intent)
        }
    }

    private fun handleIntent(intent: Intent?) {
        if (intent == null || hasHandledCurrentIntent) {
            return
        }

        Log.d(TAG, "📨 Processing Intent in handleIntent:")
        Log.d(TAG, "   Action: ${intent.action}")
        Log.d(TAG, "   Extras: ${intent.extras?.keySet()}")
        
        val isLockScreen = intent.getBooleanExtra("isLockScreen", false)
        val lockedPackage = intent.getStringExtra("lockedPackage")
        
        if (isLockScreen && lockedPackage != null) {
            Log.d(TAG, "🎯 LOCK SCREEN MODE ACTIVATED for: $lockedPackage")
            activateLockScreenMode(lockedPackage, intent.getStringExtra("lockedClass"))
            hasHandledCurrentIntent = true
        } else {
            Log.d(TAG, "📭 REGULAR APP MODE - No lock screen intent")
            // If no lock screen intent, make sure we're in regular mode
            if (isLockScreenMode) {
                Log.d(TAG, "⚠️ Was in lock screen mode but no lock intent - resetting")
                resetToRegularMode()
            }
            hasHandledCurrentIntent = true
        }
    }

    private fun activateLockScreenMode(packageName: String, className: String?) {
        Log.d(TAG, "🛡️ ACTIVATING LOCK SCREEN MODE for: $packageName")
        
        isLockScreenMode = true
        lockedPackageName = packageName
        lockedClassName = className
        
        // Store in SharedPreferences as backup
        storePendingLockedApp(packageName, className)
        
        // Set up lock screen UI immediately
        setupLockScreenUI()
        
        // Send event to React Native
        sendLockEventToReactNative(packageName, className)
    }

    private fun resetToRegularMode() {
        Log.d(TAG, "🔄 RESETTING TO REGULAR MODE")
        isLockScreenMode = false
        lockedPackageName = null
        lockedClassName = null
        hasHandledCurrentIntent = false
        
        // Clear any lock screen state
        clearLockScreenState()
        
        // Remove lock screen flags
        window.clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
        window.clearFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
        window.clearFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun setupLockScreenUI() {
        try {
            Log.d(TAG, "🎨 Setting up Lock Screen UI")
            
            // Make this a proper lock screen that shows over other apps
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
            window.addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
            window.addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
            
            // Modern Android APIs
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            
            Log.d(TAG, "✅ Lock screen UI setup complete")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error setting up lock screen UI: ${e.message}", e)
        }
    }

    private fun storePendingLockedApp(packageName: String, className: String?) {
        try {
            val editor = prefs.edit()
            editor.putString("pendingLockedPackage", packageName)
            editor.putString("pendingLockedClass", className ?: "")
            editor.putLong("pendingLockedTimestamp", System.currentTimeMillis())
            editor.apply()
            Log.d(TAG, "💾 Stored pending locked app: $packageName")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error storing pending locked app: ${e.message}")
        }
    }

    private fun clearLockScreenState() {
        try {
            val editor = prefs.edit()
            editor.remove("pendingLockedPackage")
            editor.remove("pendingLockedClass")
            editor.remove("pendingLockedTimestamp")
            editor.apply()
            Log.d(TAG, "🧹 Cleared lock screen state from SharedPreferences")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error clearing lock screen state: ${e.message}")
        }
    }

    private fun sendLockEventToReactNative(packageName: String, className: String?) {
        Log.d(TAG, "📤 Attempting to send lock event to React Native: $packageName")
        
        val params = Bundle().apply {
            putString("packageName", packageName)
            putString("className", className)
            putString("timestamp", System.currentTimeMillis().toString())
        }
        
        handler.post {
            try {
                if (reactInstanceManager != null && 
                    reactInstanceManager.currentReactContext != null) {
                    
                    Log.d(TAG, "✅ React Context is available, sending event")
                    reactInstanceManager
                        .currentReactContext
                        ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        ?.emit("onAppLocked", Arguments.fromBundle(params))
                        
                    Log.d(TAG, "✅ Lock event sent successfully to React Native")
                } else {
                    Log.w(TAG, "⚠️ React Context not ready, will retry in 100ms")
                    // Retry after short delay
                    handler.postDelayed({
                        sendLockEventToReactNative(packageName, className)
                    }, 100)
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error sending lock event: ${e.message}", e)
            }
        }
    }

    override fun onBackPressed() {
        if (isLockScreenMode) {
            Log.d(TAG, "🔒 Back button blocked - Lock screen is active")
            // Don't call super - prevent back button from working
            return
        }
        super.onBackPressed()
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "💀 MainActivity onDestroy")
        // Don't reset state here as it might cause issues with rapid recreations
    }

    override fun getMainComponentName(): String = "AppLock"

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return DefaultReactActivityDelegate(
            this,
            mainComponentName,
            DefaultNewArchitectureEntryPoint.fabricEnabled
        )
    }
}