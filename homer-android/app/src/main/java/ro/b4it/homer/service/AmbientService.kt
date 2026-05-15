package ro.b4it.homer.service

import android.app.*
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import ro.b4it.homer.HomerApplication
import ro.b4it.homer.MainActivity
import ro.b4it.homer.R

/** Foreground service that keeps the process alive while ambient sounds are playing.
 *  This prevents the OS from suspending the WebView's JavaScript execution in background. */
class AmbientService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIF_ID, buildNotification())
        return START_STICKY
    }

    private fun buildNotification(): Notification {
        val tap = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, HomerApplication.CHANNEL_AMBIENT)
            .setSmallIcon(R.drawable.ic_homer_splash)
            .setContentTitle("Homer Ambient")
            .setContentText("Ambient sounds playing")
            .setContentIntent(tap)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    companion object {
        const val NOTIF_ID = 1002
    }
}
