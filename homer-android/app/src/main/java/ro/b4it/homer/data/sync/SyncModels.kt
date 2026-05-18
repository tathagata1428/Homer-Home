package ro.b4it.homer.data.sync

/** Describes a field where local and cloud item counts differ. */
data class ConflictInfo(
    val fieldKey: String,
    val label: String,
    val emoji: String,
    val localCount: Int,
    val cloudCount: Int,
)

/** How to resolve a conflict between local Room data and Supabase cloud data. */
enum class SyncResolution {
    /** Keep local as-is; push local → cloud so they align. */
    KEEP_LOCAL,
    /** Merge cloud into local via upsert — keeps all items from both sides. */
    MERGE_BOTH,
    /** Replace local entirely with cloud data (clear + upsert). */
    USE_CLOUD,
}
