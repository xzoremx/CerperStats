document.addEventListener("DOMContentLoaded", async () => {
  const contenedor = document.querySelector(".analysis-grid");
  const btnEvaluar = document.getElementById("btn-evaluar");
  const btnContinuar = document.getElementById("btn-continuar");
  const btnVolver = document.getElementById("go-back");
  const menuEvaluaciones = document.getElementById("menu-evaluaciones");
  const menuVisualizaciones = document.getElementById("menu-visualizaciones");
  const progressBar = document.getElementById("progress-bar");
  const progressPercent = document.getElementById("progress-percent");
  const progressStatus = document.getElementById("progress-status");
  const viewEvaluaciones = document.getElementById("view-evaluaciones");
  const viewVisualizaciones = document.getElementById("view-visualizaciones");
  const emptyState = document.getElementById("empty-state");
  const emptyTitle = document.getElementById("empty-title");
  const emptyText = document.getElementById("empty-text");
  const runInfo = document.getElementById("run-info");

  // New visualization UI elements
  const filterNivel = document.getElementById("filter-nivel");
  const filterAnalito = document.getElementById("filter-analito");
  const btnVizRolodex = document.getElementById("btn-viz-rolodex");
  const btnVizList = document.getElementById("btn-viz-list");
  const vizRolodexView = document.getElementById("viz-rolodex-view");
  const vizListView = document.getElementById("viz-list-view");
  const vizCardsContainer = document.getElementById("viz-cards-container");
  const vizListContainer = document.getElementById("viz-list-container");
  const vizTimelineTrack = document.getElementById("viz-timeline-track");
  const vizHoverPreview = document.getElementById("viz-hover-preview");
  const vizHoverImage = document.getElementById("viz-hover-image");

  const PROGRESS_POLL_INTERVAL_MS = 700;
  let progressPollTimer = null;
  let stopProgressPolling = false;
  let isEvaluating = false;
  let activeView = "evaluaciones";
  let visualizacionesLoading = false;

  // Visualization state
  let allGraphs = [];
  let filteredGraphs = [];
  let vizActiveIndex = 0;
  let vizDragProgress = 0;
  let vizScrollAccumulator = 0;
  let vizCurrentView = "rolodex"; // 'rolodex' or 'list'

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
      const returnTo = sessionStorage.getItem("evalSelectReturnTo");
      if (returnTo) {
        try {
          sessionStorage.removeItem("evalSelectReturnTo");
        } catch (_) { }
        if (window.cerper && window.cerper.openPage) {
          window.cerper.openPage(returnTo);
        } else {
          window.location.href = returnTo;
        }
        return;
      }
      if (window.cerper && window.cerper.openPage) {
        window.cerper.openPage("input_data/input_data_sheet.html");
      } else {
        window.location.href = "input_data/input_data_sheet.html";
      }
    });
  }

  // === Obtener contexto de sesión ===
  let labKey =
    sessionStorage.getItem("labSeleccionado") ||
    localStorage.getItem("labSeleccionado");
  let tipoAnalisis =
    sessionStorage.getItem("tipoAnalisis") ||
    sessionStorage.getItem("modoAnalito");
  let tipoDato = sessionStorage.getItem("tipoDato");
  let modoCualitativo = sessionStorage.getItem("modoCualitativo");
  let sessionId =
    sessionStorage.getItem("sessionID") || sessionStorage.getItem("sessionSeleccionada");

  if (sessionId && !sessionStorage.getItem("sessionID")) {
    sessionStorage.setItem("sessionID", sessionId);
  }

  // Normalizar alias históricos para evitar perder contexto entre páginas
  if (tipoAnalisis && !sessionStorage.getItem("tipoAnalisis")) {
    sessionStorage.setItem("tipoAnalisis", tipoAnalisis);
  }
  if (labKey && !sessionStorage.getItem("labSeleccionado")) {
    sessionStorage.setItem("labSeleccionado", labKey);
  }

  // Intentar hidratar el contexto desde la sesión (útil si se entra desde "Ver Resultados")
  if (
    sessionId &&
    (!labKey || !tipoAnalisis || !tipoDato) &&
    window.cerper &&
    typeof window.cerper.getSessionInfo === "function"
  ) {
    try {
      const sessionRes = await window.cerper.getSessionInfo(sessionId);
      if (sessionRes?.ok && sessionRes.data) {
        labKey = labKey || sessionRes.data.lab_key;
        tipoAnalisis = tipoAnalisis || sessionRes.data.tipo_analisis;
        tipoDato = tipoDato || sessionRes.data.tipo_dato;
        if (!modoCualitativo && sessionRes.data.modo_cualitativo != null) {
          modoCualitativo = sessionRes.data.modo_cualitativo;
        }

        if (labKey && !sessionStorage.getItem("labSeleccionado")) {
          sessionStorage.setItem("labSeleccionado", labKey);
        }
        if (tipoAnalisis && !sessionStorage.getItem("tipoAnalisis")) {
          sessionStorage.setItem("tipoAnalisis", tipoAnalisis);
        }
        if (tipoDato && !sessionStorage.getItem("tipoDato")) {
          sessionStorage.setItem("tipoDato", tipoDato);
        }
        if (modoCualitativo != null && !sessionStorage.getItem("modoCualitativo")) {
          sessionStorage.setItem("modoCualitativo", modoCualitativo);
        }
      }
    } catch (err) {
      console.warn("[EvalSelect] No se pudo hidratar sesión:", err);
    }
  }

  const MENU_ACTIVE_CLASSES = [
    "bg-blue-500/15",
    "border",
    "border-blue-500/20",
    "text-blue-200",
    "hover:bg-blue-500/25",
  ];
  const MENU_INACTIVE_CLASSES = ["text-gray-300", "hover:text-white", "hover:bg-white/8"];

  function setMenuActiveState(el, isActive) {
    if (!el) return;
    if (isActive) {
      el.classList.add(...MENU_ACTIVE_CLASSES);
      el.classList.remove(...MENU_INACTIVE_CLASSES);
    } else {
      el.classList.remove(...MENU_ACTIVE_CLASSES);
      el.classList.add(...MENU_INACTIVE_CLASSES);
      el.classList.remove("border", "border-blue-500/20");
    }
  }

  function showVisualizacionesEmpty(title, message) {
    if (vizCardsContainer) vizCardsContainer.innerHTML = "";
    if (vizListContainer) vizListContainer.innerHTML = "";
    if (vizTimelineTrack) vizTimelineTrack.innerHTML = "";
    if (runInfo) runInfo.textContent = "";
    if (emptyTitle) emptyTitle.textContent = title || "";
    if (emptyText) emptyText.textContent = message || "";
    if (emptyState) emptyState.classList.remove("hidden");
    if (vizRolodexView) vizRolodexView.classList.add("viz-hidden");
    if (vizListView) vizListView.classList.add("viz-hidden");
  }

  function isValidDataImageUrl(value) {
    return (
      typeof value === "string" &&
      value.startsWith("data:image/") &&
      value.includes(";base64,")
    );
  }

  // ========================================
  // Visualization UI Functions
  // ========================================

  function setVizView(view) {
    vizCurrentView = view === "list" ? "list" : "rolodex";

    if (btnVizRolodex) btnVizRolodex.classList.toggle("active", vizCurrentView === "rolodex");
    if (btnVizList) btnVizList.classList.toggle("active", vizCurrentView === "list");

    if (vizRolodexView) vizRolodexView.classList.toggle("viz-hidden", vizCurrentView !== "rolodex");
    if (vizListView) vizListView.classList.toggle("viz-hidden", vizCurrentView !== "list");
  }

  function applyFilters() {
    const nivelFilter = filterNivel?.value || "";
    const analitoFilter = filterAnalito?.value || "";

    filteredGraphs = allGraphs.filter(g => {
      if (nivelFilter && String(g.nivel) !== nivelFilter) return false;
      if (analitoFilter && g.analito !== analitoFilter) return false;
      return true;
    });

    vizActiveIndex = Math.min(vizActiveIndex, Math.max(0, filteredGraphs.length - 1));
    renderVizCards();
    renderVizTimeline();
    renderVizList();
  }

  function populateFilters() {
    const niveles = new Set();
    const analitos = new Set();

    allGraphs.forEach(g => {
      if (g.nivel != null) niveles.add(String(g.nivel));
      if (g.analito) analitos.add(g.analito);
    });

    if (filterNivel) {
      const currentVal = filterNivel.value;
      filterNivel.innerHTML = '<option value="">Todos los niveles</option>';
      [...niveles].sort((a, b) => Number(a) - Number(b)).forEach(n => {
        const opt = document.createElement("option");
        opt.value = n;
        opt.textContent = `Nivel ${n}`;
        filterNivel.appendChild(opt);
      });
      filterNivel.value = currentVal;
    }

    if (filterAnalito) {
      const currentVal = filterAnalito.value;
      filterAnalito.innerHTML = '<option value="">Todos los analitos</option>';
      [...analitos].sort().forEach(a => {
        const opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a;
        filterAnalito.appendChild(opt);
      });
      filterAnalito.value = currentVal;
    }
  }

  function renderVizCards() {
    if (!vizCardsContainer) return;
    vizCardsContainer.innerHTML = "";

    if (filteredGraphs.length === 0) {
      if (allGraphs.length > 0) {
        showVisualizacionesEmpty("Sin resultados", "No hay gráficos que coincidan con los filtros seleccionados.");
      }
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");
    if (vizRolodexView && vizCurrentView === "rolodex") vizRolodexView.classList.remove("viz-hidden");

    filteredGraphs.forEach((g, index) => {
      const card = document.createElement("div");
      card.className = "viz-card";
      card.dataset.index = index;

      const title = g?.test_titulo || g?.nombre_interno || (g?.catalog_id ? `Prueba ${g.catalog_id}` : "Prueba");
      const subtitleParts = [];
      if (g?.analito) subtitleParts.push(g.analito);
      if (g?.nivel != null) subtitleParts.push(`Nivel ${g.nivel}`);
      const subtitle = subtitleParts.join(" · ");

      card.innerHTML = `
        <div class="viz-card-inner">
          <div class="viz-card-image">
            <img src="${g.grafico_data}" alt="${title}" loading="lazy">
          </div>
          <div class="viz-card-content">
            <h2 class="viz-card-title">${title}</h2>
            ${subtitle ? `<p class="viz-card-subtitle">${subtitle}</p>` : ""}
            <span class="viz-card-badge">#${g?.catalog_id || "?"}</span>
          </div>
        </div>
      `;

      vizCardsContainer.appendChild(card);
    });

    updateVizCards();
  }

  function updateVizCards() {
    const cards = vizCardsContainer?.querySelectorAll(".viz-card") || [];

    cards.forEach((card, index) => {
      const offset = index - vizActiveIndex;
      const absOffset = Math.abs(offset);
      const isActive = index === vizActiveIndex;

      let translateY = offset * 45;
      let translateZ = -absOffset * 60;
      let rotateX = 0;
      let opacity = Math.max(0.4, 1 - absOffset * 0.08);
      let scale = Math.max(0.7, 1 - absOffset * 0.035);

      if (isActive && Math.abs(vizDragProgress) > 0.05) {
        translateY = translateY - vizDragProgress * 100;
        translateZ = translateZ + Math.abs(vizDragProgress) * 40;
        rotateX = -vizDragProgress * 12;
      }

      card.style.transform = `translateY(${translateY}px) translateZ(${translateZ}px) rotateX(${rotateX}deg) scale(${scale})`;
      card.style.opacity = opacity;
      card.style.zIndex = 100 - Math.round(absOffset * 10);

      if (isActive) {
        card.classList.add("active");
      } else {
        card.classList.remove("active");
      }
    });

    updateVizTimeline();
  }

  function renderVizTimeline() {
    if (!vizTimelineTrack) return;
    vizTimelineTrack.innerHTML = "";

    if (filteredGraphs.length === 0) return;

    // Update labels
    const topLabel = document.querySelector(".viz-timeline-label-top");
    const bottomLabel = document.querySelector(".viz-timeline-label-bottom");
    if (topLabel) topLabel.textContent = `#${filteredGraphs[0]?.catalog_id || 1}`;
    if (bottomLabel) bottomLabel.textContent = `#${filteredGraphs[filteredGraphs.length - 1]?.catalog_id || "?"}`;

    // Create tick marks
    const tickCount = Math.min(Math.max(filteredGraphs.length, 10), 40);
    for (let i = 0; i <= tickCount; i++) {
      const tick = document.createElement("div");
      tick.className = "viz-timeline-tick";
      tick.style.top = `${(i / tickCount) * 100}%`;
      vizTimelineTrack.appendChild(tick);
    }

    // Create markers for each graph
    filteredGraphs.forEach((g, index) => {
      const position = index / Math.max(1, filteredGraphs.length - 1);

      const marker = document.createElement("div");
      marker.className = "viz-timeline-marker";
      marker.dataset.index = index;
      marker.style.top = `${position * 100}%`;

      marker.innerHTML = `
        <span class="viz-timeline-id-label">#${g?.catalog_id || "?"}</span>
        <div class="viz-timeline-marker-bar" style="width: 1.25rem;"></div>
      `;

      marker.addEventListener("click", () => {
        vizActiveIndex = index;
        vizDragProgress = 0;
        updateVizCards();
      });

      vizTimelineTrack.appendChild(marker);
    });

    updateVizTimeline();

    // Timeline drag
    vizTimelineTrack.addEventListener("mousedown", handleVizTimelineDrag);
  }

  function updateVizTimeline() {
    const markers = vizTimelineTrack?.querySelectorAll(".viz-timeline-marker") || [];
    markers.forEach(marker => {
      const index = parseInt(marker.dataset.index);
      if (index === vizActiveIndex) {
        marker.classList.add("active");
      } else {
        marker.classList.remove("active");
      }
    });
  }

  function handleVizTimelineDrag(e) {
    const rect = vizTimelineTrack.getBoundingClientRect();

    const updateFromMouse = (event) => {
      const y = event.clientY - rect.top;
      const percentage = Math.max(0, Math.min(1, y / rect.height));
      const nearestIndex = Math.round(percentage * (filteredGraphs.length - 1));
      vizActiveIndex = Math.max(0, Math.min(filteredGraphs.length - 1, nearestIndex));
      vizDragProgress = 0;
      updateVizCards();
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", updateFromMouse);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    updateFromMouse(e);
    window.addEventListener("mousemove", updateFromMouse);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function renderVizList() {
    if (!vizListContainer) return;
    vizListContainer.innerHTML = "";

    if (filteredGraphs.length === 0) return;

    filteredGraphs.forEach((g, index) => {
      const title = g?.test_titulo || g?.nombre_interno || (g?.catalog_id ? `Prueba ${g.catalog_id}` : "Prueba");
      const metaParts = [];
      if (g?.analito) metaParts.push(g.analito);
      if (g?.nivel != null) metaParts.push(`Nivel ${g.nivel}`);

      const item = document.createElement("a");
      item.href = "#";
      item.className = "viz-list-item";
      item.dataset.index = index;
      item.dataset.image = g?.grafico_data || "";
      item.onclick = (e) => {
        e.preventDefault();
        vizActiveIndex = index;
        setVizView("rolodex");
        updateVizCards();
      };

      item.innerHTML = `
        <div class="viz-list-item-inner">
          <span class="viz-list-id">#${g?.catalog_id || "?"}</span>
          <h2 class="viz-list-title">${title}</h2>
          <p class="viz-list-meta">${metaParts.join(" · ")}</p>
          <span class="viz-list-arrow">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"></path>
            </svg>
          </span>
        </div>
      `;

      // Hover preview
      item.addEventListener("mouseenter", () => {
        if (g?.grafico_data && vizHoverImage && vizHoverPreview) {
          vizHoverImage.src = g.grafico_data;
          vizHoverPreview.classList.add("visible");
        }
      });

      item.addEventListener("mouseleave", () => {
        if (vizHoverPreview) vizHoverPreview.classList.remove("visible");
      });

      item.addEventListener("mousemove", (e) => {
        if (vizHoverPreview) {
          vizHoverPreview.style.left = `${e.clientX + 20}px`;
          vizHoverPreview.style.top = `${e.clientY - 100}px`;
        }
      });

      vizListContainer.appendChild(item);
    });
  }

  // Wheel handling for rolodex
  let vizWheelTimeout;
  function handleVizWheel(e) {
    if (vizCurrentView !== "rolodex" || filteredGraphs.length === 0) return;
    e.preventDefault();

    vizScrollAccumulator += e.deltaY * 0.012;
    vizDragProgress += vizScrollAccumulator;
    vizScrollAccumulator = 0;

    if (Math.abs(vizDragProgress) > 1) {
      const direction = vizDragProgress > 0 ? 1 : -1;
      vizActiveIndex = Math.max(0, Math.min(filteredGraphs.length - 1, vizActiveIndex + direction));
      vizDragProgress = 0;
    } else {
      vizDragProgress = Math.max(-1, Math.min(1, vizDragProgress));
    }

    updateVizCards();

    clearTimeout(vizWheelTimeout);
    vizWheelTimeout = setTimeout(() => {
      if (Math.abs(vizDragProgress) > 0.25) {
        const direction = vizDragProgress > 0 ? 1 : -1;
        vizActiveIndex = Math.max(0, Math.min(filteredGraphs.length - 1, vizActiveIndex + direction));
      }
      vizDragProgress = 0;
      updateVizCards();
    }, 40);
  }

  // Keyboard navigation
  function handleVizKeydown(e) {
    if (activeView !== "visualizaciones" || vizCurrentView !== "rolodex" || filteredGraphs.length === 0) return;

    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      vizActiveIndex = Math.max(0, vizActiveIndex - 1);
      vizDragProgress = 0;
      updateVizCards();
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      vizActiveIndex = Math.min(filteredGraphs.length - 1, vizActiveIndex + 1);
      vizDragProgress = 0;
      updateVizCards();
    }
  }

  async function loadVisualizaciones() {
    if (visualizacionesLoading) return;

    if (!sessionId) {
      showVisualizacionesEmpty(
        "No hay sesión activa",
        "Regresa al flujo de sesión y ejecuta las evaluaciones para ver gráficos."
      );
      return;
    }

    if (!window.cerper || typeof window.cerper.getEvaluacionesGraficos !== "function") {
      showVisualizacionesEmpty(
        "Visualizaciones no disponibles",
        "Falta la función para cargar gráficos. Reinicia la app o revisa la integración de IPC."
      );
      return;
    }

    visualizacionesLoading = true;
    if (runInfo) runInfo.textContent = "Cargando gráficos...";
    if (emptyState) emptyState.classList.add("hidden");

    let res;
    try {
      res = await window.cerper.getEvaluacionesGraficos(sessionId);
    } catch (err) {
      console.error("[EvalSelect] Error obteniendo gráficos:", err);
      showVisualizacionesEmpty("Error al cargar visualizaciones", "No se pudieron obtener los gráficos.");
      visualizacionesLoading = false;
      return;
    }

    if (!res?.ok) {
      showVisualizacionesEmpty(
        "Error al cargar visualizaciones",
        "No se pudieron obtener los gráficos desde el backend."
      );
      visualizacionesLoading = false;
      return;
    }

    const graphs = Array.isArray(res.data) ? res.data : [];
    const lastRunAt = res?.meta?.last_run_at || null;

    if (graphs.length === 0) {
      if (!lastRunAt) {
        showVisualizacionesEmpty(
          "No hay nada que ver aquí aún",
          "Ejecuta las evaluaciones para ver algo."
        );
        visualizacionesLoading = false;
        return;
      }
      showVisualizacionesEmpty(
        "Aún no hay gráficos para mostrar",
        "Se encontró una corrida previa, pero no hay gráficos generados en la última ejecución."
      );
      visualizacionesLoading = false;
      return;
    }

    // Filter valid images and sort by catalog_id
    allGraphs = graphs
      .filter(g => isValidDataImageUrl(g?.grafico_data))
      .sort((a, b) => (a.catalog_id || 0) - (b.catalog_id || 0));

    if (allGraphs.length === 0) {
      showVisualizacionesEmpty("Sin gráficos válidos", "Los gráficos obtenidos no tienen formato válido.");
      visualizacionesLoading = false;
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");
    if (runInfo) runInfo.textContent = lastRunAt ? `Última corrida: ${lastRunAt}` : "";

    // Populate filters
    populateFilters();

    // Apply initial filters (none)
    filteredGraphs = [...allGraphs];
    vizActiveIndex = 0;

    // Render views
    renderVizCards();
    renderVizTimeline();
    renderVizList();

    // Set initial view
    setVizView(vizCurrentView);

    // Attach event listeners
    if (vizRolodexView) {
      vizRolodexView.addEventListener("wheel", handleVizWheel, { passive: false });
    }

    visualizacionesLoading = false;
  }

  // Filter event listeners
  filterNivel?.addEventListener("change", applyFilters);
  filterAnalito?.addEventListener("change", applyFilters);

  // View toggle event listeners
  btnVizRolodex?.addEventListener("click", () => setVizView("rolodex"));
  btnVizList?.addEventListener("click", () => setVizView("list"));

  // Keyboard navigation
  document.addEventListener("keydown", handleVizKeydown);

  function setActiveView(nextView) {
    activeView = nextView === "visualizaciones" ? "visualizaciones" : "evaluaciones";
    sessionStorage.setItem("evalSelectView", activeView);

    if (viewEvaluaciones) viewEvaluaciones.classList.toggle("hidden", activeView !== "evaluaciones");
    if (viewVisualizaciones)
      viewVisualizaciones.classList.toggle("hidden", activeView !== "visualizaciones");

    setMenuActiveState(menuEvaluaciones, activeView === "evaluaciones");
    setMenuActiveState(menuVisualizaciones, activeView === "visualizaciones");

    if (activeView === "visualizaciones") {
      loadVisualizaciones();
    }
  }

  menuEvaluaciones?.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveView("evaluaciones");
  });

  menuVisualizaciones?.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveView("visualizaciones");
  });

  setActiveView(sessionStorage.getItem("evalSelectView") === "visualizaciones" ? "visualizaciones" : "evaluaciones");

  if (!sessionId) {
    notify("Faltan datos de sesión. Regresa al paso anterior.", "error");
    if (window.cerper && typeof window.cerper.openPage === "function") {
      window.cerper.openPage("input_data/input_data_sheet.html");
    } else {
      window.location.href = "input_data/input_data_sheet.html";
    }
    return;
  }

  if (!labKey || !tipoAnalisis || !tipoDato) {
    if (activeView === "visualizaciones") {
      if (btnEvaluar) btnEvaluar.disabled = true;
      if (btnContinuar) btnContinuar.disabled = true;
      return;
    } else {
      notify("Faltan datos de sesión. Regresa al paso anterior.", "error");
      if (window.cerper && typeof window.cerper.openPage === "function") {
        window.cerper.openPage("input_data/input_data_sheet.html");
      } else {
        window.location.href = "input_data/input_data_sheet.html";
      }
      return;
    }
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

  function startProgressPolling(
    { stopOnTerminal = true, skipTerminalRender = false, onTerminal = null } = {}
  ) {
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
        const terminal = isTerminalProgress(progressRes.data.status);
        if (!(skipTerminalRender && terminal)) {
          renderExecutionProgress(progressRes.data);
        }
        if (terminal && stopOnTerminal) {
          clearProgressPolling();
          if (typeof onTerminal === "function") onTerminal(progressRes.data);
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
    if (initialProgressRes.data.status === "running") {
      renderExecutionProgress(initialProgressRes.data);
      isEvaluating = true;
      bloquearBotones(true);
      startProgressPolling({
        stopOnTerminal: true,
        skipTerminalRender: false,
        onTerminal: (finalProgress) => {
          isEvaluating = false;
          bloquearBotones(false);
          if (finalProgress && activeView === "visualizaciones") loadVisualizaciones();
        },
      });
    } else {
      setProgressUi({ percent: 0, badgeVariant: "pending", badgeText: "Listo para evaluar" });
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
    startProgressPolling({ stopOnTerminal: false, skipTerminalRender: true });
    notify("Ejecutando evaluaciones seleccionadas...", "info");

    try {
      const result = await window.cerper.runEvaluations({
        session_id: sessionId,
        catalog_ids: Array.from(seleccionadas)
      });

      if (!result.ok) throw new Error(result.error || "Error desconocido");

      notify("Evaluaciones completadas y guardadas correctamente.", "success");

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

