package com.applock

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class AppAccessibilityService : AccessibilityService() {
    private var reactContext: ReactApplicationContext? = null
    
    fun setReactContext(context: ReactApplicationContext) {
        this.reactContext = context
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event?.let {
            if (it.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                val packageName = it.packageName?.toString()
                val className = it.className?.toString()
                
                packageName?.let { pkg ->
                    Log.d("Accessibility", "App opened: $pkg, class: $className")
                    
                    // Send event to React Native
                    sendAppOpenedEvent(pkg, className)
                }
            }
        }
    }
    
    private fun sendAppOpenedEvent(packageName: String, className: String?) {
        reactContext?.let { context ->
            try {
                val params: WritableMap = Arguments.createMap()
                params.putString("packageName", packageName)
                params.putString("className", className)
                
                context
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("onAppOpened", params)
            } catch (e: Exception) {
                Log.e("AppAccessibilityService", "Error sending event", e)
            }
        }
    }

    override fun onInterrupt() {
        // Handle interruption
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d("Accessibility", "Service connected")
    }
}