# Instalar VEMALEX CRM en el PC

## Acceso rapido

Para abrir el CRM en este ordenador, haz doble clic en:

```text
VEMALEX CRM.exe
```

Si Windows bloquea el ejecutable o el antivirus lo pone en cuarentena por no estar firmado, usa el lanzador alternativo:

```text
VEMALEX CRM.cmd
```

Ambos accesos inician el servidor local y abren el navegador en:

```text
http://127.0.0.1:8787
```

## Primer uso real

Antes de usar datos reales del despacho:

1. Abre `.env`.
2. Cambia `CRM_MASTER_KEY` por una clave larga y unica.
3. Cambia `CRM_ADMIN_PASSWORD`.
4. Guarda ese archivo y no lo subas nunca a internet.

La carpeta `data` contiene usuarios, expedientes y documentos cifrados. Debe tener copia de seguridad.

## Recomendacion

Este archivo es un lanzador local de Windows, no un instalador firmado. Para un uso profesional con varios equipos, lo adecuado es alojarlo en un servidor privado con HTTPS, Cloudflare Access o VPN, y copias de seguridad automaticas.
