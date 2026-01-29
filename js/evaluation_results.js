document.addEventListener("DOMContentLoaded", async () => {
  const btnVolver = document.getElementById("go-back");
  const menuVisualizaciones = document.getElementById("menu-visualizaciones");
  const menuConfiguracion = document.getElementById("menu-configuracion");
  const viewVisualizaciones = document.getElementById("view-visualizaciones");
  const viewConfiguracion = document.getElementById("view-configuracion");
  const emptyState = document.getElementById("empty-state");
  const emptyTitle = document.getElementById("empty-title");
  const emptyText = document.getElementById("empty-text");
  const runInfo = document.getElementById("run-info");

  function readResultsSessionId() {
    return (
      sessionStorage.getItem("evalResultsSessionId") ||
      sessionStorage.getItem("evalSelectSessionId") ||
      sessionStorage.getItem("sessionSeleccionada") ||
      sessionStorage.getItem("sessionID")
    );
  }

  function setCanonicalResultsSessionId(sessionId) {
    if (!sessionId) return;
    try {
      const sid = String(sessionId);
      sessionStorage.setItem("sessionSeleccionada", sid);
      // Mantener un ID separado para visualizaciones (solo lectura).
      sessionStorage.setItem("evalResultsSessionId", sid);
    } catch (_) { }
  }

  // New visualization UI elements - Custom Dropdowns
  const dropdownNivel = document.getElementById("dropdown-nivel");
  const dropdownAnalito = document.getElementById("dropdown-analito");
  const dropdownPrueba = document.getElementById("dropdown-prueba");
  const btnVizRolodex = document.getElementById("btn-viz-rolodex");
  const btnVizList = document.getElementById("btn-viz-list");
  const btnCardTheme = document.getElementById("btn-card-theme");
  const btnVizDangerToggle = document.getElementById("btn-viz-danger-toggle");
  const btnVizFullscreen = document.getElementById("btn-viz-fullscreen");
  const vizRolodexView = document.getElementById("viz-rolodex-view");
  const vizListView = document.getElementById("viz-list-view");
  const vizCardsContainer = document.getElementById("viz-cards-container");
  const vizListContainer = document.getElementById("viz-list-container");
  const vizTimelineTrack = document.getElementById("viz-timeline-track");
  const vizHoverPreview = document.getElementById("viz-hover-preview");
  const vizHoverImage = document.getElementById("viz-hover-image");

  let activeView = "visualizaciones";
  let visualizacionesLoading = false;

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
    console.warn("[EvalResults] No se pudo obtener usuario:", err);
  }

  // === Configuración dinámica de formateo (dataframes) ===
  try {
    await window.DataframeRenderer?.loadConfig?.();
  } catch (err) {
    console.warn("[EvalResults] No se pudo cargar formatting config:", err);
  }

  // --- Boton Volver ---
  if (btnVolver) {
    btnVolver.addEventListener("click", () => {
      const sid = readResultsSessionId();
      setCanonicalResultsSessionId(sid);

      const target = "session_detail.html";
      if (window.cerper && window.cerper.openPage) window.cerper.openPage(target);
      else window.location.href = target;
    });
  }

  // === Obtener contexto de sesión ===
  let labKey =
    sessionStorage.getItem("labSeleccionado") ||
    localStorage.getItem("labSeleccionado");
  let tipoAnalisis = sessionStorage.getItem("tipoAnalisis");
  let tipoDato = sessionStorage.getItem("tipoDato");
  let modoCualitativo = sessionStorage.getItem("modoCualitativo");
  let sessionId = readResultsSessionId();
  setCanonicalResultsSessionId(sessionId);
  sessionId = readResultsSessionId();

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
      console.warn("[EvalResults] No se pudo hidratar sesión:", err);
    }
  }

  function setMenuActiveState(el, isActive) {
    if (!el) return;
    el.classList.toggle("active", isActive);
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
        "No se encontró la sesión",
        "Abre este reporte desde el panel de sesiones o reportes para ver las visualizaciones."
      );
      return;
    }

    // === CACHE CHECK: Skip fetch if we already have data for this session ===
    const currentCacheVersion = sessionStorage.getItem("evalCacheVersion") || "0";
    if (cachedGraphsSessionId === sessionId && cacheVersion === currentCacheVersion && allGraphs.length > 0) {
      console.log("[EvalResults] Usando gráficos en cache");
      applyFilters();
      setVizView(vizCurrentView);
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
      console.error("[EvalResults] Error obteniendo gráficos:", err);
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
          "No hay gráficos para esta sesión",
          "Esta sesión aún no tiene una corrida registrada, por lo que no hay gráficos para mostrar."
        );
        visualizacionesLoading = false;
        return;
      }
      showVisualizacionesEmpty(
        "No hay gráficos para esta sesión",
        "Se encontró una corrida registrada para esta sesión, pero no se encontraron gráficos guardados."
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

  // Fullscreen image modal
  function showFullscreenImage() {
    if (filteredGraphs.length === 0 || vizActiveIndex < 0) return;
    const g = filteredGraphs[vizActiveIndex];
    if (!g?.grafico_data) return;

    const title = g?.test_titulo || g?.nombre_interno || "Visualización";
    const subtitleParts = [];
    if (g?.analito) subtitleParts.push(g.analito);
    if (hasMultipleLevels && g?.nivel != null) subtitleParts.push(`Nivel ${g.nivel}`);
    const subtitle = subtitleParts.join(" · ");

    // Remove any existing overlay
    const existing = document.querySelector(".cs-inline-modal-overlay");
    if (existing) existing.remove();

    // Create overlay with dark variant
    const overlay = document.createElement("div");
    overlay.className = "cs-inline-modal-overlay cs-inline-modal-overlay--dark";

    // Create modal with image viewer variant
    const modal = document.createElement("div");
    modal.className = "cs-inline-modal cs-inline-modal--image-viewer";

    modal.innerHTML = `
      <div class="cs-inline-modal__header">
        <div class="cs-inline-modal__header-info">
          <span class="cs-inline-modal__badge">#${vizActiveIndex + 1}</span>
          <div>
            <h3 class="cs-inline-modal__header-title">${title}</h3>
            ${subtitle ? `<p class="cs-inline-modal__header-subtitle">${subtitle}</p>` : ""}
          </div>
        </div>
        <button class="cs-inline-modal__close-btn" aria-label="Cerrar">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="cs-inline-modal__image-container">
        <img class="cs-inline-modal__image" src="${g.grafico_data}" alt="${title}">
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close handlers
    const closeModal = () => {
      overlay.classList.add("is-closing");
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    modal.querySelector(".cs-inline-modal__close-btn")?.addEventListener("click", closeModal);

    document.addEventListener("keydown", function escHandler(e) {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", escHandler);
      }
    });
  }

  // Fullscreen button event listener
  btnVizFullscreen?.addEventListener("click", showFullscreenImage);

  // Keyboard navigation
  document.addEventListener("keydown", handleVizKeydown);

  function setActiveView(nextView) {
    const validViews = ["visualizaciones", "resultados", "configuracion"];
    activeView = validViews.includes(nextView) ? nextView : "visualizaciones";
    sessionStorage.setItem("evalResultsView", activeView);

    if (viewVisualizaciones)
      viewVisualizaciones.classList.toggle("hidden", activeView !== "visualizaciones");
    if (viewConfiguracion)
      viewConfiguracion.classList.toggle("hidden", activeView !== "configuracion");
    if (viewResultados) viewResultados.classList.toggle("hidden", activeView !== "resultados");

    setMenuActiveState(menuVisualizaciones, activeView === "visualizaciones");
    setMenuActiveState(menuResultados, activeView === "resultados");
    setMenuActiveState(menuConfiguracion, activeView === "configuracion");

    if (activeView === "visualizaciones") loadVisualizaciones();
    if (activeView === "resultados") loadResultados();
  }

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
        "No se encontró la sesión",
        "Abre este reporte desde el panel de sesiones o reportes para ver los resultados."
      );
      return;
    }

    // === CACHE CHECK: Skip fetch if we already have data for this session ===
    const currentCacheVersion = sessionStorage.getItem("evalCacheVersion") || "0";
    if (cachedResultsSessionId === sessionId && cacheVersion === currentCacheVersion && allResults.length > 0) {
      console.log("[EvalResults] Usando resultados en cache");
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
      console.error("[EvalResults] Error obteniendo resultados:", err);
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
        "No hay resultados para esta sesión",
        "No se encontraron resultados preliminares guardados para esta sesión."
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

  if (!sessionId) {
    notify("No hay sesión seleccionada para mostrar resultados.", "error");
    const fallback = "sessions_panel.html";
    if (window.cerper && typeof window.cerper.openPage === "function") window.cerper.openPage(fallback);
    else window.location.href = fallback;
    return;
  }

  // Restore last view (results/visualizations only)
  const savedView = sessionStorage.getItem("evalResultsView");
  setActiveView(savedView === "resultados" || savedView === "configuracion" ? savedView : "visualizaciones");
});
