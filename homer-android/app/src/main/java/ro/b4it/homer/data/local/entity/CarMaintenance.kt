package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

/** A service record with optional next-due tracking. */
@Serializable
@Entity(tableName = "car_maintenance")
data class CarMaintenance(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val type: String,               // oil | filters | tires | brakes | belt | spark_plugs | battery | ac | other
    val label: String,
    val date: String,               // YYYY-MM-DD — when service was done
    val odometer: Int = 0,
    val nextDateDue: String = "",   // YYYY-MM-DD — next scheduled service
    val nextOdoKm: Int = 0,         // km at which next service is due (0 = not set)
    val cost: Double = 0.0,
    val workshop: String = "",
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)
