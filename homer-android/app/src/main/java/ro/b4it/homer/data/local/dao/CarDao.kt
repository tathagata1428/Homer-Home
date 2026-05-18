package ro.b4it.homer.data.local.dao

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import ro.b4it.homer.data.local.entity.CarDocument
import ro.b4it.homer.data.local.entity.CarFuelLog
import ro.b4it.homer.data.local.entity.CarMaintenance
import ro.b4it.homer.data.local.entity.CarVehicle

@Dao
interface CarDao {
    // ─── Vehicles ────────────────────────────────────────────────────────────
    @Query("SELECT * FROM car_vehicles ORDER BY updatedAt DESC")
    fun getVehicles(): Flow<List<CarVehicle>>

    @Query("SELECT * FROM car_vehicles WHERE id = :id LIMIT 1")
    suspend fun getVehicleById(id: String): CarVehicle?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertVehicle(vehicle: CarVehicle)

    @Delete
    suspend fun deleteVehicle(vehicle: CarVehicle)

    // ─── Documents ───────────────────────────────────────────────────────────
    @Query("SELECT * FROM car_documents WHERE id = :id LIMIT 1")
    suspend fun getDocumentById(id: String): CarDocument?

    @Query("SELECT * FROM car_documents WHERE vehicleId = :vehicleId ORDER BY expiryDate ASC")
    fun getDocuments(vehicleId: String): Flow<List<CarDocument>>

    @Query("SELECT * FROM car_documents ORDER BY expiryDate ASC")
    fun getAllDocuments(): Flow<List<CarDocument>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDocument(doc: CarDocument)

    @Delete
    suspend fun deleteDocument(doc: CarDocument)

    // ─── Maintenance ─────────────────────────────────────────────────────────
    @Query("SELECT * FROM car_maintenance WHERE vehicleId = :vehicleId ORDER BY date DESC")
    fun getMaintenance(vehicleId: String): Flow<List<CarMaintenance>>

    @Query("SELECT * FROM car_maintenance ORDER BY date DESC")
    fun getAllMaintenance(): Flow<List<CarMaintenance>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMaintenance(record: CarMaintenance)

    @Delete
    suspend fun deleteMaintenance(record: CarMaintenance)

    // ─── Fuel log ─────────────────────────────────────────────────────────────
    @Query("SELECT * FROM car_fuel_log WHERE vehicleId = :vehicleId ORDER BY date DESC")
    fun getFuelLog(vehicleId: String): Flow<List<CarFuelLog>>

    @Query("SELECT * FROM car_fuel_log ORDER BY date DESC")
    fun getAllFuelLog(): Flow<List<CarFuelLog>>

    @Query("SELECT * FROM car_fuel_log WHERE vehicleId = :vehicleId ORDER BY odometer ASC")
    suspend fun getFuelLogByOdo(vehicleId: String): List<CarFuelLog>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertFuelLog(entry: CarFuelLog)

    @Delete
    suspend fun deleteFuelLog(entry: CarFuelLog)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertVehicles(vehicles: List<CarVehicle>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDocuments(docs: List<CarDocument>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMaintenanceAll(records: List<CarMaintenance>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertFuelLogAll(entries: List<CarFuelLog>)

    @Query("DELETE FROM car_vehicles")
    suspend fun clearAllVehicles()

    @Query("DELETE FROM car_documents")
    suspend fun clearAllDocuments()

    @Query("DELETE FROM car_maintenance")
    suspend fun clearAllMaintenance()

    @Query("DELETE FROM car_fuel_log")
    suspend fun clearAllFuelLog()
}
