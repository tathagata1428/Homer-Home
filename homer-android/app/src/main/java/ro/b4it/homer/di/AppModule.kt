package ro.b4it.homer.di

import android.app.AlarmManager
import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import ro.b4it.homer.data.local.HomerDatabase
import ro.b4it.homer.data.local.dao.*
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides @Singleton
    fun provideDatabase(@ApplicationContext ctx: Context): HomerDatabase =
        Room.databaseBuilder(ctx, HomerDatabase::class.java, "homer.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideQuoteDao(db: HomerDatabase)      = db.quoteDao()
    @Provides fun providePomodoroDao(db: HomerDatabase)   = db.pomodoroDao()
    @Provides fun provideLinkDao(db: HomerDatabase)       = db.linkDao()
    @Provides fun provideVaultDao(db: HomerDatabase)      = db.vaultDao()
    @Provides fun provideKanbanDao(db: HomerDatabase)     = db.kanbanDao()
    @Provides fun provideLifeGoalDao(db: HomerDatabase)   = db.lifeGoalDao()
    @Provides fun provideHabitDao(db: HomerDatabase)      = db.habitDao()
    @Provides fun provideExpenseDao(db: HomerDatabase)    = db.expenseDao()
    @Provides fun provideInboxDao(db: HomerDatabase)      = db.inboxDao()
    @Provides fun provideCalendarDao(db: HomerDatabase)   = db.calendarDao()
    @Provides fun provideAppSettingDao(db: HomerDatabase) = db.appSettingDao()
    @Provides fun provideNoteDao(db: HomerDatabase)       = db.noteDao()
    @Provides fun provideReminderDao(db: HomerDatabase)   = db.reminderDao()

    @Provides @Singleton
    fun provideAlarmManager(@ApplicationContext ctx: Context): AlarmManager =
        ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
}
