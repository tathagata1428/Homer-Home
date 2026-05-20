package ro.b4it.homer.ui.navigation

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import ro.b4it.homer.ui.screens.account.AccountScreen
import ro.b4it.homer.ui.screens.ambient.AmbientSoundsScreen
import ro.b4it.homer.ui.screens.calendar.CalendarScreen
import ro.b4it.homer.ui.screens.dailybrief.DailyBriefScreen
import ro.b4it.homer.ui.screens.focus.FocusScreen
import ro.b4it.homer.ui.screens.focuslab.FocusLabScreen
import ro.b4it.homer.ui.screens.habits.HabitsScreen
import ro.b4it.homer.ui.screens.home.HomeScreen
import ro.b4it.homer.ui.screens.inbox.InboxScreen
import ro.b4it.homer.ui.screens.investing.InvestingScreen
import ro.b4it.homer.ui.screens.joey.JoeyScreen
import ro.b4it.homer.ui.screens.kanban.KanbanScreen
import ro.b4it.homer.ui.screens.kanban.KanbanTaskDetailScreen
import ro.b4it.homer.ui.screens.ledger.LedgerScreen
import ro.b4it.homer.ui.screens.lifegoals.LifeGoalsScreen
import ro.b4it.homer.ui.screens.links.LinksScreen
import ro.b4it.homer.ui.screens.news.NewsScreen
import ro.b4it.homer.ui.screens.journal.JournalEditorScreen
import ro.b4it.homer.ui.screens.journal.JournalScreen
import ro.b4it.homer.ui.screens.notes.NotesScreen
import ro.b4it.homer.ui.screens.reminders.RemindersScreen
import ro.b4it.homer.ui.screens.secrets.SecretNotesScreen
import ro.b4it.homer.ui.screens.secrets.SecretsScreen
import ro.b4it.homer.ui.screens.settings.SettingsScreen
import ro.b4it.homer.ui.screens.sync.SyncScreen
import ro.b4it.homer.ui.screens.tools.ToolsScreen
import ro.b4it.homer.ui.screens.car.CarScreen
import ro.b4it.homer.ui.screens.countdown.CountdownScreen
import ro.b4it.homer.ui.screens.vault.VaultScreen

@Composable
fun AppNavHost(
    navController: NavHostController,
    innerPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    NavHost(
        navController    = navController,
        startDestination = Screen.Home.route,
        modifier         = modifier.padding(innerPadding),
    ) {
        // ---- Bottom nav ----
        composable(Screen.Home.route)       { HomeScreen() }
        composable(Screen.Focus.route)      { FocusScreen() }
        composable(Screen.Tools.route)      { ToolsScreen() }
        composable(Screen.Vault.route)      { VaultScreen(navController) }
        composable(Screen.Joey.route)       { JoeyScreen() }

        // ---- More sheet ----
        composable(Screen.Ambient.route)    { AmbientSoundsScreen() }
        composable(Screen.FocusLab.route)   { FocusLabScreen() }
        composable(Screen.Investing.route)  { InvestingScreen() }
        composable(Screen.Links.route)      { LinksScreen() }
        composable(Screen.News.route)       { NewsScreen() }
        composable(Screen.Notes.route)      { NotesScreen() }
        composable(Screen.DailyBrief.route) { DailyBriefScreen() }
        composable(Screen.Account.route)    { AccountScreen() }
        composable(Screen.Sync.route)       { SyncScreen() }
        composable(Screen.Settings.route)    { SettingsScreen(onNavigateReminders = { navController.navigate(Screen.Reminders.route) }) }
        composable(Screen.Reminders.route)   { RemindersScreen() }
        composable(Screen.Journal.route)     {
            JournalScreen(
                onNewEntry   = { navController.navigate(Screen.JournalEditor.route("new")) },
                onEntryClick = { id -> navController.navigate(Screen.JournalEditor.route(id)) },
            )
        }
        composable(
            route     = Screen.JournalEditor.route,
            arguments = listOf(navArgument("entryId") { type = NavType.StringType }),
        ) {
            JournalEditorScreen(onBack = { navController.popBackStack() })
        }

        // ---- Vault sub-screens ----
        composable(Screen.Ledger.route)      { LedgerScreen() }
        composable(Screen.Inbox.route)       { InboxScreen() }
        composable(Screen.Habits.route)      { HabitsScreen() }
        composable(Screen.LifeGoals.route)   { LifeGoalsScreen() }
        composable(Screen.Secrets.route)     { SecretsScreen() }
        composable(Screen.SecretNotes.route) { SecretNotesScreen() }
        composable(Screen.Calendar.route)    { CalendarScreen() }
        composable(Screen.Kanban.route)      { KanbanScreen(onTaskClick = { taskId -> navController.navigate(Screen.KanbanTask.route(taskId)) }) }
        composable(Screen.Car.route)         { CarScreen(onBack = { navController.popBackStack() }) }
        composable(Screen.Countdown.route)   { CountdownScreen() }

        composable(
            route     = Screen.KanbanTask.route,
            arguments = listOf(navArgument("taskId") { type = NavType.StringType }),
        ) {
            KanbanTaskDetailScreen(onBack = { navController.popBackStack() })
        }
    }
}
