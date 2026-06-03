package ro.b4it.homer.di

import android.app.AlarmManager
import android.content.Context
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import ro.b4it.homer.data.local.HomerDatabase
import ro.b4it.homer.data.local.dao.*
import javax.inject.Singleton

private val MIGRATION_4_5 = object : Migration(4, 5) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `car_vehicles` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `make` TEXT NOT NULL,
                `model` TEXT NOT NULL,
                `year` INTEGER NOT NULL DEFAULT 0,
                `plate` TEXT NOT NULL DEFAULT '',
                `fuelType` TEXT NOT NULL DEFAULT 'petrol',
                `odoKm` INTEGER NOT NULL DEFAULT 0,
                `color` TEXT NOT NULL DEFAULT '',
                `vin` TEXT NOT NULL DEFAULT '',
                `engine` TEXT NOT NULL DEFAULT '',
                `displacement` TEXT NOT NULL DEFAULT '',
                `powerHp` INTEGER NOT NULL DEFAULT 0,
                `torqueNm` INTEGER NOT NULL DEFAULT 0,
                `transmission` TEXT NOT NULL DEFAULT '',
                `drivetrain` TEXT NOT NULL DEFAULT '',
                `bodyType` TEXT NOT NULL DEFAULT '',
                `seats` INTEGER NOT NULL DEFAULT 0,
                `purchaseDate` TEXT NOT NULL DEFAULT '',
                `purchasePrice` REAL NOT NULL DEFAULT 0.0,
                `notes` TEXT NOT NULL DEFAULT '',
                `updatedAt` INTEGER NOT NULL DEFAULT 0
            )
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `car_documents` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `vehicleId` TEXT NOT NULL,
                `type` TEXT NOT NULL,
                `label` TEXT NOT NULL,
                `expiryDate` TEXT NOT NULL DEFAULT '',
                `docNumber` TEXT NOT NULL DEFAULT '',
                `provider` TEXT NOT NULL DEFAULT '',
                `cost` REAL NOT NULL DEFAULT 0.0,
                `notes` TEXT NOT NULL DEFAULT '',
                `createdAt` INTEGER NOT NULL DEFAULT 0,
                `updatedAt` INTEGER NOT NULL DEFAULT 0
            )
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `car_maintenance` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `vehicleId` TEXT NOT NULL,
                `type` TEXT NOT NULL,
                `label` TEXT NOT NULL,
                `date` TEXT NOT NULL,
                `odometer` INTEGER NOT NULL DEFAULT 0,
                `nextDateDue` TEXT NOT NULL DEFAULT '',
                `nextOdoKm` INTEGER NOT NULL DEFAULT 0,
                `cost` REAL NOT NULL DEFAULT 0.0,
                `workshop` TEXT NOT NULL DEFAULT '',
                `notes` TEXT NOT NULL DEFAULT '',
                `createdAt` INTEGER NOT NULL DEFAULT 0,
                `updatedAt` INTEGER NOT NULL DEFAULT 0
            )
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `car_fuel_log` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `vehicleId` TEXT NOT NULL,
                `date` TEXT NOT NULL,
                `odometer` INTEGER NOT NULL DEFAULT 0,
                `liters` REAL NOT NULL DEFAULT 0.0,
                `pricePerLiter` REAL NOT NULL DEFAULT 0.0,
                `totalCost` REAL NOT NULL DEFAULT 0.0,
                `station` TEXT NOT NULL DEFAULT '',
                `fullTank` INTEGER NOT NULL DEFAULT 1,
                `notes` TEXT NOT NULL DEFAULT '',
                `createdAt` INTEGER NOT NULL DEFAULT 0
            )
        """.trimIndent())
    }
}

private val MIGRATION_5_6 = object : Migration(5, 6) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE `car_documents` ADD COLUMN `fileData` TEXT")
        db.execSQL("ALTER TABLE `car_documents` ADD COLUMN `fileName` TEXT")
        db.execSQL("ALTER TABLE `car_documents` ADD COLUMN `fileType` TEXT")
    }
}

private val MIGRATION_6_7 = object : Migration(6, 7) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `sync_queue` (
                `fieldId` TEXT NOT NULL PRIMARY KEY,
                `enqueuedAt` INTEGER NOT NULL DEFAULT 0
            )
        """.trimIndent())
    }
}

private val MIGRATION_3_4 = object : Migration(3, 4) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `journal_entries` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `date` TEXT NOT NULL,
                `content` TEXT NOT NULL DEFAULT '',
                `mood` TEXT NOT NULL DEFAULT '',
                `moodLabel` TEXT NOT NULL DEFAULT '',
                `aiReflection` TEXT NOT NULL DEFAULT '',
                `wordCount` INTEGER NOT NULL DEFAULT 0,
                `createdAt` INTEGER NOT NULL DEFAULT 0,
                `updatedAt` INTEGER NOT NULL DEFAULT 0
            )
        """.trimIndent())
    }
}

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides @Singleton
    fun provideDatabase(@ApplicationContext ctx: Context): HomerDatabase =
        Room.databaseBuilder(ctx, HomerDatabase::class.java, "homer.db")
            .addMigrations(MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6, MIGRATION_6_7)
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
    @Provides fun provideJournalDao(db: HomerDatabase)    = db.journalDao()
    @Provides fun provideCarDao(db: HomerDatabase)        = db.carDao()
    @Provides fun provideSyncQueueDao(db: HomerDatabase)  = db.syncQueueDao()

    @Provides @Singleton
    fun provideAlarmManager(@ApplicationContext ctx: Context): AlarmManager =
        ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
}
