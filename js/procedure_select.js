const DEFAULT_LAB_NAME = "Laboratorio seleccionado";
const loader = window.procLoader;
const DEFAULT_LAB_ICON = "flask-conical";
const DEFAULT_LAB_COLOR = "#22d3ee";

let PROCEDURE_DICT = {};

function initLabIcon() {
  const iconSlot = document.getElementById("selected-lab-icon");
  if (!iconSlot) return;

  const storedIcon =
    sessionStorage.getItem("labIcon") ||
    localStorage.getItem("labIcon") ||
    "";
  const labIcon = storedIcon || DEFAULT_LAB_ICON;

  const storedColor =
    sessionStorage.getItem("labColor") ||
    localStorage.getItem("labColor") ||
    "";
  const labColor = (storedColor || DEFAULT_LAB_COLOR).trim();
  if (labColor) {
    iconSlot.style.color = labColor;
  }

  if (window.IconSafety?.attachIcon) {
    window.IconSafety.attachIcon(iconSlot, labIcon).then((ok) => {
      if (!ok) {
        iconSlot.innerHTML = `<i data-lucide="${DEFAULT_LAB_ICON}"></i>`;
      }
      if (window.lucide?.createIcons) {
        window.lucide.createIcons();
      }
    });
  } else {
    iconSlot.innerHTML = `<i data-lucide="${DEFAULT_LAB_ICON}"></i>`;
    if (window.lucide?.createIcons) {
      window.lucide.createIcons();
    }
  }
}

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

function renderProcedureCards() {
  const grid = document.getElementById("cards-grid");
  if (!grid) return;

  grid.innerHTML = "";

  Object.keys(PROCEDURE_DICT).forEach((id) => {
    const meta = getProcedureMeta(id);
    if (!meta.id) return;

    const article = document.createElement("article");
    article.className = "card";
    article.dataset.id = meta.id;
    article.tabIndex = 0;
    article.setAttribute("role", "button");
    article.setAttribute("aria-label", meta.title);

    article.innerHTML = `
      <div class="border-backdrop"></div>
      <div class="content">
        <div class="img-container">
          <img src="${meta.image}" alt="">
        </div>
        <img class="icon-foreground" src="${meta.image}" alt="${meta.title}">
        <h2>${meta.title}</h2>
      </div>
    `;

    grid.appendChild(article);
  });
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
  loader?.show?.("Preparando entrada de datos...");
  const navigate = () => {
    if (window.cerper?.openPage) window.cerper.openPage("input_data/input_data_info.html");
    else window.location.href = "input_data/input_data_info.html";
  };
  requestAnimationFrame(navigate);
}

function initLabName() {
  const stored =
    sessionStorage.getItem("labNombreVisible") ||
    localStorage.getItem("labNombreVisible") ||
    sessionStorage.getItem("labSeleccionado") ||
    localStorage.getItem("labSeleccionado");
  const name = (stored || "").trim() || DEFAULT_LAB_NAME;
  const target = document.getElementById("selected-lab");
  if (target) target.textContent = name;
  const labTitle = document.getElementById("lab-title");
  const labInfo = document.getElementById("lab-info");
  const heroTitle = document.getElementById("hero-lab-title");
  if (labTitle) labTitle.textContent = "Selecciona el tipo de procedimiento";
  if (labInfo) labInfo.textContent = "Seleccione el procedimiento para esta sesión.";
  if (heroTitle) {
    heroTitle.textContent = "";
    const label = document.createElement("span");
    label.className = "hero-lab-name";
    label.textContent = name;
    heroTitle.appendChild(label);
  }
}

function gateSessionsSection() {
  const labKey = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado") || "";
  const rol = (sessionStorage.getItem("rol") || "").toLowerCase().trim();

  const primaryDefaultLab = (sessionStorage.getItem("default_lab") || "").trim();
  let defaultLabs = [];
  try {
    const raw = sessionStorage.getItem("default_labs");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        defaultLabs = parsed.map((v) => String(v || "").trim()).filter(Boolean);
      }
    }
  } catch (_) { }
  if (!defaultLabs.length && primaryDefaultLab) defaultLabs = [primaryDefaultLab];

  const allowed =
    rol === "admin" || (rol === "supervisor" && labKey && defaultLabs.includes(labKey));
  if (allowed) return;
  const sessionsSection = document.querySelector('.section[data-index="3"]') || document.querySelectorAll(".section")[2];
  sessionsSection?.remove();
  const sessionsDot = document.querySelector('.progress-dot[data-index="3"]') || document.querySelectorAll(".progress-dot")[2];
  sessionsDot?.remove();
}

