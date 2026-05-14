package ro.b4it.homer.ui.screens.joey

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.theme.*

@Composable
fun JoeyScreen(vm: JoeyViewModel = hiltViewModel()) {
    val messages  by vm.messages.collectAsStateWithLifecycle()
    val input     by vm.input.collectAsStateWithLifecycle()
    val loading   by vm.loading.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        // Header
        Row(
            Modifier.fillMaxWidth().padding(16.dp, 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Joey AI", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Box(
                Modifier.clip(RoundedCornerShape(20)).background(AccentBlue.copy(0.15f)).padding(horizontal = 10.dp, vertical = 4.dp)
            ) { Text("ring-2.6-1t", style = MaterialTheme.typography.labelSmall, color = AccentBlue) }
            IconButton(onClick = vm::clearChat) { Icon(Icons.Filled.Delete, null, tint = TextMuted) }
        }

        // Messages
        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(messages) { msg ->
                ChatBubble(msg)
            }
            if (loading) {
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
                        Box(
                            Modifier.clip(RoundedCornerShape(12.dp, 12.dp, 12.dp, 4.dp))
                                .background(BgCard).padding(12.dp, 8.dp)
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = AccentBlue, strokeWidth = 2.dp)
                        }
                    }
                }
            }
        }

        // Input row
        HomerCard {
            Row(
                Modifier.fillMaxWidth().padding(8.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                OutlinedTextField(
                    value = input,
                    onValueChange = vm::setInput,
                    placeholder = { Text("Ask Joey…", color = TextSubtle) },
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp, max = 120.dp),
                    maxLines = 4,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
                        focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
                    ),
                )
                Spacer(Modifier.width(6.dp))
                IconButton(
                    onClick = vm::send,
                    enabled = input.isNotBlank() && !loading,
                    modifier = Modifier.align(Alignment.Bottom),
                ) {
                    Icon(Icons.Filled.Send, "Send", tint = if (input.isNotBlank()) AccentBlue else TextSubtle)
                }
            }
        }
    }
}

@Composable
fun ChatBubble(msg: ChatMessage) {
    val isUser = msg.role == "user"
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Box(
            Modifier
                .widthIn(max = 300.dp)
                .clip(
                    if (isUser) RoundedCornerShape(12.dp, 4.dp, 12.dp, 12.dp)
                    else RoundedCornerShape(4.dp, 12.dp, 12.dp, 12.dp)
                )
                .background(if (isUser) AccentBlue else BgCard)
                .padding(12.dp, 8.dp)
        ) {
            Text(
                msg.content,
                style = MaterialTheme.typography.bodySmall,
                color = if (isUser) TextPrimary else TextPrimary,
            )
        }
    }
}
