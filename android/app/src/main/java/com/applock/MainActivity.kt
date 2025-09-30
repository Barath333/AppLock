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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d("AppLockDebug", "🏠 MainActivity onCreate")
        Log.d("AppLockDebug", "📦 Package: $packageName")
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
        // Re-check intent in case we missed it
        handleLockedIntent(intent)
    }

    private fun handleLockedIntent(intent: Intent?) {
        intent?.let {
            Log.d("AppLockDebug", "📨 Handling Intent:")
            Log.d("AppLockDebug", "   Action: ${it.action}")
            Log.d("AppLockDebug", "   Extras: ${it.extras?.keySet()}")
            
            val isLockScreen = it.getBooleanExtra("isLockScreen", false)
            val lockedPackage = it.getStringExtra("lockedPackage")
            
            if (isLockScreen && lockedPackage != null) {
                Log.d("AppLockDebug", "🎯 Lock Screen Mode Activated for: $lockedPackage")
                setupAsLockScreen()
                sendAppLockedEvent(lockedPackage, it.getStringExtra("lockedClass"))
            } else {
                Log.d("AppLockDebug", "📭 Regular App Mode")
            }
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

    private fun sendAppLockedEvent(packageName: String, className: String?) {
        try {
            Log.d("AppLockDebug", "📤 Sending App Locked Event to React Native")
            
            val params = Bundle().apply {
                putString("packageName", packageName)
                putString("className", className)
                putString("timestamp", System.currentTimeMillis().toString())
            }
            
            // Use handler to ensure this runs on UI thread
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    if (reactInstanceManager != null && 
                        reactInstanceManager.currentReactContext != null) {
                        
                        reactInstanceManager
                            .currentReactContext
                            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            ?.emit("onAppLocked", Arguments.fromBundle(params))
                            
                        Log.d("AppLockDebug", "✅ App Locked Event Sent Successfully")
                    } else {
                        Log.e("AppLockDebug", "❌ React Context is null, cannot send event")
                        // Retry after a delay
                        Handler(Looper.getMainLooper()).postDelayed({
                            reactInstanceManager
                                ?.currentReactContext
                                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                                ?.emit("onAppLocked", Arguments.fromBundle(params))
                            Log.d("AppLockDebug", "✅ App Locked Event Sent on Retry")
                        }, 1000)
                    }
                } catch (e: Exception) {
                    Log.e("AppLockDebug", "❌ Error sending locked event: ${e.message}", e)
                }
            }, 500) // Small delay to ensure React is ready
            
        } catch (e: Exception) {
            Log.e("AppLockDebug", "❌ Error in sendAppLockedEvent: ${e.message}", e)
        }
    }

    override fun onBackPressed() {
        // Check if we're in lock screen mode
        if (intent.getBooleanExtra("isLockScreen", false)) {
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