async function loadUserStats() {
  try {
    const res = await window.cerper.getStatsUser();
    if (!res.ok || !res.data) {
      console.warn("[Procedure] No se pudieron cargar las estadísticas de usuario");
      return;
    }
    const { sesiones_guardadas, sesiones_reevaluadas, informes_reprocesados } = res.data;

    const setStatValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value !== undefined ? value : "0";
    };

    setStatValue("stat-sesiones-guardadas", sesiones_guardadas);
    setStatValue("stat-sesiones-reevaluadas", sesiones_reevaluadas);
    setStatValue("stat-informes-reprocesados", informes_reprocesados);
  } catch (err) {
    console.error("[Procedure] Error cargando stats de usuario:", err);
  }
}

async function initPage() {
  window.lucide?.createIcons?.();
  initLabName();
  initLabIcon();
  gateSessionsSection();
  loadUserStats();

  await loadProcedureDictionary();
  renderProcedureCards();

  const sections = document.querySelectorAll(".section");
  const dots = document.querySelectorAll(".progress-dot");
  const magneticElements = document.querySelectorAll(".magnetic");
  const startButton = document.getElementById("start-button");
  const cardElements = document.querySelectorAll(
    "#cards-grid article.card, .procedure-showcase article.card",
  );
  const backToMenuButton = document.getElementById("back-to-menu");
  const sessionsCtaButton = document.querySelector('.section[data-index="3"] .cta-primary');

  let currentIndex = 0;
  let isScrolling = false;

  // Resetear reveals sin animar el fade‑out y luego reproducir sección 0
  sections.forEach((section) => {
    section.querySelectorAll(".reveal").forEach((el) => {
      el.classList.remove("active");
      el.style.transition = "none";
      void el.offsetHeight;
      el.style.transition = "";
    });
  });
  requestAnimationFrame(() => changeSection(currentIndex));

  

  

  if (startButton) {
    startButton.addEventListener("click", () => {
      currentIndex = 1;
      changeSection(currentIndex);
    });
  }

  document.addEventListener("pointermove", (event) => {
    if (!cardElements.length) return;
    cardElements.forEach((card) => {
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
  });

  const staticProcedureCards = document.querySelectorAll(".procedure-showcase article.card");
  staticProcedureCards.forEach((card) => {
    const procedureId = card.dataset.id;
    if (!procedureId) return;
    card.addEventListener("click", (event) => {
      event.preventDefault();
      handleProcedureSelection(procedureId);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleProcedureSelection(procedureId);
      }
    });
  });

  if (backToMenuButton) {
    backToMenuButton.addEventListener("click", () => {
      loader?.show?.("Abriendo menu...");
      const navigate = () => {
        if (window.cerper?.openPage) window.cerper.openPage("menu.html");
        else window.location.href = "menu.html";
      };
      requestAnimationFrame(navigate);
    });
  }

  if (sessionsCtaButton) {
    sessionsCtaButton.addEventListener("click", () => {
      const usuario = sessionStorage.getItem("usuario");
      if (!usuario) {
        console.warn("No user session found");
        return;
      }
      loader?.show?.("Abriendo sesiones...");
      const navigate = () => {
        if (window.cerper?.openPage) window.cerper.openPage("sessions_panel.html");
        else window.location.href = "sessions_panel.html";
      };
      requestAnimationFrame(navigate);
    });
  }

  magneticElements.forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${x * 0.05}px, ${y * 0.05}px)`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = "translate(0px, 0px)";
    });
  });

  window.addEventListener("wheel", (e) => {
    if (isScrolling) return;
    isScrolling = true;
    if (e.deltaY > 0) {
      if (currentIndex < sections.length - 1) {
        currentIndex += 1;
        changeSection(currentIndex);
      }
    } else if (currentIndex > 0) {
      currentIndex -= 1;
      changeSection(currentIndex);
    }
    setTimeout(() => {
      isScrolling = false;
    }, 1000);
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = parseInt(dot.getAttribute("data-index"), 10);
      if (Number.isNaN(index)) return;
      currentIndex = index;
      changeSection(currentIndex);
    });
  });

  function changeSection(index) {
    sections.forEach((section) => section.classList.remove("active"));
    if (sections[index]) sections[index].classList.add("active");
    updateActiveDot(index);

    const reveals = sections[index]?.querySelectorAll(".reveal") || [];
    reveals.forEach((el, i) => {
      setTimeout(() => el.classList.add("active"), i * 100);
    });

    sections.forEach((section, i) => {
      if (i !== index) {
        section.querySelectorAll(".reveal").forEach((el) => el.classList.remove("active"));
      }
    });
  }

  function updateActiveDot(index) {
    dots.forEach((dot) => dot.classList.remove("active"));
    if (dots[index]) dots[index].classList.add("active");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage, { once: true });
} else {
  initPage();
}
