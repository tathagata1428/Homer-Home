package ro.b4it.homer.ui.screens.ledger

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import ro.b4it.homer.data.local.entity.Expense
import ro.b4it.homer.ui.screens.home.HomerCard
import ro.b4it.homer.ui.screens.home.SmallChip
import ro.b4it.homer.ui.theme.*
import java.time.LocalDate
import java.util.UUID

@Composable
fun LedgerScreen(vm: LedgerViewModel = hiltViewModel()) {
    val expenses by vm.expenses.collectAsStateWithLifecycle(emptyList())
    val budgets  by vm.budgets.collectAsStateWithLifecycle(emptyList())
    var showAdd  by remember { mutableStateOf(false) }
    var tab      by remember { mutableStateOf(0) }  // 0=Transactions, 1=Budgets

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        // Header + tabs
        Row(Modifier.fillMaxWidth().padding(16.dp, 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Expense Ledger", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            IconButton(onClick = { showAdd = true }) { Icon(Icons.Filled.Add, null, tint = AccentBlue) }
        }
        TabRow(selectedTabIndex = tab, containerColor = BgCard) {
            listOf("Transactions", "Budgets").forEachIndexed { i, label ->
                Tab(selected = tab == i, onClick = { tab = i }, text = { Text(label, style = MaterialTheme.typography.labelMedium) })
            }
        }

        when (tab) {
            0 -> TransactionsTab(expenses)
            1 -> BudgetsTab(expenses, budgets)
        }
    }

    if (showAdd) {
        AddExpenseDialog(
            onAdd = { desc, amount, cat, date, type ->
                vm.addExpense(Expense(id = UUID.randomUUID().toString(), description = desc, amount = amount, category = cat, date = date, type = type))
                showAdd = false
            },
            onDismiss = { showAdd = false },
        )
    }
}

@Composable
fun TransactionsTab(expenses: List<Expense>) {
    val grouped = expenses.groupBy { it.date }.entries.sortedByDescending { it.key }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        grouped.forEach { (date, items) ->
            item {
                Text(date, style = MaterialTheme.typography.labelMedium, color = TextMuted, modifier = Modifier.padding(top = 8.dp))
            }
            items(items) { exp ->
                ExpenseRow(exp)
            }
        }
    }
}

@Composable
fun ExpenseRow(exp: Expense) {
    HomerCard {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(exp.description, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Text(exp.category, style = MaterialTheme.typography.labelSmall, color = TextMuted)
            }
            Text(
                text = "${if (exp.type == "income") "+" else "-"}${String.format("%.2f", exp.amount)}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = if (exp.type == "income") AccentGreen else AccentRed,
            )
        }
    }
}

@Composable
fun BudgetsTab(expenses: List<Expense>, budgets: List<ro.b4it.homer.data.local.entity.Budget>) {
    val now = LocalDate.now()
    val monthExpenses = expenses.filter { it.date.startsWith("${now.year}-${"%02d".format(now.monthValue)}") && it.type == "expense" }
    val spentByCategory = monthExpenses.groupBy { it.category }.mapValues { it.value.sumOf { e -> e.amount } }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(budgets) { budget ->
            val spent = spentByCategory[budget.category] ?: 0.0
            val pct   = if (budget.limit > 0) (spent / budget.limit).coerceIn(0.0, 1.0).toFloat() else 0f
            val barColor = when {
                pct >= 1.0f  -> AccentRed
                pct >= 0.8f  -> AccentOrange
                pct >= 0.6f  -> AccentAmber
                else         -> AccentGreen
            }
            HomerCard {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(budget.category, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Text("${String.format("%.0f", spent)} / ${String.format("%.0f", budget.limit)}", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    }
                    Spacer(Modifier.height(6.dp))
                    Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(BgCardAlt)) {
                        Box(Modifier.fillMaxWidth(pct).height(6.dp).clip(RoundedCornerShape(3.dp)).background(barColor))
                    }
                }
            }
        }
    }
}

@Composable
fun AddExpenseDialog(onAdd: (String, Double, String, String, String) -> Unit, onDismiss: () -> Unit) {
    var desc   by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var cat    by remember { mutableStateOf("") }
    var date   by remember { mutableStateOf(LocalDate.now().toString()) }
    var type   by remember { mutableStateOf("expense") }

    AlertDialog(
        onDismissRequest = onDismiss, containerColor = BgCard,
        title = { Text("Add Transaction") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple("Description *", desc, { v: String -> desc = v }),
                    Triple("Amount *", amount, { v: String -> amount = v }),
                    Triple("Category", cat, { v: String -> cat = v }),
                    Triple("Date (YYYY-MM-DD)", date, { v: String -> date = v }),
                ).forEach { (label, value, setter) ->
                    OutlinedTextField(value = value, onValueChange = setter, label = { Text(label) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedLabelColor = AccentBlue))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("expense", "income").forEach { t ->
                        FilterChip(selected = type == t, onClick = { type = t }, label = { Text(t.replaceFirstChar { it.uppercase() }) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = AccentBlue, selectedLabelColor = TextPrimary, containerColor = BgCardAlt, labelColor = TextMuted))
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = { val a = amount.toDoubleOrNull(); if (desc.isNotBlank() && a != null) onAdd(desc, a, cat.ifBlank { "other" }, date, type) }) { Text("Add", color = AccentBlue) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = TextMuted) } },
    )
}
