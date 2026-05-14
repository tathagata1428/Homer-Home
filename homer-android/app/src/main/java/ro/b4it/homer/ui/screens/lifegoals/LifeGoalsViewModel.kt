package ro.b4it.homer.ui.screens.lifegoals

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import ro.b4it.homer.data.local.dao.LifeGoalDao
import ro.b4it.homer.data.local.entity.LifeGoal
import ro.b4it.homer.notification.ReminderManager
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class LifeGoalsViewModel @Inject constructor(
    private val dao: LifeGoalDao,
    private val reminderManager: ReminderManager,
) : ViewModel() {

    val goals = dao.getAll()

    fun addGoal(title: String, desc: String, cat: String, icon: String, target: String) {
        val goal = LifeGoal(
            id = UUID.randomUUID().toString(), title = title, description = desc,
            category = cat, icon = icon.ifBlank { "🎯" }, targetDate = target,
        )
        viewModelScope.launch {
            dao.upsert(goal)
            if (target.isNotBlank()) reminderManager.scheduleGoalReminder(goal)
        }
    }

    fun toggleComplete(goal: LifeGoal) {
        val done = goal.progress >= 100 || goal.status == "completed"
        viewModelScope.launch {
            dao.upsert(goal.copy(
                status = if (done) "active" else "completed",
                progress = if (done) goal.progress.coerceAtMost(99) else 100,
                updatedAt = System.currentTimeMillis(),
            ))
            if (!done) reminderManager.cancelGoal(goal.id)
        }
    }

    fun deleteGoal(goal: LifeGoal) {
        viewModelScope.launch {
            dao.delete(goal)
            reminderManager.cancelGoal(goal.id)
        }
    }
}
