document.addEventListener("DOMContentLoaded", async () => {
  const contenedor = document.querySelector(".analysis-grid");
  const btnEvaluar = document.getElementById("btn-evaluar");
  const btnContinuar = document.getElementById("btn-continuar");
  const btnVolver = document.getElementById("go-back");
  const menuVisualizaciones = document.getElementById("menu-visualizaciones");

  // === Obtener y mostrar el usuario actual ===
  try {
    const userRes = await window.cerper.getCurrentUser();
    if (userRes?.ok && userRes.user) {
      const userName = userRes.user.nombre_completo || userRes.user.username || "Usuario";
      const titleElement = document.querySelector("h2.text-3xl");
      if (titleElement) {
        titleElement.textContent = `Hola de nuevo, ${userName}`;
      }
    }
  } catch (err) {
    console.warn("[EvalSelect] No se pudo obtener usuario:", err);
  }

  // --- Boton Volver ---
  if (btnVolver) {
    btnVolver.addEventListener("click", () => {
      if (window.cerper && window.cerper.openPage) {
        window.cerper.openPage("input_data/input_data_sheet.html");
      } else {
        window.location.href = "input_data/input_data_sheet.html";
      }
    });
  }

  // === Obtener contexto de sesión ===
  const labKey =
    sessionStorage.getItem("labSeleccionado") ||
    localStorage.getItem("labSeleccionado");
  const tipoAnalisis =
    sessionStorage.getItem("tipoAnalisis") ||
    sessionStorage.getItem("modoAnalito");
  const tipoDato = sessionStorage.getItem("tipoDato");
  const modoCualitativo = sessionStorage.getItem("modoCualitativo");
  const sessionId = sessionStorage.getItem("sessionID");

  // Normalizar alias históricos para evitar perder contexto entre páginas
  if (tipoAnalisis && !sessionStorage.getItem("tipoAnalisis")) {
    sessionStorage.setItem("tipoAnalisis", tipoAnalisis);
  }
  if (labKey && !sessionStorage.getItem("labSeleccionado")) {
    sessionStorage.setItem("labSeleccionado", labKey);
  }

  if (!labKey || !tipoAnalisis || !tipoDato || !sessionId) {
    notify("Faltan datos de sesión. Regresa al paso anterior.", "error");
    if (window.cerper && typeof window.cerper.openPage === "function") {
      window.cerper.openPage("input_data/input_data_sheet.html");
    } else {
      window.location.href = "input_data/input_data_sheet.html";
    }
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

  // === Obtener aplicabilidad desde la base ===
  let resTests;
  try {
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

  // Color palette for card icons
  const iconColors = ['blue', 'purple', 'pink', 'emerald', 'orange', 'cyan', 'rose', 'indigo'];
  let colorIndex = 0;

  for (const test of res.data) {
    const card = document.createElement("div");
    card.className = "glass-card rounded-2xl overflow-hidden group cursor-pointer h-72";
    card.dataset.catalogId = test.id;

    // Pick a color for this card
    const color = iconColors[colorIndex % iconColors.length];
    colorIndex++;

    // --- Build card HTML structure matching the glass UI design
    card.innerHTML = `
      <div class="p-6 flex flex-col h-full">
        <div class="flex items-center justify-between mb-4">
          <div class="icon-container p-3 rounded-xl">
            <div class="card-icon w-6 h-6 text-${color}-400"></div>
          </div>
          <span class="status-badge text-xs px-3 py-1 rounded-full font-medium bg-blue-500/20 text-blue-400">Disponible</span>
        </div>
        <h3 class="text-xl font-bold text-white mb-2 group-hover:text-${color}-300 transition-colors">${test.titulo}</h3>
        <p class="text-gray-400 text-sm mb-4 flex-1">${test.descripcion}</p>
      </div>
    `;

    // --- Icono (seguro): usa módulo IconSafety
    const rawIcon = (test.icon_value || "").trim();
    const iconSlot = card.querySelector('.card-icon');
    const ok = await window.IconSafety.attachIcon(iconSlot, rawIcon);
    if (!ok) {
      iconSlot.innerHTML = `<i data-lucide="bar-chart-2" class="w-6 h-6"></i>`;
    }

    // === Verificar si es aplicable según metadata ===
    const testMeta = resTests.data.find(t => t.id === test.id);
    const aplicable = testMeta ? testMeta.aplicable === 1 : true;

    const statusBadge = card.querySelector('.status-badge');
    if (!aplicable) {
      card.classList.add("blocked");
      statusBadge.className = "status-badge text-xs px-3 py-1 rounded-full font-medium bg-red-500/20 text-red-400";
      statusBadge.textContent = "No aplicable";
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
        statusBadge.className = "status-badge text-xs px-3 py-1 rounded-full font-medium bg-blue-500/20 text-blue-400";
        statusBadge.textContent = "Disponible";
      } else {
        seleccionadas.add(id);
        card.classList.add("selected");
        statusBadge.className = "status-badge text-xs px-3 py-1 rounded-full font-medium bg-emerald-500/20 text-emerald-400";
        statusBadge.textContent = "Seleccionada";
      }

      // Update progress
      updateProgress(seleccionadas.size, res.data.length);
    });

    contenedor.appendChild(card);
  }

  // Progress update function
  function updateProgress(selected, total) {
    const percent = total > 0 ? Math.round((selected / total) * 100) : 0;
    const progressBar = document.getElementById('progress-bar');
    const progressPercent = document.getElementById('progress-percent');
    const progressStatus = document.getElementById('progress-status');

    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (progressStatus) {
      if (selected === 0) {
        progressStatus.className = "text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full font-medium";
        progressStatus.textContent = "Pendiente";
      } else if (selected === total) {
        progressStatus.className = "text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full font-medium";
        progressStatus.textContent = "Completo";
      } else {
        progressStatus.className = "text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full font-medium";
        progressStatus.textContent = `${selected} de ${total}`;
      }
    }
  }


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

