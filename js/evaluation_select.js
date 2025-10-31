document.addEventListener("DOMContentLoaded", async () => {
  const labKey = sessionStorage.getItem("labSeleccionado");
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis");
  const tipoDato = sessionStorage.getItem("tipoDato");
  const modoCualitativo = sessionStorage.getItem("modoCualitativo");

  const res = await window.cerper.getEvaluaciones({
    lab_key: labKey,
    tipo_analisis: tipoAnalisis,
    tipo_dato: tipoDato,
    modo_cualitativo: modoCualitativo
  });

  if (!res.ok) {
    console.error("[EvalSelect] Error:", res.error);
    return;
  }

  const contenedor = document.querySelector(".analysis-grid");
  contenedor.innerHTML = ""; // limpiar

  res.data.forEach(test => {
    const card = document.createElement("article");
    card.className = "analysis-card";
    card.dataset.analysis = test.nombre_interno;
    card.innerHTML = `
      <div class="card-icon"><i data-feather="bar-chart-2"></i></div>
      <h2 class="card-title">${test.titulo}</h2>
      <p class="card-desc">${test.descripcion}</p>
    `;
    card.addEventListener("click", () => {
      sessionStorage.setItem("catalogIdSeleccionado", test.id);
      sessionStorage.setItem("evaluacionSeleccionada", test.nombre_interno);
      window.cerper.openPage("evaluation_run.html"); // o la ruta al ejecutor
    });
    contenedor.appendChild(card);
  });

  feather.replace();
});



// --- Botón Volver ---
  document.getElementById("go-back").addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("input_data/step_5_sheet.html");
    } else {
      window.location.href = "step_5_sheet.html";
    }
  });