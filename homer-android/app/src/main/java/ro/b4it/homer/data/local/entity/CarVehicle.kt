package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "car_vehicles")
data class CarVehicle(
    @PrimaryKey val id: String,
    val make: String,
    val model: String,
    val year: Int = 0,
    val plate: String = "",
    val fuelType: String = "petrol",        // petrol | diesel | electric | hybrid | lpg
    val odoKm: Int = 0,
    val color: String = "",
    val vin: String = "",                   // VIN / chassis number
    val engine: String = "",               // e.g. "2.0 TDI", "1.6 TSI"
    val displacement: String = "",         // e.g. "1984 cc"
    val powerHp: Int = 0,
    val torqueNm: Int = 0,
    val transmission: String = "",         // manual | automatic | dsg | cvt
    val drivetrain: String = "",           // fwd | rwd | awd | 4wd
    val bodyType: String = "",             // sedan | hatchback | suv | coupe | wagon | van
    val seats: Int = 0,
    val purchaseDate: String = "",         // YYYY-MM-DD
    val purchasePrice: Double = 0.0,
    val notes: String = "",
    val updatedAt: Long = System.currentTimeMillis(),
)
