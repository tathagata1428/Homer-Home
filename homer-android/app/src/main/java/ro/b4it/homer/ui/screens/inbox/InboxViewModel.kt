package ro.b4it.homer.ui.screens.inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.ExpenseDao
import ro.b4it.homer.data.local.dao.InboxDao
import ro.b4it.homer.data.local.dao.LinkDao
import ro.b4it.homer.data.local.dao.PomodoroDao
import ro.b4it.homer.data.local.entity.Expense
import ro.b4it.homer.data.local.entity.InboxItem
import ro.b4it.homer.data.local.entity.Link
import ro.b4it.homer.data.local.entity.PomodoroTask
import ro.b4it.homer.data.sync.SyncEngine
import java.time.LocalDate
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class InboxViewModel @Inject constructor(
    private val dao: InboxDao,
    private val pomDao: PomodoroDao,
    private val linkDao: LinkDao,
    private val expenseDao: ExpenseDao,
    private val sync: SyncEngine,
) : ViewModel() {
    val items = dao.getAll()
    val count = dao.getCount()

    fun capture(item: InboxItem) {
        viewModelScope.launch {
            dao.insert(item)
            sync.pushInboxDebounced()
        }
    }

    fun delete(item: InboxItem) {
        viewModelScope.launch {
            dao.delete(item)
            sync.pushInboxNow()
        }
    }

    /** Route item to its appropriate section and remove from inbox. */
    fun process(item: InboxItem) {
        viewModelScope.launch {
            when (item.type) {
                "task" -> {
                    pomDao.upsertTask(PomodoroTask(id = UUID.randomUUID().toString(), text = item.text))
                    dao.deleteById(item.id)
                    sync.pushInboxDebounced()
                    sync.pushPomodoroTasksDebounced()
                }
                "link" -> {
                    val url = if (item.text.startsWith("http")) item.text else "https://${item.text}"
                    linkDao.upsert(Link(id = UUID.randomUUID().toString(), name = item.text.take(60), url = url, category = "Inbox"))
                    dao.deleteById(item.id)
                    sync.pushInboxDebounced()
                    sync.pushLinksDebounced()
                }
                "expense" -> {
                    val amount = Regex("""(\d+(?:[.,]\d+)?)""").find(item.text)?.value
                        ?.replace(',', '.')?.toDoubleOrNull() ?: 0.0
                    expenseDao.upsert(Expense(
                        id = UUID.randomUUID().toString(),
                        description = item.text,
                        amount = amount,
                        category = "Inbox",
                        date = LocalDate.now().toString(),
                        type = "expense",
                    ))
                    dao.deleteById(item.id)
                    sync.pushInboxDebounced()
                    sync.pushExpensesDebounced()
                }
                else -> { /* thought — no auto-routing on mobile */ }
            }
        }
    }
}
