package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.VaultCredential
import ro.b4it.homer.data.local.entity.VaultLink
import ro.b4it.homer.data.local.entity.VaultNote

@Dao
interface VaultDao {
    // Credentials
    @Query("SELECT * FROM vault_credentials ORDER BY label ASC")
    fun getCredentials(): Flow<List<VaultCredential>>

    @Query("SELECT * FROM vault_credentials ORDER BY label ASC")
    suspend fun getAllCredentials(): List<VaultCredential>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCredential(cred: VaultCredential)

    @Query("DELETE FROM vault_credentials")
    suspend fun clearAllCredentials()

    @Delete
    suspend fun deleteCredential(cred: VaultCredential)

    // Secret links
    @Query("SELECT * FROM vault_links ORDER BY name ASC")
    fun getLinks(): Flow<List<VaultLink>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertLink(link: VaultLink)

    @Delete
    suspend fun deleteLink(link: VaultLink)

    // Notes (single row per mode)
    @Query("SELECT * FROM vault_notes WHERE mode = :mode LIMIT 1")
    suspend fun getNote(mode: String): VaultNote?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertNote(note: VaultNote)
}
