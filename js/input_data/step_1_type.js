// input_data/step_1_type.js
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide?.createIcons) lucide.createIcons();

  // NO borrar cache si el usuario vuelve desde input_data_sheet
  // Solo mantener el estado existente para permitir edicion

  const btnOptions = Array.from(document.querySelectorAll(".btn-option"));
  const paramPlaceholder = document.getElementById("param-placeholder");
  const paramPanel = document.getElementById("param-panel");
  const paramBadge = document.getElementById("param-badge");

  const state = {
    ok: false,
    modified: false,
  };

  function emitState() {
    document.dispatchEvent(
      new CustomEvent("step1:state", {
        detail: { ...state },
      })
    );
  }

  // Restaurar seleccion desde cache si existe
  let selectedMode = sessionStorage.getItem("tipoAnalisis") || null;

  if (selectedMode) {
    aplicarModoUI(selectedMode);
    state.ok = true;
    state.modified = true; // Marcar como modificado para que el boton Continuar funcione
    emitState();
    notificarModo(selectedMode);
  } else {
    emitState();
  }

  btnOptions.forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.textContent.trim().toLowerCase().includes("multi") ? "multi" : "mono";
      if (selectedMode === mode) return;
      selectedMode = mode;
      sessionStorage.setItem("tipoAnalisis", mode);
      aplicarModoUI(mode);
      state.ok = true;
      state.modified = true;
      emitState();
      notificarModo(mode);
    });
  });

  function aplicarModoUI(mode) {
    btnOptions.forEach(other => {
      const isMulti = other.textContent.trim().toLowerCase().includes("multi");
      other.classList.toggle("active", isMulti ? mode === "multi" : mode === "mono");
    });
    paramPlaceholder?.classList.add("hidden");
    paramPanel?.classList.add("active");
    if (paramBadge) {
      paramBadge.textContent = mode === "multi" ? "Multianalito" : "Monoanalito";
    }
  }

  function notificarModo(mode) {
    document.dispatchEvent(
      new CustomEvent("analito:mode", {
        detail: { mode },
      })
    );
  }
}
);
