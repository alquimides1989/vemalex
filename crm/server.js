const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const http = require("http");
const path = require("path");
const tls = require("tls");
const { URL } = require("url");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DOC_DIR = path.join(DATA_DIR, "documents");
const BACKUP_DIR = path.join(ROOT, "backups");
const STORE_FILE = path.join(DATA_DIR, "store.enc");
const USER_FILE = path.join(DATA_DIR, "users.json");
const AUDIT_FILE = path.join(DATA_DIR, "audit.jsonl");

loadEnv(path.join(ROOT, ".env"));

const CONFIG = {
  host: process.env.CRM_HOST || "127.0.0.1",
  port: Number(process.env.CRM_PORT || 8787),
  masterKey: process.env.CRM_MASTER_KEY || "",
  adminEmail: process.env.CRM_ADMIN_EMAIL || "info@vemalex.com",
  adminPassword: process.env.CRM_ADMIN_PASSWORD || "",
  secureCookie: process.env.CRM_COOKIE_SECURE === "true",
  gmailUser: process.env.GMAIL_USER || "",
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || "",
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpUser: process.env.SMTP_USER || process.env.GMAIL_USER || "",
  smtpPassword: process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || "",
  mailFrom: process.env.MAIL_FROM || process.env.GMAIL_USER || "info@vemalex.com",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-5-mini",
};

if (CONFIG.masterKey.length < 32) {
  console.error("CRM_MASTER_KEY debe tener al menos 32 caracteres.");
  process.exit(1);
}

ensureDirectories();

const sessions = new Map();
const loginAttempts = new Map();
const encryptionKey = crypto.createHash("sha256").update(CONFIG.masterKey).digest();

initUsers();
let store = loadStore();

const server = http.createServer(async (req, res) => {
  try {
    applySecurityHeaders(res);
    if (req.method === "OPTIONS") return sendNoContent(res);

    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Error interno" });
  }
});

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`VEMALEX CRM disponible en http://${CONFIG.host}:${CONFIG.port}`);
});

async function handleApi(req, res, url) {
  if (url.pathname === "/api/login" && req.method === "POST") return login(req, res);

  const session = getSession(req);
  if (!session) return sendJson(res, 401, { error: "No autenticado" });

  if (req.method !== "GET" && req.method !== "HEAD") {
    const csrf = req.headers["x-csrf-token"];
    if (!csrf || csrf !== session.csrf) return sendJson(res, 403, { error: "CSRF invalido" });
  }

  const user = getUserById(session.userId);
  if (!user || user.disabled) return sendJson(res, 401, { error: "Usuario no valido" });

  if (url.pathname === "/api/me" && req.method === "GET") {
    return sendJson(res, 200, { user: publicUser(user), csrfToken: session.csrf });
  }
  if (url.pathname === "/api/logout" && req.method === "POST") {
    sessions.delete(session.token);
    res.setHeader("Set-Cookie", cookie("crm_session", "", { maxAge: 0 }));
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === "/api/summary" && req.method === "GET") return sendJson(res, 200, summary());

  if (url.pathname.startsWith("/api/export/") && req.method === "GET") return exportApi(req, res, user, url);
  if (url.pathname === "/api/search" && req.method === "GET") return searchApi(req, res, user, url);
  if (url.pathname === "/api/users") return usersApi(req, res, user);
  if (url.pathname === "/api/clients") return collectionApi(req, res, user, "clients", ["admin", "lawyer", "staff"]);
  if (url.pathname === "/api/matters") return collectionApi(req, res, user, "matters", ["admin", "lawyer", "staff"]);
  if (url.pathname.startsWith("/api/matters/") && url.pathname.endsWith("/timeline") && req.method === "GET") return matterTimelineApi(req, res, user, url);
  if (url.pathname.startsWith("/api/matters/") && url.pathname.endsWith("/export-xls") && req.method === "GET") return matterExportXlsApi(req, res, user, url);
  if (url.pathname.startsWith("/api/matters/") && url.pathname.endsWith("/export") && req.method === "GET") return matterExportApi(req, res, user, url);
  if (url.pathname === "/api/tasks") return tasksApi(req, res, user);
  if (url.pathname === "/api/events") return collectionApi(req, res, user, "events", ["admin", "lawyer", "staff"]);
  if (url.pathname === "/api/time-entries") return collectionApi(req, res, user, "timeEntries", ["admin", "lawyer", "staff"]);
  if (url.pathname === "/api/email/send" && req.method === "POST") return sendEmailApi(req, res, user);
  if (url.pathname === "/api/email/log" && req.method === "GET") return sendJson(res, 200, { items: store.emailLog });
  if (url.pathname === "/api/ai/profiles") return aiProfilesApi(req, res, user);
  if (url.pathname === "/api/ai/settings") return aiSettingsApi(req, res, user);
  if (url.pathname === "/api/ai/test" && req.method === "POST") return aiTestApi(req, res, user);
  if (url.pathname === "/api/ai/chat" && req.method === "POST") return aiChatApi(req, res, user);
  if (url.pathname === "/api/ai/log" && req.method === "GET") return sendJson(res, 200, { items: store.aiLog });
  if (url.pathname === "/api/notes") return notesApi(req, res, user);
  if (url.pathname === "/api/documents") return documentsApi(req, res, user);
  if (url.pathname.startsWith("/api/documents/") && req.method === "GET") return downloadDocument(req, res, user, url);
  if (url.pathname === "/api/audit" && req.method === "GET") return auditApi(req, res, user);
  if (url.pathname === "/api/backups") return backupsApi(req, res, user);

  return sendJson(res, 404, { error: "Ruta no encontrada" });
}

async function login(req, res) {
  const body = await readJson(req);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const bucket = loginBucket(req, email);
  if (bucket.blockedUntil > Date.now()) return sendJson(res, 429, { error: "Demasiados intentos. Espera unos minutos." });
  const user = getUsers().find((item) => item.email === email && !item.disabled);
  if (!user || !verifyPassword(password, user.password)) {
    registerFailedLogin(req, email);
    audit("auth.failed", null, { email });
    return sendJson(res, 401, { error: "Credenciales incorrectas" });
  }

  loginAttempts.delete(loginAttemptKey(req, email));
  const token = crypto.randomBytes(32).toString("hex");
  const csrf = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { token, csrf, userId: user.id, createdAt: nowIso(), lastSeen: Date.now() });
  audit("auth.login", user.id, { email });
  res.setHeader("Set-Cookie", cookie("crm_session", token, { httpOnly: true, sameSite: "Strict", secure: CONFIG.secureCookie, maxAge: 60 * 60 * 8 }));
  return sendJson(res, 200, { user: publicUser(user), csrfToken: csrf });
}

