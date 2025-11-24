// Generador dinámico de cards de laboratorios para menu-test.html
const gridEl = document.getElementById("labsGrid");

function labImageSrc(lab, idx) {
  const key = lab.lab_key || lab.key || `lab-${idx}`;
  return `assets/images/labs/${key}.png`;
}

function buildLabCard(lab, idx) {
  const card = document.createElement("article");
  card.className =
    "group rounded-xl overflow-hidden ring-1 ring-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:ring-white/20";
  card.dataset.labKey = lab.lab_key || lab.key || "";

  const color = lab.color || "#22d3ee";
  const imgSrc = labImageSrc(lab, idx);
  const nombre = lab.nombre || lab.name || lab.lab_key || "Laboratorio";
  const descripcion = lab.descripcion || "Laboratorio activo";
  const iconName = lab.icon_lucide || lab.icono || lab.icon || "flask-conical";

  card.innerHTML = `
    <div class="relative aspect-[16/10] overflow-hidden">
      <img src="${imgSrc}" alt="${nombre}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" onerror="this.onerror=null;this.src='assets/images/labs/placeholder.png';" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent"></div>
      <div class="absolute top-3 left-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-white backdrop-blur-md" style="background:${color}1a;border:1px solid ${color}33;">
        <span class="inline-flex items-center justify-center" data-icon-slot></span>
      </div>
    </div>
    <div class="p-5 bg-transparent">
      <h3 class="text-base font-semibold tracking-tight text-white drop-shadow-md" title="${nombre}">
        ${nombre}
      </h3>
      <p class="mt-1.5 text-sm leading-relaxed text-neutral-200/90 font-medium line-clamp-2">
        ${descripcion}
      </p>
    </div>
  `;

  const iconSlot = card.querySelector("[data-icon-slot]");
  if (iconSlot && window.IconSafety?.attachIcon) {
    window.IconSafety.attachIcon(iconSlot, iconName).then((ok) => {
      if (!ok) iconSlot.innerHTML = '<i data-lucide="flask-conical"></i>';
      if (window.lucide?.createIcons) window.lucide.createIcons({ icons: [iconSlot] });
    });
  }

  card.addEventListener("click", () => {
    const key = lab.lab_key || lab.key;
    if (!key) return;
    sessionStorage.setItem("labSeleccionado", key);
    sessionStorage.setItem("labNombreVisible", nombre);
    localStorage.setItem("labSeleccionado", key);
    localStorage.setItem("labNombreVisible", nombre);
    if (window.cerper?.openPage) {
      window.cerper.openPage("procedure_select.html");
    } else {
      window.location.href = "procedure_select.html";
    }
  });

  return card;
}

async function loadLabs() {
  if (!gridEl) return;
  gridEl.innerHTML = `<p class="text-sm text-neutral-300">Cargando laboratorios...</p>`;
  try {
    const rows = await window.cerper.getLabs();
    if (!rows || !rows.length) {
      gridEl.innerHTML = `<p class="text-sm text-neutral-400">No hay laboratorios activos.</p>`;
      return;
    }
    gridEl.innerHTML = "";
    rows.forEach((lab, idx) => {
      gridEl.appendChild(buildLabCard(lab, idx));
    });
    if (window.lucide?.createIcons) window.lucide.createIcons();
  } catch (err) {
    console.error("[Menu] Error cargando labs", err);
    gridEl.innerHTML = `<p class="text-sm text-red-300">No se pudieron cargar los laboratorios.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadLabs);
