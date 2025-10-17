document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".select-btn");
  const goMenu = document.getElementById("go-menu");

  // Recuperar laboratorio y procedimiento actuales
  const labKey = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado");
  const labName = sessionStorage.getItem("labNombreVisible") || labKey;
  const proc = sessionStorage.getItem("procedimientoSeleccionado") || localStorage.getItem("procedimientoSeleccionado");

  console.log(`Lab (key): ${labKey} | Visible: ${labName} | Procedimiento: ${proc}`);

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const mode = btn.dataset.mode;
      sessionStorage.setItem("tipoAnalisis", mode);

      console.log(`Modo seleccionado: ${mode}`);
      // Navegar al siguiente paso
      if (window.cerper && window.cerper.openPage) {
        await window.cerper.openPage("input_data/step_2_parametro.html");
      } else {
        window.location.href = "step_2_parametro.html";
      }
    });
  });

  // Volver a preinfo
  goMenu.addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("input_data/preinfo.html");
    } else {
      window.location.href = "preinfo.html"; 
    }
  });

});
