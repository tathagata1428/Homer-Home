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
import ro.b4it.homer.ui.screens.focuslab.FocusLabScreen
import ro.b4it.homer.ui.screens.habits.HabitsScreen
import ro.b4it.homer.ui.screens.home.HomeScreen
import ro.b4it.homer.ui.screens.inbox.InboxScreen
import ro.b4it.homer.ui.screens.investing.InvestingScreen
import ro.b4it.homer.ui.screens.joey.JoeyScreen
import ro.b4it.homer.ui.screens.ledger.LedgerScreen
import ro.b4it.homer.ui.screens.links.LinksScreen
import ro.b4it.homer.ui.screens.news.NewsScreen
import ro.b4it.homer.ui.screens.focus.FocusScreen
import ro.b4it.homer.ui.screens.tools.ToolsScreen
import ro.b4it.homer.ui.screens.vault.VaultScreen
import ro.b4it.homer.ui.screens.placeholder.PlaceholderScreen

@Composable
fun AppNavHost(
    navController: NavHostController,
    innerPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    NavHost(
        navController   = navController,
        startDestination = Screen.Home.route,
        modifier        = modifier.padding(innerPadding),
    ) {
        // ---- Bottom nav ----
        composable(Screen.Home.route)       { HomeScreen() }
        composable(Screen.Focus.route)      { FocusScreen() }
        composable(Screen.Tools.route)      { ToolsScreen() }
        composable(Screen.Vault.route)      { VaultScreen(navController) }
        composable(Screen.Joey.route)       { JoeyScreen() }

        // ---- More sheet ----
        composable(Screen.FocusLab.route)   { FocusLabScreen() }
        composable(Screen.Investing.route)  { InvestingScreen() }
        composable(Screen.Links.route)      { LinksScreen() }
        composable(Screen.News.route)       { NewsScreen() }
        composable(Screen.Notes.route)      { PlaceholderScreen("Notes") }
        composable(Screen.DailyBrief.route) { PlaceholderScreen("Daily Brief") }
        composable(Screen.Account.route)    { PlaceholderScreen("Account") }
        composable(Screen.Sync.route)       { PlaceholderScreen("Sync") }
        composable(Screen.Settings.route)   { PlaceholderScreen("Settings") }

        // ---- Vault sub-screens ----
        composable(Screen.Ledger.route)     { LedgerScreen() }
        composable(Screen.Inbox.route)      { InboxScreen() }
        composable(Screen.Habits.route)     { HabitsScreen() }
        composable(Screen.LifeGoals.route)  { PlaceholderScreen("Life Goals") }
        composable(Screen.Secrets.route)    { PlaceholderScreen("Passwords & Secrets") }
        composable(Screen.SecretNotes.route){ PlaceholderScreen("Secret Notes") }
        composable(Screen.Calendar.route)   { PlaceholderScreen("Calendar") }
        composable(Screen.Kanban.route)     { PlaceholderScreen("Kanban Board") }

        composable(
            route     = Screen.KanbanTask.route,
            arguments = listOf(navArgument("taskId") { type = NavType.StringType }),
        ) { back ->
            val taskId = back.arguments?.getString("taskId") ?: return@composable
            PlaceholderScreen("Task: $taskId")
        }
    }
}
