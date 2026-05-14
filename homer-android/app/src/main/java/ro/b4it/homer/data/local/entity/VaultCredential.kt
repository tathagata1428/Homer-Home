package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "vault_credentials")
data class VaultCredential(
    @PrimaryKey val id: String,
    val label: String,
    val site: String = "",
    val username: String = "",
    /** Stored encrypted via vault AES-GCM key */
    val passwordEncrypted: String = "",
    val details: String = "",
    val updatedAt: Long = System.currentTimeMillis(),
)
