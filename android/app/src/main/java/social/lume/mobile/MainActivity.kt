package social.lume.mobile

import android.Manifest
import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import io.livekit.android.room.track.screencapture.ScreenCaptureParams
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Thin native host: the responsive React app remains Lume's only product UI. */
class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingWebPermission: PermissionRequest? = null
    private var pendingShare: ShareCredentials? = null
    private var screenRoom: Room? = null
    private var callActive = false

    private val projectionLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val credentials = pendingShare.also { pendingShare = null }
        if (result.resultCode != Activity.RESULT_OK || result.data == null || credentials == null) {
            notifyWeb(false, "Compartilhamento cancelado.")
        } else {
            startNativeScreenShare(credentials, result.data!!)
        }
    }

    private val permissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        pendingWebPermission?.let { request ->
            val allowed = request.resources.filter(::canGrantWebResource).toTypedArray()
            if (allowed.isNotEmpty()) request.grant(allowed) else request.deny()
        }
        pendingWebPermission = null
    }

    private val fileLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        fileCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        configureWebView()
        setContentView(webView)
        if (savedInstanceState == null) webView.loadUrl(BuildConfig.LUME_BASE_URL) else webView.restoreState(savedInstanceState)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.post { notifyWeb(screenRoom != null) }
        }
    }

    @Suppress("SetJavaScriptEnabled")
    private fun configureWebView() {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
            setSupportZoom(false)
            userAgentString = "$userAgentString LumeAndroid/${BuildConfig.VERSION_NAME}"
        }
        WebViewCompat.addWebMessageListener(
            webView,
            "LumeAndroid",
            setOf(BuildConfig.LUME_BASE_URL),
            object : WebViewCompat.WebMessageListener {
                override fun onPostMessage(
                    view: WebView,
                    message: WebMessageCompat,
                    sourceOrigin: Uri,
                    isMainFrame: Boolean,
                    replyProxy: JavaScriptReplyProxy,
                ) {
                    if (!isMainFrame || !isTrustedLumeUrl(sourceOrigin)) return
                    message.data?.let(::handleBridgeMessage)
                }
            },
        )
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (isTrustedLumeUrl(request.url)) return false
                startActivity(Intent(Intent.ACTION_VIEW, request.url))
                return true
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (!isTrustedLumeUrl(request.origin)) {
                        request.deny()
                        return@runOnUiThread
                    }
                    val missing = request.resources.mapNotNull(::androidPermissionForWebResource)
                        .filter { ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED }
                        .distinct()
                    if (missing.isEmpty()) {
                        val allowed = request.resources.filter(::canGrantWebResource).toTypedArray()
                        if (allowed.isNotEmpty()) request.grant(allowed) else request.deny()
                    } else {
                        pendingWebPermission?.deny()
                        pendingWebPermission = request
                        permissionLauncher.launch(missing.toTypedArray())
                    }
                }
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams,
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                fileLauncher.launch(fileChooserParams.createIntent())
                return true
            }
        }
        webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
            val request = DownloadManager.Request(Uri.parse(url))
                .setMimeType(mimeType)
                .addRequestHeader("User-Agent", userAgent)
                .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
                .setTitle(fileName)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            getSystemService(DownloadManager::class.java).enqueue(request)
        })
    }

    private fun isTrustedLumeUrl(uri: Uri): Boolean {
        val base = Uri.parse(BuildConfig.LUME_BASE_URL)
        return uri.scheme == "https" && uri.host == base.host
    }

    private fun androidPermissionForWebResource(resource: String): String? = when (resource) {
        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
        else -> null
    }

    private fun canGrantWebResource(resource: String): Boolean {
        val permission = androidPermissionForWebResource(resource) ?: return false
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }

    private fun startNativeScreenShare(credentials: ShareCredentials, projectionData: Intent) {
        lifecycleScope.launch {
            runCatching {
                stopNativeScreenShare(notify = false)
                ContextCompat.startForegroundService(
                    this@MainActivity,
                    Intent(this@MainActivity, CallForegroundService::class.java)
                        .setAction(CallForegroundService.ACTION_SCREEN_SHARE),
                )
                val room = LiveKit.create(applicationContext)
                room.connect(credentials.url, credentials.token)
                room.localParticipant.setScreenShareEnabled(true, ScreenCaptureParams(projectionData))
                screenRoom = room
            }.onSuccess { notifyWeb(true) }
                .onFailure { error ->
                    stopNativeScreenShare(notify = false)
                    notifyWeb(false, error.message ?: "Não foi possível compartilhar a tela.")
                }
        }
    }

    private suspend fun stopNativeScreenShare(notify: Boolean = true) {
        val room = screenRoom
        screenRoom = null
        runCatching { room?.localParticipant?.setScreenShareEnabled(false) }
        room?.disconnect()
        if (callActive) startForegroundCallService(CallForegroundService.ACTION_CALL)
        else stopService(Intent(this, CallForegroundService::class.java))
        if (notify) notifyWeb(false)
    }

    private fun notifyWeb(active: Boolean, error: String? = null) {
        val detail = "{active:$active,error:${if (error == null) "null" else JSONObject.quote(error)}}"
        runOnUiThread {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('lume-native-screen-share',{detail:$detail}));",
                null,
            )
        }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.destroy()
        }
        screenRoom?.disconnect()
        screenRoom = null
        stopService(Intent(this, CallForegroundService::class.java))
        super.onDestroy()
    }

    private fun handleBridgeMessage(raw: String) {
        val payload = runCatching { JSONObject(raw) }.getOrNull() ?: return
        when (payload.optString("type")) {
            "startCall" -> {
                callActive = true
                startForegroundCallService(CallForegroundService.ACTION_CALL)
            }
            "stopCall" -> {
                callActive = false
                if (screenRoom == null) stopService(Intent(this, CallForegroundService::class.java))
            }
            "startScreenShare" -> runOnUiThread {
                val url = payload.optString("url")
                val token = payload.optString("token")
                if ((!url.startsWith("wss://") && !url.startsWith("https://")) || token.isBlank()) {
                    notifyWeb(false, "Servidor de chamada inválido.")
                    return@runOnUiThread
                }
                pendingShare = ShareCredentials(url, token)
                val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                projectionLauncher.launch(manager.createScreenCaptureIntent())
            }
            "stopScreenShare" -> lifecycleScope.launch { stopNativeScreenShare() }
        }
    }

    private fun startForegroundCallService(action: String) {
        ContextCompat.startForegroundService(
            this,
            Intent(this, CallForegroundService::class.java).setAction(action),
        )
    }

    private data class ShareCredentials(val url: String, val token: String)
}
