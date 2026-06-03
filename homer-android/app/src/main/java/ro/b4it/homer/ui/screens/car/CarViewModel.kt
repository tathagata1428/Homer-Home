package ro.b4it.homer.ui.screens.car

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ro.b4it.homer.data.local.dao.CarDao
import ro.b4it.homer.data.local.entity.CarDocument
import ro.b4it.homer.data.local.entity.CarFuelLog
import ro.b4it.homer.data.local.entity.CarMaintenance
import ro.b4it.homer.data.local.entity.CarVehicle
import ro.b4it.homer.data.sync.SyncEngine
import ro.b4it.homer.notification.ReminderManager
import java.io.File
import java.time.LocalDate
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class CarViewModel @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val dao: CarDao,
    private val reminderManager: ReminderManager,
    private val sync: SyncEngine,
) : ViewModel() {

    val vehicles: StateFlow<List<CarVehicle>> = dao.getVehicles()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _selectedVehicleId = MutableStateFlow<String?>(null)

    val selectedVehicle: StateFlow<CarVehicle?> = combine(vehicles, _selectedVehicleId) { list, sel ->
        if (sel != null) list.firstOrNull { it.id == sel } else list.firstOrNull()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val documents: StateFlow<List<CarDocument>> = selectedVehicle.flatMapLatest { v ->
        if (v != null) dao.getDocuments(v.id) else flowOf(emptyList())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val maintenance: StateFlow<List<CarMaintenance>> = selectedVehicle.flatMapLatest { v ->
        if (v != null) dao.getMaintenance(v.id) else flowOf(emptyList())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val fuelLog: StateFlow<List<CarFuelLog>> = selectedVehicle.flatMapLatest { v ->
        if (v != null) dao.getFuelLog(v.id) else flowOf(emptyList())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Computed: average fuel consumption (L/100km) from last 5 full-tank fills
    val avgConsumption: StateFlow<Double?> = fuelLog.map { logs ->
        val fullFills = logs.filter { it.fullTank && it.odometer > 0 }.sortedBy { it.odometer }
        if (fullFills.size < 2) return@map null
        val segments = fullFills.zipWithNext()
        val valid = segments.filter { (a, b) -> b.odometer > a.odometer && b.liters > 0 }
        if (valid.isEmpty()) return@map null
        val totalLiters = valid.sumOf { (_, b) -> b.liters }
        val totalKm = valid.sumOf { (a, b) -> (b.odometer - a.odometer).toDouble() }
        if (totalKm == 0.0) null else (totalLiters / totalKm) * 100.0
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    fun selectVehicle(id: String) { _selectedVehicleId.value = id }

    fun saveVehicle(
        id: String = UUID.randomUUID().toString(),
        make: String, model: String, year: Int, plate: String,
        fuelType: String, odoKm: Int, color: String,
        vin: String = "", engine: String = "", displacement: String = "",
        powerHp: Int = 0, torqueNm: Int = 0, transmission: String = "",
        drivetrain: String = "", bodyType: String = "", seats: Int = 0,
        purchaseDate: String = "", purchasePrice: Double = 0.0, notes: String = "",
    ) {
        viewModelScope.launch {
            dao.upsertVehicle(
                CarVehicle(
                    id = id, make = make, model = model, year = year,
                    plate = plate, fuelType = fuelType, odoKm = odoKm,
                    color = color, vin = vin, engine = engine,
                    displacement = displacement, powerHp = powerHp, torqueNm = torqueNm,
                    transmission = transmission, drivetrain = drivetrain, bodyType = bodyType,
                    seats = seats, purchaseDate = purchaseDate, purchasePrice = purchasePrice,
                    notes = notes,
                )
            )
            sync.pushCarDebounced()
        }
    }

    fun deleteVehicle(vehicle: CarVehicle) {
        viewModelScope.launch { dao.deleteVehicle(vehicle); sync.pushCarNow() }
    }

    fun saveDocument(
        id: String = UUID.randomUUID().toString(),
        vehicleId: String,
        type: String, label: String, expiryDate: String,
        docNumber: String = "", provider: String, cost: Double, notes: String,
        fileUri: Uri? = null,
        clearFile: Boolean = false,
    ) {
        viewModelScope.launch {
            val existing = dao.getDocumentById(id)
            val (filePath, fileName, fileType) = when {
                fileUri != null -> withContext(Dispatchers.IO) { copyFileToStorage(id, fileUri) }
                clearFile -> Triple(null, null, null)
                else -> Triple(existing?.fileData, existing?.fileName, existing?.fileType)
            }
            val doc = CarDocument(
                id = id, vehicleId = vehicleId, type = type, label = label,
                expiryDate = expiryDate, docNumber = docNumber, provider = provider,
                cost = cost, notes = notes,
                fileData = filePath, fileName = fileName, fileType = fileType,
            )
            dao.upsertDocument(doc)
            reminderManager.scheduleCarDocument(doc)
            sync.pushCarDebounced()
        }
    }

    /** Copy picked file into app-internal storage; returns (absolutePath, name, mimeType). */
    private fun copyFileToStorage(docId: String, uri: Uri): Triple<String, String, String> {
        val mimeType = ctx.contentResolver.getType(uri) ?: "application/octet-stream"
        val ext = when {
            mimeType.contains("pdf")  -> ".pdf"
            mimeType.contains("png")  -> ".png"
            mimeType.contains("jpeg") || mimeType.contains("jpg") -> ".jpg"
            else -> ""
        }
        val dir = File(ctx.filesDir, "car_docs").also { it.mkdirs() }
        val dest = File(dir, "$docId$ext")
        ctx.contentResolver.openInputStream(uri)?.use { ins -> dest.outputStream().use { ins.copyTo(it) } }
        return Triple(dest.absolutePath, dest.name, mimeType)
    }

    fun deleteDocument(doc: CarDocument) {
        viewModelScope.launch {
            // Delete local file if present
            doc.fileData?.let { path -> if (path.startsWith("/")) File(path).delete() }
            dao.deleteDocument(doc)
            reminderManager.cancelCarDocument(doc.id)
            sync.pushCarNow()
        }
    }

    fun saveMaintenance(
        id: String = UUID.randomUUID().toString(),
        vehicleId: String,
        type: String, label: String, date: String, odometer: Int,
        nextDateDue: String, nextOdoKm: Int, cost: Double, workshop: String, notes: String,
    ) {
        viewModelScope.launch {
            dao.upsertMaintenance(
                CarMaintenance(
                    id = id, vehicleId = vehicleId, type = type, label = label,
                    date = date, odometer = odometer, nextDateDue = nextDateDue,
                    nextOdoKm = nextOdoKm, cost = cost, workshop = workshop, notes = notes,
                )
            )
            // Auto-update vehicle odometer if this service is at a higher reading
            if (odometer > 0) {
                val v = dao.getVehicleById(vehicleId)
                if (v != null && odometer > v.odoKm) dao.upsertVehicle(v.copy(odoKm = odometer, updatedAt = System.currentTimeMillis()))
            }
            sync.pushCarDebounced()
        }
    }

    fun deleteMaintenance(record: CarMaintenance) {
        viewModelScope.launch { dao.deleteMaintenance(record); sync.pushCarNow() }
    }

    fun saveFuelLog(
        id: String = UUID.randomUUID().toString(),
        vehicleId: String,
        date: String, odometer: Int, liters: Double,
        pricePerLiter: Double, totalCost: Double, station: String, fullTank: Boolean, notes: String,
    ) {
        viewModelScope.launch {
            dao.upsertFuelLog(
                CarFuelLog(
                    id = id, vehicleId = vehicleId, date = date, odometer = odometer,
                    liters = liters, pricePerLiter = pricePerLiter, totalCost = totalCost,
                    station = station, fullTank = fullTank, notes = notes,
                )
            )
            // Auto-update vehicle odometer if this fill is at a higher reading
            if (odometer > 0) {
                val v = dao.getVehicleById(vehicleId)
                if (v != null && odometer > v.odoKm) dao.upsertVehicle(v.copy(odoKm = odometer, updatedAt = System.currentTimeMillis()))
            }
            sync.pushCarDebounced()
        }
    }

    fun deleteFuelLog(entry: CarFuelLog) {
        viewModelScope.launch { dao.deleteFuelLog(entry); sync.pushCarNow() }
    }

    /** Days remaining until expiry. Negative = already expired. */
    fun daysUntil(dateStr: String): Int = try {
        java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), LocalDate.parse(dateStr)).toInt()
    } catch (_: Exception) { Int.MAX_VALUE }
}
