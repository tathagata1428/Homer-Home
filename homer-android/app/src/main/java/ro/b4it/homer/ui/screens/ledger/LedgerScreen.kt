package ro.b4it.homer.ui.screens.ledger

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ro.b4it.homer.data.local.entity.Budget
import ro.b4it.homer.data.local.entity.Expense
import ro.b4it.homer.ui.theme.*
import java.time.LocalDate
import java.util.UUID

@Composable
fun LedgerScreen(vm: LedgerViewModel = hiltViewModel()) {
    val expenses      by vm.expenses.collectAsStateWithLifecycle(emptyList())
    val budgets       by vm.budgets.collectAsStateWithLifecycle(emptyList())
    var showAdd       by remember { mutableStateOf(false) }
    var showAddBudget by remember { mutableStateOf(false) }
    var tab           by remember { mutableStateOf(0) }

    Column(Modifier.fillMaxSize().background(BgPrimary)) {
        // Header
        Column(Modifier.fillMaxWidth().padding(start = 20.dp, top = 16.dp, end = 12.dp, bottom = 4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Ledger", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = TextPrimary, modifier = Modifier.weight(1f))
                Box(
                    Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                        .background(AccentBlue.copy(0.1f))
                        .border(1.dp, BorderDefault, RoundedCornerShape(12.dp))
                        .clickable { if (tab == 0) showAdd = true else showAddBudget = true },
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Filled.Add, null, tint = AccentBlue, modifier = Modifier.size(20.dp)) }
            }
        }

        // Tab row
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf("Transactions", "Budgets").forEachIndexed { i, label ->
                val sel = tab == i
                Box(
                    Modifier.weight(1f).clip(RoundedCornerShape(10.dp))
                        .background(if (sel) AccentBlue.copy(0.12f) else Color.Transparent)
                        .border(1.dp, if (sel) AccentBlue.copy(0.7f) else BorderDefault, RoundedCornerShape(10.dp))
                        .clickable { tab = i }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(label, fontSize = 9.sp, letterSpacing = 0.sp, color = if (sel) AccentBlue else TextSubtle, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        when (tab) {
            0 -> TransactionsTab(expenses, onDelete = vm::deleteExpense)
            1 -> BudgetsTab(expenses, budgets, onDeleteBudget = vm::deleteBudget)
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
    if (showAddBudget) {
        AddBudgetDialog(onAdd = { cat, limit -> vm.addBudget(cat, limit); showAddBudget = false }, onDismiss = { showAddBudget = false })
    }
}

// ── Transactions tab ──────────────────────────────────────────────────────────

@Composable
fun TransactionsTab(expenses: List<Expense>, onDelete: (Expense) -> Unit) {
    val income  = expenses.filter { it.type == "income" }.sumOf { it.amount }
    val spent   = expenses.filter { it.type == "expense" }.sumOf { it.amount }
    val balance = income - spent
    val grouped = expenses.groupBy { it.date }.entries.sortedByDescending { it.key }

    LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)) {
        item {
            BalanceHeroCard(income = income, spent = spent, balance = balance)
            Spacer(Modifier.height(16.dp))
        }

        if (expenses.isEmpty()) {
            item {
                Box(Modifier.fillMaxWidth().padding(vertical = 60.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("💸", fontSize = 52.sp)
                        Text("No transactions", fontSize = 10.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                        Text("Tap + to log your first transaction", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                    }
                }
            }
        }

        grouped.forEach { (date, dayItems) ->
            item { NeonDateHeader(date) }
            items(dayItems) { exp ->
                ExpenseRow(exp, onDelete = { onDelete(exp) })
                Spacer(Modifier.height(6.dp))
            }
            item { Spacer(Modifier.height(4.dp)) }
        }
    }
}

@Composable
private fun BalanceHeroCard(income: Double, spent: Double, balance: Double) {
    val positive = balance >= 0
    val heroColor = if (positive) AccentGreen else AccentRed
    val heroColor2 = if (positive) NeonCyan else NeonPink

    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(BgCard)
            .border(2.dp, BorderDefault, RoundedCornerShape(22.dp))
            .padding(22.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text("Net balance", fontSize = 9.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Text(
                "${if (positive) "+" else ""}€ ${String.format("%,.2f", balance)}",
                fontSize = 40.sp,
                fontWeight = FontWeight.ExtraBold,
                color = heroColor,
                letterSpacing = (-1).sp,
            )
            Spacer(Modifier.height(4.dp))
            // Mini gauge bar
            val gaugeWidth = if (income > 0) (spent / income).coerceIn(0.0, 1.0).toFloat() else 0f
            Box(Modifier.fillMaxWidth(0.85f).height(4.dp).clip(RoundedCornerShape(2.dp)).background(BgCardAlt)) {
                Box(
                    Modifier.fillMaxWidth(gaugeWidth).height(4.dp).clip(RoundedCornerShape(2.dp))
                        .background(AccentBlue)
                )
            }
        }

        HorizontalDivider(color = BorderDefault)

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
            NeoBalanceStat("Income",  income, AccentGreen, AccentGreen, Icons.Filled.ArrowUpward)
            Box(Modifier.width(1.dp).height(40.dp).background(BorderDefault))
            NeoBalanceStat("Spent",   spent,  AccentRed,   AccentRed, Icons.Filled.ArrowDownward)
        }
    }
}

@Composable
private fun NeoBalanceStat(label: String, amount: Double, color: Color, neon: Color, icon: ImageVector) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            Modifier.size(36.dp).clip(CircleShape)
                .background(color.copy(0.08f))
                .border(1.dp, BorderDefault, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, tint = color, modifier = Modifier.size(16.dp))
        }
        Column {
            Text("€ ${String.format("%,.0f", amount)}", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = color)
            Text(label, fontSize = 8.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun NeonDateHeader(date: String) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(date, fontSize = 9.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
        HorizontalDivider(modifier = Modifier.weight(1f), color = BorderDefault)
    }
}

@Composable
fun ExpenseRow(exp: Expense, onDelete: () -> Unit) {
    val isIncome    = exp.type == "income"
    val amountColor = if (isIncome) AccentGreen else AccentRed
    val neonAmount  = if (isIncome) NeonCyan else NeonPink
    val catColor    = categoryColor(exp.category)

    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(BgCard)
            .border(1.dp, BorderDefault, RoundedCornerShape(14.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier.size(46.dp).clip(CircleShape)
                .background(amountColor.copy(0.08f))
                .border(1.5.dp, BorderDefault, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                exp.category.take(1).uppercase().ifBlank { if (isIncome) "+" else "−" },
                fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = neonAmount,
            )
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(exp.description, fontWeight = FontWeight.Bold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (exp.category.isNotBlank()) {
                Box(
                    Modifier.clip(RoundedCornerShape(4.dp))
                        .background(catColor.copy(0.08f))
                        .border(1.dp, catColor.copy(0.25f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                ) {
                    Text(exp.category.uppercase(), fontSize = 7.sp, letterSpacing = 1.sp, color = catColor.copy(0.75f), fontWeight = FontWeight.ExtraBold)
                }
            }
        }
        Text(
            "${if (isIncome) "+" else "−"}€${String.format("%.2f", exp.amount)}",
            fontWeight = FontWeight.ExtraBold,
            fontSize = 15.sp,
            color = amountColor,
            fontFamily = FontFamily.Monospace,
        )
        IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
            Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(0.4f), modifier = Modifier.size(14.dp))
        }
    }
}

private fun categoryColor(cat: String): Color = when {
    cat.contains("food", true) || cat.contains("restaurant", true) || cat.contains("grocer", true) -> AccentAmber
    cat.contains("transport", true) || cat.contains("car", true) || cat.contains("fuel", true)     -> NeonCyan
    cat.contains("health", true) || cat.contains("medical", true) || cat.contains("pharma", true)  -> AccentGreen
    cat.contains("entertain", true) || cat.contains("fun", true) || cat.contains("hobby", true)    -> NeonPurple
    cat.contains("shop", true) || cat.contains("cloth", true) || cat.contains("fashion", true)     -> NeonPink
    cat.contains("util", true) || cat.contains("bill", true) || cat.contains("subscri", true)      -> AccentAmber
    cat.contains("income", true) || cat.contains("salary", true) || cat.contains("wage", true)     -> AccentGreen
    else                                                                                             -> NeonCyan
}

// ── Budgets tab ───────────────────────────────────────────────────────────────

@Composable
fun BudgetsTab(expenses: List<Expense>, budgets: List<Budget>, onDeleteBudget: (Budget) -> Unit) {
    val now = LocalDate.now()
    val monthExpenses = expenses.filter {
        it.date.startsWith("${now.year}-${"%02d".format(now.monthValue)}") && it.type == "expense"
    }
    val spentByCategory = monthExpenses.groupBy { it.category }.mapValues { it.value.sumOf { e -> e.amount } }

    if (budgets.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("💰", fontSize = 52.sp)
                Text("No budgets set", fontSize = 10.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                Text("Tap + to add a budget", style = MaterialTheme.typography.bodySmall, color = TextMuted)
            }
        }
        return
    }

    val totalLimit = budgets.sumOf { it.limit }
    val totalSpent = budgets.sumOf { spentByCategory[it.category] ?: 0.0 }
    val overallPct = if (totalLimit > 0) (totalSpent / totalLimit).coerceIn(0.0, 1.0).toFloat() else 0f
    val overallNeon = when {
        overallPct >= 1.0f -> NeonPink
        overallPct >= 0.8f -> AccentOrange
        overallPct >= 0.6f -> NeonGold
        else               -> NeonCyan
    }

    LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Monthly overview card
        item {
            Column(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(BgCard)
                    .border(2.dp, BorderDefault, RoundedCornerShape(22.dp))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            now.month.name.lowercase().replaceFirstChar { it.uppercase() } + " budget",
                            fontSize = 9.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "€${String.format("%.0f", totalSpent)}",
                            fontSize = 36.sp, fontWeight = FontWeight.ExtraBold, color = overallNeon, letterSpacing = (-1).sp,
                        )
                        Text(
                            "of €${String.format("%.0f", totalLimit)} limit",
                            fontSize = 13.sp, color = TextMuted, fontWeight = FontWeight.Medium,
                        )
                    }
                    Box(
                        Modifier.size(66.dp).clip(CircleShape)
                            .background(overallNeon.copy(0.08f))
                            .border(2.dp, BorderDefault, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("${(overallPct * 100).toInt()}%", fontSize = 16.sp, color = overallNeon, fontWeight = FontWeight.ExtraBold)
                            Text("Used", fontSize = 7.sp, letterSpacing = 0.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                // Budget bar
                Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(BgCardAlt)) {
                    if (overallPct > 0f) {
                        Box(
                            Modifier.fillMaxWidth(overallPct).height(8.dp).clip(RoundedCornerShape(4.dp))
                                .background(AccentViolet)
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    val remaining = totalLimit - totalSpent
                    Text(
                        if (remaining >= 0) "€${String.format("%.0f", remaining)} remaining  ·  ${budgets.size} budgets"
                        else "Over by €${String.format("%.0f", -remaining)}",
                        fontSize = 11.sp,
                        color = if (remaining >= 0) TextMuted else AccentRed,
                        fontWeight = FontWeight.SemiBold,
                        fontFamily = if (remaining < 0) FontFamily.Monospace else FontFamily.Default,
                    )
                }
            }
        }

        items(budgets) { budget ->
            val spent     = spentByCategory[budget.category] ?: 0.0
            val pct       = if (budget.limit > 0) (spent / budget.limit).coerceIn(0.0, 1.0).toFloat() else 0f
            val remaining = budget.limit - spent
            val barNeon   = when {
                pct >= 1.0f -> NeonPink
                pct >= 0.8f -> AccentOrange
                pct >= 0.6f -> NeonGold
                else        -> NeonCyan
            }

            Column(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(BgCard)
                    .border(1.dp, BorderDefault, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(
                        Modifier.size(44.dp).clip(RoundedCornerShape(12.dp))
                            .background(barNeon.copy(0.08f))
                            .border(1.dp, barNeon.copy(0.45f), RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(budget.category.take(1).uppercase(), fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = barNeon)
                    }
                    Column(Modifier.weight(1f)) {
                        Text(budget.category, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = TextPrimary)
                        Text("${(pct * 100).toInt()}% of budget used", fontSize = 11.sp, color = barNeon.copy(0.65f))
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("€${String.format("%.0f", spent)}", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = barNeon, fontFamily = FontFamily.Monospace)
                        Text("of €${String.format("%.0f", budget.limit)}", fontSize = 11.sp, color = TextSubtle)
                    }
                    IconButton(onClick = { onDeleteBudget(budget) }, Modifier.size(28.dp)) {
                        Icon(Icons.Filled.Delete, null, tint = AccentRed.copy(0.4f), modifier = Modifier.size(14.dp))
                    }
                }

                Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(BgCardAlt)) {
                    if (pct > 0f) {
                        Box(
                            Modifier.fillMaxWidth(pct).height(8.dp).clip(RoundedCornerShape(4.dp))
                                .background(AccentViolet)
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    val filled = (pct * 15).toInt()
                    Text(
                        "${"▓".repeat(filled)}${"░".repeat(15 - filled)}",
                        fontSize = 10.sp,
                        color = barNeon.copy(0.4f),
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        if (remaining >= 0) "€${String.format("%.0f", remaining)} left" else "Over €${String.format("%.0f", -remaining)}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = if (remaining >= 0) TextMuted else AccentRed,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }
        }
    }
}

// ── Add dialogs ───────────────────────────────────────────────────────────────

@Composable
fun AddBudgetDialog(onAdd: (String, Double) -> Unit, onDismiss: () -> Unit) {
    var category by remember { mutableStateOf("") }
    var limit    by remember { mutableStateOf("") }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
        focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
        focusedLabelColor = AccentBlue, cursorColor = AccentBlue,
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = BgCard,
        shape = RoundedCornerShape(20.dp),
        title = {
            Text("Set budget", fontSize = 13.sp, letterSpacing = 0.sp, color = TextPrimary, fontWeight = FontWeight.SemiBold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Category *") }, singleLine = true, modifier = Modifier.fillMaxWidth(), colors = fieldColors)
                OutlinedTextField(value = limit, onValueChange = { limit = it }, label = { Text("Monthly limit (€) *") }, singleLine = true, modifier = Modifier.fillMaxWidth(), colors = fieldColors)
            }
        },
        confirmButton = {
            Box(
                Modifier.clip(RoundedCornerShape(10.dp))
                    .background(AccentBlue)
                    .clickable { val l = limit.toDoubleOrNull(); if (category.isNotBlank() && l != null && l > 0) onAdd(category, l) }
                    .padding(horizontal = 22.dp, vertical = 10.dp),
            ) { Text("Save", fontSize = 11.sp, letterSpacing = 0.sp, color = Color.White, fontWeight = FontWeight.SemiBold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", fontSize = 10.sp, letterSpacing = 0.sp, color = TextMuted) } },
    )
}

@Composable
fun AddExpenseDialog(onAdd: (String, Double, String, String, String) -> Unit, onDismiss: () -> Unit) {
    var desc   by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var cat    by remember { mutableStateOf("") }
    var date   by remember { mutableStateOf(LocalDate.now().toString()) }
    var type   by remember { mutableStateOf("expense") }

    val isIncome = type == "income"
    val neon = if (isIncome) NeonCyan else NeonPink

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = AccentBlue, unfocusedBorderColor = BorderDefault,
        focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
        focusedLabelColor = AccentBlue, cursorColor = AccentBlue,
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = BgCard,
        shape = RoundedCornerShape(20.dp),
        title = {
            Text("Add transaction", fontSize = 13.sp, letterSpacing = 0.sp, color = TextPrimary, fontWeight = FontWeight.SemiBold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Type toggle first
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("expense" to AccentRed, "income" to AccentGreen).forEach { (t, tColor) ->
                        val sel = type == t
                        Box(
                            Modifier.weight(1f).clip(RoundedCornerShape(10.dp))
                                .background(if (sel) tColor.copy(0.14f) else Color.Transparent)
                                .border(1.dp, if (sel) tColor.copy(0.8f) else BorderDefault, RoundedCornerShape(10.dp))
                                .clickable { type = t }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(t.replaceFirstChar { it.uppercase() }, fontSize = 9.sp, letterSpacing = 0.sp, color = if (sel) tColor else TextMuted, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
                listOf(
                    Triple("Description *", desc,   { v: String -> desc   = v }),
                    Triple("Amount *",      amount, { v: String -> amount = v }),
                    Triple("Category",      cat,    { v: String -> cat    = v }),
                    Triple("Date (YYYY-MM-DD)", date, { v: String -> date = v }),
                ).forEach { (label, value, setter) ->
                    OutlinedTextField(value = value, onValueChange = setter, label = { Text(label, fontSize = 12.sp) },
                        singleLine = true, modifier = Modifier.fillMaxWidth(), colors = fieldColors)
                }
            }
        },
        confirmButton = {
            Box(
                Modifier.clip(RoundedCornerShape(10.dp))
                    .background(Brush.linearGradient(if (isIncome) listOf(NeonCyan, AccentGreen) else listOf(NeonPink, AccentRed.copy(0.8f))))
                    .clickable { val a = amount.toDoubleOrNull(); if (desc.isNotBlank() && a != null) onAdd(desc, a, cat.ifBlank { "other" }, date, type) }
                    .padding(horizontal = 22.dp, vertical = 10.dp),
            ) { Text("ADD", fontSize = 11.sp, letterSpacing = 1.5.sp, color = Color.White, fontWeight = FontWeight.ExtraBold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("CANCEL", fontSize = 10.sp, letterSpacing = 1.sp, color = TextMuted) } },
    )
}
