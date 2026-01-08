document.addEventListener('DOMContentLoaded', async () => {
  const inputsTables = document.getElementById('inputs-tables');
  const unitBadge = document.getElementById('unit-badge');
  const emptyMsg = document.getElementById('empty-msg');
  const levelSelect = document.getElementById('level-select');

  const sessionId = sessionStorage.getItem('sessionSeleccionada');
  if (!sessionId) {
    notifyLocal('No hay sesión seleccionada.', 'error');
    if (window.cerper?.openPage) window.cerper.openPage('sessions_panel.html');
    else window.location.href = 'sessions_panel.html';
    return;
  }

  // Botón volver
  document.getElementById('btn-volver')?.addEventListener('click', () => {
    if (window.cerper?.openPage) window.cerper.openPage('session_detail.html');
    else window.location.href = 'session_detail.html';
  });

  // Botón copiar tabla
  document.getElementById('btn-copy')?.addEventListener('click', async () => {
    try {
      const tables = Array.from(inputsTables?.querySelectorAll('table.inputs-table') || []);
      if (!tables.length) {
        notifyLocal('No hay tabla visible para copiar.', 'warning');
        return;
      }

      const parts = [];
      for (const table of tables) {
        const level = table.closest('.level-block')?.dataset.level;
        if (level) parts.push(`Nivel ${level}`);
        parts.push(tableToTSV(table));
        parts.push('');
      }
      const tsv = parts.join('\n').trim();
      await navigator.clipboard.writeText(tsv);
      notifyLocal('Tabla copiada al portapapeles.', 'success');
    } catch (e) {
      console.error('[InputsMono] Copy failed:', e);
      notifyLocal('No se pudo copiar la tabla.', 'error');
    }
  });

  try {
    if (inputsTables) inputsTables.innerHTML = '';
    if (emptyMsg) emptyMsg.hidden = true;

    // 1) Info de la sesión para unidad u otros metadatos
    const infoRes = await window.cerper.getSessionInfo(sessionId);
    if (infoRes?.ok) {
      const info = infoRes.data || {};
      unitBadge.textContent = info.unidad || '—';
    }

    // 2) Inputs monoanalito de la sesión
    const res = await window.cerper.getInputsBySession(sessionId, 'mono');
    if (!res.ok) throw new Error(res.error || 'Error leyendo inputs');
    const rows = res.data || [];

    if (!rows.length) {
      emptyMsg.hidden = false;
      return;
    }

    const levels = extractLevels(rows);

    // Poblar selector de nivel (por defecto: "Todos" si hay más de 1)
    if (levelSelect) {
      levelSelect.innerHTML = '';
      if (levels.length > 1) {
        const optAll = document.createElement('option');
        optAll.value = 'all';
        optAll.textContent = 'Todos';
        levelSelect.appendChild(optAll);
      }
      for (const lvl of levels) {
        const opt = document.createElement('option');
        opt.value = String(lvl);
        opt.textContent = `Nivel ${lvl}`;
        levelSelect.appendChild(opt);
      }
      levelSelect.disabled = levels.length <= 1;
      levelSelect.value = levels.length > 1 ? 'all' : String(levels[0] ?? 1);
    }

    const render = () => {
      if (!inputsTables) return;
      inputsTables.innerHTML = '';

      const selected = levelSelect?.value || (levels.length > 1 ? 'all' : String(levels[0] ?? 1));
      const toRender = selected === 'all'
        ? levels
        : [Number(selected)];

      for (const lvl of toRender) {
        const levelRows = rows.filter(r => (asNumber(r.nivel, 1) || 1) === lvl);
        const block = document.createElement('section');
        block.className = 'level-block';
        block.dataset.level = String(lvl);

        const title = document.createElement('div');
        title.className = 'level-title';
        title.textContent = `Nivel ${lvl}`;
        block.appendChild(title);

        block.appendChild(renderMonoTable(levelRows));
        inputsTables.appendChild(block);
      }
    };

    levelSelect?.addEventListener('change', render);
    render();
  } catch (err) {
    console.error('[InputsMono] Error:', err);
    notifyLocal('Error al cargar inputs.', 'error');
  }
});

function asNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function extractLevels(rows) {
  const set = new Set();
  for (const r of rows || []) {
    set.add(asNumber(r.nivel, 1) || 1);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function formatCellValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value);
}

function renderMonoTable(levelRows) {
  const parametros = [];
  const parametrosSet = new Set();
  let maxLectura = 0;

  const byKey = new Map();
  for (const r of levelRows || []) {
    const p = String(r.parametro || '').trim();
    if (p && !parametrosSet.has(p)) {
      parametrosSet.add(p);
      parametros.push(p);
    }

    const lectura = asNumber(r.lectura_idx, null);
    if (lectura != null && lectura > maxLectura) maxLectura = lectura;
    if (p && lectura != null) {
      byKey.set(`${p}#${lectura}`, formatCellValue(r.valor));
    }
  }

  const table = document.createElement('table');
  table.className = 'sheet inputs-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const h of ['Lectura', ...parametros]) {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let i = 1; i <= maxLectura; i++) {
    const tr = document.createElement('tr');

    const first = document.createElement('td');
    first.textContent = `Lectura ${i}`;
    tr.appendChild(first);

    for (const p of parametros) {
      const td = document.createElement('td');
      td.textContent = byKey.get(`${p}#${i}`) ?? '';
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  return table;
}

function tableToTSV(table) {
  const rows = [];
  const head = table.tHead?.rows[0];
  if (head) rows.push([...head.cells].map(c => cellText(c)).join('\t'));
  for (const tr of table.tBodies[0]?.rows || []) {
    rows.push([...tr.cells].map(c => cellText(c)).join('\t'));
  }
  return rows.join('\n');
}

function cellText(cell){
  return String(cell.textContent || '').replace(/\s+/g,' ').trim();
}

function notifyLocal(message, type='info'){
  if (window.notify) { try { window.notify(message, type); return; } catch(_){} }
  let wrap = document.getElementById('toast-wrap');
  if (!wrap){ wrap = document.createElement('div'); wrap.id = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  // trigger animation
  requestAnimationFrame(()=> el.classList.add('show'));
  setTimeout(()=>{
    el.classList.remove('show');
    setTimeout(()=> el.remove(), 200);
  }, 2200);
}
