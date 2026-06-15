# VEMALEX Sesiones Android

Proyecto Android nativo para generar una app descargable (`.apk`) de VEMALEX Sesiones.

## Como generar el APK

1. Instala Android Studio.
2. Abre la carpeta `android-vemalex-sesiones`.
3. Espera a que Android Studio sincronice Gradle.
4. Ve a `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
5. El APK se genera en `app/build/outputs/apk/debug/app-debug.apk`.

## Que hace

La app abre `https://vemalex.org/app-juridica/` dentro de una WebView Android. Los enlaces externos como WhatsApp, email, Stripe o Google Meet se abren fuera de la app con la aplicacion correspondiente.

## Nota

En este equipo no hay Java, Gradle ni Android SDK instalados, por eso no puedo compilar el APK directamente desde aqui. El proyecto queda listo para compilar en Android Studio.
