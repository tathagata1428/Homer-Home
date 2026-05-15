package ro.b4it.homer.data.supabase

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import ro.b4it.homer.data.preferences.AppPreferences
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SupabaseManager @Inject constructor(
    val client: SupabaseClient,
    private val prefs: AppPreferences,
) {

    /** True when the signed-in user is "bogdan" — only then do we enable Supabase sync. */
    fun isBogdan(): Boolean {
        val session = try { client.auth.currentSessionOrNull() } catch (_: Exception) { null }
        val sessionEmail = session?.user?.email ?: ""
        return sessionEmail.contains("bogdan", ignoreCase = true) ||
               cachedAuthUser?.equals("bogdan", ignoreCase = true) == true
    }

    private var cachedAuthUser: String? = null

    fun setCachedAuthUser(user: String?) { cachedAuthUser = user }

    /** Session status as a Flow for UI observation. */
    val sessionStatus: Flow<SessionStatus> get() = client.auth.sessionStatus

    /** Current Supabase user ID, or null if not signed in. */
    val userId: String? get() = try { client.auth.currentUserOrNull()?.id } catch (_: Exception) { null }

    /** Sign in to Supabase with email + password (bogdan only). */
    suspend fun signIn(email: String, password: String) {
        client.auth.signInWith(io.github.jan.supabase.auth.providers.builtin.Email) {
            this.email = email
            this.password = password
        }
    }

    /** Sign out from Supabase. */
    suspend fun signOut() {
        try { client.auth.signOut() } catch (_: Exception) { }
    }

    /** Read a single row from `field_state` by key. Returns null if not found. */
    suspend fun getFieldState(key: String): FieldStateRow? {
        val uid = userId ?: return null
        return try {
            client.postgrest["field_state"]
                .select {
                    filter {
                        eq("user_id", uid)
                        eq("key", key)
                    }
                    limit(1)
                }
                .decodeSingleOrNull<FieldStateRow>()
        } catch (_: Exception) { null }
    }

    /** Upsert a row in `field_state`. No-op if not bogdan. */
    suspend fun setFieldState(key: String, data: String, ts: Long = System.currentTimeMillis()) {
        if (!isBogdan()) return
        val uid = userId ?: return
        try {
            client.postgrest["field_state"].upsert(
                listOf(FieldStateRow(userId = uid, key = key, value = FieldStateValue(ts = ts, data = data)))
            ) { onConflict = "user_id,key" }
        } catch (_: Exception) { }
    }

    /** Upsert a row in `joey_meta`. No-op if not bogdan. */
    suspend fun setJoeyMeta(key: String, mode: String, value: String) {
        if (!isBogdan()) return
        val uid = userId ?: return
        try {
            client.postgrest["joey_meta"].upsert(
                listOf(JoeyMetaRow(userId = uid, mode = mode, key = key, value = value))
            ) { onConflict = "user_id,mode,key" }
        } catch (_: Exception) { }
    }
}

@kotlinx.serialization.Serializable
data class JoeyMetaRow(
    @kotlinx.serialization.SerialName("user_id") val userId: String,
    val mode: String,
    val key: String,
    val value: String,
)

@kotlinx.serialization.Serializable
data class FieldStateRow(
    @kotlinx.serialization.SerialName("user_id")  val userId: String,
    val key: String,
    val value: FieldStateValue,
)

@kotlinx.serialization.Serializable
data class FieldStateValue(
    @kotlinx.serialization.SerialName("_ts")   val ts: Long,
    @kotlinx.serialization.SerialName("_data") val data: String,
)
