package social.lume.mobile

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.Base64

data class LumeSession(val token: String, val userId: String, val displayName: String)
data class LumeSpace(val id: String, val name: String)
data class LumeChannel(val id: String, val spaceId: String, val name: String, val type: String, val topic: String?)
data class LumeFriend(val id: String, val name: String, val status: String)
data class LumeFriendRequest(val id: String, val name: String, val incoming: Boolean)
data class LumeDm(val id: String, val name: String, val preview: String?, val updatedAt: Long)
data class LumeAttachment(val id: String, val filename: String, val originalName: String, val mimetype: String)
data class LumeReaction(val emoji: String, val userId: String)
data class LumeMessage(
    val id: String,
    val userId: String,
    val author: String,
    val content: String,
    val createdAt: Long,
    val edited: Boolean,
    val attachments: List<LumeAttachment>,
    val reactions: List<LumeReaction>,
    val replyAuthor: String?,
    val replyContent: String?,
)
data class VoiceChannel(val id: String, val name: String, val spaceName: String)
data class VoiceCredentials(val token: String, val url: String)

class LumeApi(private val baseUrl: String = BuildConfig.LUME_BASE_URL) {
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder().retryOnConnectionFailure(true).build()

    suspend fun login(username: String, password: String): LumeSession = withContext(Dispatchers.IO) {
        val body = JSONObject().put("username", username).put("password", password)
        val json = execute("POST", "auth/login", null, body)
        val user = json.getJSONObject("user")
        LumeSession(
            token = json.getString("token"),
            userId = user.getString("id"),
            displayName = displayName(user),
        )
    }

    suspend fun restoreSession(token: String): LumeSession = withContext(Dispatchers.IO) {
        val user = execute("GET", "users/@me", token)
        LumeSession(
            token = token,
            userId = user.getString("id"),
            displayName = displayName(user),
        )
    }

    suspend fun spaces(token: String): List<LumeSpace> = withContext(Dispatchers.IO) {
        val rows = executeArray("GET", "spaces", token)
        List(rows.length()) { index ->
            rows.getJSONObject(index).let { LumeSpace(it.getString("id"), it.getString("name")) }
        }
    }

    suspend fun channels(token: String, spaceId: String): List<LumeChannel> = withContext(Dispatchers.IO) {
        val rows = executeArray("GET", "spaces/$spaceId/channels", token)
        List(rows.length()) { index ->
            rows.getJSONObject(index).let {
                LumeChannel(
                    id = it.getString("id"),
                    spaceId = it.getString("spaceId"),
                    name = it.getString("name"),
                    type = it.getString("type"),
                    topic = nullableString(it, "topic"),
                )
            }
        }
    }

    suspend fun messages(token: String, channelId: String): List<LumeMessage> = withContext(Dispatchers.IO) {
        val rows = executeArray("GET", "channels/$channelId/messages?limit=50", token)
        List(rows.length()) { index -> parseMessage(rows.getJSONObject(index)) }
    }

    suspend fun sendMessage(
        token: String,
        channelId: String,
        content: String,
        attachmentIds: List<String> = emptyList(),
        replyToId: String? = null,
    ): LumeMessage = withContext(Dispatchers.IO) {
        val body = JSONObject().put("content", content).put("attachments", JSONArray(attachmentIds))
        if (replyToId != null) body.put("replyToId", replyToId)
        parseMessage(execute("POST", "channels/$channelId/messages", token, body))
    }

    suspend fun editMessage(token: String, messageId: String, content: String, dm: Boolean): LumeMessage = withContext(Dispatchers.IO) {
        val path = if (dm) "dm/messages/$messageId" else "messages/$messageId"
        parseMessage(execute("PATCH", path, token, JSONObject().put("content", content)))
    }

    suspend fun deleteMessage(token: String, messageId: String, dm: Boolean) = withContext(Dispatchers.IO) {
        val path = if (dm) "dm/messages/$messageId" else "messages/$messageId"
        execute("DELETE", path, token)
    }

