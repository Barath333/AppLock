package com.applock

import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream

class AppListModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppListModule"

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val packageManager = reactApplicationContext.packageManager
            val apps = packageManager.getInstalledApplications(PackageManager.GET_META_DATA)
            val result = WritableNativeArray()

            for (app in apps) {
                // Skip system apps if desired
                if (app.flags and ApplicationInfo.FLAG_SYSTEM == 0) {
                    val appInfo = WritableNativeMap()
                    appInfo.putString("name", app.loadLabel(packageManager).toString())
                    appInfo.putString("packageName", app.packageName)
                    appInfo.putString("icon", drawableToBase64(app.loadIcon(packageManager)))
                    result.pushMap(appInfo)
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("APP_LIST_ERROR", "Failed to get installed apps: ${e.message}")
        }
    }

    private fun drawableToBase64(drawable: Drawable): String {
        val bitmap = Bitmap.createBitmap(
            drawable.intrinsicWidth,
            drawable.intrinsicHeight,
            Bitmap.Config.ARGB_8888
        )
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, canvas.width, canvas.height)
        drawable.draw(canvas)

        val byteArrayOutputStream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, byteArrayOutputStream)
        val byteArray = byteArrayOutputStream.toByteArray()
        return Base64.encodeToString(byteArray, Base64.DEFAULT)
    }
}