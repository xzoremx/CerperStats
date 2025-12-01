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

const PROCEDURES = ["autorizaciones", "implementaciones", "intralaboratorios", "intercomparacion"];

const root = document.documentElement;
const cardsGrid = document.getElementById("cards-grid");
const blurNode = document.querySelector("#blur feGaussianBlur");
const lucideScript = document.getElementById("lucide-cdn");
const glowLayer = document.querySelector(".glow-bg");
let glowPaused = true;
glowLayer?.classList.add("glow-paused");

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
  const heroTitle = document.getElementById("hero-lab-title");

  if (heroTitle) {
    heroTitle.textContent = session.labName || "Laboratorio";
  }

  if (labTitle) {
    labTitle.textContent = "Selecciona el tipo de procedimiento";
  }

  if (!labInfo) return;

  if (session.labKey) {
    labInfo.textContent = "Seleccione el procedimiento para esta sesion.";
  } else {
    labInfo.textContent = "Seleccione el procedimiento correspondiente al laboratorio.";
  }
}

let PROCEDURE_DICT = {};

function formatProcedureTitle(id = "") {
  if (!id) return "Procedimiento";
  return id
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getProcedureMeta(id) {
  const dictKey = (id || "").toLowerCase();
  const meta = PROCEDURE_DICT[dictKey] || {};
  const title = meta.title || formatProcedureTitle(dictKey);
  const fallbackImageId = dictKey || "autorizaciones";
  return {
    id: dictKey,
    title,
    description: meta.description || "",
    image: meta.image || `assets/logos/procedures/${fallbackImageId}.webp`,
  };
}

async function loadProcedureDictionary() {
  if (Object.keys(PROCEDURE_DICT).length) return PROCEDURE_DICT;
  try {
    const res = await fetch("config/procedure_descriptions.json", { cache: "no-cache" });
    if (res.ok) {
      PROCEDURE_DICT = await res.json();
    }
  } catch (err) {
    console.warn("[CerperStats] No se pudo cargar procedure_descriptions.json:", err);
  }
  return PROCEDURE_DICT;
}

async function handleProcedureSelection(procedureId) {
  await loadProcedureDictionary();
  const meta = getProcedureMeta(procedureId);
  const proc = meta.title || procedureId || "";

  sessionStorage.setItem("procedimientoSeleccionado", proc);
  sessionStorage.setItem("procedimientoImagen", meta.image);
  sessionStorage.setItem("procedimientoTitulo", meta.title || proc);
  sessionStorage.setItem("procedimientoDescripcion", meta.description || "");
  if (window.cerper?.openPage) {
    await window.cerper.openPage("input_data/input_data.html");
  } else {
    window.location.href = "input_data/input_data.html";
  }
}

function createCard(procedureId) {
  const meta = getProcedureMeta(procedureId);
  const article = document.createElement("article");
  article.className = "card";
  article.dataset.id = meta.id;
  article.dataset.proc = meta.title;
  article.tabIndex = 0;
  article.setAttribute("role", "button");
  article.setAttribute("aria-label", meta.title);

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
  glowImg.src = meta.image;
  glowImg.alt = "";
  imgContainer.appendChild(glowImg);

  const icon = document.createElement("img");
  icon.className = "icon-foreground";
  icon.src = meta.image;
  icon.alt = meta.title;
  content.appendChild(icon);

  const title = document.createElement("h2");
  title.textContent = meta.title;
  content.appendChild(title);

  article.addEventListener("click", (event) => {
    event.preventDefault();
    handleProcedureSelection(meta.id);
  });

  article.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleProcedureSelection(meta.id);
    }
  });

  return article;
}

function renderCards() {
  if (!cardsGrid) return;
  cardsGrid.innerHTML = "";
  PROCEDURES.forEach((procedureId) => {
    cardsGrid.appendChild(createCard(procedureId));
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
  return () => document.removeEventListener("pointermove", handlePointerMove);
}

function wireNavigationButtons(session) {
  const backBtn = document.getElementById("go-menu");
  backBtn?.addEventListener("click", () => {
    window.procLoader?.show?.("Abriendo menú...");
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
    window.procLoader?.show?.("Abriendo sesiones...");
    if (window.cerper?.openPage) window.cerper.openPage("sessions_panel.html");
    else window.location.href = "sessions_panel.html";
  });
}

function initIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
    return;
  }

  lucideScript?.addEventListener(
    "load",
    () => {
      if (window.lucide?.createIcons) {
        window.lucide.createIcons();
      }
    },
    { once: true },
  );
}

function toggleGlowAnimation() {
  glowPaused = !glowPaused;
  glowLayer?.classList.toggle("glow-paused", glowPaused);
}

document.addEventListener("keydown", (event) => {
  if (event.key?.toLowerCase() === "p") {
    event.preventDefault();
    toggleGlowAnimation();
  }
});

async function initPage() {
  window.procLoader?.show?.("Preparando procedimientos...");
  await loadProcedureDictionary();
  applyConfig();
  const session = getSessionData();
  setLabInfo(session);
  renderCards();
  const detachPointer = attachPointerTracking();
  wireNavigationButtons(session);
  initIcons();

  let loadingCleared = false;
  const clearLoading = () => {
    if (loadingCleared) return;
    loadingCleared = true;
    window.procLoader?.hide?.();
  };

  const handleVantaReady = () => {
    window.removeEventListener("vanta-ready", handleVantaReady);
    clearLoading();
  };

  window.addEventListener("vanta-ready", handleVantaReady, { once: true });
  setTimeout(clearLoading, 1500);

  if (window.router?.registerCleanup) {
    window.router.registerCleanup(() => {
      detachPointer?.();
      window.removeEventListener("vanta-ready", handleVantaReady);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage, { once: true });
} else {
  initPage();
}