async function usersApi(req, res, user) {
  if (user.role !== "admin") return sendJson(res, 403, { error: "Solo administracion" });
  if (req.method === "GET") return sendJson(res, 200, { items: getUsers().map(publicUser) });
  if (req.method !== "POST") return sendJson(res, 405, { error: "Metodo no permitido" });

  const body = await readJson(req);
  const email = String(body.email || "").trim().toLowerCase();
  const role = ["admin", "lawyer", "staff", "read_only"].includes(body.role) ? body.role : "staff";
  const password = String(body.password || "");
  if (!email || password.length < 12) return sendJson(res, 400, { error: "Email y password minima de 12 caracteres" });
  const users = getUsers();
  if (users.some((item) => item.email === email)) return sendJson(res, 409, { error: "Usuario existente" });
  const created = { id: id("usr"), email, name: body.name || email, role, password: hashPassword(password), disabled: false, createdAt: nowIso() };
  users.push(created);
  saveUsers(users);
  audit("user.create", user.id, { target: created.id, role });
  return sendJson(res, 201, { item: publicUser(created) });
}

async function collectionApi(req, res, user, key, roles) {
  if (!roles.includes(user.role)) return sendJson(res, 403, { error: "Permisos insuficientes" });
  if (req.method === "GET") {
    const q = String(new URL(req.url, "http://x").searchParams.get("q") || "").toLowerCase();
    const items = store[key].filter((item) => JSON.stringify(item).toLowerCase().includes(q));
    return sendJson(res, 200, { items });
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Metodo no permitido" });
  const body = await readJson(req);
  const item = sanitizeRecord(key, body, user.id);
  store[key].unshift(item);
  saveStore();
  audit(`${key}.create`, user.id, { id: item.id });
  return sendJson(res, 201, { item });
}

async function tasksApi(req, res, user) {
  if (req.method === "GET") return sendJson(res, 200, { items: store.tasks });
  if (req.method === "POST") {
    const body = await readJson(req);
    const item = sanitizeRecord("tasks", body, user.id);
    store.tasks.unshift(item);
    saveStore();
    audit("tasks.create", user.id, { id: item.id });
    return sendJson(res, 201, { item });
  }
  if (req.method === "PATCH") {
    const body = await readJson(req);
    const item = store.tasks.find((task) => task.id === body.id);
    if (!item) return sendJson(res, 404, { error: "Tarea no encontrada" });
    item.status = body.status === "done" ? "done" : "open";
    item.updatedAt = nowIso();
    saveStore();
    audit("tasks.update", user.id, { id: item.id, status: item.status });
    return sendJson(res, 200, { item });
  }
  return sendJson(res, 405, { error: "Metodo no permitido" });
}

async function sendEmailApi(req, res, user) {
  if (!["admin", "lawyer", "staff"].includes(user.role)) return sendJson(res, 403, { error: "Permisos insuficientes" });
  if (!CONFIG.smtpUser || !CONFIG.smtpPassword) return sendJson(res, 400, { error: "Correo no configurado. Revisa SMTP_USER y SMTP_PASSWORD en .env" });
  const body = await readJson(req, 256 * 1024);
  const to = text(body.to, 240);
  const subject = text(body.subject, 240);
  const message = text(body.message, 20000);
  const clientId = text(body.clientId, 80);
  const matterId = text(body.matterId, 80);
  if (!to || !subject || !message) return sendJson(res, 400, { error: "Destinatario, asunto y mensaje son obligatorios" });
  try {
    await sendGmail({ to, subject, message });
    const item = { id: id("ema"), to, subject, clientId, matterId, createdAt: nowIso(), createdBy: user.id, status: "sent" };
    store.emailLog.unshift(item);
    saveStore();
    audit("email.send", user.id, { id: item.id, to, subject, clientId, matterId });
    return sendJson(res, 200, { item });
  } catch (error) {
    audit("email.failed", user.id, { to, subject, error: error.message });
    return sendJson(res, 502, { error: "No se pudo enviar el correo con Gmail" });
  }
}

async function aiProfilesApi(req, res, user) {
  if (!["admin", "lawyer", "staff", "read_only"].includes(user.role)) return sendJson(res, 403, { error: "Permisos insuficientes" });
  if (req.method === "GET") return sendJson(res, 200, { items: store.aiProfiles });
  if (req.method !== "POST") return sendJson(res, 405, { error: "Metodo no permitido" });
  if (!["admin", "lawyer"].includes(user.role)) return sendJson(res, 403, { error: "Solo administracion o letrado" });
  const body = await readJson(req, 128 * 1024);
  const item = sanitizeRecord("aiProfiles", body, user.id);
  store.aiProfiles.unshift(item);
  saveStore();
  audit("ai.profile.create", user.id, { id: item.id, name: item.name });
  return sendJson(res, 201, { item });
}

async function aiSettingsApi(req, res, user) {
  if (!["admin", "lawyer"].includes(user.role)) return sendJson(res, 403, { error: "Solo administracion o letrado" });
  if (req.method === "GET") {
    return sendJson(res, 200, {
      configured: Boolean(getOpenAiApiKey()),
      model: getOpenAiModel(),
      source: CONFIG.openaiApiKey ? ".env" : (store.settings.openaiApiKey ? "base cifrada" : "sin configurar"),
      maskedKey: maskSecret(getOpenAiApiKey()),
    });
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Metodo no permitido" });
  const body = await readJson(req, 64 * 1024);
  const apiKey = text(body.apiKey, 300);
  const model = text(body.model || CONFIG.openaiModel || "gpt-5-mini", 80);
  if (apiKey) store.settings.openaiApiKey = apiKey;
  store.settings.openaiModel = model;
  saveStore();
  audit("ai.settings.update", user.id, { model, hasKey: Boolean(apiKey) });
  return sendJson(res, 200, { configured: Boolean(getOpenAiApiKey()), model: getOpenAiModel(), source: CONFIG.openaiApiKey ? ".env" : "base cifrada", maskedKey: maskSecret(getOpenAiApiKey()) });
}

async function aiChatApi(req, res, user) {
  if (!["admin", "lawyer", "staff"].includes(user.role)) return sendJson(res, 403, { error: "Permisos insuficientes" });
  if (!getOpenAiApiKey()) return sendJson(res, 400, { error: "OpenAI no configurado. Pulsa Configurar OpenAI y pega tu API key." });
  const body = await readJson(req, 256 * 1024);
  const profile = store.aiProfiles.find((item) => item.id === body.profileId) || store.aiProfiles[0];
  const prompt = text(body.prompt, 20000);
  const clientId = text(body.clientId, 80);
  const matterId = text(body.matterId, 80);
  if (!prompt) return sendJson(res, 400, { error: "Escribe una consulta para la IA" });
  const context = buildAiContext({ clientId, matterId });
  const instructions = `${baseLegalAiInstructions()}\n\nPerfil seleccionado:\n${profile?.instructions || ""}`;
  try {
    const answer = await openaiResponse({
      instructions,
      input: `${context}\n\nConsulta del usuario:\n${prompt}`,
    });
    const item = { id: id("ail"), profileId: profile?.id || "", prompt: prompt.slice(0, 500), answer: answer.slice(0, 2000), clientId, matterId, createdAt: nowIso(), createdBy: user.id };
    store.aiLog.unshift(item);
    saveStore();
    audit("ai.chat", user.id, { id: item.id, profileId: item.profileId, clientId, matterId });
    return sendJson(res, 200, { answer, profile });
  } catch (error) {
    audit("ai.failed", user.id, { error: error.message });
    return sendJson(res, 502, { error: `OpenAI: ${publicOpenAiError(error.message)}` });
  }
}

async function aiTestApi(req, res, user) {
  if (!["admin", "lawyer"].includes(user.role)) return sendJson(res, 403, { error: "Solo administracion o letrado" });
  if (!getOpenAiApiKey()) return sendJson(res, 400, { error: "OpenAI no configurado. Pega tu API key primero." });
  try {
    const answer = await openaiResponse({ instructions: "Responde solo con OK.", input: "Prueba de conexion" });
    audit("ai.test", user.id, { ok: true });
    return sendJson(res, 200, { ok: true, answer });
  } catch (error) {
    audit("ai.test.failed", user.id, { error: error.message });
    return sendJson(res, 502, { error: `OpenAI: ${publicOpenAiError(error.message)}` });
  }
}

function searchApi(req, res, user, url) {
  if (!["admin", "lawyer", "staff", "read_only"].includes(user.role)) return sendJson(res, 403, { error: "Permisos insuficientes" });
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  if (q.length < 2) return sendJson(res, 200, { items: [] });
  const pools = [
    ["Cliente", store.clients, (item) => item.name, (item) => [item.email, item.phone, item.dni, item.tags].filter(Boolean).join(" · ")],
    ["Expediente", store.matters, (item) => item.title, (item) => [clientName(item.clientId), item.type, item.reference, item.court].filter(Boolean).join(" · ")],
    ["Tarea", store.tasks, (item) => item.title, (item) => [matterTitle(item.matterId), item.dueDate, item.status].filter(Boolean).join(" · ")],
    ["Documento", store.documents, (item) => item.name, (item) => [matterTitle(item.matterId), Math.round((item.size || 0) / 1024) + " KB"].filter(Boolean).join(" · ")],
    ["Calendario", store.events, (item) => item.title, (item) => [item.date, item.kind, matterTitle(item.matterId)].filter(Boolean).join(" · ")],
    ["Tiempo", store.timeEntries, (item) => item.concept, (item) => [item.date, matterTitle(item.matterId), minutesLabel(item.minutes)].filter(Boolean).join(" · ")],
  ];
  const items = pools.flatMap(([type, records, title, subtitle]) => records
    .filter((item) => JSON.stringify(item).toLowerCase().includes(q))
    .slice(0, 12)
    .map((item) => ({ id: item.id, type, title: title(item), subtitle: subtitle(item), matterId: item.matterId || "" })));
  return sendJson(res, 200, { items: items.slice(0, 60) });
}

function matterTimelineApi(req, res, user, url) {
  if (!["admin", "lawyer", "staff", "read_only"].includes(user.role)) return sendJson(res, 403, { error: "Permisos insuficientes" });
  const matterId = url.pathname.split("/")[3];
  const matter = store.matters.find((item) => item.id === matterId);
  if (!matter) return sendJson(res, 404, { error: "Expediente no encontrado" });
  const items = [
    ...store.notes.filter((item) => item.matterId === matterId).map((item) => timelineItem("Nota", item.createdAt, item.body, item.id)),
    ...store.tasks.filter((item) => item.matterId === matterId).map((item) => timelineItem("Tarea", item.dueDate || item.createdAt, `${item.title} · ${item.status}`, item.id)),
    ...store.documents.filter((item) => item.matterId === matterId).map((item) => timelineItem("Documento", item.createdAt, item.name, item.id)),
    ...store.events.filter((item) => item.matterId === matterId).map((item) => timelineItem("Calendario", item.date || item.createdAt, `${item.title} · ${item.kind}`, item.id)),
    ...store.timeEntries.filter((item) => item.matterId === matterId).map((item) => timelineItem("Tiempo", item.date || item.createdAt, `${item.concept} · ${minutesLabel(item.minutes)}`, item.id)),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  audit("matters.timeline", user.id, { id: matterId });
  return sendJson(res, 200, { matter, items });
}

function matterExportApi(req, res, user, url) {
  if (!["admin", "lawyer"].includes(user.role)) return sendJson(res, 403, { error: "Permisos insuficientes" });
  const matterId = url.pathname.split("/")[3];
  const matter = store.matters.find((item) => item.id === matterId);
  if (!matter) return sendJson(res, 404, { error: "Expediente no encontrado" });
  const payload = {
    exportedAt: nowIso(),
    matter,
    client: store.clients.find((item) => item.id === matter.clientId) || null,
    tasks: store.tasks.filter((item) => item.matterId === matterId),
    notes: store.notes.filter((item) => item.matterId === matterId),
    documents: store.documents.filter((item) => item.matterId === matterId),
    events: store.events.filter((item) => item.matterId === matterId),
    timeEntries: store.timeEntries.filter((item) => item.matterId === matterId),
    emailLog: store.emailLog.filter((item) => item.matterId === matterId),
  };
  audit("matters.export", user.id, { id: matterId });
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="expediente-${matterId}.json"`,
  });
  res.end(JSON.stringify(payload, null, 2));
}

function matterExportXlsApi(req, res, user, url) {
  if (!["admin", "lawyer", "staff"].includes(user.role)) return sendJson(res, 403, { error: "Permisos insuficientes" });
  const matterId = url.pathname.split("/")[3];
  const matter = store.matters.find((item) => item.id === matterId);
  if (!matter) return sendJson(res, 404, { error: "Expediente no encontrado" });
  const client = store.clients.find((item) => item.id === matter.clientId) || {};
  const sheets = [
    excelSheet("Expediente", [
      ["Campo", "Valor"],
      ["Titulo", matter.title],
      ["Cliente", client.name],
      ["Tipo", matter.type],
      ["Estado", matter.status],
      ["Juzgado", matter.court],
      ["Referencia", matter.reference],
      ["Riesgo", matter.risk],
      ["Proximo paso", matter.nextStep],
      ["Creado", matter.createdAt],
    ]),
    excelSheet("Cliente", rowsForExport("clients", [client])),
    excelSheet("Tareas", rowsForExport("tasks", store.tasks.filter((item) => item.matterId === matterId))),
    excelSheet("Agenda", rowsForExport("events", store.events.filter((item) => item.matterId === matterId))),
    excelSheet("Tiempos", rowsForExport("timeEntries", store.timeEntries.filter((item) => item.matterId === matterId))),
    excelSheet("Documentos", rowsForExport("documents", store.documents.filter((item) => item.matterId === matterId))),
    excelSheet("Correos", rowsForExport("emailLog", store.emailLog.filter((item) => item.matterId === matterId))),
    excelSheet("Notas", rowsForExport("notes", store.notes.filter((item) => item.matterId === matterId || item.clientId === client.id))),
  ];
  audit("matters.export.xls", user.id, { id: matterId });
  return sendExcel(res, `expediente-${safeFileName(matter.title || matterId)}.xls`, sheets);
}

function exportApi(req, res, user, url) {
  if (!["admin", "lawyer", "staff"].includes(user.role)) return sendJson(res, 403, { error: "Permisos insuficientes" });
  const type = path.basename(url.pathname);
  const builders = {
    clients: () => [excelSheet("Clientes", rowsForExport("clients", store.clients))],
    matters: () => [excelSheet("Expedientes", rowsForExport("matters", store.matters))],
    tasks: () => [excelSheet("Tareas", rowsForExport("tasks", store.tasks))],
    events: () => [excelSheet("Agenda", rowsForExport("events", store.events))],
    "time-entries": () => [excelSheet("Tiempos", rowsForExport("timeEntries", store.timeEntries))],
    documents: () => [excelSheet("Documentos", rowsForExport("documents", store.documents))],
    emails: () => [excelSheet("Correos", rowsForExport("emailLog", store.emailLog))],
    all: () => [
      excelSheet("Clientes", rowsForExport("clients", store.clients)),
      excelSheet("Expedientes", rowsForExport("matters", store.matters)),
      excelSheet("Tareas", rowsForExport("tasks", store.tasks)),
      excelSheet("Agenda", rowsForExport("events", store.events)),
      excelSheet("Tiempos", rowsForExport("timeEntries", store.timeEntries)),
      excelSheet("Documentos", rowsForExport("documents", store.documents)),
      excelSheet("Correos", rowsForExport("emailLog", store.emailLog)),
    ],
  };
  const build = builders[type];
  if (!build) return sendJson(res, 404, { error: "Exportacion no encontrada" });
  audit("export.xls", user.id, { type });
  return sendExcel(res, `vemalex-${type}-${new Date().toISOString().slice(0, 10)}.xls`, build());
}

async function notesApi(req, res, user) {
  if (req.method === "GET") return sendJson(res, 200, { items: store.notes });
  if (req.method !== "POST") return sendJson(res, 405, { error: "Metodo no permitido" });
  const body = await readJson(req);
  const item = sanitizeRecord("notes", body, user.id);
  store.notes.unshift(item);
  saveStore();
  audit("notes.create", user.id, { id: item.id, matterId: item.matterId });
  return sendJson(res, 201, { item });
}

async function documentsApi(req, res, user) {
  if (req.method === "GET") return sendJson(res, 200, { items: store.documents });
  if (req.method !== "POST") return sendJson(res, 405, { error: "Metodo no permitido" });
  const body = await readJson(req, 25 * 1024 * 1024);
  const buffer = Buffer.from(String(body.contentBase64 || ""), "base64");
  if (!buffer.length) return sendJson(res, 400, { error: "Documento vacio" });
  const docId = id("doc");
  const encrypted = encryptBuffer(buffer);
  fs.writeFileSync(path.join(DOC_DIR, `${docId}.bin`), JSON.stringify(encrypted));
  const item = {
    id: docId,
    matterId: body.matterId || "",
    clientId: body.clientId || "",
    name: String(body.name || "documento").slice(0, 180),
    mimeType: String(body.mimeType || "application/octet-stream").slice(0, 120),
    category: text(body.category || "General", 80),
    size: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    createdAt: nowIso(),
    createdBy: user.id,
  };
  store.documents.unshift(item);
  saveStore();
  audit("documents.upload", user.id, { id: item.id, matterId: item.matterId, size: item.size });
  return sendJson(res, 201, { item });
}

function downloadDocument(req, res, user, url) {
  const docId = path.basename(url.pathname);
  const meta = store.documents.find((item) => item.id === docId);
  if (!meta) return sendJson(res, 404, { error: "Documento no encontrado" });
  const file = path.join(DOC_DIR, `${docId}.bin`);
  if (!fs.existsSync(file)) return sendJson(res, 404, { error: "Archivo no encontrado" });
  const encrypted = JSON.parse(fs.readFileSync(file, "utf8"));
  const buffer = decryptBuffer(encrypted);
  audit("documents.download", user.id, { id: docId });
  res.writeHead(200, {
    "Content-Type": meta.mimeType,
    "Content-Disposition": `attachment; filename="${meta.name.replace(/"/g, "")}"`,
    "Content-Length": buffer.length,
  });
  res.end(buffer);
}

