const CONFIG = {
  theme: "dark",
  iconBlur: 15,
  iconSaturate: 5,
  iconBrightness: 1.3,
  iconContrast: 1.4,
  iconScale: 1.5,
  iconOpacity: 0.25,
  borderWidth: 2,
  borderBlur: 0,
  borderSaturate: 4.2,
  borderBrightness: 2.5,
  borderContrast: 2.5,
  exclude: false,
};

const PROCEDURES = [
  {
    id: "autorizaciones",
    title: "Autorizaciones",
    proc: "Autorizaciones",
    image: "assets/logos/procedures/autorizaciones.png",
  },
  {
    id: "implementaciones",
    title: "Implementaciones",
    proc: "Implementaciones",
    image: "assets/logos/procedures/Implementaciones.png",
  },
  {
    id: "intralaboratorios",
    title: "Intralaboratorios",
    proc: "Intralaboratorios",
    image: "assets/logos/procedures/intralaboratorios.png",
  },
  {
    id: "intercomparacion",
    title: "Intercomparacion",
    proc: "Intercomparacion",
    image: "assets/logos/procedures/Intercomparacion.png",
  },
];

const root = document.documentElement;
const cardsGrid = document.getElementById("cards-grid");
const blurNode = document.querySelector("#blur feGaussianBlur");

function applyConfig() {
  const themeClass = CONFIG.theme === "light" ? "light" : "dark";
  root.classList.remove("light", "dark");
  root.classList.add(themeClass);
  root.setAttribute("data-theme", themeClass);

  const vars = {
    "--icon-blur": `${CONFIG.iconBlur}px`,
    "--icon-saturate": CONFIG.iconSaturate,
    "--icon-brightness": CONFIG.iconBrightness,
    "--icon-contrast": CONFIG.iconContrast,
    "--icon-scale": CONFIG.iconScale,
    "--icon-opacity": CONFIG.iconOpacity,
    "--border-width": `${CONFIG.borderWidth}px`,
    "--border-blur": `${CONFIG.borderBlur}px`,
    "--border-saturate": CONFIG.borderSaturate,
    "--border-brightness": CONFIG.borderBrightness,
    "--border-contrast": CONFIG.borderContrast,
  };

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  if (blurNode) {
    blurNode.setAttribute("stdDeviation", CONFIG.iconBlur);
  }

  if (CONFIG.exclude) {
    document.body.classList.add("exclude-icons");
  } else {
    document.body.classList.remove("exclude-icons");
  }
}

function getSessionData() {
  const labKey = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado");
  const defaultLab = (sessionStorage.getItem("default_lab") || "").trim();
  const labName = sessionStorage.getItem("labNombreVisible") || labKey || "Laboratorio";
  const rol = (sessionStorage.getItem("rol") || "").toLowerCase().trim();
  const usuario = sessionStorage.getItem("usuario");
  return { labKey, defaultLab, labName, rol, usuario };
}

function setLabInfo(session) {
  const labTitle = document.getElementById("lab-title");
  const labInfo = document.getElementById("lab-info");

  if (!labTitle && !labInfo) return;

  if (session.labKey) {
    if (labTitle) labTitle.textContent = session.labName;
    if (labInfo) labInfo.textContent = "Seleccione el procedimiento para esta sesion.";
  } else {
    if (labTitle) labTitle.textContent = "Procedimientos";
    if (labInfo) labInfo.textContent = "Seleccione el procedimiento correspondiente al laboratorio.";
  }
}

let PROCEDURE_DICT = {};

async function loadProcedureDictionary() {
  try {
    const res = await fetch("config/procedure_descriptions.json", { cache: "no-cache" });
    if (res.ok) {
      PROCEDURE_DICT = await res.json();
    }
  } catch (err) {
    console.warn("[CerperStats] No se pudo cargar procedure_descriptions.json:", err);
  }
}

