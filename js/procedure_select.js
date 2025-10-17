// js/procedure_select.js
document.addEventListener("DOMContentLoaded", () => {
  // --- Recuperar laboratorio seleccionado ---
  const labKey =
    sessionStorage.getItem("labSeleccionado") ||
    localStorage.getItem("labSeleccionado");
  const labName =
    sessionStorage.getItem("labNombreVisible") || labKey || "Laboratorio";

  const labTitle = document.getElementById("lab-title");
  const labInfo = document.getElementById("lab-info");

  // --- Mostrar información del laboratorio ---
  if (labKey) {
    labTitle.textContent = labName;
    labInfo.textContent = `Seleccione el procedimiento para ${labName}.`;
  } else {
    labTitle.textContent = "Procedimientos";
    labInfo.textContent = "Seleccione el procedimiento correspondiente al laboratorio.";
  }

  // --- Botón de volver al menú ---
  const backBtn = document.getElementById("go-menu");
  backBtn.addEventListener("click", () => {
    if (window.cerper?.openPage) {
      window.cerper.openPage("menu.html");
    } else {
      window.location.href = "menu.html";
    }
  });

  // --- Click en tarjeta de procedimiento ---
  document.querySelectorAll(".procedure-card").forEach(btn => {
    btn.addEventListener("click", async () => {
      const proc = btn.dataset.proc;

      // Guardar procedimiento actual
      sessionStorage.setItem("procedimientoSeleccionado", proc);

      // Ir al siguiente paso: selección Mono / Multi (step_1_type)
      if (window.cerper?.openPage) {
        await window.cerper.openPage("input_data/step_1_type.html");
      } else {
        window.location.href = "input_data/step_1_type.html";
      }
    });
  });
});
