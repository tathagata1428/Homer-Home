package ro.b4it.homer.data.supabase

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import ro.b4it.homer.data.preferences.AppPreferences
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

@Singleton
class SupabaseManager @Inject constructor(
    val client: SupabaseClient,
    private val prefs: AppPreferences,
    @Named("syncEmail") private val syncEmail: String,
    @Named("syncPass")  private val syncPass:  String,
) {
    /** Monotonic client-seq counter — must stay within PostgreSQL INTEGER range (< 2^31).
     *  Starts at 0 each session; stale-reject uses client_ts first so reset is safe. */
    private val clientSeq = java.util.concurrent.atomic.AtomicLong(0L)

    /** True when the signed-in user is "bogdan" — only then do we enable Supabase sync. */
    fun isBogdan(): Boolean {
        val session = try { client.auth.currentSessionOrNull() } catch (_: Exception) { null }
        val sessionEmail = session?.user?.email ?: ""
        return sessionEmail.contains("bogdan", ignoreCase = true) ||
               _cachedAuthUser.value?.equals("bogdan", ignoreCase = true) == true
    }

    private val _cachedAuthUser = MutableStateFlow<String?>(null)
    val cachedAuthUserFlow: StateFlow<String?> = _cachedAuthUser.asStateFlow()

    fun setCachedAuthUser(user: String?) { _cachedAuthUser.value = user }

    /** Session status as a Flow for UI observation. */
    val sessionStatus: Flow<SessionStatus> get() = client.auth.sessionStatus

    /** Current Supabase user ID, or null if not signed in. */
    val userId: String? get() = try { client.auth.currentUserOrNull()?.id } catch (_: Exception) { null }

    /** Current Supabase access token, or null if not signed in. Used for API calls that need a Bearer token. */
    val accessToken: String? get() = try { client.auth.currentSessionOrNull()?.accessToken } catch (_: Exception) { null }

    /**
     * Ensure a Supabase session exists before any sync operation.
     * Called automatically by getFieldState / setFieldState so timing of
     * the HomerApplication auto-sign-in doesn't matter.
     */
    /**
     * Ensures an active Supabase session.
     * If credentials are not set in local.properties (Play Store / third-party builds),
     * returns silently — the app runs in local-only mode with no Supabase sync.
     */
    suspend fun ensureSignedIn() {
        if (userId != null) return
        if (syncEmail.isBlank() || syncPass.isBlank()) return   // local-only mode
        signIn(syncEmail, syncPass)
    }

    /** Sign in to Supabase with email + password (bogdan only). */
    suspend fun signIn(email: String, password: String) {
        client.auth.signInWith(io.github.jan.supabase.auth.providers.builtin.Email) {
            this.email = email
            this.password = password
        }
    }

    /** Sign in using the credentials stored in BuildConfig (local.properties).
     *  Called after exchangeToken validates the Homer credentials server-side.
     *  No-op in local-only (Play Store) builds where credentials are blank.
     */
    suspend fun signInWithStoredCredentials() {
        if (syncEmail.isBlank() || syncPass.isBlank()) return
        signIn(syncEmail, syncPass)
    }

    /** Sign out from Supabase. */
    suspend fun signOut() {
        try { client.auth.signOut() } catch (_: Exception) { }
    }

    /**
     * Read a single row from `field_state` by field_id.
     * Returns null if not found or not authenticated.
     *
     * Column mapping matches the website's field_state table schema:
     *   user_id, field_id, kind, value, client_ts, server_ts, ...
     */
    suspend fun getFieldState(fieldId: String): FieldStateRow? {
        ensureSignedIn()
        val uid = userId ?: run {
            android.util.Log.w("HomerSupabase", "getFieldState[$fieldId]: uid=null (not signed in)")
            return null
        }
        return try {
            client.postgrest["field_state"]
                .select {
                    filter {
                        eq("user_id", uid)
                        eq("field_id", fieldId)
                    }
                    limit(1)
                }
                .decodeSingleOrNull<FieldStateRow>()
                .also { row ->
                    if (row == null) android.util.Log.d("HomerSupabase", "getFieldState[$fieldId]: no row in Supabase")
                    else android.util.Log.d("HomerSupabase", "getFieldState[$fieldId]: got ${row.value.length} chars")
                }
        } catch (e: Exception) {
            android.util.Log.e("HomerSupabase", "getFieldState[$fieldId] failed: ${e.message}", e)
            null
        }
    }

    /**
     * Upsert a row in `field_state`. No-op if not bogdan.
     *
     * `data` is the JSON-encoded payload (e.g. serialized list of expenses).
     * Stored in the `value` column as a plain JSON string, matching the website schema.
     * Conflict key: user_id,field_id — same as the website's upsert constraint.
     */
    suspend fun setFieldState(fieldId: String, data: String, ts: Long = System.currentTimeMillis()) {
        if (!isBogdan()) return
        ensureSignedIn()
        val uid = userId ?: return
        try {
            client.postgrest["field_state"].upsert(
                listOf(
                    FieldStateRow(
                        userId    = uid,
                        fieldId   = fieldId,
                        kind      = "json",
                        value     = data,
                        clientTs  = ts,
                        clientSeq = clientSeq.getAndIncrement(),
                        serverTs  = ts,
                        deleted   = false,
                        deviceId  = "android",
                        updatedAt = java.time.Instant.ofEpochMilli(ts)
                            .toString(),   // ISO-8601, e.g. "2026-05-15T12:00:00Z"
                    )
                )
            ) { onConflict = "user_id,field_id" }
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

// ── Data models — columns match the website's field_state table schema ─────────

@Serializable
data class FieldStateRow(
    @SerialName("user_id")    val userId:    String,
    @SerialName("field_id")   val fieldId:   String,
    val kind:                                String  = "json",
    val value:                               String  = "",
    val deleted:                             Boolean = false,
    @SerialName("client_ts")  val clientTs:  Long    = 0L,
    @SerialName("client_seq") val clientSeq: Long    = 0L,
    @SerialName("device_id")  val deviceId:  String  = "android",
    @SerialName("server_ts")  val serverTs:  Long    = 0L,
    @SerialName("updated_at") val updatedAt: String  = "",
)

@Serializable
data class JoeyMetaRow(
    @SerialName("user_id") val userId: String,
    val mode: String,
    val key: String,
    val value: String,
)
