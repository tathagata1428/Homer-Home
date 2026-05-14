package ro.b4it.homer.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "expenses")
data class Expense(
    @PrimaryKey val id: String,
    val description: String,
    val amount: Double,
    val category: String,
    val date: String,   // "YYYY-MM-DD"
    val note: String = "",
    val type: String = "expense",  // "expense" | "income"
    val updatedAt: Long = System.currentTimeMillis(),
)
