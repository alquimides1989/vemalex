# VEMALEX Sesiones Jurídicas

App instalable en Android para reservar sesiones pagadas de asistencia jurídica.

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
- Datos de contacto y resumen del caso.
- Envío por WhatsApp o email.
- Pago mediante enlace configurable.
- Historial local en el dispositivo.
- Manifest y service worker para instalación en Android.

## Nota de publicación en Google Play

Las sesiones 1:1 de asesoramiento especializado pueden quedar fuera de la obligación de Google Play Billing si son servicios entre dos personas y no quedan disponibles como contenido digital reproducible dentro de la app. Aun así, antes de publicarla en Play Store conviene revisar la política vigente y la ficha concreta de la app.
