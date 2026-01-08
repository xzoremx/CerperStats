document.addEventListener("DOMContentLoaded", async () => {
  const usuario = sessionStorage.getItem("usuario");
  const rol = sessionStorage.getItem("rol");
  const defaultLab = sessionStorage.getItem("default_lab") || null;

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
  const labWrap = document.getElementById('filter-lab-wrap');
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

  // Hide lab filter for supervisors, show and populate for admins
  if (rol === 'supervisor') {
    labWrap?.classList.add('hidden');
    if (labWrap) labWrap.style.display = 'none';
  } else {
    try {
      const labs = await window.cerper.getLabs();
      if (selLab) {
        selLab.innerHTML = '';
        const optAll = document.createElement('option');
        optAll.value = 'all'; optAll.textContent = 'Todos';
        selLab.appendChild(optAll);
        labs.forEach(l => {
          const o = document.createElement('option');
          o.value = l.key; o.textContent = l.name;
          selLab.appendChild(o);
        });
        selLab.value = 'all';
      }
    } catch (e) { console.warn('[SessionsPanel] No se pudieron cargar labs', e); }
  }

  async function loadSessions() {
    const labFilter = (rol === 'admin') ? (selLab?.value === 'all' ? null : selLab?.value) : defaultLab;
    const res = await window.cerper.getSessionsByRole({ rol, labDefault: labFilter || null });
    if (!res.ok) throw new Error(res.error);
    allSessions = res.data || [];
    applyFilters();
  }

  function applyFilters() {
    const proc = (selProc?.value || 'all').toLowerCase();
    const analisis = (selAnalisis?.value || 'all').toLowerCase();
    let data = allSessions;
    if (proc !== 'all') {
      data = data.filter(s => (s.procedure || '').toLowerCase() === proc);
    }
    if (analisis !== 'all') {
      data = data.filter(s => normalizeTipoAnalisis(s.tipo_analisis) === analisis);
    }
    renderSesiones(data);
  }

  selLab?.addEventListener('change', () => { if (rol === 'admin') loadSessions().catch(console.error); });
  selProc?.addEventListener('change', applyFilters);
  selAnalisis?.addEventListener('change', applyFilters);

  try { await loadSessions(); } catch (err) {
    console.error('[SessionsPanel] Error:', err);
    window.notify?.('Error al cargar las sesiones.', 'error');
  }

  document.getElementById("btn-volver")?.addEventListener("click", () => {
    if (window.cerper?.openPage) window.cerper.openPage("procedure_select.html");
    else window.location.href = "procedure_select.html";
  });
});

