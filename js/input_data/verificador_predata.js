// input_data/verificador_predata.js
document.addEventListener("DOMContentLoaded", () => {
  const continueBtn = document.getElementById("predata-continue");
  if (!continueBtn) return;

  const steps = {
    preinfo: { ok: false, modified: false },
    step1: { ok: false, modified: false },
    step2: { ok: false, modified: false },
    step3: { ok: false, modified: false },
    step4: { ok: false, modified: false },
  };

  updateContinue();

  document.addEventListener("preinfo:state", e => {
    Object.assign(steps.preinfo, e.detail || {});
    updateContinue();
  });

  document.addEventListener("step1:state", e => {
    Object.assign(steps.step1, e.detail || {});
    updateContinue();
  });

  document.addEventListener("step2:state", e => {
    Object.assign(steps.step2, e.detail || {});
    updateContinue();
  });

  document.addEventListener("step3:state", e => {
    Object.assign(steps.step3, e.detail || {});
    updateContinue();
  });

  document.addEventListener("step4:state", e => {
    Object.assign(steps.step4, e.detail || {});
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
      notify(
        "Aún hay pasos sin completar: " + pendientes.join(", "),
        "error"
      );
      return;
    }

    // Verificación ligera de consistencia
    const metodo = getValue("metodo");
    const producto = getValue("producto");
    const ensayo = getValue("ensayo");
    const expediente = getValue("expediente");
    const unidad = getValue("unidad");
    const modoAnalito = sessionStorage.getItem("modoAnalito");
    const parametro = sessionStorage.getItem("parametroSeleccionado");
    const tipoDato = sessionStorage.getItem("tipoDato");
    const k = Number(sessionStorage.getItem("K"));
    const lecturas = JSON.parse(sessionStorage.getItem("lecturasPorParametro") || "[]");

    const problemas = [];
    if (!metodo || !producto || !ensayo || !expediente || !unidad) problemas.push("Preinfo incompleta");
    if (!modoAnalito) problemas.push("modo de análisis");
    if (!parametro) problemas.push("parámetro");
    if (!tipoDato) problemas.push("tipo de dato");
    if (!Number.isInteger(k) || k < 2) problemas.push("K inválido");
    if (!Array.isArray(lecturas) || !lecturas.length) problemas.push("lecturas no definidas");

    if (problemas.length) {
      notify(
        "Se detectaron inconsistencias en los datos: " + problemas.join(", "),
        "error"
      );
      return;
    }

    notify("Datos validados correctamente. Avanzando…", "success");

    setTimeout(() => {
      const destino = "input_data/step_5_sheet.html";
      if (window.cerper?.openPage) {
        window.cerper.openPage(destino);
      } else {
        window.location.href = "step_5_sheet.html";
      }
    }, 800);
  });

  function updateContinue() {
    const allOk = Object.values(steps).every(s => s.ok);

    // Solo pasos manuales para el estado visual (preinfo, 1, 2, 4)
    const manual = [steps.preinfo, steps.step1, steps.step2, steps.step4];
    const doneManual = manual.filter(s => s.modified).length;

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
});

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function notify(message, type = "info") {
  const existing = document.querySelector(".notify");
  if (existing) existing.remove();

  const div = document.createElement("div");
  div.className = `notify ${type}`;
  div.textContent = message;
  document.body.appendChild(div);

  setTimeout(() => div.classList.add("show"), 50);
  setTimeout(() => div.classList.remove("show"), 3000);
  setTimeout(() => div.remove(), 3500);
}