function auditApi(req, res, user) {
  if (user.role !== "admin") return sendJson(res, 403, { error: "Solo administracion" });
  const lines = fs.existsSync(AUDIT_FILE) ? fs.readFileSync(AUDIT_FILE, "utf8").trim().split("\n").filter(Boolean) : [];
  return sendJson(res, 200, { items: lines.slice(-300).map((line) => JSON.parse(line)).reverse() });
}

function backupsApi(req, res, user) {
  if (!["admin", "lawyer"].includes(user.role)) return sendJson(res, 403, { error: "Solo administracion o letrado" });
  if (req.method === "GET") return sendJson(res, 200, { items: listBackups(), path: BACKUP_DIR });
  if (req.method !== "POST") return sendJson(res, 405, { error: "Metodo no permitido" });
  const item = createBackup(user.id);
  audit("backup.create", user.id, { name: item.name, size: item.size });
  return sendJson(res, 201, { item, path: BACKUP_DIR });
}

function sanitizeRecord(key, body, userId) {
  const base = { id: id(key.slice(0, 3)), createdAt: nowIso(), updatedAt: nowIso(), createdBy: userId };
  if (key === "clients") {
    return { ...base, name: text(body.name, 160), dni: text(body.dni, 40), email: text(body.email, 160), phone: text(body.phone, 80), address: text(body.address, 240), tags: text(body.tags, 240), notes: text(body.notes, 2000) };
  }
  if (key === "matters") {
    return { ...base, title: text(body.title, 180), clientId: text(body.clientId, 80), type: text(body.type, 120), status: text(body.status || "abierto", 80), court: text(body.court, 180), reference: text(body.reference, 120), risk: text(body.risk || "medio", 40), nextStep: text(body.nextStep, 400) };
  }
  if (key === "tasks") {
    return { ...base, title: text(body.title, 180), matterId: text(body.matterId, 80), dueDate: text(body.dueDate, 30), priority: text(body.priority || "media", 40), status: "open" };
  }
  if (key === "events") {
    return { ...base, title: text(body.title, 180), matterId: text(body.matterId, 80), date: text(body.date, 30), time: text(body.time, 20), kind: text(body.kind || "plazo", 80), location: text(body.location, 160), status: text(body.status || "previsto", 60), notes: text(body.notes, 1000) };
  }
  if (key === "timeEntries") {
    const minutes = Math.max(0, Math.min(24 * 60, Number(body.minutes || 0)));
    const rate = Math.max(0, Math.min(9999, Number(body.rate || 0)));
    return { ...base, matterId: text(body.matterId, 80), date: text(body.date, 30), concept: text(body.concept, 220), minutes, rate, billable: body.billable !== "no" };
  }
  if (key === "aiProfiles") {
    return { ...base, name: text(body.name, 120), instructions: text(body.instructions, 12000) };
  }
  if (key === "notes") {
    return { ...base, matterId: text(body.matterId, 80), clientId: text(body.clientId, 80), body: text(body.body, 5000) };
  }
  return base;
}

