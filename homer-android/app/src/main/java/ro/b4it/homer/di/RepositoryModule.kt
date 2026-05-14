package ro.b4it.homer.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/**
 * Repository bindings — filled in as repository classes are implemented per phase.
 * Hilt @Binds go here to map interfaces → implementations.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule
// Bindings added as repositories are built in Phases 1-14
