package social.lume.mobile

import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class LumeApiTest {
    private lateinit var server: MockWebServer
    private lateinit var api: LumeApi

    @Before fun setUp() {
        server = MockWebServer()
        server.start()
        api = LumeApi(server.url("/").toString())
    }

    @After fun tearDown() {
        server.shutdown()
    }

    @Test fun restoresSessionWithoutPersistingPassword() = runBlocking {
        server.enqueue(json("""{"id":"u1","username":"talisman","displayName":"Talisman"}"""))

        val session = api.restoreSession("jwt-token")
        val request = server.takeRequest()

        assertEquals("Talisman", session.displayName)
        assertEquals("u1", session.userId)
        assertEquals("Bearer jwt-token", request.getHeader("Authorization"))
        assertEquals("/api/users/@me", request.path)
    }

    @Test fun listsSpacesChannelsAndMessages() = runBlocking {
        server.enqueue(json("""[{"id":"s1","name":"Lume"}]"""))
        server.enqueue(json("""[{"id":"c1","spaceId":"s1","name":"geral","type":"text","topic":"Boas-vindas"}]"""))
        server.enqueue(json("""[{"id":"m1","content":"Olá Android","createdAt":42,"editedAt":null,"user":{"username":"ana","displayName":"Ana"}}]"""))

        val spaces = api.spaces("token")
        val channels = api.channels("token", spaces.single().id)
        val messages = api.messages("token", channels.single().id)

        assertEquals("Lume", spaces.single().name)
        assertEquals("geral", channels.single().name)
        assertEquals("Ana", messages.single().author)
        assertEquals("Olá Android", messages.single().content)
        assertEquals("/api/channels/c1/messages?limit=50", server.takeRequestAfter(2).path)
    }

    @Test fun sendsTrimmedMessagePayload() = runBlocking {
        server.enqueue(json("""{"id":"m2","content":"Oi","createdAt":43,"editedAt":null,"user":{"username":"ana","displayName":null}}""", 201))

        val message = api.sendMessage("token", "c1", "Oi")
        val request = server.takeRequest()

        assertEquals("POST", request.method)
        assertEquals("/api/channels/c1/messages", request.path)
        assertTrue(request.body.readUtf8().contains("\"content\":\"Oi\""))
        assertEquals("ana", message.author)
    }

    @Test fun listsDirectMessagesWithoutShowingCurrentUserAsTitle() = runBlocking {
        server.enqueue(json("""[{"id":"dm1","createdAt":40,"name":null,"members":[{"id":"me","username":"eu","displayName":"Eu"},{"id":"u2","username":"bia","displayName":"Bia"}],"lastMessage":{"content":"Até já","createdAt":50}}]"""))

        val conversations = api.directMessages("token", "me")

        assertEquals("Bia", conversations.single().name)
        assertEquals("Até já", conversations.single().preview)
        assertEquals("/api/dm", server.takeRequest().path)
    }

    @Test fun listsFriendsAndSendsDmMessage() = runBlocking {
        server.enqueue(json("""[{"id":"u2","username":"bia","displayName":"Bia","status":"working"}]"""))
        server.enqueue(json("""{"id":"m3","content":"Oi Bia","createdAt":51,"editedAt":null,"user":{"id":"me","username":"eu","displayName":"Eu"}}""", 201))

        val friend = api.friends("token").single()
        val sent = api.sendDmMessage("token", "dm1", "Oi Bia")

        assertEquals("working", friend.status)
        assertEquals("Oi Bia", sent.content)
        server.takeRequest()
        val sendRequest = server.takeRequest()
        assertEquals("/api/dm/dm1/messages", sendRequest.path)
        assertEquals("POST", sendRequest.method)
    }

    @Test fun listsAndAcceptsIncomingFriendRequest() = runBlocking {
        server.enqueue(json("""[{"id":"r1","fromId":"u2","toId":"me","status":"pending","user":{"id":"u2","username":"bia","displayName":"Bia"}}]"""))
        server.enqueue(json("""{"success":true}"""))

        val request = api.friendRequests("token", "me").single()
        api.answerFriendRequest("token", request.id, true)

        assertTrue(request.incoming)
        assertEquals("Bia", request.name)
        server.takeRequest()
        val answer = server.takeRequest()
        assertEquals("PATCH", answer.method)
        assertEquals("/api/social/requests/r1", answer.path)
        assertTrue(answer.body.readUtf8().contains("\"status\":\"accepted\""))
    }

    @Test fun sendsFriendRequestByUsername() = runBlocking {
        server.enqueue(json("""{"success":true,"requestId":"r2"}""", 201))

        api.sendFriendRequest("token", "bia@lumesocial.online")
        val request = server.takeRequest()

        assertEquals("/api/social/requests", request.path)
        assertTrue(request.body.readUtf8().contains("bia@lumesocial.online"))
    }

    private fun json(body: String, status: Int = 200) = MockResponse()
        .setResponseCode(status)
        .setHeader("Content-Type", "application/json")
        .setBody(body)

    private fun MockWebServer.takeRequestAfter(skip: Int): okhttp3.mockwebserver.RecordedRequest {
        repeat(skip) { takeRequest() }
        return takeRequest()
    }
}
