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
import android.text.format.DateFormat
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
    private lateinit var sessionStore: SessionStore
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
        sessionStore = SessionStore(this)
        val savedToken = sessionStore.token()
        if (savedToken == null) showLogin() else restoreSession(savedToken)
    }

    private fun restoreSession(token: String) {
        lifecycleScope.launch {
            showBusy("Abrindo o Lume…")
            runCatching { api.restoreSession(token) }
                .onSuccess { session = it; showHome() }
                .onFailure { sessionStore.clear(); showLogin() }
        }
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
                        .onSuccess { session = it; sessionStore.save(it.token); showHome() }
                        .onFailure { showLogin(); toast(it.message ?: "Não foi possível entrar.") }
                }
            })
        }
        setContentView(wrap(content))
    }

    private fun showHome() {
        val current = session ?: return showLogin()
        val content = column().apply {
            addView(label("LUME MOBILE"))
            addView(title("Olá, ${current.displayName}"))
            addView(label("Seus espaços, mensagens e chamadas em um só lugar."))
            addView(action("Servidores e conversas") { loadSpaces() })
            addView(action("Canais de voz") { loadChannels() })
            addView(action("Sair da conta") {
                leaveCall(false)
                sessionStore.clear()
                session = null
                showLogin()
            })
        }
        setContentView(wrap(content))
    }

    private fun loadSpaces() {
        val current = session ?: return showLogin()
        lifecycleScope.launch {
            showBusy("Buscando seus servidores…")
            runCatching { api.spaces(current.token) }
                .onSuccess { showSpaces(it) }
                .onFailure { showHome(); toast(it.message ?: "Erro ao carregar servidores.") }
        }
    }

    private fun showSpaces(spaces: List<LumeSpace>) {
        val content = column().apply {
            addView(label("SEUS SERVIDORES"))
            addView(title("Escolha um espaço"))
            if (spaces.isEmpty()) addView(label("Você ainda não participa de nenhum servidor."))
            spaces.forEach { space -> addView(action(space.name) { loadSpaceChannels(space) }) }
            addView(action("Voltar") { showHome() })
        }
        setContentView(wrap(content))
    }

    private fun loadSpaceChannels(space: LumeSpace) {
        val current = session ?: return showLogin()
        lifecycleScope.launch {
            showBusy("Abrindo ${space.name}…")
            runCatching { api.channels(current.token, space.id) }
                .onSuccess { showSpaceChannels(space, it) }
                .onFailure { loadSpaces(); toast(it.message ?: "Erro ao carregar canais.") }
        }
    }

    private fun showSpaceChannels(space: LumeSpace, channels: List<LumeChannel>) {
        val content = column().apply {
            addView(label("SERVIDOR"))
            addView(title(space.name))
            val textChannels = channels.filter { it.type == "text" }
            val voiceChannels = channels.filter { it.type == "voice" }
            addView(section("CANAIS DE TEXTO"))
            if (textChannels.isEmpty()) addView(label("Nenhum canal de texto disponível."))
            textChannels.forEach { channel -> addView(action("#  ${channel.name}") { loadMessages(space, channel) }) }
            addView(section("CANAIS DE VOZ"))
            if (voiceChannels.isEmpty()) addView(label("Nenhum canal de voz disponível."))
            voiceChannels.forEach { channel ->
                addView(action("◉  ${channel.name}") {
                    requestJoin(VoiceChannel(channel.id, channel.name, space.name))
                })
            }
            addView(action("Voltar aos servidores") { loadSpaces() })
        }
        setContentView(wrap(content))
    }

    private fun loadMessages(space: LumeSpace, channel: LumeChannel) {
        val current = session ?: return showLogin()
        lifecycleScope.launch {
            showBusy("Carregando #${channel.name}…")
            runCatching { api.messages(current.token, channel.id) }
                .onSuccess { showChat(space, channel, it) }
                .onFailure { loadSpaceChannels(space); toast(it.message ?: "Erro ao carregar mensagens.") }
        }
    }

    private fun showChat(space: LumeSpace, channel: LumeChannel, messages: List<LumeMessage>) {
        val current = session ?: return showLogin()
        val content = column().apply {
            addView(label(space.name.uppercase()))
            addView(title("# ${channel.name}"))
            channel.topic?.let { addView(label(it)) }
            if (messages.isEmpty()) addView(label("Este é o começo da conversa."))
            messages.forEach { message ->
                val time = DateFormat.format("dd/MM · HH:mm", message.createdAt).toString()
                addView(messageCard(message.author, time, message.content, message.edited))
            }

            val composer = input("Mensagem em #${channel.name}").apply {
                isSingleLine = false
                maxLines = 5
                inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            }
            addView(composer)
            addView(action("Enviar mensagem") { sendButton ->
                val text = composer.text.toString().trim()
                if (text.isBlank()) return@action toast("Digite uma mensagem.")
                sendButton.isEnabled = false
                lifecycleScope.launch {
                    runCatching { api.sendMessage(current.token, channel.id, text) }
                        .onSuccess { loadMessages(space, channel) }
                        .onFailure { error ->
                            sendButton.isEnabled = true
                            toast(error.message ?: "Não foi possível enviar.")
                        }
                }
            })
            addView(action("Atualizar conversa") { loadMessages(space, channel) })
            addView(action("Voltar aos canais") { loadSpaceChannels(space) })
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
            addView(action("Voltar") { showHome() })
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

    private fun section(text: String) = TextView(this).apply {
        this.text = text
        textSize = 12f
        setTextColor(Color.rgb(82, 217, 255))
        setTypeface(typeface, Typeface.BOLD)
        setPadding(0, dp(22), 0, dp(10))
    }

    private fun messageCard(author: String, time: String, content: String, edited: Boolean) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(12), dp(16), dp(12))
        setBackgroundColor(Color.rgb(13, 23, 26))
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(10)
        }
        addView(TextView(context).apply {
            text = "$author  ·  $time${if (edited) "  · editada" else ""}"
            textSize = 13f
            setTextColor(Color.rgb(82, 217, 255))
            setTypeface(typeface, Typeface.BOLD)
        })
        addView(TextView(context).apply {
            text = content.ifBlank { "Mensagem sem texto" }
            textSize = 16f
            setTextColor(Color.rgb(243, 250, 252))
            setPadding(0, dp(6), 0, 0)
        })
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
