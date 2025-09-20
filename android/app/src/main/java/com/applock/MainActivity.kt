package com.applock

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.Arguments
import android.util.Log

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    handleLockedIntent(intent)
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    handleLockedIntent(intent)
  }

  private fun handleLockedIntent(intent: Intent?) {
    intent?.let {
      if (it.hasExtra("lockedPackage")) {
        val packageName = it.getStringExtra("lockedPackage")
        val className = it.getStringExtra("lockedClass")
        
        Log.d("MainActivity", "Handling locked intent for package: $packageName")
        
        // Send event to React Native
        val params = Arguments.createMap().apply {
          putString("packageName", packageName)
          putString("className", className)
        }
        
        reactInstanceManager?.currentReactContext?.let { context ->
          context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onAppOpened", params)
        }
      }
    }
  }

  override fun getMainComponentName(): String = "AppLock"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}