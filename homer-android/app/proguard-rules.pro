-keep class ro.b4it.homer.data.local.entity.** { *; }
-keep class ro.b4it.homer.data.supabase.** { *; }
-keepattributes *Annotation*
-keepattributes Signature
# Ktor / Supabase
-keep class io.ktor.** { *; }
-keep class io.github.jan.tennert.supabase.** { *; }
# Kotlinx serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keep,includedescriptorclasses class ro.b4it.homer.**$$serializer { *; }
-keepclassmembers class ro.b4it.homer.** {
    *** Companion;
}
-keepclasseswithmembers class ro.b4it.homer.** {
    kotlinx.serialization.KSerializer serializer(...);
}
