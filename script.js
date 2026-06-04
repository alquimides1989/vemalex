const areaContent = {
  familia: {
    index: "01",
    title: "Derecho de Familia",
    text:
      "Divorcios, separaciones, custodia, medidas paterno-filiales, modificaciones de medidas, adopciones y reclamaciones de pensiones alimenticias con una estrategia centrada en la estabilidad familiar.",
    list: [
      "Divorcio de mutuo acuerdo o contencioso",
      "Guarda, custodia y régimen de visitas",
      "Pensión de alimentos y ejecución de resoluciones",
    ],
  },
  mediacion: {
    index: "02",
    title: "Mediación",
    text:
      "Intervención orientada a resolver conflictos familiares de forma pacífica, eficaz y menos desgastante, favoreciendo acuerdos que protejan a los menores y al entorno familiar.",
    list: [
      "Negociación entre progenitores",
      "Acuerdos antes de iniciar la vía judicial",
      "Comunicación ordenada y reducción del conflicto",
    ],
  },
  penal: {
    index: "03",
    title: "Derecho Penal",
    text:
      "Defensa y acompañamiento en procedimientos penales, con análisis temprano de riesgos, preparación de estrategia y protección de derechos desde el primer momento.",
    list: [
      "Asistencia ante denuncias o acusaciones",
      "Defensa en instrucción y juicio",
      "Estrategia probatoria y seguimiento procesal",
    ],
  },
  social: {
    index: "04",
    title: "Derecho Social",
    text:
      "Asesoramiento y defensa en asuntos laborales y de Seguridad Social, tanto frente a empresas como ante organismos públicos.",
    list: [
      "Despidos y reclamación de derechos laborales",
      "Prestaciones e incapacidades",
      "Conflictos con empresas u organismos públicos",
    ],
  },
};

const resultContent = {
  familia: {
    label: "Derecho de Familia",
    title: "Conviene ordenar medidas y proteger la estabilidad familiar.",
    text:
      "Prepara sentencias, convenios, comunicaciones relevantes y datos económicos. En la primera consulta se puede valorar urgencia, viabilidad y estrategia.",
    link:
      "https://wa.me/34623912318?text=Hola%20VEMALEX%2C%20quiero%20consultar%20un%20asunto%20de%20familia",
  },
  mediacion: {
    label: "Mediación",
    title: "Puede ser el camino más eficiente si existe margen de diálogo.",
    text:
      "La mediación permite reducir tensión, costes y tiempos. Es útil cuando las partes necesitan acuerdos sostenibles sin entrar de lleno en un procedimiento contencioso.",
    link:
      "https://wa.me/34623912318?text=Hola%20VEMALEX%2C%20quiero%20informarme%20sobre%20mediaci%C3%B3n",
  },
  penal: {
    label: "Derecho Penal",
    title: "Es importante actuar pronto y conservar toda la información.",
    text:
      "Guarda citaciones, denuncias, mensajes y cualquier documento recibido. Una valoración rápida ayuda a evitar errores en las primeras actuaciones.",
    link:
      "https://wa.me/34623912318?text=Hola%20VEMALEX%2C%20necesito%20orientaci%C3%B3n%20penal",
  },
  social: {
    label: "Derecho Social",
    title: "Revisa plazos cuanto antes: en laboral el tiempo importa.",
    text:
      "Despidos, sanciones, prestaciones e incapacidades suelen tener plazos concretos. Conviene revisar documentación y fechas desde el primer contacto.",
    link:
      "https://wa.me/34623912318?text=Hola%20VEMALEX%2C%20quiero%20consultar%20un%20asunto%20laboral%20o%20social",
  },
};

const header = document.querySelector("[data-header]");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

function updateHeader() {
  header.classList.toggle("scrolled", window.scrollY > 24);
}

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

navToggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  document.body.classList.toggle("nav-open", isOpen);
  header.classList.toggle("nav-active", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

nav.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    nav.classList.remove("open");
    document.body.classList.remove("nav-open");
    header.classList.remove("nav-active");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

document.querySelectorAll(".practice-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const content = areaContent[tab.dataset.area];
    document.querySelectorAll(".practice-tab").forEach((item) => {
      item.classList.toggle("active", item === tab);
      item.setAttribute("aria-selected", String(item === tab));
    });
    document.querySelector("[data-area-index]").textContent = content.index;
    document.querySelector("[data-area-title]").textContent = content.title;
    document.querySelector("[data-area-text]").textContent = content.text;
    document.querySelector("[data-area-list]").innerHTML = content.list
      .map((item) => `<li>${item}</li>`)
      .join("");
  });
});

document.querySelectorAll(".choice").forEach((choice) => {
  choice.addEventListener("click", () => {
    const result = resultContent[choice.dataset.result];
    document.querySelectorAll(".choice").forEach((item) => item.classList.toggle("active", item === choice));
    document.querySelector("[data-result-label]").textContent = result.label;
    document.querySelector("[data-result-title]").textContent = result.title;
    document.querySelector("[data-result-text]").textContent = result.text;
    document.querySelector("[data-result-link]").href = result.link;
  });
});

document.querySelectorAll(".accordion button").forEach((button) => {
  button.addEventListener("click", () => {
    const panel = button.nextElementSibling;
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    panel.classList.toggle("open", !expanded);
  });
});

const contactForm = document.querySelector("[data-contact-form]");
const formSteps = Array.from(document.querySelectorAll(".form-step"));
const progressSteps = Array.from(document.querySelectorAll(".form-progress span"));
let currentFormStep = 0;

function updateFormStep(nextStep) {
  currentFormStep = Math.max(0, Math.min(nextStep, formSteps.length - 1));
  formSteps.forEach((step, index) => step.classList.toggle("active", index === currentFormStep));
  progressSteps.forEach((step, index) => step.classList.toggle("active", index <= currentFormStep));
}

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", () => updateFormStep(currentFormStep + 1));
});

document.querySelectorAll("[data-prev]").forEach((button) => {
  button.addEventListener("click", () => updateFormStep(currentFormStep - 1));
});

contactForm.addEventListener("submit", (event) => {
  const form = event.currentTarget;
  const note = form.querySelector("[data-form-note]");

  if (!form.checkValidity()) {
    event.preventDefault();
    updateFormStep(formSteps.length - 1);
    return;
  }

  form.classList.add("is-sending");
  form.querySelector("button[type='submit']").textContent = "Enviando consulta...";
  note.textContent = "Estamos enviando tu consulta a info@vemalex.com.";
});

const chatToggle = document.querySelector("[data-chat-toggle]");
const chatPanel = document.querySelector("[data-chat-panel]");

chatToggle.addEventListener("click", () => {
  const isOpen = chatPanel.classList.toggle("open");
  chatToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelector("[data-chat-contact]").addEventListener("click", () => {
  chatPanel.classList.remove("open");
  chatToggle.setAttribute("aria-expanded", "false");
});