async function handleProcedureSelection(procedure) {
  const proc = procedure?.proc || procedure?.id || "";
  const dictKey = (procedure?.id || proc || "").toLowerCase();
  const meta = PROCEDURE_DICT[dictKey] || {};

  sessionStorage.setItem("procedimientoSeleccionado", proc);
  sessionStorage.setItem("procedimientoImagen", meta.image || procedure?.image || "");
  sessionStorage.setItem("procedimientoTitulo", meta.title || procedure?.title || proc);
  sessionStorage.setItem("procedimientoDescripcion", meta.description || "");
  if (window.cerper?.openPage) {
    await window.cerper.openPage("input_data/input_data.html");
  } else {
    window.location.href = "input_data/input_data.html";
  }
}

function createCard(procedure) {
  const article = document.createElement("article");
  article.className = "card";
  article.dataset.id = procedure.id;
  article.dataset.proc = procedure.proc;
  article.tabIndex = 0;
  article.setAttribute("role", "button");
  article.setAttribute("aria-label", procedure.title);

  const border = document.createElement("div");
  border.className = "border-backdrop";
  article.appendChild(border);

  const content = document.createElement("div");
  content.className = "content";
  article.appendChild(content);

  const imgContainer = document.createElement("div");
  imgContainer.className = "img-container";
  content.appendChild(imgContainer);

  const glowImg = document.createElement("img");
  glowImg.src = procedure.image;
  glowImg.alt = "";
  imgContainer.appendChild(glowImg);

  const icon = document.createElement("img");
  icon.className = "icon-foreground";
  icon.src = procedure.image;
  icon.alt = procedure.title;
  content.appendChild(icon);

  const title = document.createElement("h2");
  title.textContent = procedure.title;
  content.appendChild(title);

  article.addEventListener("click", (event) => {
    event.preventDefault();
    handleProcedureSelection(procedure);
  });

  article.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleProcedureSelection(procedure);
    }
  });

  return article;
}

function renderCards() {
  if (!cardsGrid) return;
  cardsGrid.innerHTML = "";
  PROCEDURES.forEach((procedure) => {
    cardsGrid.appendChild(createCard(procedure));
  });
}

function attachPointerTracking() {
  const cards = Array.from(document.querySelectorAll("article.card"));
  if (!cards.length) return;

  const handlePointerMove = (event) => {
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const relativeX = event.clientX - centerX;
      const relativeY = event.clientY - centerY;

      const x = (relativeX / (rect.width / 2)).toFixed(3);
      const y = (relativeY / (rect.height / 2)).toFixed(3);

      card.style.setProperty("--pointer-x", x);
      card.style.setProperty("--pointer-y", y);
    });
  };

  document.addEventListener("pointermove", handlePointerMove);
}

function wireNavigationButtons(session) {
  const backBtn = document.getElementById("go-menu");
  backBtn?.addEventListener("click", () => {
    if (window.cerper?.openPage) window.cerper.openPage("menu.html");
    else window.location.href = "menu.html";
  });

  const sessionsBtn = document.getElementById("go-sessions");
  if (!sessionsBtn) return;

  const allowed = session.rol === "admin" || (session.rol === "supervisor" && session.labKey && session.defaultLab && session.labKey === session.defaultLab);
  if (!allowed) {
    sessionsBtn.hidden = true;
    sessionsBtn.style.display = "none";
  } else {
    sessionsBtn.hidden = false;
    sessionsBtn.style.display = "";
  }

  sessionsBtn.addEventListener("click", () => {
    if (!session.usuario) {
      if (window.cerper?.openPage) window.cerper.openPage("login.html");
      else window.location.href = "login.html";
      return;
    }
    if (window.cerper?.openPage) window.cerper.openPage("sessions_panel.html");
    else window.location.href = "sessions_panel.html";
  });
}

function initIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadProcedureDictionary();
  applyConfig();
  const session = getSessionData();
  setLabInfo(session);
  renderCards();
  attachPointerTracking();
  wireNavigationButtons(session);
  initIcons();
});
