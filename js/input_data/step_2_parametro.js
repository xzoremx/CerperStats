// input_data/step_2_parametro.js
document.addEventListener("DOMContentLoaded", () => {
  const paramPanel = document.getElementById("param-panel");
  const paramGrid = document.getElementById("param-grid");
  const paramPlaceholder = document.getElementById("param-placeholder");
  const paramBadge = document.getElementById("param-badge");
  const paramCustom = document.getElementById("param-custom");
  const paramCustomInput = document.getElementById("param-custom-input");
  const paramCustomConfirm = document.getElementById("param-custom-confirm");

  const PARAM_OPTIONS = [
    { name: "Días", icon: "calendar" },
    { name: "Analista", icon: "user" },
    { name: "Equipos", icon: "cpu" },
    { name: "Otro", icon: "list" },
  ];

  let selectedMode = sessionStorage.getItem("tipoAnalisis") || null;
  let selectedParam = sessionStorage.getItem("parametroSeleccionado") || null;

  const state = {
    ok: !!selectedParam,
    modified: false,
  };

  function emitState() {
    document.dispatchEvent(
      new CustomEvent("step2:state", {
        detail: { ...state },
      })
    );
  }

  paramPlaceholder?.classList.add("hidden");
  paramPanel?.classList.add("active");
  renderParamButtons();
  if (selectedParam) {
    highlightParam(selectedParam);
    actualizarBadge(selectedParam);
  }

  emitState();

  document.addEventListener("analito:mode", evt => {
    selectedMode = evt?.detail?.mode || null;
    if (!selectedParam) {
      if (!selectedMode && paramBadge) paramBadge.textContent = "Esperando modo";
    } else {
      actualizarBadge(selectedParam);
    }
  });

  paramGrid?.addEventListener("click", e => {
    const btn = e.target.closest(".param-btn");
    if (!btn) return;
    const value = btn.dataset.param;
    if (value === "Otro") {
      paramCustom?.classList.remove("hidden");
      paramCustomInput?.focus();
      highlightParam(null);
    } else {
      paramCustom?.classList.add("hidden");
      setSelectedParam(value, true);
      highlightParam(value);
    }
  });

  paramCustomConfirm?.addEventListener("click", () => {
    const custom = paramCustomInput?.value.trim();
    if (!custom) return;
    setSelectedParam(custom, true);
    highlightParam(null);
  });

  function renderParamButtons() {
    if (!paramGrid) return;
    paramGrid.innerHTML = "";
    paramCustom?.classList.add("hidden");
    PARAM_OPTIONS.forEach(opt => {
      const button = document.createElement("button");
      button.className =
        "param-btn group flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white hover:border-orange-400/70 hover:bg-orange-500/10 transition-all";
      button.dataset.param = opt.name;
      button.classList.add("param-btn");
      button.innerHTML = `
        <span class="flex items-center gap-2">
          <i data-lucide="${opt.icon}" class="w-4 h-4 text-orange-200"></i>
          <span class="font-geist">${opt.name}</span>
        </span>
        <span class="text-[11px] text-gray-400 group-hover:text-orange-200">Elegir</span>
      `;
      paramGrid.appendChild(button);
    });
    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
    highlightParam(selectedParam);
  }

  function setSelectedParam(paramName, fromUser) {
    if (!paramName) return;
    selectedParam = paramName;
    sessionStorage.setItem("parametroSeleccionado", paramName);
    actualizarBadge(paramName);
    state.ok = true;
    if (fromUser) state.modified = true;
    emitState();
    document.dispatchEvent(
      new CustomEvent("parametro:seleccionado", {
        detail: { valor: paramName, modo: selectedMode },
      })
    );
  }

  function actualizarBadge(paramName) {
    if (!paramBadge || !paramName) return;
    const modeLabel = selectedMode
      ? selectedMode === "multi"
        ? "Multianalito"
        : "Monoanalito"
      : "Estructura pendiente";
    paramBadge.textContent = `${modeLabel} - ${paramName}`;
  }

  function highlightParam(paramName) {
    if (!paramGrid) return;
    paramGrid.querySelectorAll(".param-btn").forEach(btn => {
      const isActive = paramName && btn.dataset.param === paramName;
      btn.classList.toggle("param-btn-selected", isActive);
    });
  }
});
