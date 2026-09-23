package social.lume.mobile

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.text.InputType
import android.text.format.DateFormat
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import io.livekit.android.LiveKit
import io.livekit.android.audio.ScreenAudioCapturer
import io.livekit.android.room.Room
import io.livekit.android.room.track.LocalAudioTrack
import io.livekit.android.room.track.LocalVideoTrack
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.screencapture.ScreenCaptureParams
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.io.File

class MainActivity : AppCompatActivity() {
    private val api = LumeApi()
    private lateinit var sessionStore: SessionStore
    private var session: LumeSession? = null
    private var realtime: RealtimeSocket? = null
    private var realtimeEnabled = false
    private var activeView = ActiveView.HOME
    private var activeSpace: LumeSpace? = null
    private var activeChannel: LumeChannel? = null
    private var activeDm: LumeDm? = null
    private var pendingUpload: UploadTarget? = null
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

    private val notificationPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    private val filePicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) uploadSelectedFile(uri) else pendingUpload = null
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
                .onSuccess { session = it; connectRealtime(it.token); showHome() }
                .onFailure { sessionStore.clear(); showLogin() }
        }
    }

    private fun showLogin() {
        val content = column().apply {
            gravity = Gravity.CENTER_HORIZONTAL
            addView(ImageView(context).apply {
                setImageResource(R.drawable.ic_lume)
                layoutParams = LinearLayout.LayoutParams(dp(88), dp(88)).apply { bottomMargin = dp(18) }
            })
            addView(title("Bem-vindo ao Lume").apply { gravity = Gravity.CENTER })
            addView(label("Seu espaço para conversar, jogar e estar junto.").apply { gravity = Gravity.CENTER })
            val loginForm = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(18), dp(18), dp(18), dp(8))
                val username = input("Usuário")
                val password = input("Senha").apply { inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }
                addView(username)
                addView(password)
                addView(primaryAction("Entrar no Lume") {
                    val user = username.text.toString().trim()
                    val pass = password.text.toString()
                    if (user.isBlank() || pass.isBlank()) return@primaryAction toast("Digite usuário e senha.")
                    lifecycleScope.launch {
                        showBusy("Entrando…")
                        runCatching { api.login(user, pass) }
                            .onSuccess { session = it; sessionStore.save(it.token); connectRealtime(it.token); showHome() }
                            .onFailure { showLogin(); toast(it.message ?: "Não foi possível entrar.") }
                    }
                })
            }
            addView(surface(loginForm))
            addView(label("Lume para Android · Beta privada").apply { gravity = Gravity.CENTER })
        }
        setContentView(wrap(content))
    }

    private fun showHome() {
        session ?: return showLogin()
        activeView = ActiveView.HOME
        activeSpace = null
        activeChannel = null
        activeDm = null
        requestNotificationPermission()
        loadDirectMessages()
    }

    private fun connectRealtime(token: String) {
        realtimeEnabled = true
        realtime?.close()
        realtime = api.openRealtimeSocket(
            token = token,
            onEvent = { event -> runOnUiThread { handleRealtimeEvent(event) } },
            onDisconnected = {
                runOnUiThread {
                    if (!realtimeEnabled || session?.token != token) return@runOnUiThread
                    lifecycleScope.launch {
                        delay(5_000)
                        if (realtimeEnabled && session?.token == token) connectRealtime(token)
                    }
                }
            },
        )
    }

    private fun handleRealtimeEvent(event: JSONObject) {
        when (event.optString("type")) {
            "message_created" -> {
                val message = event.optJSONObject("message") ?: return
                val channelId = message.optString("channelId")
                if (activeView == ActiveView.CHANNEL && activeChannel?.id == channelId) {
                    val space = activeSpace ?: return
                    val channel = activeChannel ?: return
                    loadMessages(space, channel)
                } else if (message.optString("userId") != session?.userId) {
                    showMessageNotification("Nova mensagem no servidor", message)
                }
            }
            "dm_message_created" -> {
                val message = event.optJSONObject("message") ?: return
                val dmId = message.optString("dmChannelId")
                if (activeView == ActiveView.DM && activeDm?.id == dmId) {
                    activeDm?.let { loadDmMessages(it) }
                } else if (message.optString("userId") != session?.userId) {
                    showMessageNotification("Nova mensagem direta", message)
                }
            }
            "message_updated", "message_deleted", "dm_message_updated", "dm_message_deleted",
            "reaction_added", "reaction_removed" -> reloadActiveConversation()
            "presence_update" -> if (activeView == ActiveView.FRIENDS) loadFriends()
            "friend_request_received" -> {
                notify("Novo pedido de amizade", "Abra o Lume para responder.")
                if (activeView == ActiveView.REQUESTS) loadFriendRequests()
            }
            "friend_request_accepted", "friend_request_declined", "friend_request_cancelled" -> {
                if (activeView == ActiveView.REQUESTS) loadFriendRequests()
                if (activeView == ActiveView.FRIENDS) loadFriends()
            }
        }
    }

    private fun reloadActiveConversation() {
        when (activeView) {
            ActiveView.CHANNEL -> {
                val space = activeSpace ?: return
                val channel = activeChannel ?: return
                loadMessages(space, channel)
            }
            ActiveView.DM -> activeDm?.let { loadDmMessages(it) }
            else -> Unit
        }
    }

    private fun showMessageNotification(title: String, message: JSONObject) {
        val user = message.optJSONObject("user")
        val author = if (user == null) "Lume" else user.optString("displayName").takeIf { it.isNotBlank() && it != "null" }
            ?: user.optString("username", "Lume")
        val content = message.optString("content").takeIf { it.isNotBlank() && it != "null" } ?: "Enviou um anexo"
        notify(title, "$author: $content")
    }

    private fun notify(title: String, text: String) {
        if (Build.VERSION.SDK_INT >= 33 && !hasPermission(Manifest.permission.POST_NOTIFICATIONS)) return
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(NotificationChannel(MESSAGE_CHANNEL, "Mensagens do Lume", NotificationManager.IMPORTANCE_DEFAULT))
        }
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        manager.notify(
            (System.currentTimeMillis() % Int.MAX_VALUE).toInt(),
            NotificationCompat.Builder(this, MESSAGE_CHANNEL)
                .setSmallIcon(R.drawable.ic_lume)
                .setContentTitle(title)
                .setContentText(text.take(120))
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build(),
        )
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && !hasPermission(Manifest.permission.POST_NOTIFICATIONS)) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun loadDirectMessages() {
        val current = session ?: return showLogin()
        lifecycleScope.launch {
            showBusy("Buscando suas conversas…")
            runCatching { api.directMessages(current.token, current.userId) }
                .onSuccess { showDirectMessages(it) }
                .onFailure { showDirectMessages(emptyList()); toast(it.message ?: "Erro ao carregar conversas.") }
        }
    }

    private fun showDirectMessages(conversations: List<LumeDm>) {
        activeView = ActiveView.DMS
        activeDm = null
        val content = column().apply {
            addView(screenHeader("Conversas", "Amigos") { loadFriends() })
            addView(section("MENSAGENS DIRETAS"))
            if (conversations.isEmpty()) addView(label("Nenhuma conversa ainda. Abra uma pela lista de amigos."))
            conversations.forEach { dm ->
                val preview = dm.preview?.replace('\n', ' ')?.take(60)
                addView(listRow("●", dm.name, preview ?: "Toque para conversar") { loadDmMessages(dm) })
            }
            addView(primaryAction("＋  Nova conversa") { loadFriends() })
        }
        setContentView(appFrame(content, RootTab.DMS))
    }

    private fun loadFriends() {
        val current = session ?: return showLogin()
        lifecycleScope.launch {
            showBusy("Buscando amigos…")
            runCatching { api.friends(current.token) }
                .onSuccess { showFriends(it) }
                .onFailure { showHome(); toast(it.message ?: "Erro ao carregar amigos.") }
        }
    }

    private fun showFriends(friends: List<LumeFriend>) {
        val current = session ?: return showLogin()
        activeView = ActiveView.FRIENDS
        val content = column().apply {
            addView(backHeader("Amigos") { loadDirectMessages() })
            addView(label("Toque em uma pessoa para abrir a conversa."))
            if (friends.isEmpty()) addView(label("Sua lista de amigos está vazia."))
            friends.forEach { friend ->
                addView(listRow(presenceDot(friend.status), friend.name, presenceLabel(friend.status)) {
                    lifecycleScope.launch {
                        showBusy("Abrindo conversa…")
                        runCatching { api.openDirectMessage(current.token, friend.id, current.userId) }
                            .onSuccess { loadDmMessages(it) }
                            .onFailure { error -> showFriends(friends); toast(error.message ?: "Não foi possível abrir a conversa.") }
                    }
                })
            }
            addView(action("Pedidos de amizade") { loadFriendRequests() })
        }
        setContentView(wrap(content))
    }

    private fun loadFriendRequests() {
        val current = session ?: return showLogin()
        lifecycleScope.launch {
            showBusy("Buscando pedidos…")
            runCatching { api.friendRequests(current.token, current.userId) }
                .onSuccess { showFriendRequests(it) }
                .onFailure { showHome(); toast(it.message ?: "Erro ao carregar pedidos.") }
        }
    }

    private fun showFriendRequests(requests: List<LumeFriendRequest>) {
        val current = session ?: return showLogin()
        activeView = ActiveView.REQUESTS
        val content = column().apply {
            addView(label("AMIZADES"))
            addView(title("Pedidos"))

            val incoming = requests.filter { it.incoming }
            val outgoing = requests.filterNot { it.incoming }
            addView(section("RECEBIDOS"))
            if (incoming.isEmpty()) addView(label("Nenhum pedido recebido."))
            incoming.forEach { request ->
                addView(label(request.name))
                addView(primaryAction("Aceitar ${request.name}") { answerButton ->
                    answerButton.isEnabled = false
                    lifecycleScope.launch {
                        runCatching { api.answerFriendRequest(current.token, request.id, true) }
                            .onSuccess { loadFriendRequests() }
                            .onFailure { error -> answerButton.isEnabled = true; toast(error.message ?: "Não foi possível aceitar.") }
                    }
                })
                addView(action("Recusar") { answerButton ->
                    answerButton.isEnabled = false
                    lifecycleScope.launch {
                        runCatching { api.answerFriendRequest(current.token, request.id, false) }
                            .onSuccess { loadFriendRequests() }
                            .onFailure { error -> answerButton.isEnabled = true; toast(error.message ?: "Não foi possível recusar.") }
                    }
                })
            }

            addView(section("ENVIADOS"))
            if (outgoing.isEmpty()) addView(label("Nenhum pedido enviado aguardando resposta."))
            outgoing.forEach { request -> addView(label("Aguardando ${request.name}")) }

            addView(section("ADICIONAR PESSOA"))
            val username = input("usuário ou usuário@servidor")
            addView(username)
            addView(primaryAction("Enviar pedido") { sendButton ->
                val target = username.text.toString().trim()
                if (target.isBlank()) return@primaryAction toast("Digite o usuário.")
                sendButton.isEnabled = false
                lifecycleScope.launch {
                    runCatching { api.sendFriendRequest(current.token, target) }
                        .onSuccess { loadFriendRequests(); toast("Pedido enviado.") }
                        .onFailure { error -> sendButton.isEnabled = true; toast(error.message ?: "Não foi possível enviar.") }
                }
            })
            addView(action("Voltar") { showHome() })
        }
        setContentView(wrap(content))
    }

    private fun loadDmMessages(dm: LumeDm) {
        val current = session ?: return showLogin()
        lifecycleScope.launch {
            showBusy("Abrindo ${dm.name}…")
            runCatching { api.dmMessages(current.token, dm.id) }
                .onSuccess { showDmChat(dm, it) }
                .onFailure { loadDirectMessages(); toast(it.message ?: "Erro ao carregar mensagens.") }
        }
    }

    private fun showDmChat(dm: LumeDm, messages: List<LumeMessage>) {
        val current = session ?: return showLogin()
        activeView = ActiveView.DM
        activeDm = dm
        var replyToId: String? = null
        var replyLabel: TextView? = null
        val content = column().apply {
            addView(backHeader(dm.name, "Mensagem direta") { loadDirectMessages() })
            if (messages.isEmpty()) addView(label("Este é o começo da conversa."))
            messages.forEach { message ->
                val time = DateFormat.format("dd/MM · HH:mm", message.createdAt).toString()
                addView(messageCard(
                    message = message,
                    time = time,
                    currentUserId = current.userId,
                    onReply = { replyToId = message.id; replyLabel?.text = "Respondendo a ${message.author}" },
                    onReact = { emoji, remove -> realtime?.reaction(message.id, emoji, remove) },
                    onEdit = { editMessage(message, true) { loadDmMessages(dm) } },
                    onDelete = { confirmDelete(message, true) { loadDmMessages(dm) } },
                    onAttachment = { openAttachment(it) },
                ))
            }

            replyLabel = label("").also { addView(it) }
            val composer = input("Mensagem para ${dm.name}").apply {
                isSingleLine = false
                maxLines = 5
                inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            }
            addView(composer)
            addView(primaryAction("Enviar mensagem") { sendButton ->
                val text = composer.text.toString().trim()
                if (text.isBlank()) return@primaryAction toast("Digite uma mensagem.")
                sendButton.isEnabled = false
                lifecycleScope.launch {
                    runCatching { api.sendDmMessage(current.token, dm.id, text, replyToId = replyToId) }
                        .onSuccess { loadDmMessages(dm) }
                        .onFailure { error -> sendButton.isEnabled = true; toast(error.message ?: "Não foi possível enviar.") }
                }
            })
            addView(action("Anexar arquivo") {
                pendingUpload = UploadTarget(dm = dm, replyToId = replyToId)
                filePicker.launch(arrayOf("image/*", "video/*", "audio/*", "application/pdf", "text/plain"))
            })
            addView(action("Atualizar conversa") { loadDmMessages(dm) })
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
        activeView = ActiveView.SPACES
        val content = column().apply {
            addView(screenHeader("Servidores", "Ao vivo") { loadChannels() })
            addView(section("SEUS ESPAÇOS"))
            if (spaces.isEmpty()) addView(label("Você ainda não participa de nenhum servidor."))
            spaces.forEach { space -> addView(listRow(space.name.take(1).uppercase(), space.name, "Abrir canais") { loadSpaceChannels(space) }) }
        }
        setContentView(appFrame(content, RootTab.SPACES))
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
        activeView = ActiveView.SPACE
        activeSpace = space
        val content = column().apply {
            addView(backHeader(space.name) { loadSpaces() })
            val textChannels = channels.filter { it.type == "text" }
            val voiceChannels = channels.filter { it.type == "voice" }
            addView(section("CANAIS DE TEXTO"))
            if (textChannels.isEmpty()) addView(label("Nenhum canal de texto disponível."))
            textChannels.forEach { channel -> addView(listRow("#", channel.name, "Canal de texto") { loadMessages(space, channel) }) }
            addView(section("CANAIS DE VOZ"))
            if (voiceChannels.isEmpty()) addView(label("Nenhum canal de voz disponível."))
            voiceChannels.forEach { channel ->
                addView(listRow("◉", channel.name, "Canal de voz") {
                    requestJoin(VoiceChannel(channel.id, channel.name, space.name))
                })
            }
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
        activeView = ActiveView.CHANNEL
        activeSpace = space
        activeChannel = channel
        var replyToId: String? = null
        var replyLabel: TextView? = null
        val content = column().apply {
            addView(backHeader("# ${channel.name}", space.name) { loadSpaceChannels(space) })
            channel.topic?.let { addView(label(it)) }
            if (messages.isEmpty()) addView(label("Este é o começo da conversa."))
            messages.forEach { message ->
                val time = DateFormat.format("dd/MM · HH:mm", message.createdAt).toString()
                addView(messageCard(
                    message = message,
                    time = time,
                    currentUserId = current.userId,
                    onReply = { replyToId = message.id; replyLabel?.text = "Respondendo a ${message.author}" },
                    onReact = { emoji, remove -> realtime?.reaction(message.id, emoji, remove) },
                    onEdit = { editMessage(message, false) { loadMessages(space, channel) } },
                    onDelete = { confirmDelete(message, false) { loadMessages(space, channel) } },
                    onAttachment = { openAttachment(it) },
                ))
            }

            replyLabel = label("").also { addView(it) }
            val composer = input("Mensagem em #${channel.name}").apply {
                isSingleLine = false
                maxLines = 5
                inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            }
            addView(composer)
            addView(primaryAction("Enviar mensagem") { sendButton ->
                val text = composer.text.toString().trim()
                if (text.isBlank()) return@primaryAction toast("Digite uma mensagem.")
                sendButton.isEnabled = false
                lifecycleScope.launch {
                    runCatching { api.sendMessage(current.token, channel.id, text, replyToId = replyToId) }
                        .onSuccess { loadMessages(space, channel) }
                        .onFailure { error ->
                            sendButton.isEnabled = true
                            toast(error.message ?: "Não foi possível enviar.")
                        }
                }
            })
            addView(action("Anexar arquivo") {
                pendingUpload = UploadTarget(space = space, channel = channel, replyToId = replyToId)
                filePicker.launch(arrayOf("image/*", "video/*", "audio/*", "application/pdf", "text/plain"))
            })
            addView(action("Atualizar conversa") { loadMessages(space, channel) })
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
        activeView = ActiveView.VOICE_LIST
        val content = column().apply {
            addView(backHeader("Canais de voz", current.displayName) { loadSpaces() })
            if (channels.isEmpty()) addView(label("Nenhum canal de voz disponível."))
            channels.forEach { channel ->
                addView(listRow("◉", channel.name, channel.spaceName) { requestJoin(channel) })
            }
            addView(action("Atualizar") { loadChannels() })
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
        activeView = ActiveView.CALL
        val content = column().apply {
            gravity = Gravity.CENTER_HORIZONTAL
            addView(backHeader(channel.name, channel.spaceName) { leaveCall(); loadChannels() })
            addView(section("NA CHAMADA"))
            addView(participantCard(session?.displayName ?: "Você", true))
            addView(label("Conectado. O áudio das outras pessoas toca automaticamente."))

            val controls = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
            }
            val mic = callControl("◉", "Microfone") {
                microphoneMuted = !microphoneMuted
                lifecycleScope.launch { room?.localParticipant?.setMicrophoneEnabled(!microphoneMuted) }
                presence?.status(microphoneMuted, screenSharing)
                (it as Button).text = if (microphoneMuted) "○\nAtivar" else "◉\nMicrofone"
            }
            controls.addView(mic, weightedParams(64))

            controls.addView(callControl("▣", "Tela") {
                if (screenSharing) lifecycleScope.launch { stopScreenShare() }
                else {
                    val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                    screenCaptureLauncher.launch(manager.createScreenCaptureIntent())
                }
            }, weightedParams(64))
            controls.addView(callControl("×", "Sair", danger = true) {
                leaveCall()
                loadChannels()
            }, weightedParams(64))
            addView(controls, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(72)).apply { bottomMargin = dp(8) })
            addView(label("O Android sempre pedirá sua confirmação antes de transmitir a tela."))
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
        isFillViewport = true
        setBackgroundColor(APP_BG)
        addView(content, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    private fun column() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(8), dp(14), dp(20))
    }

    private fun title(text: String) = TextView(this).apply {
        this.text = text
        textSize = 22f
        setTextColor(TEXT_PRIMARY)
        setTypeface(typeface, Typeface.BOLD)
        setPadding(0, dp(8), 0, dp(6))
    }

    private fun label(text: String) = TextView(this).apply {
        this.text = text
        textSize = 14f
        setTextColor(TEXT_SECONDARY)
        setPadding(0, dp(8), 0, dp(16))
    }

    private fun section(text: String) = TextView(this).apply {
        this.text = text
        textSize = 11f
        setTextColor(ACCENT)
        setTypeface(typeface, Typeface.BOLD)
        letterSpacing = 0.12f
        setPadding(dp(2), dp(18), 0, dp(8))
    }

    private fun appFrame(content: LinearLayout, selected: RootTab): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundColor(APP_BG)
        addView(wrap(content), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        addView(bottomDock(selected), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(62)))
    }

    private fun bottomDock(selected: RootTab) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
        setPadding(dp(6), dp(5), dp(6), dp(5))
        background = roundedBackground(Color.rgb(8, 11, 13), BORDER, 18)
        addView(dockItem("▦", "Servidores", selected == RootTab.SPACES) { loadSpaces() }, weightedParams(52))
        addView(dockItem("●", "Conversas", selected == RootTab.DMS) { loadDirectMessages() }, weightedParams(52))
        addView(dockItem("◎", "Você", selected == RootTab.YOU) { showYou() }, weightedParams(52))
    }

    private fun dockItem(icon: String, text: String, active: Boolean, click: () -> Unit) = MaterialButton(this).apply {
        this.text = "$icon\n$text"
        isAllCaps = false
        textSize = 11f
        gravity = Gravity.CENTER
        minHeight = 0
        minimumHeight = 0
        cornerRadius = dp(14)
        backgroundTintList = ColorStateList.valueOf(if (active) Color.rgb(13, 39, 46) else Color.TRANSPARENT)
        setTextColor(if (active) ACCENT else TEXT_SECONDARY)
        insetTop = 0
        insetBottom = 0
        setOnClickListener { click() }
    }

    private fun screenHeader(title: String, actionLabel: String, actionClick: () -> Unit) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(2), dp(8), dp(2), dp(10))
        addView(TextView(context).apply {
            text = title
            textSize = 20f
            setTextColor(TEXT_PRIMARY)
            setTypeface(typeface, Typeface.BOLD)
        }, LinearLayout.LayoutParams(0, dp(44), 1f).apply { gravity = Gravity.CENTER_VERTICAL })
        addView(compactButton(actionLabel, actionClick), LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(40)))
    }

    private fun backHeader(title: String, subtitle: String? = null, click: () -> Unit) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(0, dp(6), 0, dp(12))
        addView(compactButton("‹", click), LinearLayout.LayoutParams(dp(42), dp(42)).apply { marginEnd = dp(8) })
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            addView(TextView(context).apply {
                text = title
                textSize = 18f
                setTextColor(TEXT_PRIMARY)
                setTypeface(typeface, Typeface.BOLD)
            })
            if (!subtitle.isNullOrBlank()) addView(TextView(context).apply {
                text = subtitle
                textSize = 11f
                setTextColor(TEXT_TERTIARY)
            })
        }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    }

    private fun listRow(icon: String, heading: String, subtitle: String, click: () -> Unit) = MaterialCardView(this).apply {
        radius = dp(14).toFloat()
        cardElevation = 0f
        setCardBackgroundColor(Color.rgb(9, 10, 12))
        strokeColor = BORDER
        strokeWidth = dp(1)
        isClickable = true
        isFocusable = true
        setOnClickListener { click() }
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(68)).apply { bottomMargin = dp(8) }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(13), dp(8), dp(12), dp(8))
            addView(TextView(context).apply {
                text = icon
                textSize = 19f
                gravity = Gravity.CENTER
                setTextColor(ACCENT)
                background = roundedBackground(Color.rgb(13, 28, 33), Color.rgb(23, 56, 65), 13)
            }, LinearLayout.LayoutParams(dp(42), dp(42)).apply { marginEnd = dp(12) })
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(context).apply {
                    text = heading
                    textSize = 15f
                    setTextColor(TEXT_PRIMARY)
                    setTypeface(typeface, Typeface.BOLD)
                    maxLines = 1
                })
                addView(TextView(context).apply {
                    text = subtitle
                    textSize = 12f
                    setTextColor(TEXT_TERTIARY)
                    maxLines = 1
                })
            }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            addView(TextView(context).apply {
                text = "›"
                textSize = 22f
                setTextColor(TEXT_TERTIARY)
            })
        })
    }

    private fun participantCard(name: String, self: Boolean) = MaterialCardView(this).apply {
        radius = dp(18).toFloat()
        cardElevation = 0f
        setCardBackgroundColor(Color.rgb(9, 10, 12))
        strokeColor = if (self) ACCENT else BORDER
        strokeWidth = dp(if (self) 2 else 1)
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(16), dp(24), dp(16), dp(18))
            addView(ImageView(context).apply { setImageResource(R.drawable.ic_lume) }, LinearLayout.LayoutParams(dp(66), dp(66)))
            addView(TextView(context).apply {
                text = if (self) "$name  (você)" else name
                textSize = 15f
                setTextColor(TEXT_PRIMARY)
                setTypeface(typeface, Typeface.BOLD)
                setPadding(0, dp(12), 0, 0)
            })
        })
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(16) }
    }

    private fun callControl(icon: String, label: String, danger: Boolean = false, click: (android.view.View) -> Unit) = MaterialButton(this).apply {
        text = "$icon\n$label"
        isAllCaps = false
        textSize = 11f
        gravity = Gravity.CENTER
        minHeight = 0
        minimumHeight = 0
        cornerRadius = dp(18)
        backgroundTintList = ColorStateList.valueOf(if (danger) Color.rgb(73, 24, 32) else Color.rgb(14, 16, 18))
        strokeColor = ColorStateList.valueOf(if (danger) Color.rgb(252, 165, 165) else BORDER)
        strokeWidth = dp(1)
        setTextColor(if (danger) Color.rgb(252, 165, 165) else TEXT_PRIMARY)
        insetTop = 0
        insetBottom = 0
        setOnClickListener(click)
    }

    private fun showYou() {
        val current = session ?: return showLogin()
        val content = column().apply {
            addView(screenHeader("Você", "Pedidos") { loadFriendRequests() })
            addView(participantCard(current.displayName, true))
            addView(listRow("◎", "Amigos", "Pessoas e presença") { loadFriends() })
            addView(listRow("◉", "Canais de voz", "Chamadas disponíveis") { loadChannels() })
            addView(action("Sair da conta") {
                leaveCall(false)
                realtimeEnabled = false
                realtime?.close()
                realtime = null
                sessionStore.clear()
                session = null
                showLogin()
            })
        }
        setContentView(appFrame(content, RootTab.YOU))
    }

    private fun brandHeader(name: String, subtitle: String) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(0, 0, 0, dp(22))
        addView(ImageView(context).apply {
            setImageResource(R.drawable.ic_lume)
        }, LinearLayout.LayoutParams(dp(52), dp(52)).apply { marginEnd = dp(12) })
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            addView(TextView(context).apply {
                text = name
                textSize = 20f
                setTextColor(Color.WHITE)
                setTypeface(typeface, Typeface.BOLD)
            })
            addView(TextView(context).apply {
                text = subtitle
                textSize = 12f
                setTextColor(Color.rgb(82, 217, 255))
            })
        })
    }

    private fun surface(content: LinearLayout) = MaterialCardView(this).apply {
        radius = dp(22).toFloat()
        cardElevation = 0f
        setCardBackgroundColor(Color.rgb(11, 20, 23))
        strokeColor = Color.rgb(28, 55, 62)
        strokeWidth = dp(1)
        addView(content)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(18)
            bottomMargin = dp(18)
        }
    }

    private fun tileRow(left: MaterialCardView, right: MaterialCardView) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        addView(left, LinearLayout.LayoutParams(0, dp(146), 1f).apply { marginEnd = dp(6); bottomMargin = dp(12) })
        addView(right, LinearLayout.LayoutParams(0, dp(146), 1f).apply { marginStart = dp(6); bottomMargin = dp(12) })
    }

    private fun homeTile(icon: String, heading: String, subtitle: String, click: () -> Unit) = MaterialCardView(this).apply {
        radius = dp(20).toFloat()
        cardElevation = 0f
        setCardBackgroundColor(Color.rgb(12, 22, 25))
        strokeColor = Color.rgb(25, 48, 54)
        strokeWidth = dp(1)
        isClickable = true
        isFocusable = true
        setOnClickListener { click() }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(15), dp(12), dp(12))
            addView(TextView(context).apply {
                text = icon
                textSize = 25f
                setTextColor(Color.rgb(82, 217, 255))
            })
            addView(TextView(context).apply {
                text = heading
                textSize = 17f
                setTextColor(Color.WHITE)
                setTypeface(typeface, Typeface.BOLD)
                setPadding(0, dp(10), 0, dp(3))
            })
            addView(TextView(context).apply {
                text = subtitle
                textSize = 12f
                setTextColor(Color.rgb(135, 158, 165))
            })
        })
    }

    private fun messageCard(
        message: LumeMessage,
        time: String,
        currentUserId: String,
        onReply: () -> Unit,
        onReact: (String, Boolean) -> Unit,
        onEdit: () -> Unit,
        onDelete: () -> Unit,
        onAttachment: (LumeAttachment) -> Unit,
    ) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(8), dp(10), dp(8), dp(10))
        background = roundedBackground(Color.TRANSPARENT, Color.TRANSPARENT, 0)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(2)
        }
        addView(TextView(context).apply {
            text = "${message.author}  ·  $time${if (message.edited) "  · editada" else ""}"
            textSize = 13f
            setTextColor(Color.rgb(82, 217, 255))
            setTypeface(typeface, Typeface.BOLD)
        })
        if (message.replyAuthor != null) {
            addView(TextView(context).apply {
                text = "↳ ${message.replyAuthor}: ${message.replyContent.orEmpty().take(90)}"
                textSize = 13f
                setTextColor(Color.rgb(157, 181, 189))
                setPadding(0, dp(6), 0, 0)
            })
        }
        if (message.content.isNotBlank()) {
            addView(TextView(context).apply {
                text = message.content
                textSize = 16f
                setTextColor(Color.rgb(243, 250, 252))
                setPadding(0, dp(6), 0, 0)
            })
        }
        message.attachments.forEach { attachment ->
            addView(compactButton("📎 ${attachment.originalName}") { onAttachment(attachment) })
        }

        val counts = message.reactions.groupingBy { it.emoji }.eachCount()
        val reactions = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            listOf("👍", "❤️", "😂").forEach { emoji ->
                val mine = message.reactions.any { it.emoji == emoji && it.userId == currentUserId }
                addView(compactButton("$emoji ${counts[emoji] ?: 0}") { onReact(emoji, mine) }, weightedParams())
            }
        }
        addView(reactions)

        val actions = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(compactButton("Responder") { onReply() }, weightedParams())
            if (message.userId == currentUserId) {
                addView(compactButton("Editar") { onEdit() }, weightedParams())
                addView(compactButton("Excluir") { onDelete() }, weightedParams())
            }
        }
        addView(actions)
    }

    private fun compactButton(text: String, click: () -> Unit) = MaterialButton(this).apply {
        this.text = text
        isAllCaps = false
        textSize = 12f
        minHeight = 0
        minimumHeight = 0
        cornerRadius = dp(12)
        backgroundTintList = ColorStateList.valueOf(Color.rgb(13, 26, 30))
        strokeColor = ColorStateList.valueOf(Color.rgb(29, 54, 61))
        strokeWidth = dp(1)
        setTextColor(Color.rgb(222, 235, 239))
        setPadding(dp(6), dp(4), dp(6), dp(4))
        setOnClickListener { click() }
    }

    private fun weightedParams() = LinearLayout.LayoutParams(0, dp(42), 1f).apply {
        marginEnd = dp(4)
        topMargin = dp(6)
    }

    private fun weightedParams(height: Int) = LinearLayout.LayoutParams(0, dp(height), 1f).apply {
        marginStart = dp(2)
        marginEnd = dp(2)
    }

    private fun editMessage(message: LumeMessage, dm: Boolean, reload: () -> Unit) {
        val current = session ?: return
        val editor = input("Editar mensagem").apply {
            setText(message.content)
            setSelection(text.length)
            isSingleLine = false
        }
        AlertDialog.Builder(this)
            .setTitle("Editar mensagem")
            .setView(editor)
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Salvar") { _, _ ->
                val content = editor.text.toString().trim()
                if (content.isBlank()) return@setPositiveButton toast("A mensagem não pode ficar vazia.")
                lifecycleScope.launch {
                    runCatching { api.editMessage(current.token, message.id, content, dm) }
                        .onSuccess { reload() }
                        .onFailure { toast(it.message ?: "Não foi possível editar.") }
                }
            }
            .show()
    }

    private fun confirmDelete(message: LumeMessage, dm: Boolean, reload: () -> Unit) {
        val current = session ?: return
        AlertDialog.Builder(this)
            .setTitle("Excluir mensagem?")
            .setMessage("Essa ação não pode ser desfeita.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Excluir") { _, _ ->
                lifecycleScope.launch {
                    runCatching { api.deleteMessage(current.token, message.id, dm) }
                        .onSuccess { reload() }
                        .onFailure { toast(it.message ?: "Não foi possível excluir.") }
                }
            }
            .show()
    }

    private fun uploadSelectedFile(uri: Uri) {
        val target = pendingUpload ?: return
        pendingUpload = null
        val current = session ?: return showLogin()
        val name = contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        } ?: "arquivo"
        lifecycleScope.launch {
            showBusy("Enviando $name…")
            runCatching {
                val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: error("Não foi possível abrir o arquivo")
                require(bytes.size <= MAX_MOBILE_UPLOAD_BYTES) { "No celular, envie arquivos de até 25 MB." }
                val attachment = api.upload(current.token, name, bytes)
                if (target.dm != null) {
                    api.sendDmMessage(current.token, target.dm.id, "", listOf(attachment.id), target.replyToId)
                } else {
                    val channel = target.channel ?: error("Canal indisponível")
                    api.sendMessage(current.token, channel.id, "", listOf(attachment.id), target.replyToId)
                }
            }.onSuccess {
                if (target.dm != null) loadDmMessages(target.dm)
                else loadMessages(target.space!!, target.channel!!)
            }.onFailure {
                if (target.dm != null) loadDmMessages(target.dm)
                else loadMessages(target.space!!, target.channel!!)
                toast(it.message ?: "Não foi possível enviar o arquivo.")
            }
        }
    }

    private fun openAttachment(attachment: LumeAttachment) {
        val current = session ?: return
        lifecycleScope.launch {
            toast("Baixando ${attachment.originalName}…")
            runCatching {
                val bytes = api.download(current.token, attachment.filename)
                val sharedDir = File(cacheDir, "shared").apply { mkdirs() }
                val safeName = attachment.originalName.replace(Regex("[^A-Za-z0-9._ -]"), "_")
                val file = File(sharedDir, safeName).apply { writeBytes(bytes) }
                FileProvider.getUriForFile(this@MainActivity, "$packageName.files", file)
            }.onSuccess { uri ->
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, attachment.mimetype)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                runCatching { startActivity(intent) }.onFailure { toast("Nenhum aplicativo consegue abrir este arquivo.") }
            }.onFailure { toast(it.message ?: "Não foi possível abrir o arquivo.") }
        }
    }

    private fun presenceDot(status: String) = when (status) {
        "online" -> "●"
        "working" -> "◆"
        "idle" -> "◐"
        "dnd" -> "⊘"
        else -> "○"
    }

    private fun presenceLabel(status: String) = when (status) {
        "online" -> "Disponível"
        "working" -> "Trabalhando no Lume"
        "idle" -> "Ausente"
        "dnd" -> "Não perturbe"
        else -> "Offline"
    }

    private fun input(hint: String) = EditText(this).apply {
        this.hint = hint
        setHintTextColor(Color.rgb(102, 124, 132))
        setTextColor(Color.rgb(245, 248, 250))
        textSize = 15f
        setSingleLine(true)
        setPadding(dp(16), dp(14), dp(16), dp(14))
        background = roundedBackground(Color.rgb(8, 15, 18), Color.rgb(31, 51, 59), 14)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(12)
        }
    }

    private fun action(text: String, click: (android.view.View) -> Unit) = MaterialButton(this).apply {
        this.text = text
        isAllCaps = false
        textSize = 15f
        setTypeface(typeface, Typeface.BOLD)
        cornerRadius = dp(12)
        backgroundTintList = ColorStateList.valueOf(Color.rgb(9, 10, 12))
        strokeColor = ColorStateList.valueOf(BORDER)
        strokeWidth = dp(1)
        setTextColor(Color.rgb(233, 241, 245))
        gravity = Gravity.CENTER_VERTICAL or Gravity.START
        insetTop = 0
        insetBottom = 0
        setOnClickListener(click)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)).apply { bottomMargin = dp(8) }
    }

    private fun primaryAction(text: String, click: (android.view.View) -> Unit) = MaterialButton(this).apply {
        this.text = text
        isAllCaps = false
        textSize = 15f
        setTypeface(typeface, Typeface.BOLD)
        cornerRadius = dp(12)
        backgroundTintList = ColorStateList.valueOf(ACCENT)
        setTextColor(Color.rgb(3, 12, 14))
        gravity = Gravity.CENTER
        insetTop = 0
        insetBottom = 0
        setOnClickListener(click)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)).apply { bottomMargin = dp(8) }
    }

    private fun roundedBackground(fill: Int, stroke: Int, radius: Int) = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        setColor(fill)
        setStroke(dp(1), stroke)
        cornerRadius = dp(radius).toFloat()
    }

    private fun hasPermission(permission: String) = ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        realtimeEnabled = false
        realtime?.close()
        realtime = null
        leaveCall(false)
        super.onDestroy()
    }

    private data class UploadTarget(
        val space: LumeSpace? = null,
        val channel: LumeChannel? = null,
        val dm: LumeDm? = null,
        val replyToId: String? = null,
    )

    private enum class ActiveView { HOME, DMS, DM, FRIENDS, REQUESTS, SPACES, SPACE, CHANNEL, VOICE_LIST, CALL }
    private enum class RootTab { SPACES, DMS, YOU }

    private companion object {
        const val MESSAGE_CHANNEL = "lume_messages"
        const val MAX_MOBILE_UPLOAD_BYTES = 25 * 1024 * 1024
        val APP_BG: Int = Color.rgb(5, 5, 5)
        val ACCENT: Int = Color.rgb(0, 209, 255)
        val BORDER: Int = Color.rgb(31, 39, 43)
        val TEXT_PRIMARY: Int = Color.rgb(239, 239, 239)
        val TEXT_SECONDARY: Int = Color.rgb(160, 160, 170)
        val TEXT_TERTIARY: Int = Color.rgb(92, 92, 104)
    }
}
