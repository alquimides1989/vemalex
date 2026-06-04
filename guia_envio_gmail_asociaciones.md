# Envío de emails a asociaciones desde Gmail

## Opción recomendada: crear borradores

No es necesario dar acceso directo a Gmail. El flujo más seguro es crear borradores en tu propia cuenta y revisarlos antes de enviar.

## Pasos

1. Entra en https://script.google.com/
2. Crea un proyecto nuevo.
3. Borra el contenido inicial del editor.
4. Copia y pega el contenido de `gmail_asociaciones_borradores.gs`.
5. Guarda el proyecto como `VEMALEX asociaciones`.
6. Ejecuta primero `previsualizarAsociaciones`.
7. Autoriza el acceso cuando Google lo pida.
8. Revisa el registro para confirmar destinatarios y asuntos.
9. Ejecuta `crearBorradoresAsociaciones`.
10. En Gmail, revisa los borradores con la etiqueta `VEMALEX asociaciones`.

## Qué hace el script

- Lee el archivo de plantillas publicado en GitHub.
- Detecta cada bloque con `Para:` y `Asunto:`.
- Crea un borrador individual por asociación.
- Añade la etiqueta `VEMALEX asociaciones`.
- No envía correos automáticamente.

## Revisión antes de enviar

Antes de enviar, revisar:

- destinatario,
- asunto,
- texto del correo,
- firma,
- que el email sea público o corporativo,
- que se mantenga la frase de baja: `Si preferís no recibir más comunicaciones de este tipo...`

## Archivo fuente

El script toma los emails desde:

https://github.com/alquimides1989/vemalex/blob/main/emails_personalizados_asociaciones_vemalex.md
