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
        server.enqueue(json("""[{"id":"m1","userId":"u2","content":"Olá Android","createdAt":42,"editedAt":null,"attachments":[],"reactions":[],"user":{"id":"u2","username":"ana","displayName":"Ana"}}]"""))

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
        server.enqueue(json("""{"id":"m2","userId":"u2","content":"Oi","createdAt":43,"editedAt":null,"attachments":[],"reactions":[],"user":{"id":"u2","username":"ana","displayName":null}}""", 201))

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
        server.enqueue(json("""{"id":"m3","userId":"me","content":"Oi Bia","createdAt":51,"editedAt":null,"attachments":[],"reactions":[],"user":{"id":"me","username":"eu","displayName":"Eu"}}""", 201))

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

    @Test fun parsesRepliesAttachmentsAndReactions() = runBlocking {
        server.enqueue(json("""[{"id":"m4","userId":"u2","content":"Resposta","createdAt":52,"editedAt":53,"user":{"id":"u2","username":"bia","displayName":"Bia"},"attachments":[{"id":"a1","filename":"a1.png","originalName":"foto.png","mimetype":"image/png"}],"reactions":[{"emoji":"👍","userId":"me"}],"replyTo":{"content":"Original","user":{"id":"me","username":"eu","displayName":"Eu"}}}]"""))

        val message = api.messages("token", "c1").single()

        assertTrue(message.edited)
        assertEquals("foto.png", message.attachments.single().originalName)
        assertEquals("👍", message.reactions.single().emoji)
        assertEquals("Eu", message.replyAuthor)
    }

    @Test fun uploadsFileUsingTusProtocol() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(201).setHeader("Location", server.url("/api/files/upload-1")))
        server.enqueue(json("""{"id":"a2","filename":"a2.png","originalName":"foto.png","mimetype":"image/png","size":3,"createdAt":54}"""))

        val attachment = api.upload("token", "foto.png", byteArrayOf(1, 2, 3))
        val create = server.takeRequest()
        val patch = server.takeRequest()

        assertEquals("a2", attachment.id)
        assertEquals("POST", create.method)
        assertEquals("3", create.getHeader("Upload-Length"))
        assertEquals("PATCH", patch.method)
        assertEquals("0", patch.getHeader("Upload-Offset"))
        assertEquals("application/offset+octet-stream", patch.getHeader("Content-Type"))
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
