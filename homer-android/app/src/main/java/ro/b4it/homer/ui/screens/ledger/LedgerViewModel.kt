package ro.b4it.homer.ui.screens.ledger

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.ExpenseDao
import ro.b4it.homer.data.local.entity.Expense
import ro.b4it.homer.data.sync.SyncEngine
import javax.inject.Inject

@HiltViewModel
class LedgerViewModel @Inject constructor(
    private val dao: ExpenseDao,
    private val sync: SyncEngine,
) : ViewModel() {
    val expenses = dao.getAll()
    val budgets  = dao.getAllBudgets()

    fun addExpense(expense: Expense) {
        viewModelScope.launch {
            dao.upsert(expense)
            sync.pushExpensesDebounced()
        }
    }

    fun deleteExpense(expense: Expense) {
        viewModelScope.launch {
            dao.delete(expense)
            sync.pushExpensesDebounced()
        }
    }
}
