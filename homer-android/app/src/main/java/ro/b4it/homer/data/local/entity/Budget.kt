package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "budgets")
data class Budget(
    @PrimaryKey val category: String,
    val limit: Double,
    val period: String = "monthly",
    val updatedAt: Long = System.currentTimeMillis(),
)
