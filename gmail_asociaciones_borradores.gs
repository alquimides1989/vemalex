/**
 * VEMALEX - Borradores Gmail para asociaciones
 *
 * Uso recomendado:
 * 1. Abrir https://script.google.com/
 * 2. Crear un proyecto nuevo.
 * 3. Pegar este archivo completo.
 * 4. Ejecutar crearBorradoresAsociaciones().
 *
 * El script crea borradores en Gmail. No envía correos.
 */

const PLANTILLAS_URL =
  'https://raw.githubusercontent.com/alquimides1989/vemalex/main/emails_personalizados_asociaciones_vemalex.md';

const ETIQUETA_GMAIL = 'VEMALEX asociaciones';
const LIMITE_BORRADORES = 100;

function crearBorradoresAsociaciones() {
  const plantillas = obtenerPlantillas_();
  const etiqueta = GmailApp.getUserLabelByName(ETIQUETA_GMAIL) || GmailApp.createLabel(ETIQUETA_GMAIL);
  let creados = 0;

  plantillas.slice(0, LIMITE_BORRADORES).forEach((email) => {
    if (!email.para || !email.asunto || !email.cuerpo) {
      return;
    }

    const borrador = GmailApp.createDraft(email.para, email.asunto, email.cuerpo, {
      name: 'VEMALEX Abogados',
    });

    const mensaje = borrador.getMessage();
    etiqueta.addToThread(mensaje.getThread());
    creados += 1;
  });

  Logger.log(`Borradores creados: ${creados}`);
}

function previsualizarAsociaciones() {
  const plantillas = obtenerPlantillas_();
  Logger.log(`Correos detectados: ${plantillas.length}`);
  plantillas.forEach((email, index) => {
    Logger.log(`${index + 1}. ${email.para} | ${email.asunto}`);
  });
}

function obtenerPlantillas_() {
  const respuesta = UrlFetchApp.fetch(PLANTILLAS_URL, { muteHttpExceptions: true });
  const status = respuesta.getResponseCode();

  if (status < 200 || status >= 300) {
    throw new Error(`No se pudo cargar el archivo de plantillas. Estado HTTP: ${status}`);
  }

  return parsearMarkdown_(respuesta.getContentText());
}

function parsearMarkdown_(markdown) {
  const bloques = markdown
    .split(/\n---\n/g)
    .map((bloque) => bloque.trim())
    .filter((bloque) => bloque.includes('Para:') && bloque.includes('Asunto:'));

  return bloques.map((bloque) => {
    const lineas = bloque.split(/\r?\n/);
    const paraLinea = lineas.find((linea) => linea.startsWith('Para:')) || '';
    const asuntoLinea = lineas.find((linea) => linea.startsWith('Asunto:')) || '';
    const indiceAsunto = lineas.findIndex((linea) => linea.startsWith('Asunto:'));

    const cuerpo = lineas
      .slice(indiceAsunto + 1)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim();

    return {
      para: limpiarValor_(paraLinea.replace(/^Para:\s*/i, '')),
      asunto: limpiarValor_(asuntoLinea.replace(/^Asunto:\s*/i, '')),
      cuerpo,
    };
  });
}

function limpiarValor_(valor) {
  return valor.replace(/\s+$/g, '').replace(/\s{2,}/g, ' ').trim();
}
