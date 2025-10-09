document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".select-btn");
  const goMenu = document.getElementById("go-menu");

  // Recuperar laboratorio y procedimiento actuales
  const lab = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado");
  const proc = sessionStorage.getItem("procedimientoSeleccionado") || localStorage.getItem("procedimientoSeleccionado");

  console.log(`Lab: ${lab} | Procedimiento: ${proc}`);

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const mode = btn.dataset.mode;
      sessionStorage.setItem("tipoAnalisis", mode);

      console.log(`Modo seleccionado: ${mode}`);
      // Navegar al siguiente paso
      if (window.cerper && window.cerper.openPage) {
        await window.cerper.openPage("input_data/step_dato.html");
      } else {
        window.location.href = "step_dato.html";
      }
    });
  });

  // Volver al menú principal
  goMenu.addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("menu.html");
    } else {
      window.location.href = "../menu.html";
    }
  });
});
