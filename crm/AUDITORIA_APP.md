# Auditoria funcional del CRM

## Mejoras incorporadas

- Logo real de VEMALEX en acceso y navegacion interna.
- Busqueda global para localizar clientes, DNI/NIE, telefonos, expedientes, tareas, documentos, citas y tiempos.
- Control de conflictos inicial al buscar nombres o datos antes de aceptar un asunto.
- Calendario mensual funcional de plazos, citas, vistas y recordatorios con seleccion directa del dia.
- Panel de proximos vencimientos.
- Envio de correos con Gmail desde la app, registrando el historial interno.
- Asistente ChatGPT interno con perfiles configurables y contexto de cliente/expediente.
- Exportaciones Excel para listados operativos y expediente completo.
- Base de datos local cifrada en `crm/data/store.enc`, no expuesta si `CRM_HOST=127.0.0.1`.
- Registro de tiempos por expediente, con marcaje facturable/no facturable y tarifa orientativa.
- Exportacion completa de expediente en JSON para copia interna o migracion.
- Historial cronologico por expediente con notas, tareas, documentos, eventos y tiempos.
- Categorias documentales para ordenar demandas, sentencias, poderes, justificantes o comunicaciones.
- Limitacion de intentos de login para reducir ataques de fuerza bruta.
- Ejecutable y lanzador local de Windows para abrir el CRM con doble clic.

## Funciones habituales de competidores que quedan como fase 2

- MFA con aplicacion autenticadora.
- Agenda sincronizada con Google Calendar o Microsoft 365.
- Plantillas de escritos y generacion de documentos.
- Versionado documental.
- Firma digital e integracion con certificados.
- Facturas/proformas con numeracion.
- Portal privado para clientes.
- Backups automaticos con restauracion probada.
- Antivirus de documentos subidos.
- Integracion con LexNET u otros sistemas judiciales cuando sea viable.

## Veredicto

La aplicacion queda en un nivel solido para uso interno inicial del despacho: centraliza expedientes, documentos, plazos, clientes y actividad. Para produccion real con datos sensibles, se recomienda desplegarla detras de HTTPS y acceso privado, activar copias de seguridad y planificar MFA como siguiente hito.
