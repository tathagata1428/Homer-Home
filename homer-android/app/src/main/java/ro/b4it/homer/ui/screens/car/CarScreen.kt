package ro.b4it.homer.ui.screens.car

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.CarDocument
import ro.b4it.homer.data.local.entity.CarFuelLog
import ro.b4it.homer.data.local.entity.CarMaintenance
import ro.b4it.homer.data.local.entity.CarVehicle
import ro.b4it.homer.ui.theme.*
import java.io.File
import java.time.LocalDate
import java.util.UUID

private fun openDocFile(context: Context, doc: CarDocument) {
    val raw = doc.fileData ?: return
    val mimeType = doc.fileType ?: "application/octet-stream"
    val file: File = if (raw.startsWith("/")) {
        // Local file stored in app's filesDir
        File(raw).also { if (!it.exists()) return }
    } else {
        // Legacy base64 data URL (from old website sync)
        val base64 = if (raw.contains(",")) raw.substringAfter(",") else raw
        val bytes = try { android.util.Base64.decode(base64, android.util.Base64.DEFAULT) } catch (_: Exception) { return }
        val dir = File(context.cacheDir, "car_docs").also { it.mkdirs() }
        File(dir, doc.fileName ?: "document").also { it.writeBytes(bytes) }
    }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
    val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, mimeType)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    try { context.startActivity(Intent.createChooser(intent, "Open with")) } catch (_: Exception) {}
}

// ─── Document type helpers ────────────────────────────────────────────────────

private val DOC_TYPES = listOf(
    "insurance"      to "Car Insurance",
    "ctp"            to "CTP / RCA",
    "vignette"       to "Vignette",
    "itp"            to "Tech Inspection",
    "registration"   to "Registration",
    "tax"            to "Road Tax",
    "driver_license" to "Driver's License",
    "id_card"        to "ID Card",
    "passport"       to "Passport",
    "other"          to "Other",
)

private val FUEL_TYPES = listOf("petrol", "diesel", "electric", "hybrid", "lpg")

private val MAINT_TYPES = listOf(
    "oil"         to "Oil Change",
    "filters"     to "Filters",
    "tires"       to "Tires",
    "brakes"      to "Brakes",
    "belt"        to "Timing Belt",
    "spark_plugs" to "Spark Plugs",
    "battery"     to "Battery",
    "ac"          to "A/C Service",
    "other"       to "Other",
)

private fun docTypeLabel(type: String) = DOC_TYPES.firstOrNull { it.first == type }?.second ?: type
private fun docTypeIcon(type: String) = when (type) {
    "insurance"      -> "🛡️"
    "ctp"            -> "⚖️"
    "vignette"       -> "🏷️"
    "itp"            -> "🔧"
    "registration"   -> "📋"
    "tax"            -> "📜"
    "driver_license" -> "🪪"
    "id_card"        -> "🆔"
    "passport"       -> "📗"
    else             -> "📄"
}

private val PERSONAL_DOC_TYPES = setOf("driver_license", "id_card", "passport")
private fun maintTypeIcon(type: String) = when (type) {
    "oil"         -> "🛢️"
    "filters"     -> "🌀"
    "tires"       -> "🔄"
    "brakes"      -> "🛑"
    "belt"        -> "⚙️"
    "spark_plugs" -> "⚡"
    "battery"     -> "🔋"
    "ac"          -> "❄️"
    else          -> "🔧"
}

// ─── Main screen ─────────────────────────────────────────────────────────────

