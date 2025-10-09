package com.applock

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class MainActivity : ReactActivity() {
    private var isLockScreenMode = false
    private var shouldShowLockScreen = false
    private var lockedPackageName: String? = null
    private var lockedClassName: String? = null
    private var isReactNativeReady = false
    private var hasSentLockEvent = false
    private lateinit var prefs: SharedPreferences
    private val handler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "AppLockDebug"
        private const val OUR_APP_PACKAGE = "com.applock"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "🏠 MainActivity onCreate")
        
        prefs = getSharedPreferences("AppLock", Context.MODE_PRIVATE)
        
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
        
        // If we're in lock screen mode but haven't shown it yet, set it up
        if (isLockScreenMode && shouldShowLockScreen) {
            setupAsLockScreen()
        }
    }

    override fun onPause() {
        super.onPause()
        Log.d(TAG, "⏸️ MainActivity onPause")
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
            // Clear any pending lock screen state if not in lock screen mode
            if (!isLockScreenMode) {
                clearLockScreenState()
            }
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
            Log.d(TAG, "🧹 Cleared lock screen state")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error clearing lock screen state: ${e.message}")
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
            
            // For modern Android (SDK 30+), use these flags to show over lock screen
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            
            Log.d(TAG, "✅ Lock screen setup complete")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error setting up lock screen: ${e.message}", e)
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