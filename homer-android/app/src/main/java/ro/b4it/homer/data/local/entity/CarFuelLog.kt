package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "car_fuel_log")
data class CarFuelLog(
    @PrimaryKey val id: String,
    val vehicleId: String,
    val date: String,               // YYYY-MM-DD
    val odometer: Int = 0,
    val liters: Double = 0.0,
    val pricePerLiter: Double = 0.0,
    val totalCost: Double = 0.0,
    val station: String = "",
    val fullTank: Boolean = true,
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis(),
)