@Composable
fun CarScreen(onBack: () -> Unit, vm: CarViewModel = hiltViewModel()) {
    val vehicles       by vm.vehicles.collectAsStateWithLifecycle()
    val selectedVehicle by vm.selectedVehicle.collectAsStateWithLifecycle()
    val documents      by vm.documents.collectAsStateWithLifecycle()
    val maintenance    by vm.maintenance.collectAsStateWithLifecycle()
    val fuelLog        by vm.fuelLog.collectAsStateWithLifecycle()
    val avgConsumption by vm.avgConsumption.collectAsStateWithLifecycle()

    var selectedTab by remember { mutableIntStateOf(0) }
    var showAddVehicle   by remember { mutableStateOf(false) }
    var editingVehicle   by remember { mutableStateOf<CarVehicle?>(null) }
    var showAddDoc       by remember { mutableStateOf(false) }
    var editingDoc       by remember { mutableStateOf<CarDocument?>(null) }
    var showAddMaint     by remember { mutableStateOf(false) }
    var editingMaint     by remember { mutableStateOf<CarMaintenance?>(null) }
    var showAddFuel      by remember { mutableStateOf(false) }
    var editingFuel      by remember { mutableStateOf<CarFuelLog?>(null) }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {

        // ── Top bar ──────────────────────────────────────────────────────────
        Row(
            Modifier.fillMaxWidth().padding(start = 4.dp, top = 8.dp, end = 12.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Filled.ArrowBack, null, tint = TextMuted)
            }
            Text(
                "Car Tracker",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
                modifier = Modifier.weight(1f),
            )
            if (selectedVehicle != null) {
                IconButton(onClick = { editingVehicle = selectedVehicle }) {
                    Icon(Icons.Filled.Edit, null, tint = TextMuted, modifier = Modifier.size(18.dp))
                }
            }
            IconButton(onClick = { showAddVehicle = true }) {
                Icon(Icons.Filled.Add, null, tint = AccentBlue)
            }
        }
        HorizontalDivider(color = BorderSubtle)

        if (selectedVehicle == null) {
            // ── Empty state ──────────────────────────────────────────────────
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("🚗", fontSize = 56.sp)
                    Text("No vehicle added yet", style = MaterialTheme.typography.titleMedium, color = TextPrimary)
                    Text("Track insurance, maintenance & fuel", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                    Button(
                        onClick = { showAddVehicle = true },
                        colors = ButtonDefaults.buttonColors(containerColor = AccentBlue),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text("Add Your Car", fontWeight = FontWeight.Bold)
                    }
                }
            }
        } else {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {

                // ── Vehicle header ────────────────────────────────────────────
                item {
                    VehicleHeader(vehicle = selectedVehicle!!, vehicles = vehicles, onSelect = vm::selectVehicle)
                    Spacer(Modifier.height(16.dp))
                }

                // ── Tabs ─────────────────────────────────────────────────────
                item {
                    TabRow(
                        selectedTabIndex = selectedTab,
                        containerColor   = BgCard,
                        contentColor     = AccentBlue,
                    ) {
                        listOf("Documents", "Maintenance", "Fuel").forEachIndexed { i, title ->
                            Tab(
                                selected = selectedTab == i,
                                onClick  = { selectedTab = i },
                                text = {
                                    Text(
                                        title,
                                        fontSize   = 11.sp,
                                        fontWeight = if (selectedTab == i) FontWeight.Bold else FontWeight.Normal,
                                        color      = if (selectedTab == i) AccentBlue else TextMuted,
                                    )
                                },
                            )
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                }

                when (selectedTab) {
                    0 -> {
                        // ── Documents tab ─────────────────────────────────────
                        item {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("Documents", fontSize = 9.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                                TextButton(onClick = { showAddDoc = true }) {
                                    Icon(Icons.Filled.Add, null, modifier = Modifier.size(14.dp), tint = AccentBlue)
                                    Spacer(Modifier.width(4.dp))
                                    Text("Add", fontSize = 11.sp, color = AccentBlue)
                                }
                            }
                        }
                        if (documents.isEmpty()) {
                            item {
                                EmptyHint("No documents yet — add insurance, vignette, ITP…")
                            }
                        } else {
                            items(documents, key = { it.id }) { doc ->
                                DocumentCard(doc = doc, daysUntil = vm.daysUntil(doc.expiryDate),
                                    onEdit = { editingDoc = doc }, onDelete = { vm.deleteDocument(doc) })
                                Spacer(Modifier.height(8.dp))
                            }
                        }
                    }

                    1 -> {
                        // ── Maintenance tab ───────────────────────────────────
                        item {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("Service history", fontSize = 9.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                                TextButton(onClick = { showAddMaint = true }) {
                                    Icon(Icons.Filled.Add, null, modifier = Modifier.size(14.dp), tint = AccentBlue)
                                    Spacer(Modifier.width(4.dp))
                                    Text("Add", fontSize = 11.sp, color = AccentBlue)
                                }
                            }
                        }
                        if (maintenance.isEmpty()) {
                            item { EmptyHint("No maintenance records yet") }
                        } else {
                            items(maintenance, key = { it.id }) { record ->
                                MaintenanceCard(record = record, currentOdo = selectedVehicle!!.odoKm,
                                    onEdit = { editingMaint = record }, onDelete = { vm.deleteMaintenance(record) })
                                Spacer(Modifier.height(8.dp))
                            }
                        }
                    }

                    2 -> {
                        // ── Fuel tab ──────────────────────────────────────────
                        item {
                            FuelStatsBar(avgConsumption = avgConsumption, fuelLog = fuelLog)
                            Spacer(Modifier.height(8.dp))
                        }
                        item {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("FUEL LOG", fontSize = 9.sp, letterSpacing = 2.sp, color = TextSubtle, fontWeight = FontWeight.ExtraBold)
                                TextButton(onClick = { showAddFuel = true }) {
                                    Icon(Icons.Filled.Add, null, modifier = Modifier.size(14.dp), tint = NeonGold)
                                    Spacer(Modifier.width(4.dp))
                                    Text("Add", fontSize = 11.sp, color = NeonGold)
                                }
                            }
                        }
                        if (fuelLog.isEmpty()) {
                            item { EmptyHint("No fuel entries yet") }
                        } else {
                            items(fuelLog, key = { it.id }) { entry ->
                                FuelCard(entry = entry, onDelete = { vm.deleteFuelLog(entry) })
                                Spacer(Modifier.height(8.dp))
                            }
                        }
                    }
                }

                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }

    // ── Dialogs ───────────────────────────────────────────────────────────────
    if (showAddVehicle || editingVehicle != null) {
        VehicleDialog(
            existing = editingVehicle,
            onSave = { make, model, year, plate, fuelType, odo, color, vin, engine, displacement, powerHp, torqueNm, transmission, drivetrain, bodyType, seats, purchaseDate, purchasePrice, notes ->
                vm.saveVehicle(
                    id = editingVehicle?.id ?: UUID.randomUUID().toString(),
                    make = make, model = model, year = year, plate = plate,
                    fuelType = fuelType, odoKm = odo, color = color,
                    vin = vin, engine = engine, displacement = displacement,
                    powerHp = powerHp, torqueNm = torqueNm, transmission = transmission,
                    drivetrain = drivetrain, bodyType = bodyType, seats = seats,
                    purchaseDate = purchaseDate, purchasePrice = purchasePrice, notes = notes,
                )
            },
            onDelete = if (editingVehicle != null) ({ vm.deleteVehicle(editingVehicle!!) }) else null,
            onDismiss = { showAddVehicle = false; editingVehicle = null },
        )
    }
    if (showAddDoc || editingDoc != null) {
        val vehicleId = selectedVehicle?.id ?: return
        DocumentDialog(
            existing = editingDoc,
            vehicleId = vehicleId,
            onSave = { type, label, expiry, docNumber, provider, cost, notes, fileUri, clearFile ->
                vm.saveDocument(
                    id = editingDoc?.id ?: UUID.randomUUID().toString(),
                    vehicleId = vehicleId, type = type, label = label,
                    expiryDate = expiry, docNumber = docNumber, provider = provider,
                    cost = cost, notes = notes, fileUri = fileUri, clearFile = clearFile,
                )
            },
            onDelete = if (editingDoc != null) ({ vm.deleteDocument(editingDoc!!); showAddDoc = false; editingDoc = null }) else null,
            onDismiss = { showAddDoc = false; editingDoc = null },
        )
    }
    if (showAddMaint || editingMaint != null) {
        val vehicleId = selectedVehicle?.id ?: return
        MaintenanceDialog(
            existing = editingMaint,
            vehicleId = vehicleId,
            onSave = { type, label, date, odo, nextDate, nextOdo, cost, workshop, notes ->
                vm.saveMaintenance(
                    id = editingMaint?.id ?: UUID.randomUUID().toString(),
                    vehicleId = vehicleId, type = type, label = label, date = date,
                    odometer = odo, nextDateDue = nextDate, nextOdoKm = nextOdo,
                    cost = cost, workshop = workshop, notes = notes,
                )
            },
            onDismiss = { showAddMaint = false; editingMaint = null },
        )
    }
    if (showAddFuel || editingFuel != null) {
        val vehicleId = selectedVehicle?.id ?: return
        FuelDialog(
            existing = editingFuel,
            vehicleId = vehicleId,
            onSave = { date, odo, liters, pricePerL, total, station, full, notes ->
                vm.saveFuelLog(
                    id = editingFuel?.id ?: UUID.randomUUID().toString(),
                    vehicleId = vehicleId, date = date, odometer = odo, liters = liters,
                    pricePerLiter = pricePerL, totalCost = total, station = station,
                    fullTank = full, notes = notes,
                )
            },
            onDismiss = { showAddFuel = false; editingFuel = null },
        )
    }
}

// ─── Vehicle dashboard ────────────────────────────────────────────────────────

@Composable
private fun VehicleHeader(vehicle: CarVehicle, vehicles: List<CarVehicle>, onSelect: (String) -> Unit) {
    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Brush.linearGradient(listOf(NeonPink.copy(0.1f), NeonCyan.copy(0.05f), NeonPurple.copy(0.06f))))
            .border(1.dp, Brush.linearGradient(listOf(NeonPink.copy(0.5f), NeonCyan.copy(0.3f))), RoundedCornerShape(20.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // ── Title row ────────────────────────────────────────────────────────
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                Modifier.size(52.dp).clip(RoundedCornerShape(14.dp))
                    .background(NeonPink.copy(0.12f))
                    .border(1.dp, NeonPink.copy(0.3f), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) { Text("🚗", fontSize = 26.sp) }
            Column(Modifier.weight(1f)) {
                Text(
                    "${vehicle.make} ${vehicle.model}",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextPrimary,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (vehicle.year > 0) Text("${vehicle.year}", fontSize = 12.sp, color = NeonCyan, fontWeight = FontWeight.SemiBold)
                    if (vehicle.bodyType.isNotBlank()) {
                        Text("·", fontSize = 10.sp, color = TextSubtle)
                        Text(vehicle.bodyType.replaceFirstChar { it.uppercase() }, fontSize = 12.sp, color = TextMuted)
                    }
                }
            }
            if (vehicle.plate.isNotBlank()) {
                Box(
                    Modifier.clip(RoundedCornerShape(8.dp))
                        .background(NeonPink.copy(0.15f))
                        .border(1.dp, NeonPink.copy(0.5f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    Text(vehicle.plate.uppercase(), fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = NeonPink, letterSpacing = 2.sp)
                }
            }
        }

        // ── Divider ──────────────────────────────────────────────────────────
        Box(Modifier.fillMaxWidth().height(1.dp).background(Brush.horizontalGradient(listOf(NeonPink.copy(0.3f), NeonCyan.copy(0.2f), Color.Transparent))))

        // ── Stats grid ───────────────────────────────────────────────────────
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (vehicle.odoKm > 0)
                    DashStat(modifier = Modifier.weight(1f), icon = "📏", label = "ODOMETER", value = "%,d km".format(vehicle.odoKm), color = NeonCyan)
                DashStat(modifier = Modifier.weight(1f), icon = "⛽", label = "FUEL TYPE", value = vehicle.fuelType.replaceFirstChar { it.uppercase() }, color = NeonGold)
                if (vehicle.color.isNotBlank())
                    DashStat(modifier = Modifier.weight(1f), icon = "🎨", label = "COLOR", value = vehicle.color.replaceFirstChar { it.uppercase() }, color = NeonPurple)
            }
            if (vehicle.engine.isNotBlank() || vehicle.powerHp > 0 || vehicle.torqueNm > 0) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (vehicle.engine.isNotBlank())
                        DashStat(modifier = Modifier.weight(1f), icon = "🔩", label = "ENGINE", value = vehicle.engine, color = NeonPink)
                    if (vehicle.powerHp > 0)
                        DashStat(modifier = Modifier.weight(1f), icon = "⚡", label = "POWER", value = "${vehicle.powerHp} HP", color = NeonGold)
                    if (vehicle.torqueNm > 0)
                        DashStat(modifier = Modifier.weight(1f), icon = "🌀", label = "TORQUE", value = "${vehicle.torqueNm} Nm", color = NeonCyan)
                }
            }
            if (vehicle.transmission.isNotBlank() || vehicle.drivetrain.isNotBlank() || vehicle.seats > 0) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (vehicle.transmission.isNotBlank())
                        DashStat(modifier = Modifier.weight(1f), icon = "⚙️", label = "GEARBOX", value = vehicle.transmission.replaceFirstChar { it.uppercase() }, color = NeonCyan)
                    if (vehicle.drivetrain.isNotBlank())
                        DashStat(modifier = Modifier.weight(1f), icon = "🔧", label = "DRIVE", value = vehicle.drivetrain.uppercase(), color = NeonPurple)
                    if (vehicle.seats > 0)
                        DashStat(modifier = Modifier.weight(1f), icon = "💺", label = "SEATS", value = "${vehicle.seats}", color = NeonPink)
                }
            }
            if (vehicle.displacement.isNotBlank() || vehicle.purchaseDate.isNotBlank()) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (vehicle.displacement.isNotBlank())
                        DashStat(modifier = Modifier.weight(1f), icon = "🔬", label = "DISPLACEMENT", value = vehicle.displacement, color = NeonGold)
                    if (vehicle.purchaseDate.isNotBlank())
                        DashStat(modifier = Modifier.weight(1f), icon = "📅", label = "PURCHASED", value = vehicle.purchaseDate, color = TextMuted)
                    if (vehicle.purchasePrice > 0)
                        DashStat(modifier = Modifier.weight(1f), icon = "💶", label = "PAID", value = "%,d lei".format(vehicle.purchasePrice.toInt()), color = NeonCyan)
                }
            }
        }

        // ── VIN ─────────────────────────────────────────────────────────────
        if (vehicle.vin.isNotBlank()) {
            Box(Modifier.fillMaxWidth().height(1.dp).background(BorderSubtle))
            Row(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(BgPrimary.copy(0.6f))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("🔢", fontSize = 12.sp)
                Text("VIN:", fontSize = 10.sp, color = TextSubtle, fontWeight = FontWeight.Bold)
                Text(vehicle.vin.uppercase(), fontSize = 10.sp, color = TextMuted, letterSpacing = 0.5.sp)
            }
        }

        // ── Vehicle selector if multiple cars ─────────────────────────────
        if (vehicles.size > 1) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                vehicles.forEach { v ->
                    val selected = v.id == vehicle.id
                    Box(
                        Modifier.clip(RoundedCornerShape(20.dp))
                            .background(if (selected) NeonPink.copy(0.15f) else BgCard)
                            .border(1.dp, if (selected) NeonPink.copy(0.5f) else BorderSubtle, RoundedCornerShape(20.dp))
                            .clickable { onSelect(v.id) }
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                    ) {
                        Text("${v.make} ${v.model}", fontSize = 10.sp, color = if (selected) NeonPink else TextMuted)
                    }
                }
            }
        }
    }
}