function summary() {
  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = store.events
    .filter((item) => !item.date || item.date >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 8);
  const billableMinutes = store.timeEntries.filter((item) => item.billable).reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  return {
    clients: store.clients.length,
    matters: store.matters.length,
    openTasks: store.tasks.filter((item) => item.status !== "done").length,
    documents: store.documents.length,
    events: store.events.length,
    billableHours: Math.round((billableMinutes / 60) * 10) / 10,
    recentMatters: store.matters.slice(0, 5),
    dueTasks: store.tasks.filter((item) => item.status !== "done").slice(0, 8),
    upcomingEvents,
  };
}

function loadStore() {
  if (!fs.existsSync(STORE_FILE)) {
    const empty = normalizeStore({});
    writeEncryptedJson(STORE_FILE, empty);
    return empty;
  }
  return normalizeStore(readEncryptedJson(STORE_FILE));
}

function normalizeStore(data) {
  return {
    clients: Array.isArray(data.clients) ? data.clients : [],
    matters: Array.isArray(data.matters) ? data.matters : [],
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    documents: Array.isArray(data.documents) ? data.documents : [],
    events: Array.isArray(data.events) ? data.events : [],
    timeEntries: Array.isArray(data.timeEntries) ? data.timeEntries : [],
    emailLog: Array.isArray(data.emailLog) ? data.emailLog : [],
    aiProfiles: mergeDefaultAiProfiles(Array.isArray(data.aiProfiles) ? data.aiProfiles : []),
    aiLog: Array.isArray(data.aiLog) ? data.aiLog : [],
    settings: typeof data.settings === "object" && data.settings ? data.settings : {},
    savedAt: data.savedAt || nowIso(),
    version: 4,
  };
}

