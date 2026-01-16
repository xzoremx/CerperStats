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

    renderSesiones(data);
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

function renderSesiones(sesiones) {
  const contenedor = document.getElementById("sessions-container");
  contenedor.innerHTML = "";

  const procInfo = (name) => {
    const k = (name || '').toLowerCase();
    if (k === 'autorizaciones') return { abbr: 'AUT', cls: 'proc-aut' };
    if (k === 'implementaciones') return { abbr: 'IMP', cls: 'proc-imp' };
    if (k === 'intralaboratorios') return { abbr: 'INTRA', cls: 'proc-intra' };
    if (k === 'intercomparación') return { abbr: 'INTER', cls: 'proc-inter' };
    return null;
  };

  if (!sesiones || !sesiones.length) {
    contenedor.innerHTML = `
      <div class="empty-state">
        <i data-lucide="inbox" class="empty-state-icon"></i>
        <h3 class="empty-state-title">No hay sesiones</h3>
        <p class="empty-state-subtitle">No se encontraron sesiones con los filtros seleccionados</p>
      </div>
    `;
    // Re-render lucide icons for the new content
    if (window.lucide) lucide.createIcons();
    return;
  }

  sesiones.forEach(s => {
    const card = document.createElement("article");
    card.className = "session-card";
    const labName = s.lab_nombre || s.lab_key || '';
    const pInfo = procInfo(s.procedure);
    const badges = [];
    if (pInfo) badges.push(`<span class="proc-badge ${pInfo.cls}" title="${s.procedure}">${pInfo.abbr}</span>`);

    const badgeRow = badges.length ? `<div class="badge-row">${badges.join('')}</div>` : '';
    const creadoRaw = s.creado_en ?? '';
    const creadoText = formatDateTimePeru(creadoRaw);
    // Determine status light class based on estado
    const estadoNorm = String(s.estado || '').toLowerCase().trim();
    let statusLightClass = 'status-light-unknown'; // orange for unknown
    if (estadoNorm === 'activa' || estadoNorm === 'activo' || estadoNorm === 'abierta') {
      statusLightClass = 'status-light-active'; // green pulsing
    } else if (estadoNorm === 'suficiente') {
      statusLightClass = 'status-light-sufficient'; // blue
    } else if (
      estadoNorm === 'finalizada' ||
      estadoNorm === 'finalizado' ||
      estadoNorm === 'completada' ||
      estadoNorm === 'completado'
    ) {
      statusLightClass = 'status-light-finalized'; // purple
    } else if (
      estadoNorm === 'cancelada' ||
      estadoNorm === 'cancelado' ||
      estadoNorm === 'cerrada' ||
      estadoNorm === 'cerrado'
    ) {
      statusLightClass = 'status-light-cancelled'; // red
    }

    card.innerHTML = `
      ${badgeRow}
      <div class="status-bar ${statusLightClass}" title="Estado: ${s.estado || 'desconocido'}"></div>
      <h3>${labName} | ${s.producto || "Sin producto"}</h3>
      <p class="card-field"><i data-lucide="book-open"></i> ${s.metodo || "-"}</p>
      <div class="card-footer">
        <span class="card-meta" title="${creadoRaw}"><i data-lucide="calendar"></i> ${creadoText}</span>
        <span class="card-meta"><i data-lucide="user"></i> ${s.usuario || "-"}</span>
      </div>
      <span class="card-id-signature">#${s.id}</span>
    `;
    card.addEventListener("click", () => {
      sessionStorage.setItem("sessionSeleccionada", s.id);
      if (window.cerper?.openPage) window.cerper.openPage("session_detail.html");
      else window.location.href = "session_detail.html";
    });
    contenedor.appendChild(card);
  });

  // Render Lucide icons after all cards are added
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

