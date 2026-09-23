package social.lume.mobile

import android.content.Context

/** Stores only the revocable session token. Passwords are never persisted. */
class SessionStore(context: Context) {
    private val preferences = context.getSharedPreferences("lume_session", Context.MODE_PRIVATE)

    fun token(): String? = preferences.getString(KEY_TOKEN, null)

    fun save(token: String) {
        preferences.edit().putString(KEY_TOKEN, token).apply()
    }

    fun clear() {
        preferences.edit().remove(KEY_TOKEN).apply()
    }

    private companion object {
        const val KEY_TOKEN = "token"
    }
}
