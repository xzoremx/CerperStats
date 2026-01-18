document.addEventListener("DOMContentLoaded", async () => {
  const usuario = sessionStorage.getItem("usuario");
  const rol = sessionStorage.getItem("rol");
  const primaryDefaultLab = (sessionStorage.getItem("default_lab") || "").trim() || null;
  let defaultLabs = null;
  try {
    const raw = sessionStorage.getItem("default_labs");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        defaultLabs = parsed.map((v) => String(v || "").trim()).filter(Boolean);
      }
    }
  } catch (_) { }
  if (!defaultLabs || defaultLabs.length === 0) {
    defaultLabs = primaryDefaultLab ? [primaryDefaultLab] : [];
  }
  if (defaultLabs.length > 2) defaultLabs = defaultLabs.slice(0, 2);

  if (!usuario) {
    if (window.cerper?.openPage) window.cerper.openPage("login.html");
    else window.location.href = "login.html";
    return;
  }

  if (rol === "analista") {
    window.notify?.("No tienes acceso a esta página.", "error");
    setTimeout(() => {
      if (window.cerper?.openPage) window.cerper.openPage("menu.html");
      else window.location.href = "menu.html";
    }, 1200);
    return;
  }

  const selLab = document.getElementById('filter-lab');
  const selProc = document.getElementById('filter-proc');
  const selAnalisis = document.getElementById('filter-analisis');

  // New filter controls
  const analisisGroup = document.getElementById('filter-analisis-group');
  const procGroup = document.getElementById('filter-proc-group');

  // Lab sidebar elements
  const labSidebar = document.getElementById('lab-sidebar');
  const labSidebarTrack = document.getElementById('lab-sidebar-track');

  // Date filter elements (simplified to just range)
  const dateFromInput = document.getElementById('filter-date-from');
  const dateToInput = document.getElementById('filter-date-to');
  const fechaClearBtn = document.getElementById('fecha-clear-btn');

  // Filter state for new controls
  let currentAnalisis = 'all';
  let currentProc = 'all';
  let labOptions = [];
  let currentLabValue = 'all';

  // View mode state (grid or list)
  let currentViewMode = 'list';

  let allSessions = [];


  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeTipoAnalisis(value) {
    const norm = normalizeText(value);
    if (!norm) return null;
    if (norm === 'multi' || norm === 'multianalito' || norm.includes('multi')) return 'multi';
    if (norm === 'mono' || norm === 'monoanalito' || norm.includes('mono')) return 'mono';
    return norm;
  }

  // Shorten lab names for display: "Laboratorio de X" -> "Lab. de X"
  function shortenLabName(name) {
    if (!name) return name;
    return name
      .replace(/^Laboratorio\s+/i, 'Lab. ')
      .replace(/\s+de\s+Laboratorio\s+/gi, ' de Lab. ');
  }

  // Lab sidebar helper functions
  function renderLabSidebar() {
    if (!labSidebarTrack) return;
    labSidebarTrack.innerHTML = '';

    labOptions.forEach((opt) => {
      const marker = document.createElement('div');
      marker.className = 'lab-sidebar-marker' + (opt.value === currentLabValue ? ' active' : '');
      marker.dataset.value = opt.value;

      const label = document.createElement('span');
      label.className = 'lab-sidebar-label';
      label.textContent = shortenLabName(opt.text);

      const bar = document.createElement('div');
      bar.className = 'lab-sidebar-marker-bar';

      marker.appendChild(bar);
      marker.appendChild(label);

      // Click handler
      marker.addEventListener('click', () => {
        selectLab(opt.value);
      });

      labSidebarTrack.appendChild(marker);
    });
  }

  function selectLab(value) {
    currentLabValue = value;

    // Update active class on markers
    const markers = labSidebarTrack?.querySelectorAll('.lab-sidebar-marker');
    markers?.forEach(m => {
      m.classList.toggle('active', m.dataset.value === value);
    });

    // Sync hidden select
    if (selLab) {
      selLab.value = value;
    }

    // Reload sessions with new lab filter
    if (rol === 'admin') {
      loadSessions().catch(console.error);
    }
  }

  // Initialize lab sidebar based on role
  if (rol === 'supervisor') {
    // Supervisor: show only their assigned labs (max 2)
    if (!defaultLabs || defaultLabs.length === 0) {
      // Hide sidebar if no labs assigned
      labSidebar?.classList.add('hidden');
    } else {
      // Build labOptions from defaultLabs
      labOptions = defaultLabs.map(labKey => ({
        value: labKey,
        text: labKey // Will be replaced with actual name if available
      }));
      // Try to get lab names
      try {
        const labs = await window.cerper.getLabs();
        const labMap = new Map(labs.map(l => [l.lab_key || l.key, l.nombre || l.name || l.lab_key || l.key]));
        labOptions = labOptions.map(opt => ({
          value: opt.value,
          text: labMap.get(opt.value) || opt.value
        }));
      } catch (_) { /* ignore, use keys as names */ }

      // Populate hidden select
      if (selLab) {
        selLab.innerHTML = '';
        labOptions.forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.text;
          selLab.appendChild(o);
        });
        if (labOptions.length > 0) {
          selLab.value = labOptions[0].value;
          currentLabValue = labOptions[0].value;
        }
      }

      renderLabSidebar();
    }
  } else {
    // Admin: show all labs with "Todos" option
    try {
      const labs = await window.cerper.getLabs();
      labOptions = [{ value: 'all', text: 'Todos' }];
      if (selLab) {
        selLab.innerHTML = '';
        const optAll = document.createElement('option');
        optAll.value = 'all'; optAll.textContent = 'Todos';
        selLab.appendChild(optAll);
        labs.forEach(l => {
          const key = l.lab_key || l.key;
          if (!key) return;
          const name = l.nombre || l.name || key;
          const o = document.createElement('option');
          o.value = key;
          o.textContent = name;
          selLab.appendChild(o);
          labOptions.push({ value: key, text: name });
        });
        selLab.value = 'all';
      }
      renderLabSidebar();
    } catch (e) {
      console.warn('[SessionsPanel] No se pudieron cargar labs', e);
      labSidebar?.classList.add('hidden');
    }
  }

  async function loadSessions() {
    if (rol === 'supervisor' && (!defaultLabs || defaultLabs.length === 0)) {
      allSessions = [];
      renderSesiones([]);
      window.notify?.("No tienes laboratorios asignados.", "error");
      return;
    }

    const labFilter =
      (rol === 'admin')
        ? (currentLabValue === 'all' ? null : currentLabValue)
        : (rol === 'supervisor' ? (currentLabValue || defaultLabs) : primaryDefaultLab);

    const res = await window.cerper.getSessionsByRole({ rol, labDefault: labFilter || null });
    if (!res.ok) throw new Error(res.error);
    allSessions = res.data || [];
    applyFilters();
  }

  function parseSessionDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  }

  function applyFilters() {
    const proc = currentProc.toLowerCase();
    const analisis = currentAnalisis.toLowerCase();
    let data = allSessions;

    // Filter by procedure
    if (proc !== 'all') {
      data = data.filter(s => (s.procedure || '').toLowerCase() === proc);
    }

    // Filter by analysis type
    if (analisis !== 'all') {
      data = data.filter(s => normalizeTipoAnalisis(s.tipo_analisis) === analisis);
    }

    // Filter by date range
    const fromValue = dateFromInput?.value;
    const toValue = dateToInput?.value;

    if (fromValue || toValue) {
      const fromDate = fromValue ? new Date(fromValue + 'T00:00:00') : null;
      const toDate = toValue ? new Date(toValue + 'T23:59:59') : null;

      data = data.filter(s => {
        const sessionDate = parseSessionDate(s.creado_en);
        if (!sessionDate) return false;
        if (fromDate && sessionDate < fromDate) return false;
        if (toDate && sessionDate > toDate) return false;
        return true;
      });
    }

    renderSesiones(data, currentViewMode);
  }


  selLab?.addEventListener('change', () => { if (rol === 'admin') loadSessions().catch(console.error); });

  // Estructura button event handlers
  if (analisisGroup) {
    const analisisBtns = analisisGroup.querySelectorAll('.estructura-btn');
    analisisBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active state
        analisisBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update state and filter
        currentAnalisis = btn.dataset.value || 'all';
        if (selAnalisis) selAnalisis.value = currentAnalisis;
        applyFilters();
      });
    });
  }

  // Procedimiento grid buttons event handlers
  if (procGroup) {
    const procBtns = procGroup.querySelectorAll('.proc-grid-item');
    procBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active state
        procBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update state and filter
        currentProc = btn.dataset.value || 'all';
        if (selProc) selProc.value = currentProc;
        applyFilters();
      });
    });
  }

  // Date input change listeners
  dateFromInput?.addEventListener('change', applyFilters);
  dateToInput?.addEventListener('change', applyFilters);

  // Clear date button
  fechaClearBtn?.addEventListener('click', () => {
    if (dateFromInput) dateFromInput.value = '';
    if (dateToInput) dateToInput.value = '';
    applyFilters();
  });

  // View toggle event handlers
  const viewToggle = document.getElementById('view-toggle');
  if (viewToggle) {
    const viewBtns = viewToggle.querySelectorAll('.view-toggle-btn');
    viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const newView = btn.dataset.view || 'grid';
        if (newView === currentViewMode) return;

        // Update active state
        viewBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update state and re-render
        currentViewMode = newView;
        applyFilters();
      });
    });
  }

  try { await loadSessions(); } catch (err) {
    console.error('[SessionsPanel] Error:', err);
    const msg = err?.message ? `Error al cargar las sesiones: ${err.message}` : 'Error al cargar las sesiones.';
    window.notify?.(msg, 'error');
  }

  document.getElementById("btn-volver")?.addEventListener("click", () => {
    if (window.cerper?.openPage) window.cerper.openPage("procedure_select.html");
    else window.location.href = "procedure_select.html";
  });
});

