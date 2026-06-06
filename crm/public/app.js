let csrfToken = "";
let state = { clients: [], matters: [], tasks: [], documents: [] };

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
    const body = formData(event.target);
    const result = await api("/api/login", { method: "POST", body, skipCsrf: true, silent: true });
    if (result?.user) return showApp(result);
    $("[data-login-message]").textContent = result?.error || "No se pudo acceder";
  });

  $("[data-logout]").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    location.reload();
  });

  $$("[data-view-button]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewButton)));
  $("[data-client-form]").addEventListener("submit", submitForm("/api/clients", "clients"));
  $("[data-matter-form]").addEventListener("submit", submitForm("/api/matters", "matters"));
  $("[data-task-form]").addEventListener("submit", submitForm("/api/tasks", "tasks"));
  $("[data-document-form]").addEventListener("submit", uploadDocument);
}

async function showApp(result) {
  csrfToken = result.csrfToken;
  $("[data-login]").classList.add("hidden");
  $("[data-shell]").classList.remove("hidden");
  $("[data-user]").textContent = `${result.user.name} · ${result.user.role}`;
  await refreshAll();
}

async function refreshAll() {
  const [summary, clients, matters, tasks, documents] = await Promise.all([
    api("/api/summary"),
    api("/api/clients"),
    api("/api/matters"),
    api("/api/tasks"),
    api("/api/documents"),
  ]);
  state.clients = clients.items || [];
  state.matters = matters.items || [];
  state.tasks = tasks.items || [];
  state.documents = documents.items || [];
  renderSummary(summary);
  renderClients();
  renderMatters();
  renderTasks();
  renderDocuments();
  renderSelects();
}

function renderSummary(summary) {
  $("[data-stats]").innerHTML = [
    ["Clientes", summary.clients],
    ["Expedientes", summary.matters],
    ["Tareas abiertas", summary.openTasks],
    ["Documentos", summary.documents],
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  $("[data-recent-matters]").innerHTML = list(summary.recentMatters || [], (item) => `<strong>${esc(item.title)}</strong><span>${esc(item.type)} · ${esc(item.status)}</span>`);
  $("[data-due-tasks]").innerHTML = list(summary.dueTasks || [], (item) => `<strong>${esc(item.title)}</strong><span>${esc(item.dueDate || "Sin fecha")} · ${esc(item.priority)}</span>`);
}

function renderClients() {
  $("[data-clients]").innerHTML = list(state.clients, (item) => `<strong>${esc(item.name)}</strong><span>${esc(item.phone)} · ${esc(item.email)}</span><span>${esc(item.tags)}</span>`);
}

function renderMatters() {
  $("[data-matters]").innerHTML = list(state.matters, (item) => {
    const client = state.clients.find((c) => c.id === item.clientId);
    return `<strong>${esc(item.title)}</strong><span>${esc(client?.name || "Sin cliente")} · ${esc(item.type)} · riesgo ${esc(item.risk)}</span><span>${esc(item.nextStep)}</span>`;
  });
}

function renderTasks() {
  $("[data-tasks]").innerHTML = `<div class="list">${state.tasks.map((item) => `<div class="item"><strong>${esc(item.title)}</strong><span>${esc(item.dueDate || "Sin fecha")} · ${esc(item.priority)} · ${esc(item.status)}</span><div class="item-actions">${item.status !== "done" ? `<button data-done="${item.id}">Marcar hecha</button>` : ""}</div></div>`).join("") || "<p class='meta'>Sin registros</p>"}</div>`;
  $$("[data-done]").forEach((button) => button.addEventListener("click", async () => {
    await api("/api/tasks", { method: "PATCH", body: { id: button.dataset.done, status: "done" } });
    await refreshAll();
  }));
}

function renderDocuments() {
  $("[data-documents]").innerHTML = `<div class="list">${state.documents.map((item) => `<div class="item"><strong>${esc(item.name)}</strong><span>${Math.round(item.size / 1024)} KB · ${esc(item.createdAt)}</span><div class="item-actions"><a href="/api/documents/${item.id}">Descargar</a></div></div>`).join("") || "<p class='meta'>Sin registros</p>"}</div>`;
}

function renderSelects() {
  const clientOptions = `<option value="">Cliente</option>${state.clients.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join("")}`;
  $$("[data-client-select]").forEach((select) => select.innerHTML = clientOptions);
  const matterOptions = `<option value="">Expediente</option>${state.matters.map((item) => `<option value="${item.id}">${esc(item.title)}</option>`).join("")}`;
  $$("[data-matter-select], [data-document-matter-select]").forEach((select) => select.innerHTML = matterOptions);
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
  await api("/api/documents", { method: "POST", body: { matterId: form.matterId.value, name: file.name, mimeType: file.type, contentBase64 } });
  form.reset();
  await refreshAll();
}

function setView(view) {
  $$("[data-view]").forEach((el) => el.classList.toggle("hidden", el.dataset.view !== view));
  $$("[data-view-button]").forEach((el) => el.classList.toggle("active", el.dataset.viewButton === view));
  $("[data-view-title]").textContent = { dashboard: "Panel", clients: "Clientes", matters: "Expedientes", tasks: "Tareas", documents: "Documentos", audit: "Auditoría" }[view] || "Panel";
  if (view === "audit") loadAudit();
}

async function loadAudit() {
  const result = await api("/api/audit");
  $("[data-audit]").innerHTML = list(result.items || [], (item) => `<strong>${esc(item.action)}</strong><span>${esc(item.at)} · ${esc(item.userId || "sistema")}</span><span class="meta">${esc(JSON.stringify(item.details))}</span>`);
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

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
