// --- variables de laboratorios ---
let labs = [];
let labColors = [];


// --- Elementos del carrusel ---
const cards = document.querySelectorAll(".card");
const dots = document.querySelectorAll(".dot");
const memberName = document.querySelector(".member-name");
const memberRole = document.querySelector(".member-role");
const leftArrow = document.querySelector(".nav-arrow.left");
const rightArrow = document.querySelector(".nav-arrow.right");

let currentIndex = 0;
let isAnimating = false;


// --- Intento de carga y fusión del manifest ---
const keyOrder = labs.map(l => l.key);

async function loadLabsFromManifest() {
  try {
    const res = await fetch("./manifest.json", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar manifest.json");
    const manifest = await res.json();
    if (!manifest.labs || !Array.isArray(manifest.labs)) throw new Error("Formato inválido en manifest");

    labs = manifest.labs.map(l => ({
      key: l.key,
      name: l.name,
      role: l.role
    }));
    labColors = manifest.labs.map(l => l.color || "#00ffff");
  } catch (err) {
    console.error("Error cargando manifest.json:", err);
    labs = [];
    labColors = [];
  }
}


// --- Actualiza posición y texto ---
function updateCarousel(newIndex) {
  if (isAnimating) return;
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
    const color = labColors[currentIndex];
    memberName.textContent = labs[currentIndex].name;
    memberRole.textContent = labs[currentIndex].role;
    memberName.style.color = color;
    memberName.style.textShadow = `0 0 1px ${color}, 0 0 2px ${color}`;
    memberName.style.opacity = "1";
    memberRole.style.opacity = "1";
  }, 300);

  setTimeout(() => (isAnimating = false), 800);
}

// --- Navegación lateral / teclado / swipe ---
leftArrow.addEventListener("click", () => updateCarousel(currentIndex - 1));
rightArrow.addEventListener("click", () => updateCarousel(currentIndex + 1));
dots.forEach((dot, i) => dot.addEventListener("click", () => updateCarousel(i)));

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

// --- Click en tarjeta → guardar laboratorio y abrir siguiente pantalla ---
cards.forEach((card, i) => {
  card.addEventListener("click", async () => {
    updateCarousel(i);

    const selectedLab = labs[i];

    // Guardar clave técnica y nombre visible
    sessionStorage.setItem("labSeleccionado", selectedLab.key);
    sessionStorage.setItem("labNombreVisible", selectedLab.name);

    // También lo guardamos en localStorage por compatibilidad (opcional)
    localStorage.setItem("labSeleccionado", selectedLab.key);
    localStorage.setItem("labNombreVisible", selectedLab.name);

    // Navegar a la siguiente página
    if (window.cerper && typeof window.cerper.openPage === "function") {
      await window.cerper.openPage("procedure_select.html");
    } else {
      console.warn("window.cerper no disponible — ejecución fuera de Electron");
      window.location.href = "procedure_select.html";
    }
  });
});


// --- Inicializa carrusel ---
document.addEventListener("DOMContentLoaded", async () => {
  await loadLabsFromManifest();

  // seguridad: si no hay labs, evita romper animación
  if (!labs.length) {
    console.error("No se encontraron laboratorios en manifest.json");
    return;
  }

  updateCarousel(3);
});
