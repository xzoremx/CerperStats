// js/procedure_select.js
document.addEventListener("DOMContentLoaded", () => {
  // Recuperar laboratorio seleccionado (puede venir de localStorage o sessionStorage)
  const labSeleccionado =
    sessionStorage.getItem("labSeleccionado") ||
    localStorage.getItem("labSeleccionado");

  const labTitle = document.getElementById("lab-title");
  const labInfo = document.getElementById("lab-info");

  if (labSeleccionado) {
    labTitle.textContent = labSeleccionado;
    labInfo.textContent = `Seleccione el procedimiento para el laboratorio de ${labSeleccionado}.`;
  } else {
    labTitle.textContent = "Procedimientos";
  }

  // Botón de volver al menú
  const backBtn = document.getElementById("go-menu");
  backBtn.addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("menu.html");
    } else {
      window.location.href = "menu.html";
    }
  });

  // Click en tarjeta de procedimiento
  document.querySelectorAll(".procedure-card").forEach(btn => {
    btn.addEventListener("click", async () => {
      const proc = btn.dataset.proc;

      // Guardar el procedimiento actual
      sessionStorage.setItem("procedimientoSeleccionado", proc);

      console.log(`Procedimiento seleccionado: ${proc}`);

      // Ir al siguiente paso: selección Mono / Multi (step_type)
      if (window.cerper && window.cerper.openPage) {
        await window.cerper.openPage("input_data/step_1_type.html");
      } else {
        window.location.href = "input_data/step_1_type.html";
      }
    });
  });
});
