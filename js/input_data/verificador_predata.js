// input_data/verificador_predata.js
//
// Nota: este script debe escuchar los eventos `step*:state` ANTES de `DOMContentLoaded`,
// porque los pasos emiten su estado inicial dentro de sus propios handlers de `DOMContentLoaded`.
// Si el verificador empieza a escuchar tarde, pierde esos eventos y el botón "Continuar" queda bloqueado
// hasta que el usuario vuelva a tocar cada paso.

const continueBtn = document.getElementById("predata-continue");
if (continueBtn) {
  const steps = {
    preinfo: { ok: false, modified: false },
    step1: { ok: false, modified: false },
    step2: { ok: false, modified: false },
    step3: { ok: false, modified: false },
    step4: { ok: false, modified: true },
  };

  const requestStates = () => {
    document.dispatchEvent(new Event("predata:request-state"));
  };

  document.addEventListener("preinfo:state", (e) => {
    Object.assign(steps.preinfo, e.detail || {});
    updateContinue();
  });

  document.addEventListener("step1:state", (e) => {
    Object.assign(steps.step1, e.detail || {});
    updateContinue();
  });

  document.addEventListener("step2:state", (e) => {
    Object.assign(steps.step2, e.detail || {});
    updateContinue();
  });

  document.addEventListener("step3:state", (e) => {
    const detail = e.detail || {};
    Object.assign(steps.step3, detail);
    // Si el paso 3 no se muestra (auto-resuelto), considérese modificado para el estado visual.
    if (!isStep3Visible()) steps.step3.modified = true;
    updateContinue();
  });

  document.addEventListener("step4:state", (e) => {
    const detail = e.detail || {};
    steps.step4.ok = Boolean(detail.ok);
    steps.step4.modified = true;
    updateContinue();
  });

  // Estado inicial
  updateContinue();

  // Solicitar estados iniciales a los pasos que lo soporten (p.ej. step4).
  // (Se hace en DOMContentLoaded para que los pasos ya hayan registrado su listener `predata:request-state`.)
  document.addEventListener("DOMContentLoaded", () => {
    requestStates();
    updateContinue();
  });

  // En navegaciones "volver/adelante" algunos navegadores restauran el DOM desde cache (BFCache).
  // Re-solicitar estado garantiza que el botón refleje el cache actual.
  window.addEventListener("pageshow", () => {
    requestStates();
    updateContinue();
  });

  continueBtn.addEventListener("click", () => {
    const pendientes = [];
    if (!steps.preinfo.ok) pendientes.push("Preinfo");
    if (!steps.step1.ok) pendientes.push("Paso 1 (tipo de análisis)");
    if (!steps.step2.ok) pendientes.push("Paso 2 (parámetro)");
    if (!steps.step3.ok) pendientes.push("Paso 3 (tipo de dato)");
    if (!steps.step4.ok) pendientes.push("Paso 4 (K y lecturas)");

    if (pendientes.length) {
      notify("Aún hay pasos sin completar: " + pendientes.join(", "), "error");
      return;
    }

    // Verificación ligera de consistencia
    const metodo = getValue("metodo");
    const producto = getValue("producto");
    const ensayo = getValue("ensayo");
    const expediente = getValue("expediente");
    const unidad = getValue("unidad");
    const tipoAnalisis = sessionStorage.getItem("tipoAnalisis");
    const parametro = sessionStorage.getItem("parametroSeleccionado");
    const tipoDato = sessionStorage.getItem("tipoDato");
    const k = Number(sessionStorage.getItem("K"));
    let lecturas = [];
    try {
      lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");
    } catch (e) {
      console.warn("[verificador] Cache de lecturas corrupto, usando fallback:", e);
      lecturas = [];
    }

    const problemas = [];
    if (!metodo || !producto || !ensayo || !expediente || !unidad) {
      problemas.push("Preinfo incompleta");
    }
    if (!tipoAnalisis) problemas.push("modo de análisis");
    if (!parametro) problemas.push("parámetro");
    if (!tipoDato) problemas.push("tipo de dato");
    if (!Number.isInteger(k) || k < 2) problemas.push("K inválido");
    if (!Array.isArray(lecturas) || !lecturas.length) problemas.push("lecturas no definidas");

    if (problemas.length) {
      notify("Se detectaron inconsistencias en los datos: " + problemas.join(", "), "error");
      return;
    }

    notify("Next step! :) ", "success");

    setTimeout(() => {
      const destino = "input_data/input_data_sheet.html";
      if (window.cerper?.openPage) {
        window.cerper.openPage(destino);
      } else {
        window.location.href = "input_data/input_data_sheet.html";
      }
    }, 800);
  });

  function isStep3Visible() {
    const el = document.getElementById("step3-section");
    if (!el) return false;
    return !el.classList.contains("hidden");
  }

  function updateContinue() {
    const allOk = Object.values(steps).every((s) => s.ok);

    // Pasos manuales para el estado visual (preinfo, 1, 2 y opcional 3). Step4 se fuerza como modificado.
    const manual = [steps.preinfo, steps.step1, steps.step2];
    if (isStep3Visible()) manual.push(steps.step3);
    const doneManual = manual.filter((s) => s.modified).length;

    const isPending = doneManual === 0;
    const isComplete = allOk;
    const isInProgress = !isPending && !isComplete;

    // Habilitación real
    continueBtn.disabled = !isComplete;
    continueBtn.classList.toggle("opacity-50", !isComplete);
    continueBtn.classList.toggle("cursor-not-allowed", !isComplete);

    // Estado visual
    continueBtn.classList.remove("bar-highlight", "bar-accent");
    if (isInProgress) {
      continueBtn.classList.add("bar-highlight");
    } else if (isComplete) {
      continueBtn.classList.add("bar-accent");
    }
  }
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