    suspend fun friends(token: String): List<LumeFriend> = withContext(Dispatchers.IO) {
        val rows = executeArray("GET", "social/friends", token)
        List(rows.length()) { index ->
            rows.getJSONObject(index).let {
                LumeFriend(
                    id = it.getString("id"),
                    name = displayName(it),
                    status = it.optString("status", "offline"),
                )
            }
        }
    }

    suspend fun friendRequests(token: String, currentUserId: String): List<LumeFriendRequest> = withContext(Dispatchers.IO) {
        val rows = executeArray("GET", "social/requests", token)
        List(rows.length()) { index ->
            rows.getJSONObject(index).let {
                val user = it.optJSONObject("user")
                LumeFriendRequest(
                    id = it.getString("id"),
                    name = if (user == null) "Usuário" else displayName(user),
                    incoming = it.optString("toId") == currentUserId,
                )
            }
        }
    }

    suspend fun answerFriendRequest(token: String, requestId: String, accept: Boolean) = withContext(Dispatchers.IO) {
        execute(
            "PATCH",
            "social/requests/$requestId",
            token,
            JSONObject().put("status", if (accept) "accepted" else "declined"),
        )
    }

    suspend fun sendFriendRequest(token: String, username: String) = withContext(Dispatchers.IO) {
        execute("POST", "social/requests", token, JSONObject().put("username", username))
    }

    suspend fun directMessages(token: String, currentUserId: String): List<LumeDm> = withContext(Dispatchers.IO) {
        val rows = executeArray("GET", "dm", token)
        List(rows.length()) { index ->
            val row = rows.getJSONObject(index)
            val members = row.optJSONArray("members") ?: JSONArray()
            val memberNames = buildList {
                for (i in 0 until members.length()) {
                    val member = members.getJSONObject(i)
                    if (member.optString("id") != currentUserId) add(displayName(member))
                }
            }
            val fallbackName = memberNames.joinToString(", ").ifBlank { "Conversa" }
            val lastMessage = row.optJSONObject("lastMessage")
            LumeDm(
                id = row.getString("id"),
                name = nullableString(row, "name") ?: fallbackName,
                preview = lastMessage?.let { nullableString(it, "content") },
                updatedAt = lastMessage?.optLong("createdAt") ?: row.optLong("createdAt"),
            )
        }
    }

    suspend fun openDirectMessage(token: String, userId: String, currentUserId: String): LumeDm = withContext(Dispatchers.IO) {
        val row = execute("POST", "dm", token, JSONObject().put("userId", userId))
        val members = row.optJSONArray("members") ?: JSONArray()
        var name = "Conversa"
        for (i in 0 until members.length()) {
            val member = members.getJSONObject(i)
            if (member.optString("id") != currentUserId) {
                name = displayName(member)
                break
            }
        }
        LumeDm(row.getString("id"), nullableString(row, "name") ?: name, null, row.optLong("createdAt"))
    }

    suspend fun dmMessages(token: String, dmId: String): List<LumeMessage> = withContext(Dispatchers.IO) {
        val rows = executeArray("GET", "dm/$dmId/messages?limit=50", token)
        List(rows.length()) { index -> parseMessage(rows.getJSONObject(index)) }
    }

    suspend fun sendDmMessage(
        token: String,
        dmId: String,
        content: String,
        attachmentIds: List<String> = emptyList(),
        replyToId: String? = null,
    ): LumeMessage = withContext(Dispatchers.IO) {
        val body = JSONObject().put("content", content).put("attachments", JSONArray(attachmentIds))
        if (replyToId != null) body.put("replyToId", replyToId)
        parseMessage(execute("POST", "dm/$dmId/messages", token, body))
    }

