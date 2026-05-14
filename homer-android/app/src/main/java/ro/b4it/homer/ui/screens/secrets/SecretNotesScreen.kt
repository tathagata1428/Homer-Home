package ro.b4it.homer.ui.screens.secrets

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.theme.*

@Composable
fun SecretNotesScreen(vm: SecretNotesViewModel = hiltViewModel()) {
    val personalText by vm.personalText.collectAsStateWithLifecycle()
    val workText     by vm.workText.collectAsStateWithLifecycle()
    var tab          by remember { mutableStateOf(0) }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 12.dp)) {
            Text("Secret Notes", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }

        TabRow(selectedTabIndex = tab, containerColor = BgCard) {
            listOf("Personal", "Work").forEachIndexed { i, label ->
                Tab(selected = tab == i, onClick = { tab = i }, text = { Text(label, style = MaterialTheme.typography.labelMedium) })
            }
        }

        val (text, setter) = when (tab) {
            0    -> personalText to vm::setPersonalText
            else -> workText to vm::setWorkText
        }

        OutlinedTextField(
            value = text,
            onValueChange = setter,
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            placeholder = { Text("Write your private notes here…", color = TextSubtle) },
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = AccentBlue,
                unfocusedBorderColor = BorderDefault,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary,
                cursorColor = AccentBlue,
            ),
        )
    }
}
