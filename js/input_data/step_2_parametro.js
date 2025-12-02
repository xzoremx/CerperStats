// input_data/step_2_parametro.js
document.addEventListener("DOMContentLoaded", () => {
  const paramPanel = document.getElementById("param-panel");
  const paramGrid = document.getElementById("param-grid");
  const paramPlaceholder = document.getElementById("param-placeholder");
  const paramBadge = document.getElementById("param-badge");
  const paramCustom = document.getElementById("param-custom");
  const paramCustomInput = document.getElementById("param-custom-input");
  const paramCustomConfirm = document.getElementById("param-custom-confirm");

  const paramOptionsByMode = {
    mono: [
      { name: "Dias", icon: "calendar" },
      { name: "Analista", icon: "user" },
      { name: "Equipos", icon: "cpu" },
      { name: "Otro", icon: "list" },
    ],
    multi: [
      { name: "Analista", icon: "user" },
      { name: "Otro", icon: "list" },
    ],
  };

  let selectedMode = sessionStorage.getItem("modoAnalito") || null;
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

  if (selectedMode) {
    activarPanel();
    renderParamButtons(selectedMode);
    if (selectedParam) {
      highlightParam(selectedParam);
      actualizarBadge(selectedParam);
    }
  }

  emitState();

  document.addEventListener("analito:mode", evt => {
    selectedMode = evt?.detail?.mode || null;
    selectedParam = null;
    sessionStorage.removeItem("parametroSeleccionado");
    state.ok = false;
    // no marcamos modified aquí; se marcará cuando el usuario elija un parámetro
    emitState();
    if (!selectedMode) return;
    activarPanel();
    renderParamButtons(selectedMode);
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

  function activarPanel() {
    paramPlaceholder?.classList.add("hidden");
    paramPanel?.classList.add("active");
  }

  function renderParamButtons(mode) {
    if (!paramGrid) return;
    paramGrid.innerHTML = "";
    paramCustom?.classList.add("hidden");
    const opts = paramOptionsByMode[mode] || [];
    opts.forEach(opt => {
      const button = document.createElement("button");
      button.className =
        "param-btn group flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white hover:border-orange-400/70 hover:bg-orange-500/10 transition-all";
      button.dataset.param = opt.name;
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
    if (selectedParam) {
      highlightParam(selectedParam);
    }
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
    const modeLabel = selectedMode === "multi" ? "Multianalito" : "Monoanalito";
    if (paramBadge && paramName) {
      paramBadge.textContent = `${modeLabel} - ${paramName}`;
    }
  }

  function highlightParam(paramName) {
    if (!paramGrid) return;
    paramGrid.querySelectorAll(".param-btn").forEach(btn => {
      const isActive = paramName && btn.dataset.param === paramName;
      btn.classList.toggle("ring-2", isActive);
      btn.classList.toggle("ring-orange-400/70", isActive);
      btn.classList.toggle("border-orange-400/70", isActive);
    });
  }
});

