let csrfToken = "";
let calendarDate = new Date();
let state = { clients: [], matters: [], tasks: [], documents: [], events: [], timeEntries: [], emailLog: [] };

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

boot();

async function boot() {
  bindEvents();
  const me = await api("/api/me", { silent: true });
  if (me?.user) showApp(me);
}

function bindEvents() {
  $("[data-login-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = await api("/api/login", { method: "POST", body: formData(event.target), skipCsrf: true, silent: true });
    if (result?.user) return showApp(result);
    $("[data-login-message]").textContent = result?.error || "No se pudo acceder";
  });

  $("[data-logout]").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    location.reload();
  });

  $$("[data-view-button]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewButton)));
  $("[data-search-form]").addEventListener("submit", search);
  $("[data-client-form]").addEventListener("submit", submitForm("/api/clients", "clients"));
  $("[data-matter-form]").addEventListener("submit", submitForm("/api/matters", "matters"));
  $("[data-task-form]").addEventListener("submit", submitForm("/api/tasks", "tasks"));
  $("[data-event-form]").addEventListener("submit", submitForm("/api/events", "events"));
  $("[data-time-form]").addEventListener("submit", submitForm("/api/time-entries", "timeEntries"));
  $("[data-document-form]").addEventListener("submit", uploadDocument);
  $("[data-email-form]").addEventListener("submit", sendEmail);
  $("[data-calendar-prev]").addEventListener("click", () => moveCalendar(-1));
  $("[data-calendar-next]").addEventListener("click", () => moveCalendar(1));
  $("[data-email-client-select]").addEventListener("change", fillEmailFromClient);
}

async function showApp(result) {
  csrfToken = result.csrfToken;
  $("[data-login]").classList.add("hidden");
  $("[data-shell]").classList.remove("hidden");
  $("[data-user]").textContent = `${result.user.name} - ${result.user.role}`;
  await refreshAll();
}

async function refreshAll() {
  const [summary, clients, matters, tasks, documents, events, timeEntries, emailLog] = await Promise.all([
    api("/api/summary"),
    api("/api/clients"),
    api("/api/matters"),
    api("/api/tasks"),
    api("/api/documents"),
    api("/api/events"),
    api("/api/time-entries"),
    api("/api/email/log"),
  ]);
  state.clients = clients.items || [];
  state.matters = matters.items || [];
  state.tasks = tasks.items || [];
  state.documents = documents.items || [];
  state.events = events.items || [];
  state.timeEntries = timeEntries.items || [];
  state.emailLog = emailLog.items || [];
  renderSummary(summary);
  renderClients();
  renderMatters();
  renderTasks();
  renderEvents();
  renderCalendar();
  renderTimeEntries();
  renderEmailLog();
  renderDocuments();
  renderSelects();
}