function saveStore() {
  store.savedAt = nowIso();
  writeEncryptedJson(STORE_FILE, store);
}

function readEncryptedJson(file) {
  return JSON.parse(decryptBuffer(JSON.parse(fs.readFileSync(file, "utf8"))).toString("utf8"));
}

function writeEncryptedJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(encryptBuffer(Buffer.from(JSON.stringify(data, null, 2)))));
}

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { v: 1, alg: "AES-256-GCM", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: ciphertext.toString("base64") };
}

function decryptBuffer(payload) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]);
}

function initUsers() {
  if (fs.existsSync(USER_FILE)) return;
  if (!CONFIG.adminPassword || CONFIG.adminPassword.length < 12) {
    console.error("CRM_ADMIN_PASSWORD debe tener al menos 12 caracteres en el primer arranque.");
    process.exit(1);
  }
  const admin = { id: id("usr"), email: CONFIG.adminEmail.toLowerCase(), name: "Administracion VEMALEX", role: "admin", password: hashPassword(CONFIG.adminPassword), disabled: false, createdAt: nowIso() };
  fs.writeFileSync(USER_FILE, JSON.stringify([admin], null, 2));
}

function getUsers() {
  return JSON.parse(fs.readFileSync(USER_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2));
}

function getUserById(userId) {
  return getUsers().find((user) => user.id === userId);
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256");
  return `pbkdf2$310000$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function verifyPassword(password, encoded) {
  const [, rounds, saltB64, hashB64] = encoded.split("$");
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.pbkdf2Sync(password, salt, Number(rounds), expected.length, "sha256");
  return crypto.timingSafeEqual(actual, expected);
}

function audit(action, userId, details = {}) {
  const previous = lastAuditHash();
  const entry = { at: nowIso(), action, userId, details, previous };
  entry.hash = crypto.createHash("sha256").update(JSON.stringify(entry)).digest("hex");
  fs.appendFileSync(AUDIT_FILE, `${JSON.stringify(entry)}\n`);
}

function lastAuditHash() {
  if (!fs.existsSync(AUDIT_FILE)) return null;
  const lines = fs.readFileSync(AUDIT_FILE, "utf8").trim().split("\n").filter(Boolean);
  if (!lines.length) return null;
  return JSON.parse(lines[lines.length - 1]).hash;
}

function getSession(req) {
  const token = parseCookies(req).crm_session;
  const session = token ? sessions.get(token) : null;
  if (!session) return null;
  if (Date.now() - session.lastSeen > 1000 * 60 * 60 * 8) {
    sessions.delete(token);
    return null;
  }
  session.lastSeen = Date.now();
  return session;
}

function serveStatic(req, res, url) {
  const safePath = path.normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
  const file = path.join(PUBLIC_DIR, safePath);
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return sendJson(res, 404, { error: "No encontrado" });
  const ext = path.extname(file).toLowerCase();
  const type = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8" }[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
}

function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (CONFIG.secureCookie) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendNoContent(res) {
  res.writeHead(204);
  res.end();
}

function sendExcel(res, filename, sheets) {
  const workbook = `<!doctype html><html><head><meta charset="utf-8" />
    <xml><x:ExcelWorkbook xmlns:x="urn:schemas-microsoft-com:office:excel"><x:ExcelWorksheets>${sheets.map((sheet) => `<x:ExcelWorksheet><x:Name>${xmlEscape(sheet.name)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>`).join("")}</x:ExcelWorksheets></x:ExcelWorkbook></xml>
    <style>body{font-family:Arial,sans-serif} table{border-collapse:collapse} th{background:#0f1f2f;color:#fff;font-weight:bold} td,th{border:1px solid #d9d9d9;padding:6px;vertical-align:top;mso-number-format:"\\@"}.sheet-title{font-size:18px;font-weight:bold;color:#0f1f2f}</style>
  </head><body>${sheets.map((sheet) => `<h1 class="sheet-title">${htmlEscape(sheet.name)}</h1>${htmlTable(sheet.rows)}`).join("<br style='mso-special-character:line-break;page-break-before:always' />")}</body></html>`;
  res.writeHead(200, {
    "Content-Type": "application/vnd.ms-excel; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    "Cache-Control": "no-store",
  });
  res.end(workbook);
}

function excelSheet(name, rows) {
  return { name: String(name || "Hoja").slice(0, 31), rows: rows && rows.length ? rows : [["Sin datos"]] };
}

function htmlTable(rows) {
  return `<table>${rows.map((row, index) => `<tr>${row.map((cell) => index === 0 ? `<th>${htmlEscape(cell)}</th>` : `<td>${htmlEscape(excelSafe(cell))}</td>`).join("")}</tr>`).join("")}</table>`;
}

function rowsForExport(type, items) {
  const list = Array.isArray(items) ? items : [];
  const columns = exportColumns(type);
  return [
    columns.map((column) => column.label),
    ...list.map((item) => columns.map((column) => column.value(item || {}))),
  ];
}

function exportColumns(type) {
  const common = [
    { label: "ID", value: (item) => item.id },
    { label: "Creado", value: (item) => item.createdAt },
    { label: "Actualizado", value: (item) => item.updatedAt },
  ];
  const map = {
    clients: [
      { label: "Nombre", value: (item) => item.name },
      { label: "DNI/NIE", value: (item) => item.dni },
      { label: "Email", value: (item) => item.email },
      { label: "Telefono", value: (item) => item.phone },
      { label: "Direccion", value: (item) => item.address },
      { label: "Etiquetas", value: (item) => item.tags },
      { label: "Notas", value: (item) => item.notes },
      ...common,
    ],
    matters: [
      { label: "Titulo", value: (item) => item.title },
      { label: "Cliente", value: (item) => clientName(item.clientId) },
      { label: "Tipo", value: (item) => item.type },
      { label: "Estado", value: (item) => item.status },
      { label: "Juzgado", value: (item) => item.court },
      { label: "Referencia", value: (item) => item.reference },
      { label: "Riesgo", value: (item) => item.risk },
      { label: "Proximo paso", value: (item) => item.nextStep },
      ...common,
    ],
    tasks: [
      { label: "Tarea", value: (item) => item.title },
      { label: "Expediente", value: (item) => matterTitle(item.matterId) },
      { label: "Fecha limite", value: (item) => item.dueDate },
      { label: "Prioridad", value: (item) => item.priority },
      { label: "Estado", value: (item) => item.status },
      ...common,
    ],
    events: [
      { label: "Evento", value: (item) => item.title },
      { label: "Expediente", value: (item) => matterTitle(item.matterId) },
      { label: "Fecha", value: (item) => item.date },
      { label: "Hora", value: (item) => item.time },
      { label: "Tipo", value: (item) => item.kind },
      { label: "Lugar", value: (item) => item.location },
      { label: "Notas", value: (item) => item.notes },
      ...common,
    ],
    timeEntries: [
      { label: "Concepto", value: (item) => item.concept },
      { label: "Expediente", value: (item) => matterTitle(item.matterId) },
      { label: "Fecha", value: (item) => item.date },
      { label: "Minutos", value: (item) => item.minutes },
      { label: "Horas", value: (item) => Math.round((Number(item.minutes || 0) / 60) * 100) / 100 },
      { label: "Tarifa", value: (item) => item.rate },
      { label: "Facturable", value: (item) => item.billable ? "Si" : "No" },
      ...common,
    ],
    documents: [
      { label: "Nombre", value: (item) => item.name },
      { label: "Expediente", value: (item) => matterTitle(item.matterId) },
      { label: "Categoria", value: (item) => item.category },
      { label: "Tipo MIME", value: (item) => item.mimeType },
      { label: "Tamano bytes", value: (item) => item.size },
      { label: "SHA256", value: (item) => item.sha256 },
      ...common,
    ],
    emailLog: [
      { label: "Destinatario", value: (item) => item.to },
      { label: "Asunto", value: (item) => item.subject },
      { label: "Cliente", value: (item) => clientName(item.clientId) },
      { label: "Expediente", value: (item) => matterTitle(item.matterId) },
      { label: "Estado", value: (item) => item.status },
      { label: "Creado", value: (item) => item.createdAt },
    ],
    notes: [
      { label: "Expediente", value: (item) => matterTitle(item.matterId) },
      { label: "Cliente", value: (item) => clientName(item.clientId) },
      { label: "Nota", value: (item) => item.body },
      ...common,
    ],
  };
  return map[type] || common;
}

function excelSafe(value) {
  const textValue = String(value ?? "");
  return /^[=+\-@]/.test(textValue) ? `'${textValue}` : textValue;
}

function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function xmlEscape(value) {
  return htmlEscape(value);
}

function safeFileName(value) {
  return String(value || "export").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "export";
}

function createBackup(userId) {
  ensureDirectories();
  const name = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const target = path.join(BACKUP_DIR, name);
  fs.mkdirSync(target, { recursive: true });
  copyIfExists(STORE_FILE, path.join(target, "store.enc"));
  copyIfExists(USER_FILE, path.join(target, "users.json"));
  copyIfExists(AUDIT_FILE, path.join(target, "audit.jsonl"));
  if (fs.existsSync(DOC_DIR)) copyDirectory(DOC_DIR, path.join(target, "documents"));
  const manifest = {
    name,
    createdAt: nowIso(),
    createdBy: userId,
    source: {
      data: DATA_DIR,
      documents: DOC_DIR,
    },
    files: backupFileList(target),
  };
  fs.writeFileSync(path.join(target, "manifest.json"), JSON.stringify(manifest, null, 2));
  const item = backupInfo(target);
  pruneBackups(30);
  return item;
}

function listBackups() {
  ensureDirectories();
  return fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => backupInfo(path.join(BACKUP_DIR, entry.name)))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function backupInfo(dir) {
  const manifestFile = path.join(dir, "manifest.json");
  let manifest = {};
  if (fs.existsSync(manifestFile)) {
    try { manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")); } catch { manifest = {}; }
  }
  const stat = fs.statSync(dir);
  return {
    name: path.basename(dir),
    path: dir,
    createdAt: manifest.createdAt || stat.birthtime.toISOString(),
    size: directorySize(dir),
    files: backupFileList(dir).length,
  };
}

function copyIfExists(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name);
    const dst = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirectory(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
}

function backupFileList(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(path.relative(dir, full));
    }
  };
  walk(dir);
  return files;
}

