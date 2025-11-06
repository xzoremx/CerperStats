// === Notificaciones flotantes ===
window.notify = function (message, type = "info") {
  // Elimina notificación previa
  const existing = document.querySelector(".notify");
  if (existing) existing.remove();

  // Crear elemento
  const div = document.createElement("div");
  div.className = `notify ${type}`;
  div.textContent = message;
  document.body.appendChild(div);

  // Mostrar con animación
  requestAnimationFrame(() => div.classList.add("show"));

  // Ocultar y eliminar
  setTimeout(() => div.classList.remove("show"), 2800);
  setTimeout(() => div.remove(), 3300);
};

document.addEventListener("DOMContentLoaded", async () => {
  const contenedor = document.querySelector(".analysis-grid");
  const btnEvaluar = document.getElementById("btn-evaluar");
  const btnContinuar = document.getElementById("btn-continuar");
  const btnVolver = document.getElementById("go-back");
  const menuVisualizaciones = document.getElementById("menu-visualizaciones");

  // --- Boton Volver ---
  if (btnVolver) {
    btnVolver.addEventListener("click", () => {
      if (window.cerper && window.cerper.openPage) {
        window.cerper.openPage("input_data/step_5_sheet.html");
      } else {
        window.location.href = "step_5_sheet.html";
      }
    });
  }

  // === Obtener contexto de sesión ===
  const labKey = sessionStorage.getItem("labSeleccionado");
  const tipoAnalisis = sessionStorage.getItem("tipoAnalisis");
  const tipoDato = sessionStorage.getItem("tipoDato");
  const modoCualitativo = sessionStorage.getItem("modoCualitativo");
  const sessionId = sessionStorage.getItem("sessionID");

  if (!labKey || !tipoAnalisis || !tipoDato) {
    notify("Faltan datos de sesión. Regresa al paso anterior.", "error");
    window.cerper.openPage("input_data/step_5_sheet.html");
    return;
  }

  // === Cargar evaluaciones disponibles desde la base ===
  let res;
  try {
    res = await window.cerper.getEvaluaciones({
      lab_key: labKey,
      tipo_analisis: tipoAnalisis,
      tipo_dato: tipoDato,
      modo_cualitativo: modoCualitativo
    });
  } catch (err) {
    console.error("[EvalSelect] Error de conexión:", err);
    notify("No se pudieron cargar las evaluaciones.", "error");
    return;
  }

  // === Obtener metadata y aplicabilidad desde la base ===
  let meta = {};
  let resTests;
  try {
    const metaRes = await window.cerper.getSessionMetadata(sessionId);
    if (metaRes?.ok) meta = metaRes.data;

    resTests = await window.cerper.getTestsWithMetadata(sessionId);
    if (!resTests.ok) throw new Error(resTests.error || "Error al cargar pruebas.");
  } catch (err) {
    console.error("[EvalSelect] Error cargando metadata:", err);
    notify("No se pudieron cargar las condiciones de elegibilidad.", "warning");
    resTests = { data: [] };
  }


  if (!res.ok) {
    console.error("[EvalSelect] Error:", res.error);
    notify("Error al cargar las evaluaciones del laboratorio.", "error");
    return;
  }

  // === Renderizar tarjetas dinámicamente ===
  contenedor.innerHTML = "";
  const seleccionadas = new Set();

  if (!res.data || res.data.length === 0) {
    contenedor.innerHTML = `<p style="text-align:center; opacity:0.8;">No hay pruebas disponibles para este tipo de análisis.</p>`;
    return;
  }

  res.data.forEach(test => {
    const card = document.createElement("article");
    card.className = "analysis-card";
    card.dataset.catalogId = test.id;

    // --- Icono ---
    const rawIcon = (test.icon_value || "").trim();
    let iconHtml;
    if (rawIcon.startsWith("<svg")) iconHtml = rawIcon;
    else if (rawIcon.startsWith("lucide:")) {
      const name = rawIcon.split(":")[1] || "bar-chart-2";
      iconHtml = `<i data-lucide="${name}"></i>`;
    } else {
      const name = rawIcon || "bar-chart-2";
      iconHtml = `<i data-feather="${name}"></i>`;
    }

    card.innerHTML = `
      <div class="card-icon">${iconHtml}</div>
      <h2 class="card-title">${test.titulo}</h2>
      <p class="card-desc">${test.descripcion}</p>
    `;

    // === Verificar si es aplicable según metadata ===
    const testMeta = resTests.data.find(t => t.id === test.id);
    const aplicable = testMeta ? testMeta.aplicable === 1 : true;

    if (!aplicable) {
      card.classList.add("blocked");
    }

    // === Selección solo si aplicable ===
    card.addEventListener("click", () => {
      if (!aplicable) {
        const customMsg = testMeta?.mensaje_no_aplicable;
        notify(customMsg || "No aplicable, condiciones no cumplidas para ejecutar esta prueba", "warning");
        return;
      }
      const id = test.id;
      if (seleccionadas.has(id)) {
        seleccionadas.delete(id);
        card.classList.remove("selected");
      } else {
        seleccionadas.add(id);
        card.classList.add("selected");
      }
    });

    contenedor.appendChild(card);
  });


  // Render icons depending on available library
  if (window.feather && typeof window.feather.replace === "function") {
    window.feather.replace();
  }
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  // === Función auxiliar ===
  const bloquearBotones = (estado) => {
    btnEvaluar.disabled = estado;
    btnContinuar.disabled = estado;
    btnEvaluar.style.opacity = estado ? 0.6 : 1;
    btnContinuar.style.opacity = estado ? 0.6 : 1;
  };

  // === Botón EVALUAR ===
  btnEvaluar.addEventListener("click", async () => {
    if (seleccionadas.size === 0) {
      notify("Selecciona al menos una evaluación.", "warning");
      return;
    }

    bloquearBotones(true);
    notify("Ejecutando evaluaciones seleccionadas...", "info");

    try {
      const result = await window.cerper.runEvaluations({
        session_id: sessionId,
        catalog_ids: Array.from(seleccionadas)
      });

      if (!result.ok) throw new Error(result.error || "Error desconocido");

      notify("Evaluaciones completadas y guardadas correctamente.", "success");

      // Activar menú “Visualizaciones”
      if (menuVisualizaciones) {
        menuVisualizaciones.classList.add("active");
      }

    } catch (err) {
      console.error("[EvalSelect] Error al evaluar:", err);
      notify("Ocurrió un error durante la ejecución.", "error");
    } finally {
      bloquearBotones(false);
    }
  });

  // === Botón CONTINUAR ===
  btnContinuar.addEventListener("click", () => {
    notify("Redirigiendo a configuración de PDF...", "info");
    window.cerper.openPage("pdf_config.html");
  });
});




