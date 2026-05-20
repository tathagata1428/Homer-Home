package ro.b4it.homer.ui.navigation

sealed class Screen(val route: String) {
    // Bottom nav
    object Home       : Screen("home")
    object Focus      : Screen("focus")
    object Tools      : Screen("tools")
    object Vault      : Screen("vault")
    object Joey       : Screen("joey")

    // More sheet destinations
    object Ambient    : Screen("ambient")
    object FocusLab   : Screen("focus_lab")
    object Investing  : Screen("investing")
    object Links      : Screen("links")
    object News       : Screen("news")
    object Notes      : Screen("notes")
    object DailyBrief : Screen("daily_brief")
    object Account    : Screen("account")
    object Sync       : Screen("sync")
    object Settings   : Screen("settings")

    // Vault sub-screens
    object VaultUnlock    : Screen("vault_unlock")
    object VaultDashboard : Screen("vault_dashboard")
    object Kanban         : Screen("kanban")
    object KanbanTask     : Screen("kanban_task/{taskId}") {
        fun route(taskId: String) = "kanban_task/$taskId"
    }
    object LifeGoals      : Screen("life_goals")
    object Secrets        : Screen("secrets")
    object SecretNotes    : Screen("secret_notes")
    object Habits         : Screen("habits")
    object Calendar       : Screen("calendar")
    object Ledger         : Screen("ledger")
    object Inbox          : Screen("inbox")
    object Reminders      : Screen("reminders")
    object Journal        : Screen("journal")
    object JournalEditor  : Screen("journal_entry/{entryId}") {
        fun route(entryId: String) = "journal_entry/$entryId"
    }
    object Car            : Screen("car")
    object Countdown      : Screen("countdown")
}