@Composable
private fun DashStat(modifier: Modifier, icon: String, label: String, value: String, color: Color) {
    Column(
        modifier
            .clip(RoundedCornerShape(10.dp))
            .background(BgPrimary.copy(0.5f))
            .border(1.dp, color.copy(0.2f), RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(icon, fontSize = 11.sp)
            Text(label, fontSize = 7.sp, color = color.copy(0.7f), fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
        }
        Text(value, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary, maxLines = 1)
    }
}

// ─── Document card ────────────────────────────────────────────────────────────

@Composable
private fun DocumentCard(doc: CarDocument, daysUntil: Int, onEdit: () -> Unit, onDelete: () -> Unit) {
    val context = LocalContext.current
    val hasExpiry = doc.expiryDate.isNotBlank()
    val (urgencyColor, urgencyLabel) = when {
        !hasExpiry      -> NeonCyan.copy(0.6f) to "No expiry"
        daysUntil < 0   -> AccentRed to "EXPIRED"
        daysUntil <= 7  -> AccentRed to "$daysUntil days left"
        daysUntil <= 30 -> NeonGold  to "$daysUntil days left"
        else             -> NeonCyan.copy(0.8f) to "$daysUntil days"
    }
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(BgCard)
            .border(1.dp, urgencyColor.copy(0.3f), RoundedCornerShape(12.dp))
            .clickable(onClick = onEdit)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(docTypeIcon(doc.type), fontSize = 22.sp)
        Column(Modifier.weight(1f)) {
            Text(doc.label.ifBlank { docTypeLabel(doc.type) }, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = TextPrimary)
            if (hasExpiry) Text("Expires ${doc.expiryDate}", fontSize = 11.sp, color = TextMuted)
            if (doc.docNumber.isNotBlank()) Text("# ${doc.docNumber}", fontSize = 10.sp, color = TextSubtle, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
            if (doc.provider.isNotBlank()) Text(doc.provider, fontSize = 10.sp, color = TextSubtle)
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (hasExpiry || daysUntil < 0) {
                Box(
                    Modifier.clip(RoundedCornerShape(20.dp))
                        .background(urgencyColor.copy(0.12f))
                        .border(1.dp, urgencyColor.copy(0.4f), RoundedCornerShape(20.dp))
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text(urgencyLabel, fontSize = 9.sp, color = urgencyColor, fontWeight = FontWeight.Bold)
                }
            }
            if (doc.cost > 0) Text("${"%,.2f".format(doc.cost)} lei", fontSize = 10.sp, color = TextSubtle)
        }
        if (doc.fileData != null) {
            IconButton(onClick = { openDocFile(context, doc) }, modifier = Modifier.size(28.dp)) {
                Text("📎", fontSize = 14.sp)
            }
        }
        IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
            Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(0.4f), modifier = Modifier.size(14.dp))
        }
    }
}

