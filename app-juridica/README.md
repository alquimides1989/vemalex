# VEMALEX Sesiones Jurídicas

App instalable en Android para reservar sesiones de asistencia jurídica.

## Cómo probarla

Abre `app-juridica/index.html` desde la web publicada:

`https://vemalex.org/app-juridica/`

En Android, Chrome permite instalarla desde el menú con `Añadir a pantalla de inicio`.

## Pagos reales

La app está preparada para usar enlaces de pago externos. Edita `config.js` y pega cada URL en `paymentUrl`.

Ejemplo:

```js
paymentUrl: "https://buy.stripe.com/..."
```

Stripe Payment Links permite cobrar con una página de pago alojada por Stripe sin crear backend propio. Para una confirmación automática de pagos haría falta un backend con webhooks.

## Qué incluye

- Selección de sesión y precio.
- Elección de modalidad: llamada telefonica, videollamada WhatsApp o Google Meet.
- Datos de contacto y resumen del caso.
- Envío por WhatsApp o email.
- Pago mediante enlace configurable.
- Historial local en el dispositivo.
- Manifest y service worker para instalación en Android.

## Version Android descargable

El APK descargable esta disponible en:

`https://vemalex.org/downloads/vemalex-sesiones.apk`

El proyecto Android tambien esta disponible en:

`https://vemalex.org/downloads/vemalex-sesiones-android-source.zip`

Para generar el APK hay que abrir ese proyecto en Android Studio y usar `Build APK`.

## Nota de publicación en Google Play

Las sesiones 1:1 de asesoramiento especializado pueden quedar fuera de la obligación de Google Play Billing si son servicios entre dos personas y no quedan disponibles como contenido digital reproducible dentro de la app. Aun así, antes de publicarla en Play Store conviene revisar la política vigente y la ficha concreta de la app.
