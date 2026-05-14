package ro.b4it.homer.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import ro.b4it.homer.data.local.dao.*
import ro.b4it.homer.data.local.entity.*

@Database(
    entities = [
        SavedQuote::class,
        PomodoroTask::class,
        PomodoroSession::class,
        Link::class,
        BrainDump::class,
        VaultCredential::class,
        VaultLink::class,
        VaultNote::class,
        KanbanProject::class,
        KanbanTask::class,
        LifeGoal::class,
        Habit::class,
        HabitCompletion::class,
        Expense::class,
        Budget::class,
        InboxItem::class,
        CalendarEvent::class,
        AppSetting::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class HomerDatabase : RoomDatabase() {
    abstract fun quoteDao(): QuoteDao
    abstract fun pomodoroDao(): PomodoroDao
    abstract fun linkDao(): LinkDao
    abstract fun vaultDao(): VaultDao
    abstract fun kanbanDao(): KanbanDao
    abstract fun lifeGoalDao(): LifeGoalDao
    abstract fun habitDao(): HabitDao
    abstract fun expenseDao(): ExpenseDao
    abstract fun inboxDao(): InboxDao
    abstract fun calendarDao(): CalendarDao
    abstract fun appSettingDao(): AppSettingDao
}