// ─── Maintenance card ─────────────────────────────────────────────────────────

@Composable
private fun MaintenanceCard(record: CarMaintenance, currentOdo: Int, onEdit: () -> Unit, onDelete: () -> Unit) {
    val kmUntilNext = if (record.nextOdoKm > 0 && currentOdo > 0) record.nextOdoKm - currentOdo else Int.MAX_VALUE
    val overdue = kmUntilNext < 0 || (record.nextDateDue.isNotBlank() && record.nextDateDue < LocalDate.now().toString())
    val warnColor = if (overdue) AccentRed else if (kmUntilNext < 1000) NeonGold else NeonCyan.copy(0.7f)

    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(BgCard)
            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
            .clickable(onClick = onEdit)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(maintTypeIcon(record.type), fontSize = 22.sp)
        Column(Modifier.weight(1f)) {
            Text(record.label, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = TextPrimary)
            Text(record.date, fontSize = 11.sp, color = TextMuted)
            if (record.odometer > 0) Text("At ${"%,d".format(record.odometer)} km", fontSize = 10.sp, color = TextSubtle)
            if (record.workshop.isNotBlank()) Text(record.workshop, fontSize = 10.sp, color = TextSubtle)
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (record.nextDateDue.isNotBlank() || record.nextOdoKm > 0) {
                Box(
                    Modifier.clip(RoundedCornerShape(6.dp))
                        .background(warnColor.copy(0.1f))
                        .border(1.dp, warnColor.copy(0.4f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                ) {
                    val nextLabel = when {
                        record.nextOdoKm > 0 && currentOdo > 0 -> "in ${"%,d".format(kmUntilNext)} km"
                        record.nextOdoKm > 0 -> "at ${"%,d".format(record.nextOdoKm)} km"
                        record.nextDateDue.isNotBlank() -> record.nextDateDue
                        else -> "—"
                    }
                    Text("Next: $nextLabel", fontSize = 9.sp, color = warnColor, fontWeight = FontWeight.Bold)
                }
            }
            if (record.cost > 0) Text("${"%,.2f".format(record.cost)} lei", fontSize = 10.sp, color = TextSubtle)
        }
        IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
            Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(0.4f), modifier = Modifier.size(14.dp))
        }
    }
}

