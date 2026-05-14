package ro.b4it.homer.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.jan.tennert.supabase.SupabaseClient
import io.github.jan.tennert.supabase.auth.Auth
import io.github.jan.tennert.supabase.createSupabaseClient
import io.github.jan.tennert.supabase.postgrest.Postgrest
import io.github.jan.tennert.supabase.realtime.Realtime
import io.github.jan.tennert.supabase.storage.Storage
import io.ktor.client.engine.android.Android
import ro.b4it.homer.BuildConfig
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides @Singleton
    fun provideSupabaseClient(): SupabaseClient = createSupabaseClient(
        supabaseUrl    = BuildConfig.SUPABASE_URL,
        supabaseKey    = BuildConfig.SUPABASE_ANON_KEY,
    ) {
        install(Auth)
        install(Postgrest)
        install(Realtime)
        install(Storage)
        httpEngine = Android.create()
    }
}