function directorySize(dir) {
  if (!fs.existsSync(dir)) return 0;
  return backupFileList(dir).reduce((sum, file) => sum + fs.statSync(path.join(dir, file)).size, 0);
}

function pruneBackups(limit) {
  const backups = listBackups();
  for (const backup of backups.slice(limit)) {
    fs.rmSync(path.join(BACKUP_DIR, backup.name), { recursive: true, force: true });
  }
}

function readJson(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) reject(new Error("Payload demasiado grande"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/"];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  if (Number.isFinite(options.maxAge)) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

function parseCookies(req) {
  return String(req.headers.cookie || "").split(";").reduce((acc, item) => {
    const [rawKey, ...rest] = item.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function sendGmail({ to, subject, message }) {
  const email = buildEmail({ from: CONFIG.mailFrom, to, subject, message });
  return smtpSend({
    host: CONFIG.smtpHost,
    port: CONFIG.smtpPort,
    user: CONFIG.smtpUser,
    password: CONFIG.smtpPassword,
    mailFrom: CONFIG.mailFrom,
    rcptTo: to,
    data: email,
  });
}

function buildEmail({ from, to, subject, message }) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${mimeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${message.replace(/\r?\n/g, "\r\n")}\r\n`;
}

function mimeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value), "utf8").toString("base64")}?=`;
}

function smtpSend({ host, port, user, password, mailFrom, rcptTo, data }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(port, host, { servername: host });
    let buffer = "";
    const fail = (error) => {
      socket.destroy();
      reject(error);
    };
    socket.setTimeout(15000, () => fail(new Error("Timeout SMTP")));
    socket.on("error", fail);
    socket.on("data", (chunk) => { buffer += chunk.toString("utf8"); });
    socket.on("secureConnect", () => {
      Promise.resolve()
        .then(() => smtpExpect(() => buffer, (value) => { buffer = value; }, 220))
        .then(() => smtpCommand(socket, () => buffer, (value) => { buffer = value; }, "EHLO localhost", 250))
        .then(() => smtpCommand(socket, () => buffer, (value) => { buffer = value; }, `AUTH PLAIN ${Buffer.from(`\0${user}\0${password}`).toString("base64")}`, 235))
        .then(() => smtpCommand(socket, () => buffer, (value) => { buffer = value; }, `MAIL FROM:<${mailFrom}>`, 250))
        .then(() => smtpCommand(socket, () => buffer, (value) => { buffer = value; }, `RCPT TO:<${rcptTo}>`, [250, 251]))
        .then(() => smtpCommand(socket, () => buffer, (value) => { buffer = value; }, "DATA", 354))
        .then(() => smtpCommand(socket, () => buffer, (value) => { buffer = value; }, `${data.replace(/\r?\n\./g, "\r\n..")}\r\n.`, 250))
        .then(() => smtpCommand(socket, () => buffer, (value) => { buffer = value; }, "QUIT", 221))
        .then(() => {
          socket.end();
          resolve();
        })
        .catch(fail);
    });
  });
}

function smtpCommand(socket, getBuffer, setBuffer, command, expected) {
  socket.write(`${command}\r\n`);
  return smtpExpect(getBuffer, setBuffer, expected);
}

function smtpExpect(getBuffer, setBuffer, expected) {
  const expectedCodes = Array.isArray(expected) ? expected : [expected];
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const lines = getBuffer().split(/\r?\n/).filter(Boolean);
      const last = lines.findLast((line) => /^\d{3} /.test(line));
      if (last) {
        const code = Number(last.slice(0, 3));
        if (expectedCodes.includes(code)) {
          setBuffer("");
          clearInterval(timer);
          resolve(last);
        } else if (code >= 400) {
          clearInterval(timer);
          reject(new Error(last));
        }
      }
      if (Date.now() - started > 12000) {
        clearInterval(timer);
        reject(new Error("Respuesta SMTP no recibida"));
      }
    }, 50);
  });
}