    suspend fun upload(token: String, originalName: String, bytes: ByteArray): LumeAttachment = withContext(Dispatchers.IO) {
        val metadata = Base64.getEncoder().encodeToString(originalName.toByteArray(Charsets.UTF_8))
        val create = Request.Builder()
            .url(EndpointConfig.api(baseUrl, "files"))
            .header("Authorization", "Bearer $token")
            .header("Tus-Resumable", "1.0.0")
            .header("Upload-Length", bytes.size.toString())
            .header("Upload-Metadata", "filename $metadata")
            .post(ByteArray(0).toRequestBody(null))
            .build()
        val location = http.newCall(create).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Não foi possível iniciar o envio (${response.code})")
            response.header("Location") ?: throw IOException("O servidor não retornou o endereço do envio")
        }
        val uploadUrl = if (location.startsWith("http")) location else baseUrl.trimEnd('/') + "/" + location.trimStart('/')
        val patch = Request.Builder()
            .url(uploadUrl)
            .header("Authorization", "Bearer $token")
            .header("Tus-Resumable", "1.0.0")
            .header("Upload-Offset", "0")
            .patch(bytes.toRequestBody("application/offset+octet-stream".toMediaType()))
            .build()
        http.newCall(patch).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IOException(errorMessage(text, response.code))
            return@withContext parseAttachment(JSONObject(text))
        }
    }

    suspend fun download(token: String, filename: String): ByteArray = withContext(Dispatchers.IO) {
        val response = Request.Builder()
            .url(EndpointConfig.api(baseUrl, "uploads/$filename"))
            .header("Authorization", "Bearer $token")
            .build()
            .let { http.newCall(it).execute() }
        response.use {
            if (!it.isSuccessful) throw IOException("Não foi possível baixar o arquivo (${it.code})")
            it.body?.bytes() ?: throw IOException("Arquivo vazio")
        }
    }

    suspend fun voiceChannels(token: String): List<VoiceChannel> = withContext(Dispatchers.IO) {
        val spaces = executeArray("GET", "spaces", token)
        buildList {
            for (i in 0 until spaces.length()) {
                val space = spaces.getJSONObject(i)
                val channels = executeArray("GET", "spaces/${space.getString("id")}/channels", token)
                for (j in 0 until channels.length()) {
                    val channel = channels.getJSONObject(j)
                    if (channel.optString("type") == "voice") {
                        add(VoiceChannel(channel.getString("id"), channel.getString("name"), space.getString("name")))
                    }
                }
            }
        }
    }

    private fun parseMessage(json: JSONObject): LumeMessage {
        val user = json.getJSONObject("user")
        val author = displayName(user)
        val attachmentRows = json.optJSONArray("attachments") ?: JSONArray()
        val reactionRows = json.optJSONArray("reactions") ?: JSONArray()
        val reply = json.optJSONObject("replyTo")
        return LumeMessage(
            id = json.getString("id"),
            userId = json.getString("userId"),
            author = author,
            content = nullableString(json, "content").orEmpty(),
            createdAt = json.optLong("createdAt"),
            edited = !json.isNull("editedAt"),
            attachments = List(attachmentRows.length()) { parseAttachment(attachmentRows.getJSONObject(it)) },
            reactions = List(reactionRows.length()) {
                reactionRows.getJSONObject(it).let { row -> LumeReaction(row.getString("emoji"), row.getString("userId")) }
            },
            replyAuthor = reply?.optJSONObject("user")?.let { displayName(it) },
            replyContent = reply?.let { nullableString(it, "content") },
        )
    }

    private fun parseAttachment(json: JSONObject) = LumeAttachment(
        id = json.getString("id"),
        filename = json.getString("filename"),
        originalName = json.optString("originalName", json.getString("filename")),
        mimetype = json.optString("mimetype", "application/octet-stream"),
    )

    private fun displayName(user: JSONObject): String =
        if (!user.isNull("displayName") && user.optString("displayName").isNotBlank()) {
            user.getString("displayName")
        } else {
            user.optString("username", "Usuário")
        }

    private fun nullableString(json: JSONObject, key: String): String? =
        if (json.isNull(key)) null else json.optString(key).takeIf { it.isNotBlank() }

    suspend fun voiceCredentials(token: String, channelId: String): VoiceCredentials = withContext(Dispatchers.IO) {
        val json = execute("POST", "livekit/token", token, JSONObject().put("channelId", channelId))
        VoiceCredentials(json.getString("token"), json.getString("url"))
    }

    fun openPresenceSocket(token: String, channelId: String): PresenceSocket {
        val presence = PresenceSocket(token, channelId)
        val request = Request.Builder().url(EndpointConfig.websocket(baseUrl)).build()
        presence.socket = http.newWebSocket(request, presence)
        return presence
    }

    fun openRealtimeSocket(
        token: String,
        onEvent: (JSONObject) -> Unit,
        onDisconnected: () -> Unit,
    ): RealtimeSocket {
        val realtime = RealtimeSocket(token, onEvent, onDisconnected)
        val request = Request.Builder().url(EndpointConfig.websocket(baseUrl)).build()
        realtime.socket = http.newWebSocket(request, realtime)
        return realtime
    }

    private fun execute(method: String, path: String, token: String?, body: JSONObject? = null): JSONObject {
        val response = request(method, path, token, body).execute()
        response.use {
            val text = it.body?.string().orEmpty()
            if (!it.isSuccessful) throw IOException(errorMessage(text, it.code))
            return if (text.isBlank()) JSONObject() else JSONObject(text)
        }
    }

    private fun executeArray(method: String, path: String, token: String?): JSONArray {
        val response = request(method, path, token, null).execute()
        response.use {
            val text = it.body?.string().orEmpty()
            if (!it.isSuccessful) throw IOException(errorMessage(text, it.code))
            return JSONArray(text)
        }
    }

    private fun request(method: String, path: String, token: String?, body: JSONObject?): okhttp3.Call {
        val builder = Request.Builder().url(EndpointConfig.api(baseUrl, path)).header("Accept", "application/json")
        if (token != null) builder.header("Authorization", "Bearer $token")
        val requestBody = body?.toString()?.toRequestBody(jsonType)
        builder.method(method, if (method == "GET") null else requestBody ?: "{}".toRequestBody(jsonType))
        return http.newCall(builder.build())
    }

    private fun errorMessage(text: String, code: Int): String = runCatching {
        JSONObject(text).optString("error").ifBlank { "Erro $code no servidor" }
    }.getOrDefault("Erro $code no servidor")
}

