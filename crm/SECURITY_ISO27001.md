# Seguridad, ISO 27001 y GDPR

## Alcance realista

Este software incorpora controles tecnicos alineados con buenas practicas de seguridad, pero no certifica por si mismo el cumplimiento de ISO 27001. ISO 27001 requiere un Sistema de Gestion de Seguridad de la Informacion: analisis de riesgos, politicas, responsables, formacion, auditorias, evidencias, revision continua y tratamiento formal de riesgos.

## Controles tecnicos incluidos

### Control de acceso

- Login obligatorio.
- Contrasenas derivadas con PBKDF2.
- Sesiones con cookies `HttpOnly`.
- Proteccion CSRF.
- Roles de usuario.
- Separacion entre usuarios administradores y usuarios operativos.
- Limitacion de intentos de login para reducir ataques de fuerza bruta.

### Cifrado

- Base de datos cifrada en reposo con AES-256-GCM.
- Documentos cifrados individualmente con AES-256-GCM.
- Integridad de datos cifrados mediante etiqueta GCM.

### Auditoria

- Registro de eventos relevantes:
  - login correcto,
  - login fallido,
  - creacion de usuarios,
  - creacion de clientes,
  - creacion de expedientes,
  - consulta de historial de expediente,
  - exportacion de expediente,
  - subida y descarga de documentos.
- Cadena de hash para detectar manipulacion del log.

### Seguridad HTTP

- `Content-Security-Policy`.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: no-referrer`.
- `Permissions-Policy` restrictiva.
- HSTS cuando `CRM_COOKIE_SECURE=true`.

### Minimizacion

- El CRM permite guardar solo la informacion necesaria para cliente, expediente, tareas, calendario, tiempos, notas y documentos.
- Los datos operativos se mantienen fuera del repositorio mediante `.gitignore`.
- El registro de tiempos separa entradas facturables y no facturables para facilitar control economico sin exponer datos fuera del sistema.
- Si `CRM_HOST=127.0.0.1`, el CRM solo responde en el propio PC y no queda accesible desde internet ni desde la red local.
- Las credenciales de Gmail se guardan en `.env`, fuera del repositorio.
- La clave de OpenAI se guarda en `.env`, fuera del repositorio, y solo la usa el servidor local.

## Medidas necesarias fuera del codigo

Para aproximarse a ISO 27001/GDPR en un despacho real:

1. Inventario de activos: CRM, equipos, cuentas, correo, backups, moviles.
2. Analisis de riesgos documentado.
3. Politica de contrasenas y MFA.
4. Procedimiento de altas y bajas de usuarios.
5. Registro de accesos revisado periodicamente.
6. Backups cifrados y prueba de restauracion.
7. Control de proveedores tecnologicos.
8. Acuerdo de confidencialidad con usuarios internos.
9. Procedimiento de brechas de seguridad.
10. Politica de conservacion y borrado de expedientes.
11. Informacion legal y contratos de encargado de tratamiento si aplica.
12. Formacion minima del personal.

## Recomendaciones de despliegue

- Usar HTTPS obligatorio.
- Activar `CRM_COOKIE_SECURE=true`.
- Restringir acceso por VPN, Cloudflare Access o lista de IPs.
- Para uso en un unico PC, mantener `CRM_HOST=127.0.0.1`.
- Activar MFA en cuentas del proveedor de hosting.
- No ejecutar como administrador del sistema.
- Copias de seguridad diarias cifradas.
- Revision mensual del log de auditoria.

## Riesgos pendientes del MVP

- Las sesiones son en memoria; si se reinicia el servidor, se cierran.
- No hay MFA integrado en esta primera version.
- No hay flujo de borrado/retencion automatizado.
- No hay firma digital ni integracion con LexNET/e-justicia.
- No hay versionado documental.
- No hay antivirus para documentos subidos.
- El lanzador local no sustituye a un despliegue profesional con HTTPS, MFA, backups y control de acceso perimetral.
- Las consultas a OpenAI pueden incluir contexto de cliente/expediente seleccionado. Debe revisarse el criterio de minimizacion de datos antes de usarlo con informacion especialmente sensible.

## Siguiente fase recomendada

1. MFA por TOTP.
2. Historial de versiones de documentos.
3. Plantillas de escritos.
4. Facturacion/proformas.
5. Control de retencion y borrado.
6. Backups automatizados.
7. Despliegue detras de Cloudflare Access.
8. Portal privado para clientes.
