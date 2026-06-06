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
- Calendario de plazos, citas, vistas y recordatorios.
- Registro de tiempos y control facturable.
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

La carpeta critica es:

```text
crm/data/
```

Contiene usuarios, base cifrada, documentos cifrados y auditoria. Debe copiarse cifrada y conservarse fuera del repositorio.

## Recuperacion

Para restaurar:

1. Instalar la misma version del CRM.
2. Copiar `crm/data/`.
3. Usar la misma `CRM_MASTER_KEY`.

Sin la `CRM_MASTER_KEY`, los datos cifrados no podran recuperarse.
