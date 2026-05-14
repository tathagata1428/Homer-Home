package ro.b4it.homer.notification

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.flow.first
import ro.b4it.homer.HomerApplication
import ro.b4it.homer.MainActivity
import ro.b4it.homer.R
import ro.b4it.homer.data.local.dao.HabitDao

@HiltWorker
class HabitReminderWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val habitDao: HabitDao,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // Permission check (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (applicationContext.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return Result.success()
            }
        }

        val habits = habitDao.getActiveHabits().first()
        if (habits.isEmpty()) return Result.success()

        val count = habits.size
        val listText = habits.take(5)
            .joinToString("\n") { "• ${it.emoji.ifBlank { "✅" }} ${it.name}" }
        val suffix = if (count > 5) "\n+${count - 5} more" else ""

        val tapIntent = PendingIntent.getActivity(
            applicationContext, NOTIF_ID,
            Intent(applicationContext, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_SINGLE_TOP },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(applicationContext, HomerApplication.CHANNEL_REMINDERS)
            .setSmallIcon(R.drawable.ic_homer_splash)
            .setContentTitle("Daily Habits — $count to do")
            .setContentText(habits.firstOrNull()?.name ?: "")
            .setStyle(NotificationCompat.BigTextStyle().bigText(listText + suffix))
            .setContentIntent(tapIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        NotificationManagerCompat.from(applicationContext).notify(NOTIF_ID, notification)
        return Result.success()
    }

    companion object {
        const val NOTIF_ID = 2001
    }
}