// ─── Fuel stats bar ───────────────────────────────────────────────────────────

@Composable
private fun FuelStatsBar(avgConsumption: Double?, fuelLog: List<CarFuelLog>) {
    val totalSpent = fuelLog.sumOf { it.totalCost }
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(BgCard)
            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceAround,
    ) {
        StatBox("Fills", fuelLog.size.toString(), NeonGold)
        StatBox("Avg", avgConsumption?.let { "%.1f L/100".format(it) } ?: "—", NeonCyan)
        StatBox("Spent", if (totalSpent > 0) "%,.0f lei".format(totalSpent) else "—", NeonPink)
    }
}

@Composable
private fun StatBox(label: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = color)
        Text(label, fontSize = 9.sp, color = TextSubtle, letterSpacing = 1.sp)
    }
}

// ─── Fuel card ────────────────────────────────────────────────────────────────

@Composable
private fun FuelCard(entry: CarFuelLog, onDelete: () -> Unit) {
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(BgCard)
            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("⛽", fontSize = 22.sp)
        Column(Modifier.weight(1f)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(entry.date, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                if (entry.fullTank) InfoChip("Full")
            }
            if (entry.odometer > 0) Text("${"%,d".format(entry.odometer)} km", fontSize = 11.sp, color = TextMuted)
            if (entry.station.isNotBlank()) Text(entry.station, fontSize = 10.sp, color = TextSubtle)
        }
        Column(horizontalAlignment = Alignment.End) {
            if (entry.liters > 0) Text("%.2f L".format(entry.liters), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold, color = NeonGold)
            if (entry.pricePerLiter > 0) Text("%.3f lei/L".format(entry.pricePerLiter), fontSize = 10.sp, color = TextMuted)
            if (entry.totalCost > 0) Text("%.2f lei".format(entry.totalCost), fontSize = 11.sp, color = NeonPink)
        }
        IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
            Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(0.4f), modifier = Modifier.size(14.dp))
        }
    }
}

// ─── Helper composables ───────────────────────────────────────────────────────

