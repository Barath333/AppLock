package com.applock

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.os.Handler
import android.os.Looper
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.content.SharedPreferences
import android.content.Context

class MainActivity : ReactActivity() {
    private var isLockScreenMode = false
    private var shouldShowLockScreen = false
    private var lockedPackageName: String? = null
    private var lockedClassName: String? = null
    private var isReactNativeReady = false
    private val handler = Handler(Looper.getMainLooper())
    private var hasSentLockEvent = false

    companion object {
        private const val TAG = "AppLockDebug"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "🏠 MainActivity onCreate")
        Log.d(TAG, "📦 Package: $packageName")
        
        // Handle intent immediately
        handleLockedIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        Log.d(TAG, "🔄 MainActivity onNewIntent")
        setIntent(intent)
        handleLockedIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        Log.d(TAG, "🔄 MainActivity onResume")
        
        // Check if we need to send lock event
        checkAndSendLockEvent()
    }

    private fun handleLockedIntent(intent: Intent?) {
        if (intent == null) return
        
        Log.d(TAG, "📨 Handling Intent:")
        Log.d(TAG, "   Action: ${intent.action}")
        Log.d(TAG, "   Extras: ${intent.extras?.keySet()}")
        
        val isLockScreen = intent.getBooleanExtra("isLockScreen", false)
        val lockedPackage = intent.getStringExtra("lockedPackage")
        
        if (isLockScreen && lockedPackage != null) {
            Log.d(TAG, "🎯 Lock Screen Mode Activated for: $lockedPackage")
            isLockScreenMode = true
            shouldShowLockScreen = true
            lockedPackageName = lockedPackage
            lockedClassName = intent.getStringExtra("lockedClass")
            
            // Store in SharedPreferences for React Native to access
            storePendingLockedApp(lockedPackage, lockedClassName)
            
            setupAsLockScreen()
            hasSentLockEvent = false
            
            Log.d(TAG, "⏳ Stored locked app info for React Native: $lockedPackage")
        } else {
            Log.d(TAG, "📭 Regular App Mode")
            isLockScreenMode = false
            shouldShowLockScreen = false
            lockedPackageName = null
            lockedClassName = null
            hasSentLockEvent = false
            clearLockScreenFlags()
        }
    }

   private fun storePendingLockedApp(packageName: String, className: String?) {
    try {
        val prefs = getSharedPreferences("AppLock", Context.MODE_PRIVATE)
        val editor = prefs.edit()
        editor.putString("pendingLockedPackage", packageName)
        editor.putString("pendingLockedClass", className ?: "")
        editor.putLong("pendingLockedTimestamp", System.currentTimeMillis())
        editor.apply()
        Log.d(TAG, "💾 Stored pending locked app: $packageName")
        
        // Also set a flag to indicate we're in lock screen mode
        editor.putBoolean("isLockScreenMode", true)
        editor.apply()
    } catch (e: Exception) {
        Log.e(TAG, "❌ Error storing pending locked app: ${e.message}")
    }
}

    private fun checkAndSendLockEvent() {
        if (shouldShowLockScreen && lockedPackageName != null && !hasSentLockEvent) {
            Log.d(TAG, "🔍 Checking React Native readiness for lock event...")
            
            if (reactInstanceManager?.currentReactContext != null) {
                Log.d(TAG, "✅ React Native is ready, sending lock event")
                sendAppLockedEvent(lockedPackageName!!, lockedClassName)
            } else {
                Log.d(TAG, "⏳ React Native not ready yet, will retry")
                // Retry after delay
                handler.postDelayed({
                    checkAndSendLockEvent()
                }, 500)
            }
        }
    }

    private fun setupAsLockScreen() {
        try {
            Log.d(TAG, "🛡️ Setting up as Lock Screen")
            
            // Clear any existing flags first
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            
            // Add flags to make it overlay and show on top
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
            window.addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
            window.addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN)
            window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
            
            Log.d(TAG, "✅ Lock Screen Flags Applied")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error setting up lock screen: ${e.message}", e)
        }
    }

    private fun clearLockScreenFlags() {
        try {
            Log.d(TAG, "🧹 Clearing lock screen flags")
            window.clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
            window.clearFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
            window.clearFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            window.clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN)
            window.clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error clearing lock screen flags: ${e.message}")
        }
    }

    private fun sendAppLockedEvent(packageName: String, className: String?) {
        try {
            Log.d(TAG, "📤 Sending App Locked Event to React Native: $packageName")
            
            val params = Bundle().apply {
                putString("packageName", packageName)
                putString("className", className)
                putString("timestamp", System.currentTimeMillis().toString())
            }
            
            // Use handler to ensure this runs on UI thread
            handler.post {
                try {
                    if (reactInstanceManager != null && 
                        reactInstanceManager.currentReactContext != null) {
                        
                        reactInstanceManager
                            .currentReactContext
                            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            ?.emit("onAppLocked", Arguments.fromBundle(params))
                            
                        Log.d(TAG, "✅ App Locked Event Sent Successfully")
                        hasSentLockEvent = true
                        shouldShowLockScreen = false
                    } else {
                        Log.e(TAG, "❌ React Context is null, cannot send event")
                        // Retry after a delay
                        handler.postDelayed({
                            sendAppLockedEvent(packageName, className)
                        }, 500)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error sending locked event: ${e.message}", e)
                }
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error in sendAppLockedEvent: ${e.message}", e)
        }
    }

    override fun onBackPressed() {
        // Check if we're in lock screen mode
        if (isLockScreenMode) {
            Log.d(TAG, "🔒 Back button pressed in lock screen - Ignoring")
            // Don't call super to prevent back button from working
            return
        }
        super.onBackPressed()
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