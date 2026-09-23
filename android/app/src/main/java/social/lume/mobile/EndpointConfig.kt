package social.lume.mobile

object EndpointConfig {
    fun api(baseUrl: String, path: String): String =
        baseUrl.trimEnd('/') + "/api/" + path.trimStart('/')

    fun websocket(baseUrl: String): String = when {
        baseUrl.startsWith("https://") -> "wss://" + baseUrl.removePrefix("https://").trimEnd('/') + "/ws"
        baseUrl.startsWith("http://") -> "ws://" + baseUrl.removePrefix("http://").trimEnd('/') + "/ws"
        else -> error("O servidor do Lume precisa usar HTTP ou HTTPS")
    }
}
