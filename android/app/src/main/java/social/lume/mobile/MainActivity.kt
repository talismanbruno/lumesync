package social.lume.mobile

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import io.livekit.android.LiveKit
import io.livekit.android.audio.ScreenAudioCapturer
import io.livekit.android.room.Room
import io.livekit.android.room.track.LocalAudioTrack
import io.livekit.android.room.track.LocalVideoTrack
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.screencapture.ScreenCaptureParams
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private val api = LumeApi()
    private var session: LumeSession? = null
    private var room: Room? = null
    private var presence: PresenceSocket? = null
    private var pendingChannel: VoiceChannel? = null
    private var microphoneMuted = false
    private var screenSharing = false
    private var screenAudio: ScreenAudioCapturer? = null

    private val permissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        if (grants[Manifest.permission.RECORD_AUDIO] == true || hasPermission(Manifest.permission.RECORD_AUDIO)) {
            pendingChannel?.let { joinChannel(it) }
        } else toast("O microfone é necessário para entrar na chamada.")
    }

    private val screenCaptureLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            toast("Compartilhamento cancelado.")
            return@registerForActivityResult
        }
        lifecycleScope.launch { startScreenShare(result.data!!) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showLogin()
    }

    private fun showLogin() {
        val content = column().apply {
            gravity = Gravity.CENTER_HORIZONTAL
            addView(title("Lume"))
            addView(label("Mobile Beta · chamadas e compartilhamento nativo"))
            val username = input("Usuário")
            val password = input("Senha").apply { inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }
            addView(username)
            addView(password)
            addView(action("Entrar") {
                val user = username.text.toString().trim()
                val pass = password.text.toString()
                if (user.isBlank() || pass.isBlank()) return@action toast("Digite usuário e senha.")
                lifecycleScope.launch {
                    showBusy("Entrando…")
                    runCatching { api.login(user, pass) }
                        .onSuccess { session = it; loadChannels() }
                        .onFailure { showLogin(); toast(it.message ?: "Não foi possível entrar.") }
                }
            })
        }
        setContentView(wrap(content))
    }

    private fun loadChannels() {
        val current = session ?: return showLogin()
        lifecycleScope.launch {
            showBusy("Buscando canais de voz…")
            runCatching { api.voiceChannels(current.token) }
                .onSuccess { showChannels(it) }
                .onFailure { showChannels(emptyList()); toast(it.message ?: "Erro ao carregar canais.") }
        }
    }

    private fun showChannels(channels: List<VoiceChannel>) {
        val current = session ?: return showLogin()
        val content = column().apply {
            addView(title("Olá, ${current.displayName}"))
            addView(label("Escolha um canal de voz"))
            if (channels.isEmpty()) addView(label("Nenhum canal de voz disponível."))
            channels.forEach { channel ->
                addView(action("${channel.spaceName}  ·  ${channel.name}") { requestJoin(channel) })
            }
            addView(action("Atualizar") { loadChannels() })
            addView(action("Sair da conta") { session = null; showLogin() })
        }
        setContentView(wrap(content))
    }

    private fun requestJoin(channel: VoiceChannel) {
        pendingChannel = channel
        val permissions = buildList {
            if (!hasPermission(Manifest.permission.RECORD_AUDIO)) add(Manifest.permission.RECORD_AUDIO)
            if (Build.VERSION.SDK_INT >= 33 && !hasPermission(Manifest.permission.POST_NOTIFICATIONS)) add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (permissions.isEmpty()) joinChannel(channel) else permissionLauncher.launch(permissions.toTypedArray())
    }

    private fun joinChannel(channel: VoiceChannel) {
        val current = session ?: return showLogin()
        pendingChannel = null
        lifecycleScope.launch {
            showBusy("Entrando em ${channel.name}…")
            runCatching {
                val credentials = api.voiceCredentials(current.token, channel.id)
                val liveRoom = LiveKit.create(applicationContext)
                liveRoom.connect(credentials.url, credentials.token)
                liveRoom.localParticipant.setMicrophoneEnabled(true)
                room = liveRoom
                presence = api.openPresenceSocket(current.token, channel.id)
                startCallService(CallForegroundService.ACTION_CALL)
            }.onSuccess { showCall(channel) }
                .onFailure { leaveCall(false); loadChannels(); toast(it.message ?: "Não foi possível entrar.") }
        }
    }

    private fun showCall(channel: VoiceChannel) {
        val content = column().apply {
            gravity = Gravity.CENTER_HORIZONTAL
            addView(label(channel.spaceName.uppercase()))
            addView(title(channel.name))
            addView(label("Conectado. O áudio das outras pessoas toca automaticamente."))

            val mic = action("Silenciar microfone") {
                microphoneMuted = !microphoneMuted
                lifecycleScope.launch { room?.localParticipant?.setMicrophoneEnabled(!microphoneMuted) }
                presence?.status(microphoneMuted, screenSharing)
                (it as Button).text = if (microphoneMuted) "Ativar microfone" else "Silenciar microfone"
            }
            addView(mic)

            addView(action("Compartilhar minha tela") {
                if (screenSharing) lifecycleScope.launch { stopScreenShare() }
                else {
                    val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                    screenCaptureLauncher.launch(manager.createScreenCaptureIntent())
                }
            })
            addView(label("O Android sempre pedirá sua confirmação antes de transmitir a tela."))
            addView(action("Sair da chamada") { leaveCall(); loadChannels() })
        }
        setContentView(wrap(content))
    }

    private suspend fun startScreenShare(data: Intent) {
        val activeRoom = room ?: return
        runCatching {
            startCallService(CallForegroundService.ACTION_SCREEN_SHARE)
            activeRoom.localParticipant.setScreenShareEnabled(true, ScreenCaptureParams(data))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val video = activeRoom.localParticipant.getTrackPublication(Track.Source.SCREEN_SHARE)?.track as? LocalVideoTrack
                val audio = activeRoom.localParticipant.getTrackPublication(Track.Source.MICROPHONE)?.track as? LocalAudioTrack
                if (video != null && audio != null) {
                    screenAudio = ScreenAudioCapturer.createFromScreenShareTrack(video)?.also {
                        it.gain = 0.18f
                        audio.setAudioBufferCallback(it)
                    }
                }
            }
            screenSharing = true
            presence?.status(microphoneMuted, true)
        }.onSuccess { toast("Sua tela está ao vivo.") }
            .onFailure { toast(it.message ?: "Não foi possível compartilhar a tela.") }
    }

    private suspend fun stopScreenShare() {
        val activeRoom = room ?: return
        (activeRoom.localParticipant.getTrackPublication(Track.Source.MICROPHONE)?.track as? LocalAudioTrack)
            ?.setAudioBufferCallback(null)
        screenAudio?.releaseAudioResources()
        screenAudio = null
        activeRoom.localParticipant.setScreenShareEnabled(false)
        screenSharing = false
        presence?.status(microphoneMuted, false)
        toast("Compartilhamento encerrado.")
    }

    private fun leaveCall(stopUi: Boolean = true) {
        presence?.leave()
        presence = null
        screenAudio?.releaseAudioResources()
        screenAudio = null
        room?.disconnect()
        room = null
        microphoneMuted = false
        screenSharing = false
        stopService(Intent(this, CallForegroundService::class.java))
        if (stopUi) pendingChannel = null
    }

    private fun startCallService(action: String) {
        val intent = Intent(this, CallForegroundService::class.java).setAction(action)
        ContextCompat.startForegroundService(this, intent)
    }

    private fun showBusy(message: String) {
        setContentView(wrap(column().apply { gravity = Gravity.CENTER; addView(title(message)) }))
    }

    private fun wrap(content: LinearLayout) = ScrollView(this).apply {
        setBackgroundColor(Color.rgb(7, 11, 13))
        addView(content, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    private fun column() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(24), dp(48), dp(24), dp(32))
    }

    private fun title(text: String) = TextView(this).apply {
        this.text = text
        textSize = 30f
        setTextColor(Color.rgb(243, 250, 252))
        setTypeface(typeface, Typeface.BOLD)
        setPadding(0, dp(12), 0, dp(12))
    }

    private fun label(text: String) = TextView(this).apply {
        this.text = text
        textSize = 15f
        setTextColor(Color.rgb(157, 181, 189))
        setPadding(0, dp(8), 0, dp(16))
    }

    private fun input(hint: String) = EditText(this).apply {
        this.hint = hint
        setHintTextColor(Color.rgb(105, 128, 135))
        setTextColor(Color.WHITE)
        setSingleLine(true)
        setPadding(dp(16), dp(14), dp(16), dp(14))
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(12)
        }
    }

    private fun action(text: String, click: (android.view.View) -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        textSize = 16f
        setOnClickListener(click)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(58)).apply { bottomMargin = dp(12) }
    }

    private fun hasPermission(permission: String) = ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        leaveCall(false)
        super.onDestroy()
    }
}
