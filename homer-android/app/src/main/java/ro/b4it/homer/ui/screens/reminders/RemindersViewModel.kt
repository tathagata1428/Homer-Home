package ro.b4it.homer.ui.screens.reminders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.ReminderDao
import ro.b4it.homer.data.local.entity.Reminder
import ro.b4it.homer.data.sync.SyncEngine
import ro.b4it.homer.notification.ReminderManager
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class RemindersViewModel @Inject constructor(
    private val dao: ReminderDao,
    private val reminderManager: ReminderManager,
    private val sync: SyncEngine,
) : ViewModel() {

    val reminders = dao.getAll()

    fun add(title: String, body: String, triggerAt: Long, recurType: String) {
        val reminder = Reminder(
            id = UUID.randomUUID().toString(),
            title = title, body = body,
            triggerAt = triggerAt, recurType = recurType,
        )
        viewModelScope.launch {
            dao.upsert(reminder)
            reminderManager.scheduleReminder(reminder)
            sync.pushRemindersDebounced()
        }
    }

    fun toggle(reminder: Reminder) {
        viewModelScope.launch {
            val updated = reminder.copy(enabled = !reminder.enabled)
            dao.upsert(updated)
            if (updated.enabled) reminderManager.scheduleReminder(updated)
            else reminderManager.cancelReminder(updated.id)
            sync.pushRemindersDebounced()
        }
    }

    fun delete(reminder: Reminder) {
        viewModelScope.launch {
            dao.delete(reminder)
            reminderManager.cancelReminder(reminder.id)
            sync.pushRemindersDebounced()
        }
    }
}
