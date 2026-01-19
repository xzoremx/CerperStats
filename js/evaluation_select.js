document.addEventListener("DOMContentLoaded", async () => {
  const contenedor = document.querySelector(".analysis-grid");
  const btnEvaluar = document.getElementById("btn-evaluar");
  const btnContinuar = document.getElementById("btn-continuar");
  const btnVolver = document.getElementById("go-back");
  const menuEvaluaciones = document.getElementById("menu-evaluaciones");
  const menuVisualizaciones = document.getElementById("menu-visualizaciones");
  const menuConfiguracion = document.getElementById("menu-configuracion");
  const progressBar = document.getElementById("progress-bar");
  const progressPercent = document.getElementById("progress-percent");
  const progressStatus = document.getElementById("progress-status");
  const viewEvaluaciones = document.getElementById("view-evaluaciones");
  const viewVisualizaciones = document.getElementById("view-visualizaciones");
  const viewConfiguracion = document.getElementById("view-configuracion");
  const emptyState = document.getElementById("empty-state");
  const emptyTitle = document.getElementById("empty-title");
  const emptyText = document.getElementById("empty-text");
  const runInfo = document.getElementById("run-info");

  // New visualization UI elements - Custom Dropdowns
  const dropdownNivel = document.getElementById("dropdown-nivel");
  const dropdownAnalito = document.getElementById("dropdown-analito");
  const dropdownPrueba = document.getElementById("dropdown-prueba");
  const btnVizRolodex = document.getElementById("btn-viz-rolodex");
  const btnVizList = document.getElementById("btn-viz-list");
  const btnCardTheme = document.getElementById("btn-card-theme");
  const btnVizDangerToggle = document.getElementById("btn-viz-danger-toggle");
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
  let expectedResultsCount = 0; // Track expected results from last evaluation

  // Visualization state
  let allGraphs = [];
  let filteredGraphs = [];
  let vizActiveIndex = 0;
  let vizDragProgress = 0;
  let vizScrollAccumulator = 0;
  let vizCurrentView = "rolodex"; // 'rolodex' or 'list'
  let vizCardTheme = "dark"; // 'dark' or 'light'
  let filterNivelValue = "";
  let filterAnalitoValue = "";
  let filterPruebaValue = ""; // Filter by test name (test_titulo)
  let filterDangerValue = ""; // Filter by danger status
  let hasMultipleLevels = true; // Track if data has more than one unique level

  // === CACHE CONTROL ===
  // Track which session's data we have cached to avoid refetching
  let cachedGraphsSessionId = null;
  let cachedResultsSessionId = null;
  let cacheVersion = sessionStorage.getItem("evalCacheVersion") || "0";

  // Function to invalidate cache (called after new evaluation or when inputs change)
  function invalidateCache() {
    cachedGraphsSessionId = null;
    cachedResultsSessionId = null;
    allGraphs = [];
    allResults = [];
    cacheVersion = String(Date.now());
    sessionStorage.setItem("evalCacheVersion", cacheVersion);
    console.log("[EvalSelect] Cache invalidado");
  }

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

  // === Configuración dinámica de formateo (dataframes) ===
  try {
    await window.DataframeRenderer?.loadConfig?.();
  } catch (err) {
    console.warn("[EvalSelect] No se pudo cargar formatting config:", err);
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
  let tipoAnalisis = sessionStorage.getItem("tipoAnalisis");
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
    filteredGraphs = allGraphs.filter(g => {
      if (filterNivelValue && String(g.nivel) !== filterNivelValue) return false;
      if (filterAnalitoValue && g.analito !== filterAnalitoValue) return false;
      // Filter by test name (test_titulo or nombre_interno)
      if (filterPruebaValue) {
        const testName = g.test_titulo || g.nombre_interno || "";
        if (testName !== filterPruebaValue) return false;
      }
      // Filter by danger status
      if (filterDangerValue === "danger" && g.conclusion_status !== "danger") return false;
      return true;
    });

    vizActiveIndex = Math.min(vizActiveIndex, Math.max(0, filteredGraphs.length - 1));
    renderVizCards();
    renderVizTimeline();
    renderVizList();
  }

  function populateDropdown(dropdown, items, allLabel) {
    if (!dropdown) return;
    const menu = dropdown.querySelector(".viz-dropdown-menu");
    if (!menu) return;

    menu.innerHTML = `<div class="viz-dropdown-item active" data-value="">${allLabel}</div>`;
    items.forEach(item => {
      const div = document.createElement("div");
      div.className = "viz-dropdown-item";
      div.dataset.value = item.value;
      div.textContent = item.label;
      menu.appendChild(div);
    });
  }

  function populateFilters() {
    const niveles = new Set();
    const analitos = new Set();
    const pruebas = new Set();

    allGraphs.forEach(g => {
      if (g.nivel != null) niveles.add(String(g.nivel));
      if (g.analito) analitos.add(g.analito);
      // Collect unique test names
      const testName = g.test_titulo || g.nombre_interno;
      if (testName) pruebas.add(testName);
    });

    const nivelItems = [...niveles].sort((a, b) => Number(a) - Number(b)).map(n => ({
      value: n,
      label: `Nivel ${n}`
    }));

    const analitoItems = [...analitos].sort().map(a => ({
      value: a,
      label: a
    }));

    const pruebaItems = [...pruebas].sort().map(p => ({
      value: p,
      label: p
    }));

    populateDropdown(dropdownNivel, nivelItems, "Todos los niveles");
    populateDropdown(dropdownAnalito, analitoItems, "Todos los analitos");
    populateDropdown(dropdownPrueba, pruebaItems, "Todas las pruebas");
  }

  // Custom dropdown functionality
  function initDropdown(dropdown, onSelect) {
    if (!dropdown) return;

    const trigger = dropdown.querySelector(".viz-dropdown-trigger");
    const menu = dropdown.querySelector(".viz-dropdown-menu");
    const textEl = dropdown.querySelector(".viz-dropdown-text");

    if (!trigger || !menu) return;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close other dropdowns
      document.querySelectorAll(".viz-dropdown.open").forEach(d => {
        if (d !== dropdown) d.classList.remove("open");
      });
      dropdown.classList.toggle("open");
    });

    menu.addEventListener("click", (e) => {
      const item = e.target.closest(".viz-dropdown-item");
      if (!item) return;

      const value = item.dataset.value || "";
      const label = item.textContent;

      // Update active state
      menu.querySelectorAll(".viz-dropdown-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      // Update trigger text
      if (textEl) textEl.textContent = label;

      // Close dropdown
      dropdown.classList.remove("open");

      // Callback
      if (onSelect) onSelect(value);
    });
  }

  // Close dropdowns when clicking outside
  document.addEventListener("click", () => {
    document.querySelectorAll(".viz-dropdown.open").forEach(d => d.classList.remove("open"));
  });

  // Card theme toggle
  function toggleCardTheme() {
    vizCardTheme = vizCardTheme === "dark" ? "light" : "dark";
    if (vizCardsContainer) {
      vizCardsContainer.classList.toggle("viz-cards-light", vizCardTheme === "light");
    }
    if (viewVisualizaciones) {
      viewVisualizaciones.classList.toggle("viz-cards-light", vizCardTheme === "light");
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
      if (hasMultipleLevels && g?.nivel != null) subtitleParts.push(`Nivel ${g.nivel}`);
      const subtitle = subtitleParts.join(" · ");

      card.innerHTML = `
        <div class="viz-card-inner">
          <div class="viz-card-image">
            <img src="${g.grafico_data}" alt="${title}" loading="lazy">
          </div>
          <div class="viz-card-content">
            <span class="viz-card-badge">#${index + 1}</span>
            <h2 class="viz-card-title">${title}</h2>
            ${subtitle ? `<span class="viz-card-subtitle">${subtitle}</span>` : ""}
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
    if (topLabel) topLabel.textContent = `#1`;
    if (bottomLabel) bottomLabel.textContent = `#${filteredGraphs.length}`;

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
        <span class="viz-timeline-id-label">#${index + 1}</span>
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
      if (hasMultipleLevels && g?.nivel != null) metaParts.push(`Nivel ${g.nivel}`);

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
          <span class="viz-list-id">#${index + 1}</span>
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
          const previewWidth = 455;
          const previewHeight = 325;
          const margin = 20;

          // Calculate horizontal position (prefer right, fallback to left)
          let left = e.clientX + margin;
          if (left + previewWidth > window.innerWidth) {
            left = e.clientX - previewWidth - margin;
          }

          // Calculate vertical position (prefer above cursor, fallback to below)
          let top = e.clientY - previewHeight - margin;
          if (top < 0) {
            // Not enough space above, show below cursor
            top = e.clientY + margin;
          }
          // Also check if it goes below the viewport
          if (top + previewHeight > window.innerHeight) {
            top = window.innerHeight - previewHeight - margin;
          }

          vizHoverPreview.style.left = `${Math.max(0, left)}px`;
          vizHoverPreview.style.top = `${Math.max(0, top)}px`;
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

    // === CACHE CHECK: Skip fetch if we already have data for this session ===
    const currentCacheVersion = sessionStorage.getItem("evalCacheVersion") || "0";
    if (cachedGraphsSessionId === sessionId && cacheVersion === currentCacheVersion && allGraphs.length > 0) {
      console.log("[EvalSelect] Usando gráficos en cache");
      applyVizFilters();
      initVizCards();
      if (emptyState) emptyState.classList.add("hidden");
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
    const vizSpinner = document.getElementById("viz-loading-spinner");
    // Show spinner after small delay to avoid flash for quick operations
    const vizSpinnerTimeout = setTimeout(() => {
      if (vizSpinner && visualizacionesLoading) vizSpinner.classList.remove("hidden");
    }, 150);
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

    // Detect if we have multiple levels
    const uniqueLevels = new Set(allGraphs.map(g => g?.nivel).filter(n => n != null));
    hasMultipleLevels = uniqueLevels.size > 1;

    // Hide nivel dropdown if only one level
    if (dropdownNivel) {
      dropdownNivel.classList.toggle("hidden", !hasMultipleLevels);
    }

    if (allGraphs.length === 0) {
      showVisualizacionesEmpty("Sin gráficos válidos", "Los gráficos obtenidos no tienen formato válido.");
      visualizacionesLoading = false;
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    // Format last run date to Lima-Peru local time
    let formattedDate = "";
    if (lastRunAt) {
      try {
        // Parse the timestamp (assumed UTC from backend)
        const date = new Date(lastRunAt.replace(" ", "T") + "Z");
        formattedDate = date.toLocaleString("es-PE", {
          timeZone: "America/Lima",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        });
      } catch (e) {
        formattedDate = lastRunAt;
      }
    }
    if (runInfo) runInfo.textContent = formattedDate ? `Última corrida: ${formattedDate}` : "";

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

    // Mark cache as valid for this session
    cachedGraphsSessionId = sessionId;
    cacheVersion = sessionStorage.getItem("evalCacheVersion") || "0";

    // Hide loading spinner
    const vizSpinnerEnd = document.getElementById("viz-loading-spinner");
    if (vizSpinnerEnd) vizSpinnerEnd.classList.add("hidden");

    visualizacionesLoading = false;
  }

  // Initialize custom dropdowns
  initDropdown(dropdownNivel, (value) => {
    filterNivelValue = value;
    applyFilters();
  });

  initDropdown(dropdownAnalito, (value) => {
    filterAnalitoValue = value;
    applyFilters();
  });

  initDropdown(dropdownPrueba, (value) => {
    filterPruebaValue = value;
    applyFilters();
  });

  // Card theme toggle
  btnCardTheme?.addEventListener("click", toggleCardTheme);

  // Viz danger toggle button handler
  btnVizDangerToggle?.addEventListener("click", () => {
    const isActive = btnVizDangerToggle.classList.toggle("active");
    filterDangerValue = isActive ? "danger" : "";
    applyFilters();
  });

  // View toggle event listeners
  btnVizRolodex?.addEventListener("click", () => setVizView("rolodex"));
  btnVizList?.addEventListener("click", () => setVizView("list"));

  // Keyboard navigation
  document.addEventListener("keydown", handleVizKeydown);

  function setActiveView(nextView) {
    const validViews = ["evaluaciones", "visualizaciones", "configuracion", "resultados"];
    activeView = validViews.includes(nextView) ? nextView : "evaluaciones";
    sessionStorage.setItem("evalSelectView", activeView);

    if (viewEvaluaciones) viewEvaluaciones.classList.toggle("hidden", activeView !== "evaluaciones");
    if (viewVisualizaciones)
      viewVisualizaciones.classList.toggle("hidden", activeView !== "visualizaciones");
    if (viewConfiguracion) viewConfiguracion.classList.toggle("hidden", activeView !== "configuracion");
    if (viewResultados) viewResultados.classList.toggle("hidden", activeView !== "resultados");

    // Hide Evaluar and Continuar buttons when not in evaluaciones view
    const showActionButtons = activeView === "evaluaciones";
    if (btnEvaluar) btnEvaluar.classList.toggle("hidden", !showActionButtons);
    if (btnContinuar) btnContinuar.classList.toggle("hidden", !showActionButtons);

    setMenuActiveState(menuEvaluaciones, activeView === "evaluaciones");
    setMenuActiveState(menuVisualizaciones, activeView === "visualizaciones");
    setMenuActiveState(menuConfiguracion, activeView === "configuracion");
    setMenuActiveState(menuResultados, activeView === "resultados");

    if (activeView === "visualizaciones") {
      loadVisualizaciones();
    } else if (activeView === "resultados") {
      loadResultados();
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

  menuConfiguracion?.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveView("configuracion");
  });

  // ========================================
  // Resultados Preliminares Logic
  // ========================================

  const menuResultados = document.getElementById("menu-resultados");
  const viewResultados = document.getElementById("view-resultados");
  const resultListContainer = document.getElementById("result-list-container");
  const resultEmptyState = document.getElementById("result-empty-state");
  const resultEmptyTitle = document.getElementById("result-empty-title");
  const resultEmptyText = document.getElementById("result-empty-text");
  const resultRunInfo = document.getElementById("result-run-info");
  const dropdownResultNivel = document.getElementById("dropdown-result-nivel");
  const dropdownResultAnalito = document.getElementById("dropdown-result-analito");
  const dropdownResultPrueba = document.getElementById("dropdown-result-prueba");
  const btnDangerToggle = document.getElementById("btn-danger-toggle");
  const resultModalBackdrop = document.getElementById("result-modal-backdrop");
  const resultModalTitle = document.getElementById("result-modal-title");
  const resultModalSubtitle = document.getElementById("result-modal-subtitle");
  const resultModalBody = document.getElementById("result-modal-body");
  const resultModalClose = document.getElementById("result-modal-close");

  let allResults = [];
  let filteredResults = [];
  let resultadosLoading = false;
  let resultFilterNivel = "";
  let resultFilterAnalito = "";
  let resultFilterPrueba = "";
  let resultFilterDanger = "";
  let hasMultipleResultLevels = true; // Track if results have multiple levels

  menuResultados?.addEventListener("click", (e) => {
    e.preventDefault();
    setActiveView("resultados");
  });

  function showResultadosEmpty(title, message) {
    // Hide loading spinner
    const resultSpinner = document.getElementById("result-loading-spinner");
    if (resultSpinner) resultSpinner.classList.add("hidden");

    if (resultListContainer) resultListContainer.innerHTML = "";
    if (resultEmptyTitle) resultEmptyTitle.textContent = title || "";
    if (resultEmptyText) resultEmptyText.textContent = message || "";
    if (resultEmptyState) resultEmptyState.classList.remove("hidden");
    if (resultListContainer) resultListContainer.classList.add("hidden");
    if (resultRunInfo) resultRunInfo.textContent = "";
  }

  function hideResultadosEmpty() {
    if (resultEmptyState) resultEmptyState.classList.add("hidden");
    if (resultListContainer) resultListContainer.classList.remove("hidden");
  }

  // Use DataframeRenderer module for formatting
  const formatDataframeValue = window.DataframeRenderer?.formatValue || (v => String(v));
  const getColumnLabel = window.DataframeRenderer?.getColumnLabel || (k => k);
  const renderDataframeTable = window.DataframeRenderer?.renderTable || (() => '<p>Error: DataframeRenderer no disponible</p>');

  function openResultModal(result) {
    const title = result.test_titulo || result.nombre_interno || `Prueba #${result.catalog_id}`;
    const subtitleParts = [];
    if (result.nivel != null) subtitleParts.push(`Nivel ${result.nivel}`);
    if (result.analito) subtitleParts.push(result.analito);

    if (resultModalTitle) resultModalTitle.textContent = title;
    if (resultModalSubtitle) resultModalSubtitle.textContent = subtitleParts.join(" · ") || "Sin detalles";

    // Parse resultado_pc if it's a string
    let dataArray = result.resultado_pc;
    if (typeof dataArray === "string") {
      try {
        dataArray = JSON.parse(dataArray);
      } catch (e) {
        dataArray = [];
      }
    }
    if (!Array.isArray(dataArray)) dataArray = [dataArray].filter(Boolean);

    if (resultModalBody) {
      resultModalBody.innerHTML = renderDataframeTable(dataArray);
    }

    if (resultModalBackdrop) resultModalBackdrop.classList.add("visible");
  }

  function closeResultModal() {
    if (resultModalBackdrop) resultModalBackdrop.classList.remove("visible");
  }

  resultModalClose?.addEventListener("click", closeResultModal);
  resultModalBackdrop?.addEventListener("click", (e) => {
    if (e.target === resultModalBackdrop) closeResultModal();
  });

  // Close modal on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && resultModalBackdrop?.classList.contains("visible")) {
      closeResultModal();
    }
  });

  function renderResultadosList() {
    if (!resultListContainer) return;
    resultListContainer.innerHTML = "";

    if (filteredResults.length === 0) {
      if (allResults.length > 0) {
        showResultadosEmpty("Sin resultados", "No hay resultados que coincidan con los filtros seleccionados.");
      }
      return;
    }

    hideResultadosEmpty();

    filteredResults.forEach((r, index) => {
      const title = r.test_titulo || r.nombre_interno || `Prueba ${r.catalog_id}`;
      const metaParts = [];
      if (r.analito) metaParts.push(r.analito);
      if (hasMultipleResultLevels && r.nivel != null) metaParts.push(`Nivel ${r.nivel}`);

      const item = document.createElement("div");
      item.className = "result-list-item";
      // Add danger class if conclusion_status is 'danger'
      if (r.conclusion_status === "danger") {
        item.classList.add("is-danger");
      }
      item.dataset.index = index;

      // Build danger badge HTML if needed
      const dangerBadge = r.conclusion_status === "danger"
        ? '<span class="result-danger-badge">⚠️ Alerta</span>'
        : '';

      item.innerHTML = `
        <div class="result-list-item-inner">
          <span class="result-list-id">#${index + 1}</span>
          <h2 class="result-list-title">${title}${dangerBadge}</h2>
          <p class="result-list-meta">${metaParts.join(" · ")}</p>
          ${r.categoria ? `<span class="result-list-category">${r.categoria}</span>` : ""}
          <span class="result-list-arrow">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"></path>
            </svg>
          </span>
        </div>
      `;

      item.addEventListener("click", () => openResultModal(r));
      resultListContainer.appendChild(item);
    });
  }

  function applyResultFilters() {
    filteredResults = allResults.filter(r => {
      if (resultFilterNivel && String(r.nivel) !== resultFilterNivel) return false;
      if (resultFilterAnalito && r.analito !== resultFilterAnalito) return false;
      // Filter by test name
      if (resultFilterPrueba) {
        const testName = r.test_titulo || r.nombre_interno || "";
        if (testName !== resultFilterPrueba) return false;
      }
      // Filter by danger status
      if (resultFilterDanger === "danger" && r.conclusion_status !== "danger") return false;
      return true;
    });
    renderResultadosList();
  }

  function populateResultFilters() {
    const niveles = new Set();
    const analitos = new Set();
    const pruebas = new Set();

    allResults.forEach(r => {
      if (r.nivel != null) niveles.add(String(r.nivel));
      if (r.analito) analitos.add(r.analito);
      // Collect unique test names
      const testName = r.test_titulo || r.nombre_interno;
      if (testName) pruebas.add(testName);
    });

    const nivelItems = [...niveles].sort((a, b) => Number(a) - Number(b)).map(n => ({
      value: n,
      label: `Nivel ${n}`
    }));

    const analitoItems = [...analitos].sort().map(a => ({
      value: a,
      label: a
    }));

    const pruebaItems = [...pruebas].sort().map(p => ({
      value: p,
      label: p
    }));

    populateDropdown(dropdownResultNivel, nivelItems, "Todos los niveles");
    populateDropdown(dropdownResultAnalito, analitoItems, "Todos los analitos");
    populateDropdown(dropdownResultPrueba, pruebaItems, "Todas las pruebas");
  }

  // Initialize result dropdowns with reused function
  initDropdown(dropdownResultNivel, (value) => {
    resultFilterNivel = value;
    applyResultFilters();
  });

  initDropdown(dropdownResultAnalito, (value) => {
    resultFilterAnalito = value;
    applyResultFilters();
  });

  initDropdown(dropdownResultPrueba, (value) => {
    resultFilterPrueba = value;
    applyResultFilters();
  });

  // Danger toggle button handler
  btnDangerToggle?.addEventListener("click", () => {
    const isActive = btnDangerToggle.classList.toggle("active");
    resultFilterDanger = isActive ? "danger" : "";
    applyResultFilters();
  });

  async function loadResultados() {
    if (resultadosLoading) return;

    if (!sessionId) {
      showResultadosEmpty(
        "No hay sesión activa",
        "Regresa al flujo de sesión y ejecuta las evaluaciones para ver resultados."
      );
      return;
    }

    // === CACHE CHECK: Skip fetch if we already have data for this session ===
    const currentCacheVersion = sessionStorage.getItem("evalCacheVersion") || "0";
    if (cachedResultsSessionId === sessionId && cacheVersion === currentCacheVersion && allResults.length > 0) {
      console.log("[EvalSelect] Usando resultados en cache");
      applyResultFilters();
      hideResultadosEmpty();
      return;
    }

    if (!window.cerper || typeof window.cerper.getResultadosPreliminares !== "function") {
      showResultadosEmpty(
        "Resultados no disponibles",
        "Falta la función para cargar resultados. Reinicia la app o revisa la integración."
      );
      return;
    }

    resultadosLoading = true;
    // Show spinner after small delay to avoid flash for quick operations
    let resultSpinnerTimeout = setTimeout(() => {
      const rs = document.getElementById("result-loading-spinner");
      if (rs && resultadosLoading) rs.classList.remove("hidden");
    }, 150);

    // Helper to cleanup spinner
    const cleanupResultSpinner = () => {
      clearTimeout(resultSpinnerTimeout);
      const rs = document.getElementById("result-loading-spinner");
      if (rs) rs.classList.add("hidden");
    };
    hideResultadosEmpty();

    let res;
    try {
      res = await window.cerper.getResultadosPreliminares(sessionId);
    } catch (err) {
      console.error("[EvalSelect] Error obteniendo resultados:", err);
      cleanupResultSpinner();
      showResultadosEmpty("Error al cargar resultados", "No se pudieron obtener los resultados preliminares.");
      resultadosLoading = false;
      return;
    }

    if (!res?.ok) {
      cleanupResultSpinner();
      showResultadosEmpty(
        "Error al cargar resultados",
        "No se pudieron obtener los resultados desde el backend."
      );
      resultadosLoading = false;
      return;
    }

    const results = Array.isArray(res.data) ? res.data : [];
    const lastRunAt = res?.meta?.last_run_at || null;

    if (results.length === 0) {
      cleanupResultSpinner();
      showResultadosEmpty(
        "No hay resultados aún",
        "Ejecuta las evaluaciones para ver los resultados preliminares."
      );
      resultadosLoading = false;
      return;
    }

    // Sort by catalog_id
    allResults = results.sort((a, b) => (a.catalog_id || 0) - (b.catalog_id || 0));

    // Detect if we have multiple levels
    const uniqueResultLevels = new Set(allResults.map(r => r?.nivel).filter(n => n != null));
    hasMultipleResultLevels = uniqueResultLevels.size > 1;

    // Hide nivel dropdown if only one level
    if (dropdownResultNivel) {
      dropdownResultNivel.classList.toggle("hidden", !hasMultipleResultLevels);
    }

    // Format last run date
    let formattedDate = "";
    if (lastRunAt) {
      try {
        const date = new Date(lastRunAt.replace(" ", "T") + "Z");
        formattedDate = date.toLocaleString("es-PE", {
          timeZone: "America/Lima",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        });
      } catch (e) {
        formattedDate = lastRunAt;
      }
    }
    if (resultRunInfo) resultRunInfo.textContent = formattedDate
      ? `Última corrida: ${formattedDate} · ${allResults.length} resultados`
      : `${allResults.length} resultados`;

    // Populate filters
    populateResultFilters();

    // Apply initial filters
    filteredResults = [...allResults];
    renderResultadosList();

    // Mark cache as valid for this session
    cachedResultsSessionId = sessionId;
    cacheVersion = sessionStorage.getItem("evalCacheVersion") || "0";

    // Hide loading spinner
    cleanupResultSpinner();

    resultadosLoading = false;
  }

  // Restore last view (but not configuracion/resultados on page load to avoid confusion)
  const savedView = sessionStorage.getItem("evalSelectView");
  setActiveView(savedView === "visualizaciones" ? "visualizaciones" : "evaluaciones");

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

  // ========================================
  // Parametrizable tests - caches (schemas + saved params)
  // ========================================
  const sessionTestParamsCache = new Map(); // Map<catalogId, params_json>
  const testParamsSchemaCache = new Map(); // Map<catalogId, user_input_schema|null>
  let sessionTestParamsLoaded = false;
  let sessionTestParamsLoading = null;

  async function loadSessionTestParamsCache() {
    if (sessionTestParamsLoaded) return;
    if (sessionTestParamsLoading) return sessionTestParamsLoading;

    sessionTestParamsLoading = (async () => {
      if (!sessionId || !window.cerper?.getAllSessionTestParams) {
        sessionTestParamsLoaded = true;
        return;
      }
      try {
        const savedRes = await window.cerper.getAllSessionTestParams(sessionId);
        if (savedRes?.ok && Array.isArray(savedRes.data)) {
          sessionTestParamsCache.clear();
          for (const row of savedRes.data) {
            sessionTestParamsCache.set(row.catalog_id, row.params_json || {});
          }
          console.log(`[ParamTests] Loaded ${savedRes.data.length} saved param sets`);
        }
        sessionTestParamsLoaded = true;
      } catch (err) {
        console.warn("[ParamTests] Error loading saved params:", err);
        sessionTestParamsLoaded = false;
      } finally {
        sessionTestParamsLoading = null;
      }
    })();

    return sessionTestParamsLoading;
  }

  async function getUserInputSchemaCached(catalogId) {
    if (!catalogId) return null;
    if (testParamsSchemaCache.has(catalogId)) {
      return testParamsSchemaCache.get(catalogId) || null;
    }
    try {
      const schemaRes = await window.cerper.getTestParamsSchema(catalogId);
      const schema = schemaRes?.ok ? schemaRes.data?.user_input_schema || null : null;
      testParamsSchemaCache.set(catalogId, schema);
      return schema;
    } catch (err) {
      console.warn("[ParamTests] Error fetching schema:", err);
      testParamsSchemaCache.set(catalogId, null);
      return null;
    }
  }

  // === Renderizar tarjetas dinámicamente ===
  contenedor.innerHTML = "";
  const seleccionadas = new Set();
  await loadSessionTestParamsCache();


  if (!res.data || res.data.length === 0) {
    contenedor.innerHTML = `<p style="text-align:center; opacity:0.8;">No hay pruebas disponibles para este tipo de análisis.</p>`;
    return;
  }

  // Color palette for card icons (neon/intense variants, no purple-like colors)
  const iconColors = ['cyan', 'teal', 'lime', 'amber', 'orange', 'rose', 'sky', 'yellow'];
  let colorIndex = 0;

  for (const test of res.data) {
    const card = document.createElement("div");
    card.className = "glass-card pokemon-card rounded-2xl overflow-hidden group cursor-pointer";
    card.dataset.catalogId = test.id;

    // Pick a color for this card
    const color = iconColors[colorIndex % iconColors.length];
    colorIndex++;

    // --- Build Pokemon-style card: title + large centered icon
    card.innerHTML = `
      <div class="pokemon-card-inner">
        <span class="status-badge badge-available">Disponible</span>
        <h3 class="pokemon-card-title group-hover:text-${color}-300">${test.titulo}</h3>
        <div class="pokemon-card-icon-wrapper">
          <div class="card-icon text-${color}-400"></div>
        </div>
      </div>
    `;

    // --- Icono (seguro): usa módulo IconSafety
    const rawIcon = (test.icon_value || "").trim();
    const iconSlot = card.querySelector('.card-icon');
    const ok = await window.IconSafety.attachIcon(iconSlot, rawIcon);
    if (!ok) {
      iconSlot.innerHTML = `<i data-lucide="bar-chart-2"></i>`;
    }

    // === Verificar si es aplicable según metadata ===
    const testMeta = resTests.data.find(t => t.id === test.id);
    const aplicable = testMeta ? testMeta.aplicable === 1 : true;

    const statusBadge = card.querySelector('.status-badge');
    if (!aplicable) {
      card.classList.add("blocked");
      statusBadge.className = "status-badge badge-blocked";
      statusBadge.textContent = "No aplicable";
    }

    // === Parametrizable tests: set initial status + selection ===
    const id = test.id;
    const hasSavedParams = sessionTestParamsCache.has(id);
    let cachedSchema = null;
    let isParametrizable = hasSavedParams;
    if (aplicable) {
      cachedSchema = await getUserInputSchemaCached(id);
      if (cachedSchema?.enabled === true) isParametrizable = true;
    }

    if (aplicable && isParametrizable) {
      if (hasSavedParams) {
        seleccionadas.add(id);
        card.classList.add("selected");
        statusBadge.className = "status-badge badge-configured";
        statusBadge.textContent = "Configurada";
      } else {
        statusBadge.className = "status-badge badge-needs-config";
        statusBadge.textContent = "Requiere configuración";
      }
    }

    // === Selección solo si aplicable ===
    card.addEventListener("click", async () => {
      if (isEvaluating) return;
      if (!aplicable) {
        const customMsg = testMeta?.mensaje_no_aplicable;
        notify(customMsg || "No aplicable, condiciones no cumplidas para ejecutar esta prueba", "warning");
        return;
      }
      const id = test.id;

      // Parametrizable tests: always open modal (selection handled by save/delete)
      if (isParametrizable) {
        const opened = await openParamModal(id, test.titulo, card, cachedSchema);
        if (opened) return;
      }

      if (seleccionadas.has(id)) {
        seleccionadas.delete(id);
        card.classList.remove("selected");
        statusBadge.className = "status-badge badge-available";
        statusBadge.textContent = "Disponible";
      } else {
        seleccionadas.add(id);
        card.classList.add("selected");
        statusBadge.className = "status-badge badge-selected";
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
    notify("Ejecutando evaluaciones seleccionadas...", "info");

    try {
      const result = await window.cerper.runEvaluations({
        session_id: sessionId,
        catalog_ids: Array.from(seleccionadas)
      });

      if (!result.ok) {
        throw new Error(result.error || "Error desconocido");
      }

      // Backend starts processing in background - now poll for completion
      console.log("[EvalSelect] Evaluaciones iniciadas, polling progreso...");
      startProgressPolling({
        stopOnTerminal: true,
        skipTerminalRender: false,
        onTerminal: (finalProgress) => {
          isEvaluating = false;
          bloquearBotones(false);

          // Invalidate cache - new results are available
          invalidateCache();

          // Save expected count for validation when clicking Continuar
          if (finalProgress?.total_tasks) {
            expectedResultsCount = finalProgress.total_tasks;
            console.log(`[EvalSelect] Guardando expectedResultsCount: ${expectedResultsCount}`);
          }

          if (finalProgress?.status === "completed") {
            notify("Evaluaciones completadas y guardadas correctamente.", "success");
          } else if (finalProgress?.status === "completed_with_errors") {
            notify("Evaluaciones completadas con algunos errores.", "warning");
          } else {
            notify("Las evaluaciones finalizaron.", "info");
          }

          // Refresh visualizations if on that view
          if (activeView === "visualizaciones") loadVisualizaciones();
          if (activeView === "resultados") loadResultados();
        },
      });

    } catch (err) {
      console.error("[EvalSelect] Error al iniciar evaluaciones:", err);
      notify("Ocurrió un error al iniciar las evaluaciones.", "error");
      setProgressUi({ percent: 0, badgeVariant: "error", badgeText: "Error" });
      clearProgressPolling();
      isEvaluating = false;
      bloquearBotones(false);
    }
  });

  // === Botón CONTINUAR ===
  btnContinuar.addEventListener("click", async () => {
    if (!sessionId) {
      notify("No hay sesión activa.", "error");
      return;
    }

    // Use lightweight endpoint to check results count
    try {
      const statusRes = await window.cerper.getSessionResultsStatus(sessionId);

      if (!statusRes?.ok) {
        // If server is down, allow navigation anyway - pdf_config will validate
        console.warn("[EvalSelect] No se pudo verificar estado, navegando de todos modos...");
        notify("Redirigiendo a configuración de PDF...", "info");
        window.cerper.openPage("pdf_config.html");
        return;
      }

      if (!statusRes.has_results || statusRes.results_count === 0) {
        notify("No hay resultados de evaluación. Ejecuta las pruebas primero.", "warning");
        return;
      }

      // Validate that we have all expected results
      if (expectedResultsCount > 0 && statusRes.results_count < expectedResultsCount) {
        notify(
          `Resultados incompletos: ${statusRes.results_count}/${expectedResultsCount}. ` +
          `Espera a que termine o vuelve a ejecutar.`,
          "warning"
        );
        return;
      }

      console.log(`[EvalSelect] Validación OK: ${statusRes.results_count} resultados`);
      notify("Redirigiendo a configuración de PDF...", "info");
      window.cerper.openPage("pdf_config.html");
    } catch (err) {
      console.error("[EvalSelect] Error checking results:", err);
      // On error, still allow navigation - pdf_config will do final validation
      notify("Redirigiendo a configuración de PDF...", "info");
      window.cerper.openPage("pdf_config.html");
    }
  });

  // ========================================
  // Parametrizable Tests Modal Logic
  // ========================================

  const paramModalBackdrop = document.getElementById("param-modal-backdrop");
  const paramModalTitle = document.getElementById("param-modal-title");
  const paramModalSubtitle = document.getElementById("param-modal-subtitle");
  const paramModalBody = document.getElementById("param-modal-body");
  const paramForm = document.getElementById("param-form");
  const paramValidationErrors = document.getElementById("param-validation-errors");
  const paramModalClose = document.getElementById("param-modal-close");
  const paramModalCancel = document.getElementById("param-modal-cancel");
  const paramModalDelete = document.getElementById("param-modal-delete");
  const paramModalSubmit = document.getElementById("param-modal-submit");

  // State for current parametrizable test being configured
  const paramModalState = {
    isOpen: false,
    currentCatalogId: null,
    currentSchema: null,
    currentCard: null,
    savedParams: sessionTestParamsCache, // Map<catalogId, params>
  };

  // Load saved params for all tests in this session on init
  async function loadAllSessionParams() {
    await loadSessionTestParamsCache();
  }

  // Check if a test is parametrizable (has user_input_schema enabled)
  function isTestParametrizable(testMeta) {
    return testMeta?.parametros_json?.user_input_schema?.enabled === true;
  }

  // Get the schema for a parametrizable test
  function getTestParamSchema(testMeta) {
    return testMeta?.parametros_json?.user_input_schema || null;
  }

  // Open the param modal for a specific test
  async function openParamModal(catalogId, testTitle, card, preloadedSchema = null) {
    // Resolve schema (prefer preloaded/cache)
    let schema = preloadedSchema;
    if (schema) {
      testParamsSchemaCache.set(catalogId, schema);
    } else {
      schema = await getUserInputSchemaCached(catalogId);
    }

    if (!schema || schema.enabled !== true) return false;
    if (!Array.isArray(schema.fields) || schema.fields.length === 0) {
      notify("La prueba tiene un schema de parámetros inválido (sin fields)", "warning");
      return false;
    }

    paramModalState.currentCatalogId = catalogId;
    paramModalState.currentSchema = schema;
    paramModalState.currentCard = card;

    // Toggle delete button based on whether params exist
    if (paramModalDelete) {
      const hasSaved = paramModalState.savedParams.has(catalogId);
      paramModalDelete.classList.toggle("hidden", !hasSaved);
    }

    // Update modal header
    if (paramModalTitle) paramModalTitle.textContent = schema.layout?.title || "Configurar Parámetros";
    if (paramModalSubtitle) paramModalSubtitle.textContent = `Prueba: ${testTitle}`;

    // Generate form fields
    generateParamForm(schema, paramModalState.savedParams.get(catalogId) || {});

    // Clear validation errors
    if (paramValidationErrors) {
      paramValidationErrors.innerHTML = "";
      paramValidationErrors.classList.add("hidden");
    }

    // Open modal
    if (paramModalBackdrop) {
      paramModalBackdrop.classList.add("visible");
      paramModalState.isOpen = true;
      return true;
    }
    return false;
  }

  // Close the param modal
  function closeParamModal() {
    if (paramModalBackdrop) {
      paramModalBackdrop.classList.remove("visible");
    }
    clearParamValidationErrors();
    paramModalDelete?.classList.add("hidden");
    paramModalState.isOpen = false;
    paramModalState.currentCatalogId = null;
    paramModalState.currentSchema = null;
    paramModalState.currentCard = null;
    if (paramForm) paramForm.innerHTML = "";
  }

  // Generate dynamic form fields from schema
  function generateParamForm(schema, savedValues) {
    if (!paramForm) return;
    paramForm.innerHTML = "";

    const fields = schema.fields || [];
    for (const field of fields) {
      const fieldType = String(field.type || "").toLowerCase();
      const fieldWrapper = document.createElement("div");
      fieldWrapper.className = "param-field";
      fieldWrapper.dataset.fieldName = field.name;

      // Label
      const label = document.createElement("label");
      label.className = "param-field-label";
      label.innerHTML = `${field.label || field.name}${field.required ? ' <span class="required-mark">*</span>' : ''}`;
      fieldWrapper.appendChild(label);

      // Description
      if (field.description) {
        const desc = document.createElement("p");
        desc.className = "param-field-description";
        desc.textContent = field.description;
        fieldWrapper.appendChild(desc);
      }

      // Input based on type
      const savedValue = savedValues[field.name];

      if (fieldType === "boolean" || fieldType === "checkbox") {
        // Checkbox
        const checkWrapper = document.createElement("div");
        checkWrapper.className = "param-checkbox-wrapper";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "param-checkbox";
        checkbox.id = `param-${field.name}`;
        checkbox.name = field.name;
        checkbox.checked = savedValue !== undefined ? Boolean(savedValue) : Boolean(field.default);

        const checkLabel = document.createElement("label");
        checkLabel.htmlFor = checkbox.id;
        checkLabel.textContent = "Activar";
        checkLabel.style.cursor = "pointer";
        checkLabel.style.fontSize = "0.875rem";
        checkLabel.style.color = "#475569";

        checkWrapper.appendChild(checkbox);
        checkWrapper.appendChild(checkLabel);
        fieldWrapper.appendChild(checkWrapper);

      } else if (fieldType === "select") {
        // Select dropdown
        const rawOptions = Array.isArray(field.options) && field.options.length
          ? field.options
          : Array.isArray(field.enum) && field.enum.length
            ? field.enum
            : [];

        const select = document.createElement("select");
        select.className = "param-select";
        select.name = field.name;
        select.id = `param-${field.name}`;

        const defaultOpt = document.createElement("option");
        defaultOpt.value = "";
        defaultOpt.textContent = "Seleccionar...";
        select.appendChild(defaultOpt);

        for (const opt of rawOptions) {
          const optValue =
            opt && typeof opt === "object"
              ? opt.value ?? opt.id ?? opt.key ?? opt.label
              : opt;
          const optLabel =
            opt && typeof opt === "object"
              ? opt.label ?? opt.name ?? optValue
              : optValue;

          const option = document.createElement("option");
          option.value = String(optValue ?? "");
          option.textContent = String(optLabel ?? "");
          if ((savedValue !== undefined && String(savedValue) === String(optValue)) ||
              (savedValue === undefined && String(field.default) === String(optValue))) {
            option.selected = true;
          }
          select.appendChild(option);
        }

        fieldWrapper.appendChild(select);

      } else if (fieldType === "range") {
        // Range input (min/max)
        const rangeWrapper = document.createElement("div");
        rangeWrapper.className = "param-range-wrapper";

        const inputsWrapper = document.createElement("div");
        inputsWrapper.className = "param-range-inputs";

        const minInput = document.createElement("input");
        minInput.type = "number";
        minInput.className = "param-input";
        minInput.name = `${field.name}_min`;
        minInput.id = `param-${field.name}-min`;
        minInput.placeholder = "Min";
        if (field.validation?.min !== undefined) minInput.min = field.validation.min;
        if (field.validation?.step !== undefined) minInput.step = field.validation.step;
        if (savedValue?.min !== undefined) {
          minInput.value = savedValue.min;
        } else if (field.default?.min !== undefined) {
          minInput.value = field.default.min;
        }

        const separator = document.createElement("span");
        separator.className = "param-range-separator";
        separator.textContent = "—";

        const maxInput = document.createElement("input");
        maxInput.type = "number";
        maxInput.className = "param-input";
        maxInput.name = `${field.name}_max`;
        maxInput.id = `param-${field.name}-max`;
        maxInput.placeholder = "Max";
        if (field.validation?.max !== undefined) maxInput.max = field.validation.max;
        if (field.validation?.step !== undefined) maxInput.step = field.validation.step;
        if (savedValue?.max !== undefined) {
          maxInput.value = savedValue.max;
        } else if (field.default?.max !== undefined) {
          maxInput.value = field.default.max;
        }

        inputsWrapper.appendChild(minInput);
        inputsWrapper.appendChild(separator);
        inputsWrapper.appendChild(maxInput);
        rangeWrapper.appendChild(inputsWrapper);

        // Visual slider track (optional enhancement)
        const sliderTrack = document.createElement("div");
        sliderTrack.className = "param-range-slider";
        const sliderFill = document.createElement("div");
        sliderFill.className = "param-range-track";
        sliderTrack.appendChild(sliderFill);
        rangeWrapper.appendChild(sliderTrack);

        const sliderMin = field.validation?.min !== undefined ? Number(field.validation.min) : null;
        const sliderMax = field.validation?.max !== undefined ? Number(field.validation.max) : null;

        const candidates = [];
        if (savedValue && typeof savedValue === "object") {
          if (Number.isFinite(Number(savedValue.min))) candidates.push(Number(savedValue.min));
          if (Number.isFinite(Number(savedValue.max))) candidates.push(Number(savedValue.max));
        }
        if (field.default && typeof field.default === "object") {
          if (Number.isFinite(Number(field.default.min))) candidates.push(Number(field.default.min));
          if (Number.isFinite(Number(field.default.max))) candidates.push(Number(field.default.max));
        }

        const inferredMin = candidates.length ? Math.min(...candidates) : 0;
        const inferredMax = candidates.length ? Math.max(...candidates) : inferredMin + 1;

        const trackMin = Number.isFinite(sliderMin) ? sliderMin : inferredMin;
        const trackMax = Number.isFinite(sliderMax) ? sliderMax : inferredMax;

        const updateTrack = () => {
          const denom = trackMax - trackMin;
          if (!Number.isFinite(denom) || denom <= 0) {
            sliderFill.style.left = "0%";
            sliderFill.style.width = "0%";
            return;
          }

          const minValRaw = Number(minInput.value);
          const maxValRaw = Number(maxInput.value);
          const minVal = Number.isFinite(minValRaw) ? minValRaw : trackMin;
          const maxVal = Number.isFinite(maxValRaw) ? maxValRaw : trackMax;

          const leftPct = ((Math.min(minVal, maxVal) - trackMin) / denom) * 100;
          const rightPct = ((Math.max(minVal, maxVal) - trackMin) / denom) * 100;
          sliderFill.style.left = `${Math.max(0, Math.min(100, leftPct))}%`;
          sliderFill.style.width = `${Math.max(0, Math.min(100, rightPct)) - Math.max(0, Math.min(100, leftPct))}%`;
        };

        minInput.addEventListener("input", updateTrack);
        maxInput.addEventListener("input", updateTrack);
        updateTrack();

        fieldWrapper.appendChild(rangeWrapper);

      } else {
        // Default: number or text input
        const input = document.createElement("input");
        input.type = fieldType === "number" ? "number" : "text";
        input.className = "param-input";
        input.name = field.name;
        input.id = `param-${field.name}`;
        input.placeholder = field.placeholder || `Ingrese ${(field.label || field.name).toLowerCase()}`;

        if (fieldType === "number") {
          if (field.validation?.min !== undefined) input.min = field.validation.min;
          if (field.validation?.max !== undefined) input.max = field.validation.max;
          if (field.validation?.step !== undefined) input.step = field.validation.step;
        }

        if (savedValue !== undefined) {
          input.value = savedValue;
        } else if (field.default !== undefined) {
          input.value = field.default;
        }

        fieldWrapper.appendChild(input);
      }

      paramForm.appendChild(fieldWrapper);
    }
  }

  // Validate form values against schema
  function validateParamForm(schema, values) {
    const errors = {};
    const fields = schema.fields || [];

    for (const field of fields) {
      const fieldType = String(field.type || "").toLowerCase();
      const value = values[field.name];

      // Required validation
      if (field.required) {
        if (fieldType === "range") {
          if (value?.min === undefined || value?.min === "" || value?.max === undefined || value?.max === "") {
            errors[field.name] = `${field.label || field.name} es requerido (min y max)`;
            continue;
          }
        } else if (value === undefined || value === null || value === "") {
          errors[field.name] = `${field.label || field.name} es requerido`;
          continue;
        }
      }

      // Skip further validation if empty and not required
      if (value === undefined || value === null || value === "") continue;

      // Type-specific validation
      if (fieldType === "number") {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors[field.name] = `${field.label || field.name} debe ser un número válido`;
          continue;
        }
        if (field.validation?.min !== undefined && numValue < field.validation.min) {
          errors[field.name] = `${field.label || field.name} debe ser >= ${field.validation.min}`;
        }
        if (field.validation?.max !== undefined && numValue > field.validation.max) {
          errors[field.name] = `${field.label || field.name} debe ser <= ${field.validation.max}`;
        }
      }

      if (fieldType === "range" && value) {
        const minVal = Number(value.min);
        const maxVal = Number(value.max);
        if (isNaN(minVal) || isNaN(maxVal)) {
          errors[field.name] = `${field.label || field.name} debe tener valores numéricos válidos`;
          continue;
        }
        if (maxVal <= minVal) {
          errors[field.name] = `${field.label || field.name}: el máximo debe ser mayor que el mínimo`;
        }
        if (field.validation?.min !== undefined && minVal < field.validation.min) {
          errors[field.name] = `${field.label || field.name}: mínimo debe ser >= ${field.validation.min}`;
        }
        if (field.validation?.max !== undefined && maxVal > field.validation.max) {
          errors[field.name] = `${field.label || field.name}: máximo debe ser <= ${field.validation.max}`;
        }
      }

      if (fieldType === "select") {
        const allowedOptions =
          (Array.isArray(field.options) && field.options.length ? field.options : null) ||
          (Array.isArray(field.enum) && field.enum.length ? field.enum : null) ||
          (Array.isArray(field.validation?.enum) && field.validation.enum.length ? field.validation.enum : null);
        if (allowedOptions) {
          const allowed = new Set(allowedOptions.map((opt) => String(opt && typeof opt === "object" ? (opt.value ?? opt.id ?? opt.key ?? opt.label) : opt)));
          if (!allowed.has(String(value))) {
            errors[field.name] = `${field.label || field.name} tiene un valor no permitido`;
          }
        }
      }

      if (fieldType === "text" || fieldType === "string") {
        const pattern = field.validation?.pattern;
        if (pattern) {
          try {
            const re = new RegExp(pattern);
            if (!re.test(String(value))) {
              errors[field.name] = `${field.label || field.name} no cumple el formato requerido`;
            }
          } catch (reErr) {
            console.warn("[ParamModal] Invalid regex pattern:", pattern, reErr);
          }
        }
      }

      // Cross-field validation (gt_field, lt_field)
      if (field.validation?.gt_field) {
        const otherValue = values[field.validation.gt_field];
        if (otherValue !== undefined && Number(value) <= Number(otherValue)) {
          errors[field.name] = `${field.label || field.name} debe ser mayor que ${field.validation.gt_field}`;
        }
      }
      if (field.validation?.lt_field) {
        const otherValue = values[field.validation.lt_field];
        if (otherValue !== undefined && Number(value) >= Number(otherValue)) {
          errors[field.name] = `${field.label || field.name} debe ser menor que ${field.validation.lt_field}`;
        }
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  // Collect form values
  function collectParamFormValues(schema) {
    const values = {};
    const fields = schema.fields || [];

    for (const field of fields) {
      const fieldType = String(field.type || "").toLowerCase();
      if (fieldType === "boolean" || fieldType === "checkbox") {
        const checkbox = document.getElementById(`param-${field.name}`);
        values[field.name] = checkbox ? checkbox.checked : false;
      } else if (fieldType === "range") {
        const minInput = document.getElementById(`param-${field.name}-min`);
        const maxInput = document.getElementById(`param-${field.name}-max`);
        values[field.name] = {
          min: minInput?.value ? Number(minInput.value) : undefined,
          max: maxInput?.value ? Number(maxInput.value) : undefined,
        };
      } else if (fieldType === "number") {
        const input = document.getElementById(`param-${field.name}`);
        values[field.name] = input?.value ? Number(input.value) : undefined;
      } else {
        const input = document.getElementById(`param-${field.name}`);
        values[field.name] = input?.value || undefined;
      }
    }

    return values;
  }

  // Show validation errors in modal
  function showParamValidationErrors(errors) {
    if (!paramValidationErrors) return;
    paramValidationErrors.innerHTML = "";

    for (const [fieldName, message] of Object.entries(errors)) {
      const item = document.createElement("div");
      item.className = "param-error-item";
      item.innerHTML = `<span>⚠</span> ${message}`;
      paramValidationErrors.appendChild(item);

      // Highlight field with error
      const fieldWrapper = document.querySelector(`[data-field-name="${fieldName}"]`);
      if (fieldWrapper) {
        const input = fieldWrapper.querySelector("input, select");
        if (input) input.classList.add("error");
      }
    }

    paramValidationErrors.classList.remove("hidden");
  }

  // Clear error highlights
  function clearParamValidationErrors() {
    if (paramValidationErrors) {
      paramValidationErrors.innerHTML = "";
      paramValidationErrors.classList.add("hidden");
    }
    document.querySelectorAll(".param-input.error, .param-select.error").forEach(el => {
      el.classList.remove("error");
    });
  }

  // Save params and update card state
  async function saveParamsAndSelect() {
    if (!paramModalState.currentSchema || !paramModalState.currentCatalogId) return;

    clearParamValidationErrors();

    const values = collectParamFormValues(paramModalState.currentSchema);
    const validation = validateParamForm(paramModalState.currentSchema, values);

    if (!validation.valid) {
      showParamValidationErrors(validation.errors);
      return;
    }

    // Save to backend
    try {
      const res = await window.cerper.saveSessionTestParams({
        sessionId,
        catalogId: paramModalState.currentCatalogId,
        params: values,
      });

      if (!res?.ok) {
        throw new Error(res?.error || "Error al guardar");
      }

      // Update local cache
      paramModalState.savedParams.set(paramModalState.currentCatalogId, values);

      // Update card UI
      const card = paramModalState.currentCard;
      const catalogId = paramModalState.currentCatalogId;

      if (card) {
        seleccionadas.add(catalogId);
        card.classList.add("selected");
        const statusBadge = card.querySelector(".status-badge");
        if (statusBadge) {
          statusBadge.className = "status-badge badge-configured";
          statusBadge.textContent = "Configurada";
        }
      }

      notify("Parámetros guardados correctamente", "success");
      closeParamModal();

    } catch (err) {
      console.error("[ParamModal] Error saving params:", err);
      notify("Error al guardar parámetros", "error");
    }
  }

  // Delete params for a test
  async function deleteTestParams(catalogId) {
    if (!sessionId) return;
    try {
      await window.cerper.deleteSessionTestParams(sessionId, catalogId);
      paramModalState.savedParams.delete(catalogId);
    } catch (err) {
      console.warn("[ParamModal] Error deleting params:", err);
    }
  }

  async function deleteParamsAndDeselect() {
    const catalogId = paramModalState.currentCatalogId;
    if (!catalogId) return;
    const card = paramModalState.currentCard;

    const ok = window.confirm("¿Quitar configuración y deseleccionar esta prueba?");
    if (!ok) return;

    await deleteTestParams(catalogId);

    // Update UI + selection state
    seleccionadas.delete(catalogId);
    if (card) {
      card.classList.remove("selected");
      const statusBadge = card.querySelector(".status-badge");
      if (statusBadge) {
        statusBadge.className = "status-badge badge-needs-config";
        statusBadge.textContent = "Requiere configuración";
      }
    }

    notify("Configuración eliminada", "success");
    closeParamModal();
  }

  // Event listeners for modal
  paramModalClose?.addEventListener("click", closeParamModal);
  paramModalCancel?.addEventListener("click", closeParamModal);
  paramModalDelete?.addEventListener("click", deleteParamsAndDeselect);
  paramModalSubmit?.addEventListener("click", saveParamsAndSelect);

  paramModalBackdrop?.addEventListener("click", (e) => {
    if (e.target === paramModalBackdrop) closeParamModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && paramModalState.isOpen) {
      closeParamModal();
    }
  });

  // Load saved params on init
  loadAllSessionParams();

  // Export functions for external use
  window.ParamModal = {
    open: openParamModal,
    close: closeParamModal,
    isParametrizable: isTestParametrizable,
    getSchema: getTestParamSchema,
    hasSavedParams: (catalogId) => paramModalState.savedParams.has(catalogId),
    getSavedParams: (catalogId) => paramModalState.savedParams.get(catalogId),
    deleteParams: deleteTestParams,
  };
});

// === Notificaciones flotantes ===
// NOTE: notify() is now provided by js/notify.js (centralized module)
// Ensure evaluation_select.html includes <script src="js/notify.js"></script>
