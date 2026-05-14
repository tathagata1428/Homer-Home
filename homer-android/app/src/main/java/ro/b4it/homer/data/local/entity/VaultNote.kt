package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "vault_notes")
data class VaultNote(
    @PrimaryKey val id: Int = 1,   // single-row per mode
    val mode: String = "personal",  // "personal" | "work"
    /** Stored encrypted via vault AES-GCM key */
    val textEncrypted: String = "",
    val updatedAt: Long = System.currentTimeMillis(),
)
