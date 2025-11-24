// --- variables de laboratorios ---
let labs = [];
let labColors = [];
let cards = [];
let dots = [];

// --- Elementos del carrusel ---
const track = document.querySelector(".carousel-track");
const dotsContainer = document.querySelector(".dots");
const memberName = document.querySelector(".member-name");
const memberRole = document.querySelector(".member-role");
const leftArrow = document.querySelector(".nav-arrow.left");
const rightArrow = document.querySelector(".nav-arrow.right");

let currentIndex = 0;
let isAnimating = false;

// --- Cargar laboratorios desde la base de datos (vía preload / main.js) ---
async function loadLabsFromDB() {
  try {
    const rows = await window.cerper.getLabs();

    if (!rows || !Array.isArray(rows) || !rows.length) {
      throw new Error("No se encontraron laboratorios en la base de datos.");
    }

    labs = rows.map((l) => ({
      key: l.lab_key,
      name: l.nombre,
      role: l.descripcion || l.nombre || "",
      icon: l.icon_lucide || l.icono || null,
    }));

    labColors = rows.map((l) => l.color || "#00ffff");

    console.log(`[CerperStats] Laboratorios cargados (${labs.length})`);
    await renderLabs();
  } catch (err) {
    console.error("[CerperStats] Error al cargar laboratorios:", err);
    labs = [];
    labColors = [];
    await renderLabs();
  }
}

async function renderLabs() {
  if (!track || !dotsContainer) return;
  track.innerHTML = "";
  dotsContainer.innerHTML = "";
  cards = [];
  dots = [];

  if (!labs.length) {
    const empty = document.createElement("div");
    empty.className = "card center";
    empty.innerHTML = `
      <div class="lab-icon"><i data-lucide="alert-triangle"></i></div>
      <h2>Sin laboratorios</h2>
      <p style="opacity:0.75;font-size:0.9rem;">Contacte al administrador.</p>
    `;
    track.appendChild(empty);
    cards.push(empty);
    if (window.lucide?.createIcons) window.lucide.createIcons();
    return;
  }

  for (let i = 0; i < labs.length; i++) {
    const lab = labs[i];
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.index = String(i);
    card.dataset.lab = lab.name || lab.key;
    card.dataset.route = "procedure_select.html";

    const iconSlot = document.createElement("div");
    iconSlot.className = "lab-icon";
    const iconName = lab.icon || "bar-chart-2";
    let ok = false;
    if (window.IconSafety && typeof window.IconSafety.attachIcon === "function") {
      ok = await window.IconSafety.attachIcon(iconSlot, iconName);
    } else {
      const safe = String(iconName || "").toLowerCase().replace(/[^a-z0-9\-]/g, "") || "bar-chart-2";
      iconSlot.innerHTML = `<i data-lucide="${safe}"></i>`;
      ok = true;
    }
    if (!ok) {
      iconSlot.innerHTML = `<i data-lucide="bar-chart-2"></i>`;
    }

    const title = document.createElement("h2");
    title.textContent = lab.name || lab.key;

    card.appendChild(iconSlot);
    card.appendChild(title);

    track.appendChild(card);
    cards.push(card);

    const dot = document.createElement("div");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.dataset.index = String(i);
    dotsContainer.appendChild(dot);
    dots.push(dot);
  }

  if (window.lucide?.createIcons) window.lucide.createIcons();

  cards.forEach((card, i) => card.addEventListener("click", () => handleCardClick(i)));
  dots.forEach((dot, i) => dot.addEventListener("click", () => updateCarousel(i)));

  updateCarousel(Math.min(currentIndex, cards.length - 1));
}

// --- Actualiza posición y texto ---
function updateCarousel(newIndex) {
  if (isAnimating || !cards.length) return;
  isAnimating = true;

  currentIndex = (newIndex + cards.length) % cards.length;

  cards.forEach((card, i) => {
    const offset = (i - currentIndex + cards.length) % cards.length;
    card.classList.remove("center", "left-1", "left-2", "right-1", "right-2", "hidden");

    if (offset === 0) card.classList.add("center");
    else if (offset === 1) card.classList.add("right-1");
    else if (offset === 2) card.classList.add("right-2");
    else if (offset === cards.length - 1) card.classList.add("left-1");
    else if (offset === cards.length - 2) card.classList.add("left-2");
    else card.classList.add("hidden");
  });

  dots.forEach((dot, i) => dot.classList.toggle("active", i === currentIndex));

  memberName.style.opacity = "0";
  memberRole.style.opacity = "0";

  setTimeout(() => {
    const color = labColors[currentIndex] || "#00ffff";
    memberName.textContent = labs[currentIndex]?.name || "Laboratorio";
    memberRole.textContent = labs[currentIndex]?.role || "";
    memberName.style.color = color;
    memberName.style.textShadow = `0 0 1px ${color}, 0 0 2px ${color}`;
    memberName.style.opacity = "1";
    memberRole.style.opacity = "1";
  }, 300);

  setTimeout(() => (isAnimating = false), 800);
}

function handleCardClick(i) {
  updateCarousel(i);
  const selectedLab = labs[i];
  if (!selectedLab) return;

  sessionStorage.setItem("labSeleccionado", selectedLab.key);
  sessionStorage.setItem("labNombreVisible", selectedLab.name);
  localStorage.setItem("labSeleccionado", selectedLab.key);
  localStorage.setItem("labNombreVisible", selectedLab.name);

  if (window.cerper && typeof window.cerper.openPage === "function") {
    window.cerper.openPage("procedure_select.html");
  } else {
    window.location.href = "procedure_select.html";
  }
}

// --- Navegación lateral / teclado / swipe ---
if (leftArrow) leftArrow.addEventListener("click", () => updateCarousel(currentIndex - 1));
if (rightArrow) rightArrow.addEventListener("click", () => updateCarousel(currentIndex + 1));

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") updateCarousel(currentIndex - 1);
  else if (e.key === "ArrowRight") updateCarousel(currentIndex + 1);
});

let touchStartX = 0;
document.addEventListener("touchstart", (e) => (touchStartX = e.changedTouches[0].screenX));
document.addEventListener("touchend", (e) => {
  const diff = touchStartX - e.changedTouches[0].screenX;
  if (Math.abs(diff) > 50) updateCarousel(currentIndex + (diff > 0 ? 1 : -1));
});

// --- Inicialización del carrusel ---
document.addEventListener("DOMContentLoaded", async () => {
  await loadLabsFromDB();
});
