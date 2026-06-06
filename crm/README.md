# VEMALEX CRM

CRM privado para centralizar clientes, expedientes, tareas, calendario, tiempos, notas, documentos y auditoria interna del despacho.

## Importante

No publiques esta carpeta como web publica de Cloudflare Pages. Este CRM debe ejecutarse en un entorno privado con HTTPS, control de acceso y backups.

## Funcionalidades

- Login con contrasena derivada mediante PBKDF2.
- Sesion con cookie `HttpOnly` y `SameSite=Strict`.
- Proteccion CSRF en operaciones de escritura.
- Roles: `admin`, `lawyer`, `staff`, `read_only`.
- Clientes.
- Expedientes con exportacion e historial cronologico.
- Tareas.
- Busqueda global y control inicial de conflictos.
- Calendario mensual funcional de plazos, citas, vistas y recordatorios.
- Registro de tiempos y control facturable.
- Envio de correos con Gmail mediante credenciales privadas en `.env`.
- Asistente ChatGPT interno mediante OpenAI API.
- Perfiles IA configurables para replicar instrucciones de GPTs personalizados.
- Exportacion a Excel de clientes, expedientes, tareas, agenda, tiempos, documentos, correos y expediente individual.
- Backups locales fechados en `crm/backups`.
- Notas internas.
- Documentos cifrados con AES-256-GCM.
- Categorias documentales.
- Base de datos cifrada en reposo.
- Registro de auditoria con cadena de hash.
- Cabeceras de seguridad HTTP.
- Limitacion de intentos de login.
- Lanzador local de Windows.

## Abrir en este PC

Haz doble clic en:

```text
VEMALEX CRM.exe
```

El lanzador abre el CRM en:

```text
http://127.0.0.1:8787
```

Consulta tambien `INSTALAR_EN_PC.md`.

Si Windows bloquea el ejecutable por no estar firmado, usa `VEMALEX CRM.cmd`.

## Base de datos local

Los datos no se suben a internet. El CRM guarda la informacion en:

```text
crm/data/store.enc
```

Ese archivo esta cifrado con `CRM_MASTER_KEY` y la carpeta `crm/data` esta fuera del repositorio. Para mantenerlo privado en un unico PC, usa:

```text
CRM_HOST=127.0.0.1
```

No uses `0.0.0.0` salvo que quieras permitir acceso desde otros equipos de la red local.

## Gmail

Para enviar correos desde el CRM con Gmail:

1. Activa la verificacion en dos pasos en la cuenta de Google.
2. Crea una contrasena de aplicacion para correo.
3. Rellena en `.env`:

```text
GMAIL_USER=tu-cuenta@gmail.com
GMAIL_APP_PASSWORD=contrasena-de-aplicacion
MAIL_FROM=tu-cuenta@gmail.com
```

No guardes la contrasena de Gmail normal. Google recomienda usar contrasena de aplicacion u OAuth para este tipo de integraciones.

## ChatGPT / OpenAI

La API de OpenAI se configura en `.env`:

```text
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini
```

Los GPTs personalizados de ChatGPT no se invocan directamente por nombre desde la API. La app incluye perfiles IA internos donde puedes pegar las instrucciones de tus GPTs personalizados y usarlos con los datos seleccionados del CRM.

La clave se usa solo en el servidor local y no se envia al navegador.

## Primer arranque local

1. Copia `.env.example` como `.env`, o usa el lanzador para crearlo.
2. Cambia:
   - `CRM_MASTER_KEY`
   - `CRM_ADMIN_EMAIL`
   - `CRM_ADMIN_PASSWORD`
3. Ejecuta:

```powershell
npm start
```

4. Abre:

```text
http://127.0.0.1:8787
```

## Produccion

Recomendado:

- VPS pequeno o servidor privado.
- HTTPS obligatorio.
- `CRM_COOKIE_SECURE=true`.
- Firewall permitiendo solo IPs autorizadas o acceso mediante VPN.
- Backups cifrados diarios de `crm/data`.
- Usuario de sistema sin privilegios.
- Monitorizacion de logs.

No recomendado:

- Subirlo como esta a un hosting estatico.
- Compartir la carpeta `crm/data`.
- Usar claves debiles.
- Exponerlo sin HTTPS.

## Backups

La carpeta critica de datos activos es:

```text
crm/data/
```

Contiene usuarios, base cifrada, documentos cifrados y auditoria. Debe copiarse cifrada y conservarse fuera del repositorio.

Desde la pantalla `Backups` del CRM puedes crear una copia local completa en:

```text
crm/backups/
```

Cada backup incluye:

- `store.enc`: base cifrada con clientes, expedientes, agenda, tiempos, IA, etc.
- `users.json`: usuarios.
- `audit.jsonl`: auditoria.
- `documents/`: documentos cifrados.
- `manifest.json`: resumen del backup.

La carpeta `crm/backups/` esta ignorada por Git y no se sube a GitHub.

## Recuperacion

Para restaurar:

1. Instalar la misma version del CRM.
2. Copiar `crm/data/`.
3. Usar la misma `CRM_MASTER_KEY`.

Sin la `CRM_MASTER_KEY`, los datos cifrados no podran recuperarse.