// Helper functions (outside render for performance)
const PROC_INFO_MAP = {
  autorizaciones: { abbr: 'AUT', cls: 'proc-aut' },
  implementaciones: { abbr: 'IMP', cls: 'proc-imp' },
  intralaboratorios: { abbr: 'INTRA', cls: 'proc-intra' },
  'intercomparación': { abbr: 'INTER', cls: 'proc-inter' }
};

const STATUS_MAP = {
  activa: 'status-light-active',
  activo: 'status-light-active',
  abierta: 'status-light-active',
  suficiente: 'status-light-sufficient',
  finalizada: 'status-light-finalized',
  finalizado: 'status-light-finalized',
  completada: 'status-light-finalized',
  completado: 'status-light-finalized',
  cancelada: 'status-light-cancelled',
  cancelado: 'status-light-cancelled',
  cerrada: 'status-light-cancelled',
  cerrado: 'status-light-cancelled'
};

function getProcInfo(name) {
  return PROC_INFO_MAP[(name || '').toLowerCase()] || null;
}

function getStatusLightClass(estado) {
  return STATUS_MAP[String(estado || '').toLowerCase().trim()] || 'status-light-unknown';
}

function navigateToSession(id) {
  sessionStorage.setItem("sessionSeleccionada", id);
  if (window.cerper?.openPage) window.cerper.openPage("session_detail.html");
  else window.location.href = "session_detail.html";
}

