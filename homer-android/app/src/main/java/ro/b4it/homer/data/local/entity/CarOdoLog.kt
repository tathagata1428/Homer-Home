package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

/** A manual odometer check-in — recording current km without a fuel fill. */
@Serializable
@Entity(tableName = "car_odo_logs")
data class CarOdoLog(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val km: Int,
    val date: String = "",      // YYYY-MM-DD
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis(),
)