class RealtimeSocket(
    private val token: String,
    private val onEvent: (JSONObject) -> Unit,
    private val onDisconnected: () -> Unit,
) : WebSocketListener() {
    lateinit var socket: WebSocket
    private var intentionalClose = false
    private var disconnectedNotified = false

    override fun onOpen(webSocket: WebSocket, response: Response) {
        webSocket.send(JSONObject().put("type", "auth").put("token", token).toString())
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
        runCatching { JSONObject(text) }.onSuccess(onEvent)
    }

    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
        notifyDisconnected()
    }

    override fun onFailure(webSocket: WebSocket, throwable: Throwable, response: Response?) {
        notifyDisconnected()
    }

    private fun notifyDisconnected() {
        if (!intentionalClose && !disconnectedNotified) {
            disconnectedNotified = true
            onDisconnected()
        }
    }

    fun close() {
        intentionalClose = true
        if (::socket.isInitialized) socket.close(1000, "Aplicativo encerrado")
    }

    fun reaction(messageId: String, emoji: String, remove: Boolean) {
        if (!::socket.isInitialized) return
        socket.send(
            JSONObject()
                .put("type", if (remove) "reaction_remove" else "reaction_add")
                .put("messageId", messageId)
                .put("emoji", emoji)
                .toString(),
        )
    }
}

class PresenceSocket(private val token: String, private val channelId: String) : WebSocketListener() {
    lateinit var socket: WebSocket

    override fun onOpen(webSocket: WebSocket, response: Response) {
        webSocket.send(JSONObject().put("type", "auth").put("token", token).toString())
        webSocket.send(JSONObject().put("type", "voice_join").put("channelId", channelId).toString())
    }

    fun status(muted: Boolean, sharing: Boolean) {
        if (!::socket.isInitialized) return
        socket.send(
            JSONObject()
                .put("type", "voice_status")
                .put("isMuted", muted)
                .put("isDeafened", false)
                .put("isCameraOn", false)
                .put("isScreenSharing", sharing)
                .toString(),
        )
    }

    fun leave() {
        if (!::socket.isInitialized) return
        socket.send(JSONObject().put("type", "voice_leave").toString())
        socket.close(1000, "Saindo da chamada")
    }
}