function renderSummary(summary) {
  $("[data-stats]").innerHTML = [
    ["Clientes", summary.clients],
    ["Expedientes", summary.matters],
    ["Tareas abiertas", summary.openTasks],
    ["Documentos", summary.documents],
    ["Horas facturables", summary.billableHours || 0],
  ].map(([label, value]) => `<div class="stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join("");
  $("[data-recent-matters]").innerHTML = list(summary.recentMatters || [], (item) => `<strong>${esc(item.title)}</strong><span>${esc(item.type)} - ${esc(item.status)}</span>`);
  $("[data-due-tasks]").innerHTML = list(summary.dueTasks || [], (item) => `<strong>${esc(item.title)}</strong><span>${esc(item.dueDate || "Sin fecha")} - ${esc(item.priority)}</span>`);
  $("[data-upcoming-events]").innerHTML = list(summary.upcomingEvents || [], (item) => `<strong>${esc(item.title)}</strong><span>${esc(eventWhen(item))} - ${esc(item.kind)} - ${esc(matterTitle(item.matterId))}</span>`);
}

function renderClients() {
  $("[data-clients]").innerHTML = list(state.clients, (item) => `<strong>${esc(item.name)}</strong><span>${esc(item.phone)} - ${esc(item.email)}</span><span>${esc(item.tags)}</span><div class="item-actions"><button data-email-client="${item.id}">Enviar correo</button></div>`);
  $$("[data-email-client]").forEach((button) => button.addEventListener("click", () => {
    const client = state.clients.find((item) => item.id === button.dataset.emailClient);
    setView("emails");
    $("[data-email-form]").clientId.value = client?.id || "";
    $("[data-email-form]").to.value = client?.email || "";
    $("[data-email-form]").subject.focus();
  }));
}

function renderMatters() {
  $("[data-matters]").innerHTML = `<div class="list">${state.matters.map((item) => {
    const client = state.clients.find((c) => c.id === item.clientId);
    return `<div class="item"><strong>${esc(item.title)}</strong><span>${esc(client?.name || "Sin cliente")} - ${esc(item.type)} - riesgo ${esc(item.risk)}</span><span>${esc(item.nextStep)}</span><div class="item-actions"><button data-timeline="${item.id}">Ver historial</button><a href="/api/matters/${item.id}/export">Exportar</a></div></div>`;
  }).join("") || "<p class='meta'>Sin registros</p>"}</div>`;
  $$("[data-timeline]").forEach((button) => button.addEventListener("click", () => loadTimeline(button.dataset.timeline)));
}

function renderTasks() {
  $("[data-tasks]").innerHTML = `<div class="list">${state.tasks.map((item) => `<div class="item"><strong>${esc(item.title)}</strong><span>${esc(item.dueDate || "Sin fecha")} - ${esc(item.priority)} - ${esc(item.status)}</span><div class="item-actions">${item.status !== "done" ? `<button data-done="${item.id}">Marcar hecha</button>` : ""}</div></div>`).join("") || "<p class='meta'>Sin registros</p>"}</div>`;
  $$("[data-done]").forEach((button) => button.addEventListener("click", async () => {
    await api("/api/tasks", { method: "PATCH", body: { id: button.dataset.done, status: "done" } });
    await refreshAll();
  }));
}

function renderEvents() {
  const ordered = [...state.events].sort((a, b) => String(a.date + (a.time || "")).localeCompare(String(b.date + (b.time || ""))));
  $("[data-events]").innerHTML = list(ordered, (item) => `<strong>${esc(item.title)}</strong><span>${esc(eventWhen(item))} - ${esc(item.kind)} - ${esc(matterTitle(item.matterId))}</span><span>${esc(item.location)} ${esc(item.notes)}</span>`);
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const labels = ["L", "M", "X", "J", "V", "S", "D"];
  const monthName = first.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  $("[data-calendar-title]").textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const cells = labels.map((label) => `<div class="calendar-label">${label}</div>`);
  for (let i = 0; i < startOffset; i += 1) cells.push("<div class='calendar-day muted'></div>");
  for (let day = 1; day <= days; day += 1) {
    const date = isoDate(new Date(year, month, day));
    const events = state.events.filter((item) => item.date === date);
    cells.push(`<button type="button" class="calendar-day ${events.length ? "has-events" : ""}" data-calendar-day="${date}"><strong>${day}</strong>${events.slice(0, 3).map((item) => `<span>${esc(item.title)}</span>`).join("")}</button>`);
  }
  $("[data-calendar]").innerHTML = cells.join("");
  $$("[data-calendar-day]").forEach((button) => button.addEventListener("click", () => selectCalendarDay(button.dataset.calendarDay)));
}

function renderTimeEntries() {
  $("[data-time-entries]").innerHTML = list(state.timeEntries, (item) => {
    const amount = Number(item.rate || 0) && Number(item.minutes || 0) ? ` - ${Math.round((Number(item.minutes) / 60) * Number(item.rate))} EUR` : "";
    return `<strong>${esc(item.concept)}</strong><span>${esc(item.date || "Sin fecha")} - ${esc(matterTitle(item.matterId))} - ${minutesLabel(item.minutes)}${esc(amount)}</span><span>${item.billable ? "Facturable" : "No facturable"}</span>`;
  });
}

function renderEmailLog() {
  $("[data-email-log]").innerHTML = list(state.emailLog, (item) => `<strong>${esc(item.subject)}</strong><span>${esc(item.to)} - ${esc(item.createdAt)}</span>`);
}

function renderDocuments() {
  $("[data-documents]").innerHTML = `<div class="list">${state.documents.map((item) => `<div class="item"><strong>${esc(item.name)}</strong><span>${esc(item.category || "General")} - ${Math.round(item.size / 1024)} KB - ${esc(item.createdAt)}</span><div class="item-actions"><a href="/api/documents/${item.id}">Descargar</a></div></div>`).join("") || "<p class='meta'>Sin registros</p>"}</div>`;
}

function renderSelects() {
  const clientOptions = `<option value="">Cliente</option>${state.clients.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join("")}`;
  $$("[data-client-select], [data-email-client-select]").forEach((select) => select.innerHTML = clientOptions);
  const matterOptions = `<option value="">Expediente</option>${state.matters.map((item) => `<option value="${item.id}">${esc(item.title)}</option>`).join("")}`;
  $$("[data-matter-select], [data-document-matter-select], [data-event-matter-select], [data-time-matter-select], [data-email-matter-select]").forEach((select) => select.innerHTML = matterOptions);
}

function submitForm(url, view) {
  return async (event) => {
    event.preventDefault();
    await api(url, { method: "POST", body: formData(event.target) });
    event.target.reset();
    await refreshAll();
    setView(view);
  };
}

async function uploadDocument(event) {
  event.preventDefault();
  const form = event.target;
  const file = form.file.files[0];
  if (!file) return;
  const contentBase64 = await fileToBase64(file);
  await api("/api/documents", { method: "POST", body: { matterId: form.matterId.value, category: form.category.value, name: file.name, mimeType: file.type, contentBase64 } });
  form.reset();
  await refreshAll();
}

async function sendEmail(event) {
  event.preventDefault();
  const form = event.target;
  const result = await api("/api/email/send", { method: "POST", body: formData(form), silent: true });
  $("[data-email-message]").textContent = result?.error || "Correo enviado correctamente";
  if (!result?.error) {
    form.reset();
    await refreshAll();
  }
}

async function search(event) {
  event.preventDefault();
  const q = event.target.q.value.trim();
  const result = await api(`/api/search?q=${encodeURIComponent(q)}`);
  $("[data-search-results]").innerHTML = list(result.items || [], (item) => `<strong>${esc(item.type)} - ${esc(item.title)}</strong><span>${esc(item.subtitle)}</span>`);
}

async function loadTimeline(matterId) {
  const result = await api(`/api/matters/${matterId}/timeline`);
  $("[data-timeline-panel]").classList.remove("hidden");
  $("[data-timeline-title]").textContent = `Historial - ${result.matter?.title || "Expediente"}`;
  $("[data-timeline]").innerHTML = list(result.items || [], (item) => `<strong>${esc(item.type)} - ${esc(item.title)}</strong><span>${esc(item.date || "Sin fecha")}</span>`);
}

function setView(view) {
  $$("[data-view]").forEach((el) => el.classList.toggle("hidden", el.dataset.view !== view));
  $$("[data-view-button]").forEach((el) => el.classList.toggle("active", el.dataset.viewButton === view));
  $("[data-view-title]").textContent = { dashboard: "Panel", search: "Busqueda global", clients: "Clientes", matters: "Expedientes", tasks: "Tareas", events: "Calendario", timeEntries: "Tiempos", emails: "Correos", documents: "Documentos", audit: "Auditoria" }[view] || "Panel";
  if (view === "audit") loadAudit();
}

async function loadAudit() {
  const result = await api("/api/audit");
  $("[data-audit]").innerHTML = list(result.items || [], (item) => `<strong>${esc(item.action)}</strong><span>${esc(item.at)} - ${esc(item.userId || "sistema")}</span><span class="meta">${esc(JSON.stringify(item.details))}</span>`);
}

function moveCalendar(delta) {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + delta, 1);
  renderCalendar();
}

function selectCalendarDay(date) {
  const form = $("[data-event-form]");
  form.date.value = date;
  form.title.focus();
}

function fillEmailFromClient(event) {
  const client = state.clients.find((item) => item.id === event.target.value);
  const form = $("[data-email-form]");
  form.to.value = client?.email || "";
}

async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (csrfToken && !options.skipCsrf && options.method && options.method !== "GET") headers["X-CSRF-Token"] = csrfToken;
  const response = await fetch(url, { method: options.method || "GET", headers, body: options.body ? JSON.stringify(options.body) : undefined });
  if (response.status === 401 && !options.silent) location.reload();
  try { return await response.json(); } catch { return {}; }
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function list(items, render) {
  return `<div class="list">${items.length ? items.map((item) => `<div class="item">${render(item)}</div>`).join("") : "<p class='meta'>Sin registros</p>"}</div>`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function matterTitle(matterId) {
  return state.matters.find((item) => item.id === matterId)?.title || "Sin expediente";
}

function minutesLabel(minutes) {
  const value = Number(minutes || 0);
  return `${Math.floor(value / 60)}h ${value % 60}m`;
}

function eventWhen(item) {
  return `${item.date || "Sin fecha"}${item.time ? ` ${item.time}` : ""}`;
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
