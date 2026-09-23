package social.lume.mobile

import org.junit.Assert.assertEquals
import org.junit.Test

class EndpointConfigTest {
    @Test fun buildsProductionEndpoints() {
        assertEquals("https://lumesocial.online/api/spaces", EndpointConfig.api("https://lumesocial.online/", "/spaces"))
        assertEquals("wss://lumesocial.online/ws", EndpointConfig.websocket("https://lumesocial.online"))
    }
}
