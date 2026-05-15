package ro.b4it.homer.ui

import android.Manifest
import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import ro.b4it.homer.ui.navigation.AppNavHost
import ro.b4it.homer.ui.navigation.Screen
import ro.b4it.homer.ui.theme.*

private data class BottomNavItem(val screen: Screen, val label: String, val icon: ImageVector)

private val bottomNavItems = listOf(
    BottomNavItem(Screen.Home,  "Home",  Icons.Filled.Home),
    BottomNavItem(Screen.Focus, "Focus", Icons.Filled.Timer),
    BottomNavItem(Screen.Vault, "Vault", Icons.Filled.Lock),
    BottomNavItem(Screen.Joey,  "Joey",  Icons.Filled.Chat),
)

private data class MoreItem(val emoji: String, val label: String, val screen: Screen)

private val moreItems = listOf(
    MoreItem("🧪", "Focus Lab",   Screen.FocusLab),
    MoreItem("🔧", "Tools",       Screen.Tools),
    MoreItem("🎧", "Ambient",     Screen.Ambient),
    MoreItem("📰", "News",        Screen.News),
    MoreItem("📋", "Daily Brief", Screen.DailyBrief),
    MoreItem("💰", "Investing",   Screen.Investing),
    MoreItem("🔗", "Links",       Screen.Links),
    MoreItem("📝", "Notes",       Screen.Notes),
    MoreItem("📥", "Inbox",       Screen.Inbox),
    MoreItem("⏰", "Reminders",   Screen.Reminders),
    MoreItem("👤", "Account",     Screen.Account),
    MoreItem("🔄", "Sync",        Screen.Sync),
    MoreItem("⚙️", "Settings",    Screen.Settings),
)

private val moreRoutes = moreItems.map { it.screen.route }.toSet()

@OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)
@Composable
fun HomerApp() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    var showMore by remember { mutableStateOf(false) }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val notifPermission = rememberPermissionState(Manifest.permission.POST_NOTIFICATIONS)
        LaunchedEffect(Unit) {
            if (!notifPermission.status.isGranted) notifPermission.launchPermissionRequest()
        }
    }

    if (showMore) {
        ModalBottomSheet(
            onDismissRequest = { showMore = false },
            containerColor = BgCard,
            dragHandle = { BottomSheetDefaults.DragHandle(color = TextSubtle) },
        ) {
            Column(
                modifier = Modifier
                    .padding(horizontal = 16.dp)
                    .navigationBarsPadding(),
            ) {
                Text(
                    "More",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 16.dp),
                )
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.heightIn(max = 600.dp),
                ) {
                    items(moreItems) { item ->
                        val isSelected = currentRoute == item.screen.route
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .clip(RoundedCornerShape(14.dp))
                                .background(if (isSelected) AccentBlue.copy(alpha = 0.15f) else BgCardAlt)
                                .clickable {
                                    showMore = false
                                    navController.navigate(item.screen.route) {
                                        popUpTo(Screen.Home.route) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                                .padding(vertical = 12.dp, horizontal = 8.dp),
                        ) {
                            Text(item.emoji, fontSize = 26.sp)
                            Spacer(Modifier.height(6.dp))
                            Text(
                                item.label,
                                style = MaterialTheme.typography.labelSmall,
                                color = if (isSelected) AccentBlue else TextMuted,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = BgPrimary,
        bottomBar = {
            NavigationBar(
                containerColor = BgCard,
                tonalElevation = 0.dp,
            ) {
                bottomNavItems.forEach { item ->
                    NavigationBarItem(
                        selected = currentRoute == item.screen.route,
                        onClick = {
                            navController.navigate(item.screen.route) {
                                popUpTo(Screen.Home.route) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor   = AccentBlue,
                            selectedTextColor   = AccentBlue,
                            unselectedIconColor = TextMuted,
                            unselectedTextColor = TextMuted,
                            indicatorColor      = BgCardAlt,
                        ),
                    )
                }
                NavigationBarItem(
                    selected = currentRoute in moreRoutes,
                    onClick = { showMore = true },
                    icon = { Icon(Icons.Filled.GridView, contentDescription = "More") },
                    label = { Text("More") },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor   = AccentBlue,
                        selectedTextColor   = AccentBlue,
                        unselectedIconColor = TextMuted,
                        unselectedTextColor = TextMuted,
                        indicatorColor      = BgCardAlt,
                    ),
                )
            }
        },
    ) { innerPadding ->
        AppNavHost(navController = navController, innerPadding = innerPadding)
    }
}
