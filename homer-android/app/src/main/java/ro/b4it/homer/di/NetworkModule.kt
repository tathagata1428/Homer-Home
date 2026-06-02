package ro.b4it.homer.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import ro.b4it.homer.BuildConfig
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides @Named("supabaseUrl")     fun provideSupabaseUrl():     String = BuildConfig.SUPABASE_URL
    @Provides @Named("supabaseAnonKey") fun provideSupabaseAnonKey(): String = BuildConfig.SUPABASE_ANON_KEY
    @Provides @Named("syncEmail")       fun provideSyncEmail():       String = BuildConfig.SUPABASE_SYNC_EMAIL
    @Provides @Named("syncPassword")    fun provideSyncPassword():    String = BuildConfig.SUPABASE_SYNC_PASSWORD

    // Keep homerBaseUrl for other consumers (JoeyViewModel, weather, etc.)
    @Provides @Named("homerBaseUrl") fun provideHomerBaseUrl(): String = BuildConfig.HOMER_BASE_URL

    @Provides @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30,  TimeUnit.SECONDS)
        .build()
}
