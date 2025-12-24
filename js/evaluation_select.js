document.addEventListener("DOMContentLoaded", async () => {
  const contenedor = document.querySelector(".analysis-grid");
  const btnEvaluar = document.getElementById("btn-evaluar");
  const btnContinuar = document.getElementById("btn-continuar");
  const btnVolver = document.getElementById("go-back");
  const menuVisualizaciones = document.getElementById("menu-visualizaciones");
  const progressBar = document.getElementById("progress-bar");
  const progressPercent = document.getElementById("progress-percent");
  const progressStatus = document.getElementById("progress-status");

  const PROGRESS_POLL_INTERVAL_MS = 700;
  let progressPollTimer = null;
  let stopProgressPolling = false;
  let isEvaluating = false;

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

  function clampPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function setProgressUi({ percent = 0, badgeVariant = "pending", badgeText = "Pendiente" }) {
    const safePercent = clampPercent(percent);

    if (progressBar) progressBar.style.width = `${safePercent}%`;
    if (progressPercent) progressPercent.textContent = `${safePercent}%`;

    if (!progressStatus) return;
    const base = "text-xs px-2 py-1 rounded-full font-medium";
    const variants = {
      pending: "bg-yellow-500/20 text-yellow-400",
      running: "bg-blue-500/20 text-blue-400",
      success: "bg-emerald-500/20 text-emerald-400",
      warning: "bg-yellow-500/20 text-yellow-400",
      error: "bg-red-500/20 text-red-400",
    };
    progressStatus.className = `${base} ${variants[badgeVariant] || variants.pending}`;
    progressStatus.textContent = badgeText;
  }

  const PROGRESS_MESSAGE_LABELS = {
    inicializando: "Inicializando",
    preparando_evaluacion: "Preparando",
    cargando_inputs: "Cargando datos",
    ejecutando: "Ejecutando",
    completed: "Completo",
    completed_with_errors: "Completo con errores",
    failed: "Falló",
  };

  function formatProgressCurrent(current) {
    if (!current) return "";
    const parts = [];
    if (current.analito) parts.push(String(current.analito));
    if (current.nivel != null) parts.push(`Nivel ${current.nivel}`);
    return parts.length ? ` (${parts.join(" · ")})` : "";
  }

  function renderExecutionProgress(progress) {
    if (!progress) {
      setProgressUi({ percent: 0, badgeVariant: "pending", badgeText: "Pendiente" });
      return;
    }

    const percent = clampPercent(progress.percent_tasks);
    const processed = Number(progress.processed_tasks) || 0;
    const total = Number(progress.total_tasks) || 0;
    const saved = Number(progress.saved_results) || 0;
    const failed = Number(progress.failed_tasks) || 0;
    const stage =
      PROGRESS_MESSAGE_LABELS[progress.message] ||
      PROGRESS_MESSAGE_LABELS[progress.status] ||
      (progress.message ? String(progress.message) : "Ejecutando");
    const currentText = formatProgressCurrent(progress.current);

    if (progress.status === "running") {
      if (total > 0) {
        const failedText = failed > 0 ? ` · ✗${failed}` : "";
        setProgressUi({
          percent,
          badgeVariant: "running",
          badgeText: `${stage}: ${processed}/${total}${failedText}${currentText}`,
        });
      } else {
        setProgressUi({ percent, badgeVariant: "running", badgeText: `${stage}${currentText}` });
      }
      return;
    }

    if (progress.status === "completed") {
      const details = total > 0 ? `✓${saved}/${total}` : "Completo";
      setProgressUi({ percent: 100, badgeVariant: "success", badgeText: `Completo · ${details}` });
      return;
    }

    if (progress.status === "completed_with_errors") {
      const details = total > 0 ? `✓${saved} · ✗${failed}` : "Con errores";
      setProgressUi({ percent: 100, badgeVariant: "warning", badgeText: `Con errores · ${details}` });
      return;
    }

    if (progress.status === "failed") {
      setProgressUi({ percent, badgeVariant: "error", badgeText: "Falló" });
      return;
    }

    setProgressUi({ percent, badgeVariant: "running", badgeText: `${stage}${currentText}` });
  }

  function isTerminalProgress(status) {
    return status === "completed" || status === "completed_with_errors" || status === "failed";
  }

  async function getEvaluacionesProgressSafe() {
    if (!window.cerper || typeof window.cerper.getEvaluacionesProgress !== "function") {
      return { ok: false, error: "progress_api_not_available" };
    }
    try {
      return await window.cerper.getEvaluacionesProgress(sessionId);
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  function clearProgressPolling() {
    stopProgressPolling = true;
    if (progressPollTimer) {
      clearTimeout(progressPollTimer);
      progressPollTimer = null;
    }
  }

  function startProgressPolling() {
    clearProgressPolling();
    stopProgressPolling = false;

    const loop = async () => {
      if (stopProgressPolling) return;

      const progressRes = await getEvaluacionesProgressSafe();
      if (progressRes?.error === "progress_api_not_available") {
        clearProgressPolling();
        return;
      }
      if (progressRes?.ok && progressRes.data) {
        renderExecutionProgress(progressRes.data);
        if (isTerminalProgress(progressRes.data.status)) {
          clearProgressPolling();
          return;
        }
      } else if (progressRes?.status !== 404 && progressRes?.error !== "progress_not_found") {
        console.warn("[EvalSelect] Progreso no disponible:", progressRes?.error || progressRes);
      }

      if (stopProgressPolling) return;
      progressPollTimer = setTimeout(loop, PROGRESS_POLL_INTERVAL_MS);
    };

    loop();
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
      if (isEvaluating) return;
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
    });

    contenedor.appendChild(card);
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
    if (contenedor) {
      contenedor.style.pointerEvents = estado ? "none" : "auto";
      contenedor.style.opacity = estado ? "0.7" : "1";
    }
  };

  // Si existe una evaluación en curso, reflejar progreso al entrar
  const initialProgressRes = await getEvaluacionesProgressSafe();
  if (initialProgressRes?.ok && initialProgressRes.data) {
    renderExecutionProgress(initialProgressRes.data);
    if (initialProgressRes.data.status === "running") {
      isEvaluating = true;
      bloquearBotones(true);
      startProgressPolling();
    }
  }

  // === Botón EVALUAR ===
  btnEvaluar.addEventListener("click", async () => {
    if (seleccionadas.size === 0) {
      notify("Selecciona al menos una evaluación.", "warning");
      return;
    }

    bloquearBotones(true);
    isEvaluating = true;
    setProgressUi({ percent: 0, badgeVariant: "running", badgeText: "Iniciando..." });
    startProgressPolling();
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
      setProgressUi({ percent: 0, badgeVariant: "error", badgeText: "Error" });
    } finally {
      const finalProgressRes = await getEvaluacionesProgressSafe();
      if (finalProgressRes?.ok && finalProgressRes.data) {
        renderExecutionProgress(finalProgressRes.data);
      }
      clearProgressPolling();
      isEvaluating = false;
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