@Composable
private fun InfoChip(text: String) {
    Box(
        Modifier.clip(RoundedCornerShape(20.dp))
            .background(BgCard)
            .border(1.dp, BorderSubtle, RoundedCornerShape(20.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Text(text, fontSize = 9.sp, color = TextMuted)
    }
}

@Composable
private fun EmptyHint(text: String) {
    Box(Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.bodySmall, color = TextSubtle)
    }
}

// ─── Dialogs ─────────────────────────────────────────────────────────────────

private val BODY_TYPES     = listOf("sedan", "hatchback", "suv", "coupe", "wagon", "van", "pickup", "convertible")
private val TRANSMISSIONS  = listOf("manual", "automatic", "dsg", "cvt")
private val DRIVETRAINS    = listOf("fwd", "rwd", "awd", "4wd")

@Composable
private fun VehicleDialog(
    existing: CarVehicle?,
    onSave: (make: String, model: String, year: Int, plate: String, fuelType: String, odo: Int, color: String,
             vin: String, engine: String, displacement: String, powerHp: Int, torqueNm: Int,
             transmission: String, drivetrain: String, bodyType: String, seats: Int,
             purchaseDate: String, purchasePrice: Double, notes: String) -> Unit,
    onDelete: (() -> Unit)?,
    onDismiss: () -> Unit,
) {
    var make          by remember { mutableStateOf(existing?.make ?: "") }
    var model         by remember { mutableStateOf(existing?.model ?: "") }
    var year          by remember { mutableStateOf(existing?.year?.takeIf { it > 0 }?.toString() ?: "") }
    var plate         by remember { mutableStateOf(existing?.plate ?: "") }
    var fuelType      by remember { mutableStateOf(existing?.fuelType ?: "petrol") }
    var odo           by remember { mutableStateOf(existing?.odoKm?.takeIf { it > 0 }?.toString() ?: "") }
    var color         by remember { mutableStateOf(existing?.color ?: "") }
    var vin           by remember { mutableStateOf(existing?.vin ?: "") }
    var engine        by remember { mutableStateOf(existing?.engine ?: "") }
    var displacement  by remember { mutableStateOf(existing?.displacement ?: "") }
    var powerHp       by remember { mutableStateOf(existing?.powerHp?.takeIf { it > 0 }?.toString() ?: "") }
    var torqueNm      by remember { mutableStateOf(existing?.torqueNm?.takeIf { it > 0 }?.toString() ?: "") }
    var transmission  by remember { mutableStateOf(existing?.transmission ?: "") }
    var drivetrain    by remember { mutableStateOf(existing?.drivetrain ?: "") }
    var bodyType      by remember { mutableStateOf(existing?.bodyType ?: "") }
    var seats         by remember { mutableStateOf(existing?.seats?.takeIf { it > 0 }?.toString() ?: "") }
    var purchaseDate  by remember { mutableStateOf(existing?.purchaseDate ?: "") }
    var purchasePrice by remember { mutableStateOf(existing?.purchasePrice?.takeIf { it > 0 }?.toString() ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor  = BgCard,
        shape           = RoundedCornerShape(18.dp),
        title           = { Text(if (existing != null) "Edit Vehicle" else "Add Vehicle", color = TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {

                Text("BASIC INFO", fontSize = 8.sp, letterSpacing = 2.sp, color = NeonPink.copy(0.7f), fontWeight = FontWeight.ExtraBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = make, onValueChange = { make = it }, label = { Text("Make") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true)
                    OutlinedTextField(value = model, onValueChange = { model = it }, label = { Text("Model") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = year, onValueChange = { year = it }, label = { Text("Year") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                    OutlinedTextField(value = plate, onValueChange = { plate = it }, label = { Text("Plate") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = color, onValueChange = { color = it }, label = { Text("Color") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true)
                    OutlinedTextField(value = odo, onValueChange = { odo = it }, label = { Text("Odometer km") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                }
                OutlinedTextField(value = vin, onValueChange = { vin = it }, label = { Text("VIN / Chassis Number") }, modifier = Modifier.fillMaxWidth(), colors = carFieldColors(), singleLine = true)

                // Fuel type
                Text("FUEL TYPE", fontSize = 8.sp, letterSpacing = 2.sp, color = NeonGold.copy(0.7f), fontWeight = FontWeight.ExtraBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                    FUEL_TYPES.forEach { ft ->
                        val sel = fuelType == ft
                        Box(Modifier.clip(RoundedCornerShape(20.dp)).background(if (sel) NeonGold.copy(0.15f) else BgPrimary).border(1.dp, if (sel) NeonGold.copy(0.5f) else BorderSubtle, RoundedCornerShape(20.dp)).clickable { fuelType = ft }.padding(horizontal = 12.dp, vertical = 6.dp)) {
                            Text(ft.replaceFirstChar { it.uppercase() }, fontSize = 11.sp, color = if (sel) NeonGold else TextMuted)
                        }
                    }
                }

                // Body type
                Text("BODY TYPE", fontSize = 8.sp, letterSpacing = 2.sp, color = NeonCyan.copy(0.7f), fontWeight = FontWeight.ExtraBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                    BODY_TYPES.forEach { bt ->
                        val sel = bodyType == bt
                        Box(Modifier.clip(RoundedCornerShape(20.dp)).background(if (sel) NeonCyan.copy(0.12f) else BgPrimary).border(1.dp, if (sel) NeonCyan.copy(0.5f) else BorderSubtle, RoundedCornerShape(20.dp)).clickable { bodyType = bt }.padding(horizontal = 10.dp, vertical = 6.dp)) {
                            Text(bt.replaceFirstChar { it.uppercase() }, fontSize = 11.sp, color = if (sel) NeonCyan else TextMuted)
                        }
                    }
                }

                Text("ENGINE", fontSize = 8.sp, letterSpacing = 2.sp, color = NeonPink.copy(0.7f), fontWeight = FontWeight.ExtraBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = engine, onValueChange = { engine = it }, label = { Text("Engine (e.g. 2.0 TDI)") }, modifier = Modifier.weight(1.5f), colors = carFieldColors(), singleLine = true)
                    OutlinedTextField(value = displacement, onValueChange = { displacement = it }, label = { Text("Displacement") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = powerHp, onValueChange = { powerHp = it }, label = { Text("Power (HP)") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                    OutlinedTextField(value = torqueNm, onValueChange = { torqueNm = it }, label = { Text("Torque (Nm)") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                }

                // Transmission
                Text("TRANSMISSION", fontSize = 8.sp, letterSpacing = 2.sp, color = NeonPurple.copy(0.7f), fontWeight = FontWeight.ExtraBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                    TRANSMISSIONS.forEach { t ->
                        val sel = transmission == t
                        Box(Modifier.clip(RoundedCornerShape(20.dp)).background(if (sel) NeonPurple.copy(0.12f) else BgPrimary).border(1.dp, if (sel) NeonPurple.copy(0.5f) else BorderSubtle, RoundedCornerShape(20.dp)).clickable { transmission = t }.padding(horizontal = 10.dp, vertical = 6.dp)) {
                            Text(t.uppercase(), fontSize = 11.sp, color = if (sel) NeonPurple else TextMuted)
                        }
                    }
                }

                // Drivetrain
                Text("DRIVETRAIN", fontSize = 8.sp, letterSpacing = 2.sp, color = NeonPurple.copy(0.7f), fontWeight = FontWeight.ExtraBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    DRIVETRAINS.forEach { d ->
                        val sel = drivetrain == d
                        Box(Modifier.clip(RoundedCornerShape(20.dp)).background(if (sel) NeonPurple.copy(0.12f) else BgPrimary).border(1.dp, if (sel) NeonPurple.copy(0.5f) else BorderSubtle, RoundedCornerShape(20.dp)).clickable { drivetrain = d }.padding(horizontal = 10.dp, vertical = 6.dp)) {
                            Text(d.uppercase(), fontSize = 11.sp, color = if (sel) NeonPurple else TextMuted)
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = seats, onValueChange = { seats = it }, label = { Text("Seats") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                    OutlinedTextField(value = purchaseDate, onValueChange = { purchaseDate = it }, label = { Text("Purchase date") }, modifier = Modifier.weight(1.5f), colors = carFieldColors(), singleLine = true)
                }
                OutlinedTextField(value = purchasePrice, onValueChange = { purchasePrice = it }, label = { Text("Purchase price (lei)") }, modifier = Modifier.fillMaxWidth(), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))

                if (onDelete != null) {
                    Spacer(Modifier.height(4.dp))
                    TextButton(onClick = { onDelete(); onDismiss() }, modifier = Modifier.fillMaxWidth()) {
                        Text("Delete Vehicle", color = AccentRed, fontSize = 12.sp)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (make.isNotBlank() && model.isNotBlank()) {
                        onSave(make, model, year.toIntOrNull() ?: 0, plate, fuelType, odo.toIntOrNull() ?: 0, color,
                            vin, engine, displacement, powerHp.toIntOrNull() ?: 0, torqueNm.toIntOrNull() ?: 0,
                            transmission, drivetrain, bodyType, seats.toIntOrNull() ?: 0,
                            purchaseDate, purchasePrice.toDoubleOrNull() ?: 0.0, "")
                        onDismiss()
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = NeonPink),
                shape  = RoundedCornerShape(10.dp),
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } },
    )
}

@Composable
private fun DocumentDialog(
    existing: CarDocument?,
    vehicleId: String,
    onSave: (type: String, label: String, expiry: String, docNumber: String, provider: String, cost: Double, notes: String, fileUri: Uri?, clearFile: Boolean) -> Unit,
    onDelete: (() -> Unit)?,
    onDismiss: () -> Unit,
) {
    var type      by remember { mutableStateOf(existing?.type ?: "insurance") }
    var label     by remember { mutableStateOf(existing?.label ?: "") }
    var expiry    by remember { mutableStateOf(existing?.expiryDate ?: "") }
    var docNumber by remember { mutableStateOf(existing?.docNumber ?: "") }
    var provider  by remember { mutableStateOf(existing?.provider ?: "") }
    var cost      by remember { mutableStateOf(existing?.cost?.takeIf { it > 0 }?.toString() ?: "") }
    var notes     by remember { mutableStateOf(existing?.notes ?: "") }

    // File state
    var pickedUri   by remember { mutableStateOf<Uri?>(null) }
    var pickedName  by remember { mutableStateOf<String?>(null) }
    var fileCleared by remember { mutableStateOf(false) }
    val hasExistingFile = existing?.fileData != null && !fileCleared
    val fileLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) { pickedUri = uri; pickedName = uri.lastPathSegment?.substringAfterLast('/'); fileCleared = false }
    }

    val isPersonal = type in PERSONAL_DOC_TYPES
    LaunchedEffect(type) { if (label.isBlank() || label == docTypeLabel(type)) label = docTypeLabel(type) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor  = BgCard,
        shape           = RoundedCornerShape(18.dp),
        title           = { Text(if (existing != null) "Edit Document" else "Add Document", color = TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Type selector
                Text("TYPE", fontSize = 8.sp, letterSpacing = 2.sp, color = NeonPink.copy(0.7f), fontWeight = FontWeight.ExtraBold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                    DOC_TYPES.forEach { (t, tLabel) ->
                        Box(
                            Modifier.clip(RoundedCornerShape(20.dp))
                                .background(if (type == t) NeonPink.copy(0.15f) else BgPrimary)
                                .border(1.dp, if (type == t) NeonPink.copy(0.5f) else BorderSubtle, RoundedCornerShape(20.dp))
                                .clickable { type = t; label = tLabel }
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                        ) { Text(tLabel, fontSize = 11.sp, color = if (type == t) NeonPink else TextMuted) }
                    }
                }

                OutlinedTextField(value = label, onValueChange = { label = it }, label = { Text("Label") }, modifier = Modifier.fillMaxWidth(), colors = carFieldColors(), singleLine = true)

                OutlinedTextField(
                    value = expiry, onValueChange = { expiry = it },
                    label = { Text(if (isPersonal) "Expiry Date (optional)" else "Expiry Date (YYYY-MM-DD)") },
                    modifier = Modifier.fillMaxWidth(), colors = carFieldColors(), singleLine = true,
                    placeholder = { Text(LocalDate.now().plusYears(1).toString(), color = TextSubtle) },
                )

                OutlinedTextField(value = docNumber, onValueChange = { docNumber = it }, label = { Text("Document / Policy Number") }, modifier = Modifier.fillMaxWidth(), colors = carFieldColors(), singleLine = true)
                OutlinedTextField(value = provider, onValueChange = { provider = it }, label = { Text("Provider / Issuer") }, modifier = Modifier.fillMaxWidth(), colors = carFieldColors(), singleLine = true)
                OutlinedTextField(value = cost, onValueChange = { cost = it }, label = { Text("Cost (lei)") }, modifier = Modifier.fillMaxWidth(), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))

                // ── File attachment ───────────────────────────────────────────
                Text("ATTACHMENT", fontSize = 8.sp, letterSpacing = 2.sp, color = NeonCyan.copy(0.7f), fontWeight = FontWeight.ExtraBold)
                val fileLabel = when {
                    pickedUri != null  -> pickedName ?: "File selected"
                    hasExistingFile    -> existing?.fileName ?: "File attached"
                    else               -> null
                }
                if (fileLabel != null) {
                    Row(
                        Modifier.fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(NeonCyan.copy(0.07f))
                            .border(1.dp, NeonCyan.copy(0.3f), RoundedCornerShape(10.dp))
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text("📎", fontSize = 14.sp)
                        Text(fileLabel, fontSize = 11.sp, color = NeonCyan, modifier = Modifier.weight(1f), maxLines = 1)
                        IconButton(onClick = { pickedUri = null; fileCleared = true }, modifier = Modifier.size(20.dp)) {
                            Icon(Icons.Filled.Close, null, tint = TextMuted, modifier = Modifier.size(14.dp))
                        }
                    }
                } else {
                    OutlinedButton(
                        onClick = { fileLauncher.launch(arrayOf("application/pdf", "image/*")) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, NeonCyan.copy(0.4f)),
                    ) {
                        Icon(Icons.Filled.AttachFile, null, tint = NeonCyan, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Attach PDF or Image", fontSize = 12.sp, color = NeonCyan)
                    }
                }

                if (onDelete != null) {
                    Spacer(Modifier.height(4.dp))
                    TextButton(onClick = { onDelete(); onDismiss() }, modifier = Modifier.fillMaxWidth()) {
                        Text("Delete Document", color = AccentRed, fontSize = 12.sp)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val canSave = isPersonal || expiry.isNotBlank()
                    if (canSave) {
                        onSave(type, label.ifBlank { docTypeLabel(type) }, expiry, docNumber, provider,
                            cost.toDoubleOrNull() ?: 0.0, notes, pickedUri, fileCleared)
                        onDismiss()
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = NeonPink),
                shape  = RoundedCornerShape(10.dp),
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } },
    )
}

@Composable
private fun MaintenanceDialog(
    existing: CarMaintenance?,
    vehicleId: String,
    onSave: (type: String, label: String, date: String, odo: Int, nextDate: String, nextOdo: Int, cost: Double, workshop: String, notes: String) -> Unit,
    onDismiss: () -> Unit,
) {
    var type     by remember { mutableStateOf(existing?.type ?: "oil") }
    var label    by remember { mutableStateOf(existing?.label ?: "") }
    var date     by remember { mutableStateOf(existing?.date ?: LocalDate.now().toString()) }
    var odo      by remember { mutableStateOf(existing?.odometer?.takeIf { it > 0 }?.toString() ?: "") }
    var nextDate by remember { mutableStateOf(existing?.nextDateDue ?: "") }
    var nextOdo  by remember { mutableStateOf(existing?.nextOdoKm?.takeIf { it > 0 }?.toString() ?: "") }
    var cost     by remember { mutableStateOf(existing?.cost?.takeIf { it > 0 }?.toString() ?: "") }
    var workshop by remember { mutableStateOf(existing?.workshop ?: "") }
    var notes    by remember { mutableStateOf(existing?.notes ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor  = BgCard,
        shape           = RoundedCornerShape(18.dp),
        title           = { Text(if (existing != null) "Edit Record" else "Add Service", color = TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Type selector
                Text("Service Type", fontSize = 11.sp, color = TextSubtle)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                    MAINT_TYPES.forEach { (t, tLabel) ->
                        Box(
                            Modifier.clip(RoundedCornerShape(20.dp))
                                .background(if (type == t) NeonCyan.copy(0.15f) else BgPrimary)
                                .border(1.dp, if (type == t) NeonCyan.copy(0.5f) else BorderSubtle, RoundedCornerShape(20.dp))
                                .clickable { type = t; if (label.isBlank()) label = tLabel }
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                        ) { Text(tLabel, fontSize = 11.sp, color = if (type == t) NeonCyan else TextMuted) }
                    }
                }
                OutlinedTextField(value = label, onValueChange = { label = it }, label = { Text("Label") }, modifier = Modifier.fillMaxWidth(), colors = carFieldColors(), singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = date, onValueChange = { date = it }, label = { Text("Date done") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true)
                    OutlinedTextField(value = odo, onValueChange = { odo = it }, label = { Text("Odometer km") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = nextDate, onValueChange = { nextDate = it }, label = { Text("Next date") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true)
                    OutlinedTextField(value = nextOdo, onValueChange = { nextOdo = it }, label = { Text("Next km") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = cost, onValueChange = { cost = it }, label = { Text("Cost (lei)") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                    OutlinedTextField(value = workshop, onValueChange = { workshop = it }, label = { Text("Workshop") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (date.isNotBlank()) {
                        onSave(type, label.ifBlank { MAINT_TYPES.firstOrNull { it.first == type }?.second ?: type },
                            date, odo.toIntOrNull() ?: 0, nextDate, nextOdo.toIntOrNull() ?: 0,
                            cost.toDoubleOrNull() ?: 0.0, workshop, notes)
                        onDismiss()
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = NeonCyan.copy(0.8f)),
                shape  = RoundedCornerShape(10.dp),
            ) { Text("Save", color = BgPrimary) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } },
    )
}

@Composable
private fun FuelDialog(
    existing: CarFuelLog?,
    vehicleId: String,
    onSave: (date: String, odo: Int, liters: Double, pricePerL: Double, total: Double, station: String, full: Boolean, notes: String) -> Unit,
    onDismiss: () -> Unit,
) {
    var date       by remember { mutableStateOf(existing?.date ?: LocalDate.now().toString()) }
    var odo        by remember { mutableStateOf(existing?.odometer?.takeIf { it > 0 }?.toString() ?: "") }
    var liters     by remember { mutableStateOf(existing?.liters?.takeIf { it > 0 }?.toString() ?: "") }
    var pricePerL  by remember { mutableStateOf(existing?.pricePerLiter?.takeIf { it > 0 }?.toString() ?: "") }
    var total      by remember { mutableStateOf(existing?.totalCost?.takeIf { it > 0 }?.toString() ?: "") }
    var station    by remember { mutableStateOf(existing?.station ?: "") }
    var fullTank   by remember { mutableStateOf(existing?.fullTank ?: true) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor  = BgCard,
        shape           = RoundedCornerShape(18.dp),
        title           = { Text("Add Fuel Entry", color = TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = date, onValueChange = { date = it }, label = { Text("Date") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true)
                    OutlinedTextField(value = odo, onValueChange = { odo = it }, label = { Text("Odometer km") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = liters, onValueChange = {
                        liters = it
                        val l = it.toDoubleOrNull(); val p = pricePerL.toDoubleOrNull()
                        if (l != null && p != null) total = "%.2f".format(l * p)
                    }, label = { Text("Liters") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                    OutlinedTextField(value = pricePerL, onValueChange = {
                        pricePerL = it
                        val l = liters.toDoubleOrNull(); val p = it.toDoubleOrNull()
                        if (l != null && p != null) total = "%.2f".format(l * p)
                    }, label = { Text("Price/L") }, modifier = Modifier.weight(1f), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                }
                OutlinedTextField(value = total, onValueChange = { total = it }, label = { Text("Total cost (lei)") }, modifier = Modifier.fillMaxWidth(), colors = carFieldColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                OutlinedTextField(value = station, onValueChange = { station = it }, label = { Text("Station") }, modifier = Modifier.fillMaxWidth(), colors = carFieldColors(), singleLine = true)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Checkbox(checked = fullTank, onCheckedChange = { fullTank = it },
                        colors = CheckboxDefaults.colors(checkedColor = NeonGold, uncheckedColor = TextMuted))
                    Text("Full tank", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(date, odo.toIntOrNull() ?: 0, liters.toDoubleOrNull() ?: 0.0,
                        pricePerL.toDoubleOrNull() ?: 0.0, total.toDoubleOrNull() ?: 0.0,
                        station, fullTank, "")
                    onDismiss()
                },
                colors = ButtonDefaults.buttonColors(containerColor = NeonGold),
                shape  = RoundedCornerShape(10.dp),
            ) { Text("Save", color = BgPrimary) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } },
    )
}

@Composable
private fun carFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor   = NeonPink,
    unfocusedBorderColor = BorderSubtle,
    focusedTextColor     = TextPrimary,
    unfocusedTextColor   = TextPrimary,
    focusedLabelColor    = NeonPink,
    unfocusedLabelColor  = TextMuted,
    cursorColor          = NeonPink,
)
