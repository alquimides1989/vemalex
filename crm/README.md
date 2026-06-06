# VEMALEX CRM

CRM privado para centralizar clientes, expedientes, tareas, notas, documentos y auditoría interna del despacho.

## Importante

No publiques esta carpeta como web pública de Cloudflare Pages. Este CRM debe ejecutarse en un entorno privado con HTTPS, control de acceso y backups.

## Funcionalidades

- Login con contraseña derivada mediante PBKDF2.
- Sesión con cookie `HttpOnly` y `SameSite=Strict`.
- Protección CSRF en operaciones de escritura.
- Roles: `admin`, `lawyer`, `staff`, `read_only`.
- Clientes.
- Expedientes.
- Tareas.
- Notas internas.
- Documentos cifrados con AES-256-GCM.
- Base de datos cifrada en reposo.
- Registro de auditoría con cadena de hash.
- Cabeceras de seguridad HTTP.

## Primer arranque local

1. Copia `.env.example` como `.env`.
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

## Producción

Recomendado:

- VPS pequeño o servidor privado.
- HTTPS obligatorio.
- `CRM_COOKIE_SECURE=true`.
- Firewall permitiendo solo IPs autorizadas o acceso mediante VPN.
- Backups cifrados diarios de `crm/data`.
- Usuario de sistema sin privilegios.
- Monitorización de logs.

No recomendado:

- Subirlo como está a un hosting estático.
- Compartir la carpeta `crm/data`.
- Usar claves débiles.
- Exponerlo sin HTTPS.

## Backups

La carpeta crítica es:

```text
crm/data/
```

Contiene:

- usuarios,
- base cifrada,
- documentos cifrados,
- auditoría.

Debe copiarse cifrada y conservarse fuera del repositorio.

## Recuperación

Para restaurar:

1. Instalar la misma versión del CRM.
2. Copiar `crm/data/`.
3. Usar la misma `CRM_MASTER_KEY`.

Sin la `CRM_MASTER_KEY`, los datos cifrados no podrán recuperarse.
