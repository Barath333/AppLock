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

class MainActivity : ReactActivity() {
    private var isLockScreenMode = false
    private var shouldShowLockScreen = false
    private var lockedPackageName: String? = null
    private var lockedClassName: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d("AppLockDebug", "🏠 MainActivity onCreate")
        Log.d("AppLockDebug", "📦 Package: $packageName")
        
        // Handle intent immediately
        handleLockedIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        Log.d("AppLockDebug", "🔄 MainActivity onNewIntent")
        setIntent(intent)
        handleLockedIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        Log.d("AppLockDebug", "🔄 MainActivity onResume")
        
        // If we're in lock screen mode and React is ready, send the event
        if (shouldShowLockScreen && lockedPackageName != null) {
            Handler(Looper.getMainLooper()).postDelayed({
                sendAppLockedEvent(lockedPackageName!!, lockedClassName)
            }, 100)
        }
    }

    private fun handleLockedIntent(intent: Intent?) {
        if (intent == null) return
        
        Log.d("AppLockDebug", "📨 Handling Intent:")
        Log.d("AppLockDebug", "   Action: ${intent.action}")
        Log.d("AppLockDebug", "   Extras: ${intent.extras?.keySet()}")
        
        val isLockScreen = intent.getBooleanExtra("isLockScreen", false)
        val lockedPackage = intent.getStringExtra("lockedPackage")
        
        if (isLockScreen && lockedPackage != null) {
            Log.d("AppLockDebug", "🎯 Lock Screen Mode Activated for: $lockedPackage")
            isLockScreenMode = true
            shouldShowLockScreen = true
            lockedPackageName = lockedPackage
            lockedClassName = intent.getStringExtra("lockedClass")
            
            setupAsLockScreen()
            
            // Don't send event immediately - wait for React to be ready
            Log.d("AppLockDebug", "⏳ Waiting for React to be ready before sending lock event")
        } else {
            Log.d("AppLockDebug", "📭 Regular App Mode")
            isLockScreenMode = false
            shouldShowLockScreen = false
            lockedPackageName = null
            lockedClassName = null
            clearLockScreenFlags()
        }
    }

    private fun setupAsLockScreen() {
        try {
            Log.d("AppLockDebug", "🛡️ Setting up as Lock Screen")
            
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
            
            Log.d("AppLockDebug", "✅ Lock Screen Flags Applied")
            
        } catch (e: Exception) {
            Log.e("AppLockDebug", "❌ Error setting up lock screen: ${e.message}", e)
        }
    }

    private fun clearLockScreenFlags() {
        try {
            Log.d("AppLockDebug", "🧹 Clearing lock screen flags")
            window.clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
            window.clearFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
            window.clearFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            window.clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN)
            window.clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
        } catch (e: Exception) {
            Log.e("AppLockDebug", "❌ Error clearing lock screen flags: ${e.message}")
        }
    }

    private fun sendAppLockedEvent(packageName: String, className: String?) {
        try {
            Log.d("AppLockDebug", "📤 Sending App Locked Event to React Native: $packageName")
            
            val params = Bundle().apply {
                putString("packageName", packageName)
                putString("className", className)
                putString("timestamp", System.currentTimeMillis().toString())
            }
            
            // Use handler to ensure this runs on UI thread
            Handler(Looper.getMainLooper()).post {
                try {
                    if (reactInstanceManager != null && 
                        reactInstanceManager.currentReactContext != null) {
                        
                        reactInstanceManager
                            .currentReactContext
                            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            ?.emit("onAppLocked", Arguments.fromBundle(params))
                            
                        Log.d("AppLockDebug", "✅ App Locked Event Sent Successfully")
                        shouldShowLockScreen = false
                    } else {
                        Log.e("AppLockDebug", "❌ React Context is null, cannot send event")
                        // Retry after a delay
                        Handler(Looper.getMainLooper()).postDelayed({
                            if (reactInstanceManager?.currentReactContext != null) {
                                reactInstanceManager
                                    .currentReactContext
                                    ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                                    ?.emit("onAppLocked", Arguments.fromBundle(params))
                                Log.d("AppLockDebug", "✅ App Locked Event Sent on Retry")
                                shouldShowLockScreen = false
                            }
                        }, 500)
                    }
                } catch (e: Exception) {
                    Log.e("AppLockDebug", "❌ Error sending locked event: ${e.message}", e)
                }
            }
            
        } catch (e: Exception) {
            Log.e("AppLockDebug", "❌ Error in sendAppLockedEvent: ${e.message}", e)
        }
    }

    override fun onBackPressed() {
        // Check if we're in lock screen mode
        if (isLockScreenMode) {
            Log.d("AppLockDebug", "🔒 Back button pressed in lock screen - Ignoring")
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