document.addEventListener("DOMContentLoaded", () => {
  const lab = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado");
  const tipoDato = sessionStorage.getItem("tipoDato") || "cuantitativo";

  const title = document.getElementById("lab-title");
  title.textContent = `${lab} - Parámetro (${tipoDato})`;

  document.querySelectorAll(".select-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const parametro = btn.dataset.param;
      sessionStorage.setItem("parametroSeleccionado", parametro);
      console.log(`Parámetro seleccionado: ${parametro}`);

      if (window.cerper && window.cerper.openPage) {
        await window.cerper.openPage("input_data/step_k.html");
      } else {
        window.location.href = "step_k.html";
      }
    });
  });

  // Volver atrás
  document.getElementById("go-back").addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("input_data/step_dato.html");
    } else {
      window.location.href = "step_dato.html";
    }
  });
});
