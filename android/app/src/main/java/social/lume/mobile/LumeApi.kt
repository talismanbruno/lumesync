package social.lume.mobile

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

data class LumeSession(val token: String, val displayName: String)
data class LumeSpace(val id: String, val name: String)
data class LumeChannel(val id: String, val spaceId: String, val name: String, val type: String, val topic: String?)
data class LumeMessage(
    val id: String,
    val author: String,
    val content: String,
    val createdAt: Long,
    val edited: Boolean,
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
            displayName = displayName(user),
        )
    }

    suspend fun restoreSession(token: String): LumeSession = withContext(Dispatchers.IO) {
        val user = execute("GET", "users/@me", token)
        LumeSession(
            token = token,
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
                    topic = it.optString("topic").takeIf { topic -> topic.isNotBlank() },
                )
            }
        }
    }

    suspend fun messages(token: String, channelId: String): List<LumeMessage> = withContext(Dispatchers.IO) {
        val rows = executeArray("GET", "channels/$channelId/messages?limit=50", token)
        List(rows.length()) { index -> parseMessage(rows.getJSONObject(index)) }
    }

    suspend fun sendMessage(token: String, channelId: String, content: String): LumeMessage = withContext(Dispatchers.IO) {
        val body = JSONObject().put("content", content)
        parseMessage(execute("POST", "channels/$channelId/messages", token, body))
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
        return LumeMessage(
            id = json.getString("id"),
            author = author,
            content = json.optString("content"),
            createdAt = json.optLong("createdAt"),
            edited = !json.isNull("editedAt"),
        )
    }

    private fun displayName(user: JSONObject): String =
        if (!user.isNull("displayName") && user.optString("displayName").isNotBlank()) {
            user.getString("displayName")
        } else {
            user.optString("username", "Usuário")
        }

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