function renderSesiones(sesiones) {
  const contenedor = document.getElementById("sessions-container");
  contenedor.innerHTML = "";

  const normalizeText = (value) => {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const normalizeTipoAnalisis = (value) => {
    const norm = normalizeText(value);
    if (!norm) return null;
    if (norm === 'multi' || norm === 'multianalito' || norm.includes('multi')) return 'multi';
    if (norm === 'mono' || norm === 'monoanalito' || norm.includes('mono')) return 'mono';
    return norm;
  };

  const procInfo = (name) => {
    const k = (name || '').toLowerCase();
    if (k === 'autorizaciones') return { abbr: 'AUT', cls: 'proc-aut' };
    if (k === 'implementaciones') return { abbr: 'IMP', cls: 'proc-imp' };
    if (k === 'intralaboratorios') return { abbr: 'INTRA', cls: 'proc-intra' };
    if (k === 'intercomparación') return { abbr: 'INTER', cls: 'proc-inter' };
    return null;
  };

  if (!sesiones || !sesiones.length) {
    contenedor.innerHTML = "<p>No se encontraron sesiones.</p>";
    return;
  }

  sesiones.forEach(s => {
    const card = document.createElement("article");
    card.className = "session-card";
    const labName = s.lab_nombre || s.lab_key || '';
    const pInfo = procInfo(s.procedure);
    const badges = [];
    if (pInfo) badges.push(`<span class="proc-badge ${pInfo.cls}" title="${s.procedure}">${pInfo.abbr}</span>`);

    const ta = normalizeTipoAnalisis(s.tipo_analisis);
    if (ta === 'mono') badges.push(`<span class="proc-badge badge-mono" title="Estructura: ${s.tipo_analisis}">MONO</span>`);
    if (ta === 'multi') badges.push(`<span class="proc-badge badge-multi" title="Estructura: ${s.tipo_analisis}">MULTI</span>`);

    const td = normalizeText(s.tipo_dato);
    if (td) {
      const isCual = td.includes('cual');
      const label = isCual ? 'CUAL' : 'CUANT';
      const cls = isCual ? 'badge-cual' : 'badge-cuant';
      const modo = s.modo_cualitativo && String(s.modo_cualitativo).toLowerCase() !== 'null'
        ? ` (${s.modo_cualitativo})`
        : '';
      badges.push(`<span class="proc-badge ${cls}" title="Tipo de dato: ${s.tipo_dato}${modo}">${label}</span>`);
    }

    const badgeRow = badges.length ? `<div class="badge-row">${badges.join('')}</div>` : '';

    const tipoAnalisisText = s.tipo_analisis || '-';
    const tipoDatoText = s.tipo_dato || '-';
    const modoText = s.modo_cualitativo && String(s.modo_cualitativo).toLowerCase() !== 'null'
      ? ` (${s.modo_cualitativo})`
      : '';
    card.innerHTML = `
      ${badgeRow}
      <h3>${labName} | ${s.producto || "Sin producto"}</h3>
      <p><b>ID:</b> ${s.id}</p>
      <p><b>Estado:</b> ${s.estado}</p>
      <p><b>Método:</b> ${s.metodo || "-"}</p>
      <p><b>Estructura:</b> ${tipoAnalisisText} | <b>Dato:</b> ${tipoDatoText}${modoText}</p>
      <p><b>Creado:</b> ${s.creado_en}</p>
      <p><b>Analista:</b> ${s.usuario || "-"}</p>
    `;
    card.addEventListener("click", () => {
      sessionStorage.setItem("sessionSeleccionada", s.id);
      if (window.cerper?.openPage) window.cerper.openPage("session_detail.html");
      else window.location.href = "session_detail.html";
    });
    contenedor.appendChild(card);
  });
}

// --- Custom glass select popup for filters ---
(function(){
  function enhanceSelect(select){
    if (!select || select._enhanced) return;
    select._enhanced = true;

    const wrap = document.createElement('div'); wrap.className = 'select-wrap';
    const display = document.createElement('div'); display.className = 'select-display';
    const valueEl = document.createElement('span'); valueEl.className = 'select-value';
    valueEl.textContent = select.options[select.selectedIndex]?.text || '';
    const caret = document.createElement('span'); caret.className = 'select-caret';
    display.appendChild(valueEl); display.appendChild(caret);

    const menu = document.createElement('div'); menu.className = 'select-menu';

    const buildMenu = () => {
      menu.innerHTML = '';
      Array.from(select.options).forEach(opt => {
        const item = document.createElement('div');
        item.className = 'select-option';
        item.dataset.value = opt.value;
        item.textContent = opt.text;
        if (opt.selected) item.setAttribute('aria-selected', 'true');
        item.addEventListener('click', () => {
          select.value = opt.value;
          valueEl.textContent = opt.text;
          Array.from(menu.children).forEach(c => c.removeAttribute('aria-selected'));
          item.setAttribute('aria-selected', 'true');
          select.dispatchEvent(new Event('change', { bubbles: true }));
          menu.classList.remove('show');
        });
        menu.appendChild(item);
      });
    };

    buildMenu();

    select.style.display = 'none';
    const parent = select.parentElement || document.body;
    parent.insertBefore(wrap, select);
    wrap.appendChild(display);
    wrap.appendChild(menu);
    wrap.appendChild(select);

    // Toggle menu on display click
    display.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('show');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        menu.classList.remove('show');
      }
    });

    // Update display when select value changes
    select.addEventListener('change', () => {
      valueEl.textContent = select.options[select.selectedIndex]?.text || '';
      Array.from(menu.children).forEach(c => c.removeAttribute('aria-selected'));
      const sel = Array.from(menu.children).find(c => c.dataset.value === select.value);
      if (sel) sel.setAttribute('aria-selected', 'true');
    });

    // Observe changes to the select's options and rebuild the menu
    const mo = new MutationObserver(() => {
      buildMenu();
      valueEl.textContent = select.options[select.selectedIndex]?.text || '';
    });
    mo.observe(select, { childList: true, subtree: true, attributes: true });
  }

  // Try to enhance after initial render and after async labs load
  const boot = ()=>{
    try{
      const proc = document.getElementById('filter-proc');
      if (proc) enhanceSelect(proc);
      const analisis = document.getElementById('filter-analisis');
      if (analisis) enhanceSelect(analisis);
      const lab = document.getElementById('filter-lab');
      const rol = sessionStorage.getItem('rol');
      if (rol === 'admin' && lab) enhanceSelect(lab);
    }catch(_){/* ignore */}
  };
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 50);
  else document.addEventListener('DOMContentLoaded', ()=> setTimeout(boot, 50));
})();



