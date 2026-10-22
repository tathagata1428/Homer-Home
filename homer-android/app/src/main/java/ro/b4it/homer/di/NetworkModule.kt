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

    @Provides @Named("syncUsername") fun provideSyncUsername(): String = BuildConfig.HOMER_SYNC_USERNAME
    @Provides @Named("syncPassword") fun provideSyncPassword(): String = BuildConfig.HOMER_SYNC_PASSWORD

    // Sync, Joey, weather, etc. all talk to the Homer website API
    @Provides @Named("homerBaseUrl") fun provideHomerBaseUrl(): String = BuildConfig.HOMER_BASE_URL

    @Provides @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30,  TimeUnit.SECONDS)
        .build()
}
