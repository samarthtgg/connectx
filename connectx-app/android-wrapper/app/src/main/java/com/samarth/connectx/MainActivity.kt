package com.samarth.connectx

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingWebPermission: PermissionRequest? = null

    private val filePicker = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val data = result.data
        val selected = if (result.resultCode == RESULT_OK && data != null) {
            when {
                data.clipData != null -> Array(data.clipData!!.itemCount) { index ->
                    data.clipData!!.getItemAt(index).uri
                }
                data.data != null -> arrayOf(data.data!!)
                else -> null
            }
        } else null
        fileCallback?.onReceiveValue(selected)
        fileCallback = null
    }

    private val mediaPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val request = pendingWebPermission ?: return@registerForActivityResult
        val resources = request.resources.filter { resource ->
            when (resource) {
                PermissionRequest.RESOURCE_VIDEO_CAPTURE ->
                    grants[Manifest.permission.CAMERA] == true ||
                        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                PermissionRequest.RESOURCE_AUDIO_CAPTURE ->
                    grants[Manifest.permission.RECORD_AUDIO] == true ||
                        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                else -> false
            }
        }.toTypedArray()
        if (resources.isNotEmpty()) request.grant(resources) else request.deny()
        pendingWebPermission = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.mediaPlaybackRequiresUserGesture = true
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.setSupportMultipleWindows(false)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return if (uri.scheme == "https" && (
                    uri.host == "connectx-samarthtgg.vercel.app" ||
                    uri.host == "connectx-sandy.vercel.app"
                )) {
                    false
                } else if (uri.scheme == "http" || uri.scheme == "https") {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } else {
                    true
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = params.acceptTypes.firstOrNull { it.isNotBlank() } ?: "*/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                }
                return try {
                    filePicker.launch(intent)
                    true
                } catch (_: Exception) {
                    fileCallback = null
                    false
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val needed = mutableListOf<String>()
                    if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) &&
                        ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED
                    ) needed += Manifest.permission.CAMERA
                    if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) &&
                        ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
                    ) needed += Manifest.permission.RECORD_AUDIO

                    if (needed.isEmpty()) {
                        val allowed = request.resources.filter {
                            it == PermissionRequest.RESOURCE_VIDEO_CAPTURE || it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
                        }.toTypedArray()
                        if (allowed.isNotEmpty()) request.grant(allowed) else request.deny()
                    } else {
                        pendingWebPermission?.deny()
                        pendingWebPermission = request
                        mediaPermissionLauncher.launch(needed.toTypedArray())
                    }
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingWebPermission == request) pendingWebPermission = null
            }
        }

        if (savedInstanceState == null) {
            webView.loadUrl("https://connectx-samarthtgg.vercel.app/")
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated for WebView back navigation compatibility")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }

    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        pendingWebPermission?.deny()
        webView.destroy()
        super.onDestroy()
    }
}
