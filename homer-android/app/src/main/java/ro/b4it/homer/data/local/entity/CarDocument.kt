package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

/** A document with optional expiry — vehicle or personal (insurance, vignette, ITP, driver's license, ID, passport…). */
@Serializable
@Entity(tableName = "car_documents")
data class CarDocument(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val type: String,              // insurance | ctp | vignette | itp | registration | tax | driver_license | id_card | passport | other
    val label: String,             // display name (auto-filled from type, editable)
    val expiryDate: String = "",   // YYYY-MM-DD — empty = no expiry (e.g. registration)
    val docNumber: String = "",    // document/policy number
    val provider: String = "",     // insurer, authority, etc.
    val cost: Double = 0.0,
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)
