package ro.b4it.homer.ui.screens.account

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*

@Composable
fun AccountScreen(vm: AccountViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()

    Column(
        Modifier
            .fillMaxSize()
            .background(BgPrimary)
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Account", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

        if (state.authUser != null) {
            // Signed in card
            HomerCard {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(
                            Modifier.size(48.dp).clip(RoundedCornerShape(24.dp)).background(AccentBlue.copy(0.2f)),
                            contentAlignment = Alignment.Center,
                        ) { Text("👤", fontSize = 24.sp) }
                        Column {
                            Text(state.authUser ?: "", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                            if (state.supabaseEmail != null)
                                Text(state.supabaseEmail!!, style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        }
                    }
                    if (state.isBogdan) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Filled.Sync, null, tint = AccentGreen, modifier = Modifier.size(16.dp))
                            Text("Supabase sync enabled", style = MaterialTheme.typography.labelSmall, color = AccentGreen)
                        }
                    }
                    Button(
                        onClick = vm::signOut,
                        colors = ButtonDefaults.buttonColors(containerColor = AccentRed.copy(0.15f), contentColor = AccentRed),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Filled.Logout, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Sign Out")
                    }
                }
            }
        } else {
            // Sign in card
            HomerCard {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Sign In", style = MaterialTheme.typography.titleSmall, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                    Text(
                        "Enter your Homer username and password.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                    )
                    OutlinedTextField(
                        value = state.signInUsername,
                        onValueChange = vm::setUsername,
                        label = { Text("Username") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
                            focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue,
                        ),
                    )
                    OutlinedTextField(
                        value = state.signInPassword,
                        onValueChange = vm::setPassword,
                        label = { Text("Password") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
                            focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue,
                        ),
                    )
                    if (state.error != null) {
                        Text(state.error!!, style = MaterialTheme.typography.labelSmall, color = AccentRed)
                    }
                    Button(
                        onClick = vm::signIn,
                        enabled = !state.loading,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = AccentBlue),
                    ) {
                        if (state.loading) CircularProgressIndicator(Modifier.size(18.dp), color = androidx.compose.ui.graphics.Color.White, strokeWidth = 2.dp)
                        else Text("Sign In")
                    }
                }
            }
        }

        // Local data info card
        HomerCard {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Local Storage", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(
                    "All data is stored locally on device. Notes, habits, tasks, and vault data persist even without an account.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted,
                )
            }
        }
    }
}
