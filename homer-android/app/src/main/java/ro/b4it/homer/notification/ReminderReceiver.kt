package ro.b4it.homer.notification

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import dagger.hilt.android.AndroidEntryPoint
import ro.b4it.homer.HomerApplication
import ro.b4it.homer.MainActivity
import ro.b4it.homer.R
import javax.inject.Inject

@AndroidEntryPoint
class ReminderReceiver : BroadcastReceiver() {

    @Inject lateinit var reminderManager: ReminderManager

    override fun onReceive(ctx: Context, intent: Intent) {
        val title      = intent.getStringExtra(EXTRA_TITLE) ?: return
        val body       = intent.getStringExtra(EXTRA_BODY) ?: ""
        val notifId    = intent.getIntExtra(EXTRA_NOTIF_ID, 0)
        val reminderId = intent.getStringExtra(EXTRA_REMINDER_ID) ?: ""
        val recurType  = intent.getStringExtra(EXTRA_RECUR_TYPE) ?: "none"
        val firedAt    = intent.getLongExtra(EXTRA_FIRE_AT, System.currentTimeMillis())

        // Permission check (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ctx.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        }

        val tapIntent = PendingIntent.getActivity(
            ctx, notifId,
            Intent(ctx, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_SINGLE_TOP },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(ctx, HomerApplication.CHANNEL_REMINDERS)
            .setSmallIcon(R.drawable.ic_homer_splash)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(tapIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        NotificationManagerCompat.from(ctx).notify(notifId, notification)

        // Re-schedule if recurring
        if (reminderId.isNotBlank() && recurType != "none") {
            reminderManager.rescheduleRecurring(reminderId, recurType, firedAt)
        }
    }

    companion object {
        const val EXTRA_TITLE       = "rem_title"
        const val EXTRA_BODY        = "rem_body"
        const val EXTRA_NOTIF_ID    = "rem_notif_id"
        const val EXTRA_REMINDER_ID = "rem_reminder_id"
        const val EXTRA_RECUR_TYPE  = "rem_recur_type"
        const val EXTRA_FIRE_AT     = "rem_fire_at"
    }
}
