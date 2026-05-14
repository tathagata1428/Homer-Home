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
import ro.b4it.homer.ui.screens.placeholder.PlaceholderScreen

@Composable
fun AppNavHost(
    navController: NavHostController,
    innerPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    NavHost(
        navController  = navController,
        startDestination = Screen.Home.route,
        modifier       = modifier.padding(innerPadding),
    ) {
        composable(Screen.Home.route)       { PlaceholderScreen("Home") }
        composable(Screen.Focus.route)      { PlaceholderScreen("Focus") }
        composable(Screen.Tools.route)      { PlaceholderScreen("Tools") }
        composable(Screen.Vault.route)      { PlaceholderScreen("Vault") }
        composable(Screen.Joey.route)       { PlaceholderScreen("Joey AI") }

        composable(Screen.FocusLab.route)   { PlaceholderScreen("Focus Lab") }
        composable(Screen.Investing.route)  { PlaceholderScreen("Investing") }
        composable(Screen.Links.route)      { PlaceholderScreen("Links") }
        composable(Screen.News.route)       { PlaceholderScreen("News") }
        composable(Screen.Notes.route)      { PlaceholderScreen("Notes") }
        composable(Screen.DailyBrief.route) { PlaceholderScreen("Daily Brief") }
        composable(Screen.Account.route)    { PlaceholderScreen("Account") }
        composable(Screen.Sync.route)       { PlaceholderScreen("Sync") }
        composable(Screen.Settings.route)   { PlaceholderScreen("Settings") }

        composable(Screen.Ledger.route)     { PlaceholderScreen("Expense Ledger") }
        composable(Screen.Inbox.route)      { PlaceholderScreen("Inbox") }
        composable(Screen.Habits.route)     { PlaceholderScreen("Habits") }
        composable(Screen.LifeGoals.route)  { PlaceholderScreen("Life Goals") }
        composable(Screen.Secrets.route)    { PlaceholderScreen("Passwords & Secrets") }
        composable(Screen.SecretNotes.route){ PlaceholderScreen("Secret Notes") }
        composable(Screen.Calendar.route)   { PlaceholderScreen("Calendar") }
        composable(Screen.Kanban.route)     { PlaceholderScreen("Kanban Board") }

        composable(
            route    = Screen.KanbanTask.route,
            arguments = listOf(navArgument("taskId") { type = NavType.StringType }),
        ) { back ->
            val taskId = back.arguments?.getString("taskId") ?: return@composable
            PlaceholderScreen("Task: $taskId")
        }
    }
}
