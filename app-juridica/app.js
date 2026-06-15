const config = window.VEMALEX_APP_CONFIG;
const form = document.querySelector("[data-booking-form]");
const panels = Array.from(document.querySelectorAll("[data-panel]"));
const steps = Array.from(document.querySelectorAll("[data-step-jump]"));
const sessionGrid = document.querySelector("[data-session-grid]");
const sessionTemplate = document.querySelector("#session-template");
const summaryBox = document.querySelector("[data-summary]");
const payLink = document.querySelector("[data-pay]");
const whatsAppLink = document.querySelector("[data-whatsapp]");
const emailLink = document.querySelector("[data-email]");
const historyList = document.querySelector("[data-history-list]");
const installButton = document.querySelector("[data-install]");
let currentStep = 0;
let deferredInstallPrompt;

const money = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: config.currency
});

function renderSessions() {
  sessionGrid.innerHTML = "";
  config.sessions.forEach((session, index) => {
    const node = sessionTemplate.content.cloneNode(true);
    const input = node.querySelector("input");
    input.value = session.id;
    input.checked = index === 0;
    node.querySelector(".session-name").textContent = session.name;
    node.querySelector(".session-price").textContent = money.format(session.price);
    node.querySelector(".session-detail").textContent = session.detail;
    sessionGrid.appendChild(node);
  });
}

function setStep(step) {
  currentStep = Math.max(0, Math.min(step, panels.length - 1));
  panels.forEach((panel, index) => panel.classList.toggle("active", index === currentStep));
  steps.forEach((item, index) => item.classList.toggle("active", index === currentStep));
  if (currentStep === 2) updateSummary();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectedSession() {
  const selected = new FormData(form).get("session");
  return config.sessions.find((session) => session.id === selected) || config.sessions[0];
}

function formDataObject() {
  const data = Object.fromEntries(new FormData(form).entries());
  const session = selectedSession();
  return {
    ...data,
    sessionId: session.id,
    sessionName: session.name,
    sessionPrice: session.price,
    createdAt: new Date().toISOString()
  };
}

function validateCurrentPanel() {
  const fields = Array.from(panels[currentStep].querySelectorAll("input, select, textarea"));
  return fields.every((field) => field.reportValidity());
}

function buildMessage(data) {
  return [
    "Hola VEMALEX, quiero reservar una sesión jurídica pagada.",
    "",
    `Sesión: ${data.sessionName} (${money.format(Number(data.sessionPrice))})`,
    `Preferencia: ${data.slot || "Sin indicar"}`,
    `Fecha orientativa: ${data.date || "Sin indicar"}`,
    `Nombre: ${data.name}`,
    `Teléfono: ${data.phone}`,
    `Email: ${data.email}`,
    `Área: ${data.area}`,
    "",
    `Resumen: ${data.summary}`
  ].join("\n");
}

function updateSummary() {
  const data = formDataObject();
  const session = selectedSession();
  const message = buildMessage(data);
  summaryBox.innerHTML = `
    <dl>
      <div><dt>Sesión</dt><dd>${session.name}</dd></div>
      <div><dt>Importe</dt><dd>${money.format(session.price)}</dd></div>
      <div><dt>Horario</dt><dd>${data.slot || "Sin indicar"}</dd></div>
      <div><dt>Área</dt><dd>${data.area || "Sin indicar"}</dd></div>
    </dl>
  `;
  const encoded = encodeURIComponent(message);
  whatsAppLink.href = `https://wa.me/${config.phone}?text=${encoded}`;
  emailLink.href = `mailto:${config.email}?subject=${encodeURIComponent("Reserva de sesión jurídica")}&body=${encoded}`;
  if (session.paymentUrl) {
    payLink.href = session.paymentUrl;
    payLink.textContent = "Pagar sesión";
    payLink.classList.remove("disabled");
  } else {
    payLink.href = `https://wa.me/${config.phone}?text=${encodeURIComponent("Hola VEMALEX, necesito el enlace de pago para " + session.name)}`;
    payLink.textContent = "Solicitar enlace de pago";
    payLink.classList.remove("disabled");
  }
}

function saveRequest() {
  const data = formDataObject();
  const saved = JSON.parse(localStorage.getItem("vemalex-requests") || "[]");
  saved.unshift(data);
  localStorage.setItem("vemalex-requests", JSON.stringify(saved.slice(0, 12)));
  renderHistory();
}

function renderHistory() {
  const saved = JSON.parse(localStorage.getItem("vemalex-requests") || "[]");
  historyList.innerHTML = "";
  if (!saved.length) {
    historyList.innerHTML = "<p>No hay solicitudes guardadas todavía.</p>";
    return;
  }
  saved.forEach((item) => {
    const article = document.createElement("article");
    const date = new Date(item.createdAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
    article.innerHTML = `
      <strong>${item.sessionName}</strong>
      <span>${date} · ${item.area}</span>
      <small>${item.name} · ${item.phone}</small>
    `;
    historyList.appendChild(article);
  });
}

document.addEventListener("click", (event) => {
  const next = event.target.closest("[data-next]");
  const prev = event.target.closest("[data-prev]");
  const jump = event.target.closest("[data-step-jump]");
  if (next && validateCurrentPanel()) setStep(currentStep + 1);
  if (prev) setStep(currentStep - 1);
  if (jump) {
    const targetStep = Number(jump.dataset.stepJump);
    if (targetStep <= currentStep || validateCurrentPanel()) setStep(targetStep);
  }
});

document.querySelector("[data-save]").addEventListener("click", () => {
  saveRequest();
  alert("Solicitud guardada en este dispositivo.");
});

document.querySelector("[data-clear-history]").addEventListener("click", () => {
  localStorage.removeItem("vemalex-requests");
  renderHistory();
});

form.addEventListener("reset", () => {
  setTimeout(() => {
    setStep(0);
    renderHistory();
  }, 0);
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

renderSessions();
renderHistory();
setStep(0);