function openaiResponse({ instructions, input }) {
  const payload = JSON.stringify({
    model: getOpenAiModel(),
    instructions,
    input,
    store: false,
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.openai.com",
      path: "/v1/responses",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${getOpenAiApiKey()}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 60000,
    }, (response) => {
      let data = "";
      response.on("data", (chunk) => { data += chunk; });
      response.on("end", () => {
        try {
          const parsed = JSON.parse(data || "{}");
          if (response.statusCode >= 400) return reject(new Error(parsed.error?.message || `OpenAI ${response.statusCode}`));
          resolve(extractOpenAiText(parsed));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout OpenAI"));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function getOpenAiApiKey() {
  return CONFIG.openaiApiKey || store.settings.openaiApiKey || "";
}

function getOpenAiModel() {
  return store.settings.openaiModel || CONFIG.openaiModel || "gpt-5-mini";
}

function maskSecret(value) {
  if (!value) return "";
  return `${value.slice(0, 7)}...${value.slice(-4)}`;
}

function publicOpenAiError(message) {
  const clean = String(message || "error desconocido");
  const lower = clean.toLowerCase();
  if (lower.includes("quota") || lower.includes("billing")) {
    return "cuota agotada o facturacion no activa. Revisa saldo, plan y billing del proyecto en platform.openai.com.";
  }
  if (lower.includes("incorrect api key") || lower.includes("invalid api key") || lower.includes("401")) {
    return "API key no valida. Copia una clave nueva del proyecto correcto.";
  }
  if (lower.includes("model") && (lower.includes("not found") || lower.includes("does not exist"))) {
    return "modelo no disponible para esta cuenta. Prueba con otro modelo configurado.";
  }
  return clean.slice(0, 260);
}

function extractOpenAiText(response) {
  if (response.output_text) return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim() || "Sin respuesta";
}

function buildAiContext({ clientId, matterId }) {
  const client = store.clients.find((item) => item.id === clientId);
  const matter = store.matters.find((item) => item.id === matterId);
  const relatedClient = client || store.clients.find((item) => item.id === matter?.clientId);
  const tasks = store.tasks.filter((item) => item.matterId === matterId).slice(0, 8);
  const events = store.events.filter((item) => item.matterId === matterId).slice(0, 8);
  const notes = store.notes.filter((item) => item.matterId === matterId || item.clientId === relatedClient?.id).slice(0, 6);
  return [
    "Contexto interno del CRM VEMALEX:",
    relatedClient ? `Cliente: ${relatedClient.name || ""}; DNI/NIE: ${relatedClient.dni || ""}; email: ${relatedClient.email || ""}; telefono: ${relatedClient.phone || ""}; notas: ${relatedClient.notes || ""}` : "Cliente: no seleccionado",
    matter ? `Expediente: ${matter.title || ""}; tipo: ${matter.type || ""}; estado: ${matter.status || ""}; juzgado: ${matter.court || ""}; referencia: ${matter.reference || ""}; riesgo: ${matter.risk || ""}; proximo paso: ${matter.nextStep || ""}` : "Expediente: no seleccionado",
    tasks.length ? `Tareas: ${tasks.map((item) => `${item.title} (${item.dueDate || "sin fecha"}, ${item.status})`).join("; ")}` : "Tareas: sin datos",
    events.length ? `Agenda: ${events.map((item) => `${item.title} (${item.date || "sin fecha"} ${item.time || ""})`).join("; ")}` : "Agenda: sin datos",
    notes.length ? `Notas internas: ${notes.map((item) => item.body).join(" | ")}` : "Notas internas: sin datos",
  ].join("\n");
}

function baseLegalAiInstructions() {
  return [
    "Eres un asistente interno para VEMALEX Abogados.",
    "Ayudas a preparar borradores, organizar informacion y proponer checklists de trabajo.",
    "No sustituyes el criterio profesional de Veronica Macias ni emites una decision legal definitiva.",
    "Cuando falten datos, indicalo claramente.",
    "Evita inventar hechos, plazos o jurisprudencia.",
    "Responde en espanol, con tono profesional, claro y util para un despacho de derecho de familia.",
  ].join("\n");
}

function defaultAiProfiles() {
  return [
    {
      id: "aip_civil",
      name: "Derecho civil",
      instructions: "Especialista en derecho civil: obligaciones y contratos, reclamaciones de cantidad, arrendamientos, responsabilidad civil, propiedad, comunidades, sucesiones y negociacion extrajudicial. Prioriza analisis de hechos, prueba disponible, riesgos, plazos y estrategia procesal prudente.",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: "system",
    },
    {
      id: "aip_penal",
      name: "Derecho penal",
      instructions: "Especialista en derecho penal: denuncias, defensa, acusacion, violencia domestica o de genero, delitos patrimoniales, lesiones, quebrantamientos, conformidades y medidas cautelares. Prioriza presuncion de inocencia, prueba, plazos, garantias procesales y lenguaje prudente.",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: "system",
    },
    {
      id: "aip_familia",
      name: "Derecho de familia",
      instructions: "Especialista en divorcio, custodia, pension de alimentos, modificacion de medidas, regimen de visitas y mediacion familiar. Prioriza claridad, estrategia procesal prudente y proteccion de menores.",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: "system",
    },
    {
      id: "aip_mercantil",
      name: "Derecho mercantil",
      instructions: "Especialista en derecho mercantil y asesoramiento empresarial: sociedades, contratos mercantiles, impagos, negociacion, cumplimiento, responsabilidad de administradores, conflictos societarios y prevencion de riesgos legales para empresas.",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: "system",
    },
  ];
}

function mergeDefaultAiProfiles(existing) {
  const defaults = defaultAiProfiles();
  const existingIds = new Set(existing.map((item) => item.id));
  return [...existing, ...defaults.filter((item) => !existingIds.has(item.id))];
}

function loginAttemptKey(req, email) {
  return `${req.socket.remoteAddress || "local"}:${email}`;
}

function loginBucket(req, email) {
  const key = loginAttemptKey(req, email);
  const bucket = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
  if (bucket.blockedUntil < Date.now() && bucket.count > 0) bucket.count = Math.max(0, bucket.count - 1);
  return bucket;
}

function registerFailedLogin(req, email) {
  const key = loginAttemptKey(req, email);
  const bucket = loginBucket(req, email);
  bucket.count += 1;
  if (bucket.count >= 6) bucket.blockedUntil = Date.now() + 15 * 60 * 1000;
  loginAttempts.set(key, bucket);
}

function clientName(clientId) {
  return store.clients.find((item) => item.id === clientId)?.name || "";
}

function matterTitle(matterId) {
  return store.matters.find((item) => item.id === matterId)?.title || "";
}

function minutesLabel(minutes) {
  const value = Number(minutes || 0);
  return `${Math.floor(value / 60)}h ${value % 60}m`;
}

function timelineItem(type, date, title, idValue) {
  return { type, date, title, id: idValue };
}

function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(DOC_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function text(value, max) {
  return String(value || "").trim().slice(0, max);
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function nowIso() {
  return new Date().toISOString();
}
