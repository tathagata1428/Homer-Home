package ro.b4it.homer.notification

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.*
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.first
import ro.b4it.homer.data.local.dao.CalendarDao
import ro.b4it.homer.data.local.dao.CarDao
import ro.b4it.homer.data.local.dao.KanbanDao
import ro.b4it.homer.data.local.dao.LifeGoalDao
import ro.b4it.homer.data.local.dao.ReminderDao
import ro.b4it.homer.data.local.entity.CalendarEvent
import ro.b4it.homer.data.local.entity.CarDocument
import ro.b4it.homer.data.local.entity.KanbanTask
import ro.b4it.homer.data.local.entity.LifeGoal
import ro.b4it.homer.data.local.entity.Reminder
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.abs

@Singleton
class ReminderManager @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val alarmManager: AlarmManager,
    private val calendarDao: CalendarDao,
    private val kanbanDao: KanbanDao,
    private val lifeGoalDao: LifeGoalDao,
    private val reminderDao: ReminderDao,
    private val carDao: CarDao,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Called on app launch and after device reboot — reschedules everything. */
    fun scheduleAll() {
        scope.launch {
            val now = System.currentTimeMillis()

            // Calendar events: 15 min before start
            calendarDao.getFutureEvents(now).forEach { ev ->
                val fireAt = ev.start - 15 * 60_000L
                if (fireAt > now) scheduleAlarm(
                    id = alarmId("cal", ev.id),
                    fireAt = fireAt,
                    title = "Upcoming: ${ev.title}",
                    body = formatTime(ev.start) + if (ev.location.isNotBlank()) " · ${ev.location}" else "",
                )
            }

            // Kanban tasks: 9:00 AM on due date
            kanbanDao.getTasksWithDueDates().forEach { task ->
                val fireAt = parseDateAt(task.dueDate, 9, 0)
                if (fireAt > now) scheduleAlarm(
                    id = alarmId("task", task.id),
                    fireAt = fireAt,
                    title = "Task due today",
                    body = task.summary,
                )
            }

            // Life goals: 3 days before target date
            lifeGoalDao.getGoalsWithTargetDates().forEach { goal ->
                val fireAt = parseDateAt(goal.targetDate, 9, 0) - 3 * 86_400_000L
                if (fireAt > now) scheduleAlarm(
                    id = alarmId("goal", goal.id),
                    fireAt = fireAt,
                    title = "${goal.icon.ifBlank { "🎯" }} Goal approaching: ${goal.title}",
                    body = "Target date in 3 days",
                )
            }

            // Standalone reminders
            reminderDao.getEnabled().forEach { rem ->
                if (rem.triggerAt > now) scheduleAlarm(
                    id = alarmId("rem", rem.id),
                    fireAt = rem.triggerAt,
                    title = rem.title,
                    body = rem.body,
                    reminderId = rem.id,
                    recurType = rem.recurType,
                )
            }

            // Car documents: 30 days and 7 days before expiry
            carDao.getAllDocuments().first().forEach { doc ->
                scheduleCarDocumentAlarms(doc)
            }

            // Daily habit reminder at 9:00 AM
            scheduleHabitDailyReminder()
        }
    }

    // ---- Per-item scheduling ----

    fun scheduleCalendarEvent(event: CalendarEvent) {
        val fireAt = event.start - 15 * 60_000L
        if (fireAt > System.currentTimeMillis()) scheduleAlarm(
            id = alarmId("cal", event.id),
            fireAt = fireAt,
            title = "Upcoming: ${event.title}",
            body = formatTime(event.start) + if (event.location.isNotBlank()) " · ${event.location}" else "",
        )
    }

    fun cancelCalendarEvent(eventId: String) = cancelAlarm(alarmId("cal", eventId))

    fun scheduleTaskDue(task: KanbanTask) {
        if (task.dueDate.isBlank()) return
        val fireAt = parseDateAt(task.dueDate, 9, 0)
        if (fireAt > System.currentTimeMillis()) scheduleAlarm(
            id = alarmId("task", task.id),
            fireAt = fireAt,
            title = "Task due today",
            body = task.summary,
        )
    }

    fun cancelTask(taskId: String) = cancelAlarm(alarmId("task", taskId))

    fun scheduleGoalReminder(goal: LifeGoal) {
        if (goal.targetDate.isBlank()) return
        val fireAt = parseDateAt(goal.targetDate, 9, 0) - 3 * 86_400_000L
        if (fireAt > System.currentTimeMillis()) scheduleAlarm(
            id = alarmId("goal", goal.id),
            fireAt = fireAt,
            title = "${goal.icon.ifBlank { "🎯" }} Goal approaching: ${goal.title}",
            body = "Target date in 3 days",
        )
    }

    fun cancelGoal(goalId: String) = cancelAlarm(alarmId("goal", goalId))

    fun scheduleReminder(reminder: Reminder) {
        if (!reminder.enabled || reminder.triggerAt <= System.currentTimeMillis()) return
        scheduleAlarm(
            id = alarmId("rem", reminder.id),
            fireAt = reminder.triggerAt,
            title = reminder.title,
            body = reminder.body,
            reminderId = reminder.id,
            recurType = reminder.recurType,
        )
    }

    fun cancelReminder(reminderId: String) = cancelAlarm(alarmId("rem", reminderId))

    fun scheduleCarDocument(doc: CarDocument) = scheduleCarDocumentAlarms(doc)

    fun cancelCarDocument(docId: String) {
        cancelAlarm(alarmId("car30", docId))
        cancelAlarm(alarmId("car7",  docId))
    }

    private fun scheduleCarDocumentAlarms(doc: CarDocument) {
        if (doc.expiryDate.isBlank()) return
        val now = System.currentTimeMillis()
        val expiry = parseDateAt(doc.expiryDate, 9, 0)
        val label = doc.label.ifBlank { doc.type }
        // 30-day warning
        val fire30 = expiry - 30 * 86_400_000L
        if (fire30 > now) scheduleAlarm(
            id     = alarmId("car30", doc.id),
            fireAt = fire30,
            title  = "🚗 $label expires in 30 days",
            body   = "Expires ${doc.expiryDate}",
        )
        // 7-day warning
        val fire7 = expiry - 7 * 86_400_000L
        if (fire7 > now) scheduleAlarm(
            id     = alarmId("car7", doc.id),
            fireAt = fire7,
            title  = "⚠️ $label expires in 7 days!",
            body   = "Expires ${doc.expiryDate} — renew now",
        )
    }

    /** Called by ReminderReceiver after a recurring reminder fires — advances triggerAt and re-schedules. */
    fun rescheduleRecurring(reminderId: String, recurType: String, firedAt: Long) {
        scope.launch {
            val nextFireAt = nextOccurrence(firedAt, recurType) ?: return@launch
            reminderDao.updateTriggerAt(reminderId, nextFireAt)
            // Re-read to get current title/body
            val reminder = reminderDao.getEnabled().firstOrNull { it.id == reminderId } ?: return@launch
            scheduleAlarm(
                id = alarmId("rem", reminderId),
                fireAt = nextFireAt,
                title = reminder.title,
                body = reminder.body,
                reminderId = reminderId,
                recurType = recurType,
            )
        }
    }

    // ---- WorkManager: daily habit summary ----

    fun scheduleHabitDailyReminder() {
        val delay = delayUntil(9, 0)
        val req = PeriodicWorkRequestBuilder<HabitReminderWorker>(1, TimeUnit.DAYS)
            .setInitialDelay(delay, TimeUnit.MILLISECONDS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.NOT_REQUIRED).build())
            .build()
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
            "homer_habit_daily",
            ExistingPeriodicWorkPolicy.KEEP,
            req,
        )
    }

    // ---- Core alarm helpers ----

    private fun scheduleAlarm(
        id: Int, fireAt: Long, title: String, body: String,
        reminderId: String = "", recurType: String = "none",
    ) {
        val intent = Intent(ctx, ReminderReceiver::class.java).apply {
            putExtra(ReminderReceiver.EXTRA_TITLE, title)
            putExtra(ReminderReceiver.EXTRA_BODY, body)
            putExtra(ReminderReceiver.EXTRA_NOTIF_ID, id)
            putExtra(ReminderReceiver.EXTRA_REMINDER_ID, reminderId)
            putExtra(ReminderReceiver.EXTRA_RECUR_TYPE, recurType)
            putExtra(ReminderReceiver.EXTRA_FIRE_AT, fireAt)
        }
        val pi = PendingIntent.getBroadcast(
            ctx, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        // showIntent — tapped alarm clock icon in status bar opens the app
        val showPi = PendingIntent.getActivity(
            ctx, id,
            Intent(ctx, Class.forName("ro.b4it.homer.MainActivity")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        try {
            // setAlarmClock: bypasses Doze/battery saver, shows clock icon in status bar,
            // wakes the screen — behaves like the built-in Clock alarm
            alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(fireAt, showPi), pi)
        } catch (_: SecurityException) {
            alarmManager.set(AlarmManager.RTC_WAKEUP, fireAt, pi)
        }
    }

    private fun cancelAlarm(id: Int) {
        val pi = PendingIntent.getBroadcast(
            ctx, id, Intent(ctx, ReminderReceiver::class.java),
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
        ) ?: return
        alarmManager.cancel(pi)
    }

    // ---- Utilities ----

    /** Parse "YYYY-MM-DD" to epoch ms at the given local time. */
    fun parseDateAt(dateStr: String, hour: Int, minute: Int): Long = try {
        val parts = dateStr.trim().split("-")
        Calendar.getInstance().apply {
            set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt(), hour, minute, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    } catch (_: Exception) { 0L }

    private fun formatTime(ms: Long): String =
        SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ms))

    fun alarmId(prefix: String, entityId: String): Int = abs(("$prefix:$entityId").hashCode())

    private fun delayUntil(hour: Int, minute: Int): Long {
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour); set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
        }
        return cal.timeInMillis - System.currentTimeMillis()
    }

    private fun nextOccurrence(lastFiredAt: Long, recurType: String): Long? {
        val cal = Calendar.getInstance().apply { timeInMillis = lastFiredAt }
        return when (recurType) {
            "daily"   -> { cal.add(Calendar.DAY_OF_YEAR, 1); cal.timeInMillis }
            "weekly"  -> { cal.add(Calendar.WEEK_OF_YEAR, 1); cal.timeInMillis }
            "monthly" -> { cal.add(Calendar.MONTH, 1); cal.timeInMillis }
            "yearly"  -> { cal.add(Calendar.YEAR, 1); cal.timeInMillis }
            else      -> null
        }
    }
}