function renderSesiones(sesiones, viewMode = 'grid') {
  const contenedor = document.getElementById("sessions-container");
  contenedor.innerHTML = "";

  // Update container class based on view mode
  contenedor.classList.remove('sessions-grid', 'sessions-list');
  contenedor.classList.add(viewMode === 'list' ? 'sessions-list' : 'sessions-grid');

  if (!sesiones || !sesiones.length) {
    contenedor.innerHTML = `
      <div class="empty-state">
        <i data-lucide="inbox" class="empty-state-icon"></i>
        <h3 class="empty-state-title">No hay sesiones</h3>
        <p class="empty-state-subtitle">No se encontraron sesiones con los filtros seleccionados</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();

  sesiones.forEach(s => {
    const labName = s.lab_nombre || s.lab_key || '';
    const pInfo = getProcInfo(s.procedure);
    const creadoRaw = s.creado_en ?? '';
    const creadoText = formatDateTimePeru(creadoRaw);
    const statusClass = getStatusLightClass(s.estado);
    const producto = s.producto || "Sin producto";
    const metodo = s.metodo || "-";
    const usuario = s.usuario || "-";
    const estadoTitle = s.estado || 'desconocido';

    const el = document.createElement("article");

    if (viewMode === 'list') {
      el.className = "session-list-item";
      el.innerHTML = `
        <div class="list-status-bar ${statusClass}" title="Estado: ${estadoTitle}"></div>
        <div class="list-item-content">
          <div class="list-item-main">
            <span class="list-item-title">${labName} | ${producto}</span>
            <span class="list-item-method"><i data-lucide="book-open"></i> ${metodo}</span>
          </div>
          <div class="list-item-meta"><i data-lucide="calendar"></i> ${creadoText}</div>
          <div class="list-item-meta"><i data-lucide="user"></i> ${usuario}</div>
          ${pInfo ? `<div class="list-item-badge"><span class="proc-badge ${pInfo.cls}" title="${s.procedure}">${pInfo.abbr}</span></div>` : ''}
          <span class="list-item-id">#${s.id}</span>
        </div>
      `;
    } else {
      el.className = "session-card";
      el.innerHTML = `
        ${pInfo ? `<div class="badge-row"><span class="proc-badge ${pInfo.cls}" title="${s.procedure}">${pInfo.abbr}</span></div>` : ''}
        <div class="status-bar ${statusClass}" title="Estado: ${estadoTitle}"></div>
        <h3>${labName} | ${producto}</h3>
        <p class="card-field"><i data-lucide="book-open"></i> ${metodo}</p>
        <div class="card-footer">
          <span class="card-meta" title="${creadoRaw}"><i data-lucide="calendar"></i> ${creadoText}</span>
          <span class="card-meta"><i data-lucide="user"></i> ${usuario}</span>
        </div>
        <span class="card-id-signature">#${s.id}</span>
      `;
    }

    el.addEventListener("click", () => navigateToSession(s.id));
    fragment.appendChild(el);
  });

  contenedor.appendChild(fragment);

  // Render Lucide icons after all items are added
  try { lucide.createIcons(); } catch (e) { }
}

function formatDateTimePeru(value) {
  const raw = value == null ? '' : String(value);
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return raw || '—';
  try {
    const fmt = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return fmt.format(d);
  } catch (_) {
    return d.toLocaleString('es-PE', { hour12: false });
  }
}

// --- Custom glass select popup for filters (no longer used for proc/analisis/lab) ---
// The new UI uses:
// - Slot machine spinner for lab filter
// - Post-it buttons for procedure filter  
// - Segmented control for estructura filter
// This IIFE is kept for potential future use but currently does nothing
(function () {
  // All filter selects are now hidden and replaced with custom UI controls
})();

