# Seguridad, ISO 27001 y GDPR

## Alcance realista

Este software incorpora controles técnicos alineados con buenas prácticas de seguridad, pero no certifica por sí mismo el cumplimiento de ISO 27001. ISO 27001 requiere un Sistema de Gestión de Seguridad de la Información: análisis de riesgos, políticas, responsables, formación, auditorías, evidencias, revisión continua y tratamiento formal de riesgos.

## Controles técnicos incluidos

### Control de acceso

- Login obligatorio.
- Contraseñas derivadas con PBKDF2.
- Sesiones con cookies `HttpOnly`.
- Protección CSRF.
- Roles de usuario.
- Separación entre usuarios administradores y usuarios operativos.

### Cifrado

- Base de datos cifrada en reposo con AES-256-GCM.
- Documentos cifrados individualmente con AES-256-GCM.
- Integridad de datos cifrados mediante etiqueta GCM.

### Auditoría

- Registro de eventos relevantes:
  - login correcto,
  - login fallido,
  - creación de usuarios,
  - creación de clientes,
  - creación de expedientes,
  - subida y descarga de documentos.
- Cadena de hash para detectar manipulación del log.

### Seguridad HTTP

- `Content-Security-Policy`.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: no-referrer`.
- `Permissions-Policy` restrictiva.
- HSTS cuando `CRM_COOKIE_SECURE=true`.

### Minimización

- El CRM permite guardar solo la información necesaria para cliente, expediente, tareas, notas y documentos.
- Los datos operativos se mantienen fuera del repositorio mediante `.gitignore`.

## Medidas necesarias fuera del código

Para aproximarse a ISO 27001/GDPR en un despacho real:

1. Inventario de activos: CRM, equipos, cuentas, correo, backups, móviles.
2. Análisis de riesgos documentado.
3. Política de contraseñas y MFA.
4. Procedimiento de altas y bajas de usuarios.
5. Registro de accesos revisado periódicamente.
6. Backups cifrados y prueba de restauración.
7. Control de proveedores tecnológicos.
8. Acuerdo de confidencialidad con usuarios internos.
9. Procedimiento de brechas de seguridad.
10. Política de conservación y borrado de expedientes.
11. Información legal y contratos de encargado de tratamiento si aplica.
12. Formación mínima del personal.

## Recomendaciones de despliegue

- Usar HTTPS obligatorio.
- Activar `CRM_COOKIE_SECURE=true`.
- Restringir acceso por VPN, Cloudflare Access o lista de IPs.
- Activar MFA en cuentas del proveedor de hosting.
- No ejecutar como administrador del sistema.
- Copias de seguridad diarias cifradas.
- Revisión mensual del log de auditoría.

## Riesgos pendientes del MVP

- Las sesiones son en memoria; si se reinicia el servidor, se cierran.
- No hay MFA integrado en esta primera versión.
- No hay flujo de borrado/retención automatizado.
- No hay firma digital ni integración con LexNET/e-justicia.
- No hay versionado documental.
- No hay antivirus para documentos subidos.

## Siguiente fase recomendada

1. MFA por TOTP.
2. Historial de versiones de documentos.
3. Calendario de plazos procesales.
4. Plantillas de escritos.
5. Exportación de expediente completo.
6. Control de retención y borrado.
7. Backups automatizados.
8. Despliegue detrás de Cloudflare Access.
