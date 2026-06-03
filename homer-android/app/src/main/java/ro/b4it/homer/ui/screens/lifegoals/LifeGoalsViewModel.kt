package ro.b4it.homer.ui.screens.lifegoals

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import ro.b4it.homer.data.local.dao.LifeGoalDao
import ro.b4it.homer.data.local.entity.LifeGoal
import ro.b4it.homer.data.sync.SyncEngine
import ro.b4it.homer.notification.ReminderManager
import java.util.UUID
import javax.inject.Inject

@Serializable
data class MilestoneDto(val id: String, val text: String, val done: Boolean = false)

@HiltViewModel
class LifeGoalsViewModel @Inject constructor(
    private val dao: LifeGoalDao,
    private val reminderManager: ReminderManager,
    private val sync: SyncEngine,
) : ViewModel() {

    val goals = dao.getAll()

    private val json = Json { ignoreUnknownKeys = true }

    fun parseMilestones(jsonStr: String): List<MilestoneDto> =
        try { json.decodeFromString(jsonStr) } catch (_: Exception) { emptyList() }

    private fun encode(list: List<MilestoneDto>): String = json.encodeToString(list)

    // ── Goal CRUD ─────────────────────────────────────────────────────────────

    fun addGoal(title: String, desc: String, cat: String, icon: String, target: String) {
        val goal = LifeGoal(
            id = UUID.randomUUID().toString(),
            title = title,
            description = desc,
            category = cat,
            icon = icon.ifBlank { "🎯" },
            targetDate = target,
        )
        viewModelScope.launch {
            dao.upsert(goal)
            if (target.isNotBlank()) reminderManager.scheduleGoalReminder(goal)
            sync.pushLifeGoalsDebounced()
        }
    }

    fun toggleComplete(goal: LifeGoal) {
        val done = goal.progress >= 100 || goal.status == "completed"
        viewModelScope.launch {
            dao.upsert(goal.copy(
                status    = if (done) "active" else "completed",
                progress  = if (done) goal.progress.coerceAtMost(99) else 100,
                updatedAt = System.currentTimeMillis(),
            ))
            if (!done) reminderManager.cancelGoal(goal.id)
            sync.pushLifeGoalsDebounced()
        }
    }

    fun deleteGoal(goal: LifeGoal) {
        viewModelScope.launch {
            dao.delete(goal)
            reminderManager.cancelGoal(goal.id)
            sync.pushLifeGoalsNow()
        }
    }

    // ── Milestone CRUD ────────────────────────────────────────────────────────

    fun addMilestone(goal: LifeGoal, text: String) {
        if (text.isBlank()) return
        val milestones = parseMilestones(goal.milestonesJson).toMutableList()
        milestones.add(MilestoneDto(id = UUID.randomUUID().toString(), text = text.trim()))
        viewModelScope.launch {
            dao.upsert(goal.copy(
                milestonesJson = encode(milestones),
                updatedAt      = System.currentTimeMillis(),
            ))
            sync.pushLifeGoalsDebounced()
        }
    }

    fun toggleMilestone(goal: LifeGoal, milestoneId: String) {
        val milestones = parseMilestones(goal.milestonesJson).map {
            if (it.id == milestoneId) it.copy(done = !it.done) else it
        }
        val progress = recalcProgress(milestones, goal.progress)
        val status   = when {
            progress >= 100                         -> "completed"
            goal.status == "completed" && progress < 100 -> "active"
            else                                    -> goal.status
        }
        viewModelScope.launch {
            dao.upsert(goal.copy(
                milestonesJson = encode(milestones),
                progress       = progress,
                status         = status,
                updatedAt      = System.currentTimeMillis(),
            ))
            sync.pushLifeGoalsDebounced()
        }
    }

    fun deleteMilestone(goal: LifeGoal, milestoneId: String) {
        val milestones = parseMilestones(goal.milestonesJson).filter { it.id != milestoneId }
        val progress   = recalcProgress(milestones, goal.progress)
        viewModelScope.launch {
            dao.upsert(goal.copy(
                milestonesJson = encode(milestones),
                progress       = progress,
                updatedAt      = System.currentTimeMillis(),
            ))
            sync.pushLifeGoalsNow()
        }
    }

    private fun recalcProgress(milestones: List<MilestoneDto>, fallback: Int): Int =
        if (milestones.isEmpty()) fallback
        else milestones.count { it.done } * 100 / milestones.size
}
