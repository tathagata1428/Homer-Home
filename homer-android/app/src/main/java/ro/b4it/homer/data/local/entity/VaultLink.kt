package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "vault_links")
data class VaultLink(
    @PrimaryKey val id: String,
    val name: String,
    val url: String,
    val description: String = "",
    val updatedAt: Long = System.currentTimeMillis(),
)
