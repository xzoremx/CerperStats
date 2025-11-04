document.addEventListener('DOMContentLoaded', async () => {
  const tableHead = document.getElementById('sheet-head');
  const tableBody = document.getElementById('sheet-body');
  const unitBadge = document.getElementById('unit-badge');
  const emptyMsg = document.getElementById('empty-msg');

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
      const tsv = tableToTSV(document.getElementById('inputs-table'));
      await navigator.clipboard.writeText(tsv);
      notifyLocal('Tabla copiada al portapapeles.', 'success');
    } catch (e) {
      console.error('[InputsMulti] Copy failed:', e);
      notifyLocal('No se pudo copiar la tabla.', 'error');
    }
  });

  try {
    // 1) Info de la sesión para unidad
    const infoRes = await window.cerper.getSessionInfo(sessionId);
    if (infoRes?.ok) {
      const info = infoRes.data || {};
      unitBadge.textContent = info.unidad || '—';
    }

    // 2) Inputs multianalito de la sesión
    const res = await window.cerper.getInputsBySession(sessionId, 'multi');
    if (!res.ok) throw new Error(res.error || 'Error leyendo inputs');
    const rows = res.data || [];

    if (!rows.length) {
      emptyMsg.hidden = false;
      return;
    }

    // Estructura esperada: { parametro, analito, lectura_idx, valor }
    // Encabezados de columnas = analitos
    const analitos = [];
    const parametros = [];
    let maxLectura = 0;
    for (const r of rows) {
      if (!analitos.includes(r.analito)) analitos.push(r.analito);
      if (!parametros.includes(r.parametro)) parametros.push(r.parametro);
      if (r.lectura_idx > maxLectura) maxLectura = r.lectura_idx;
    }

    analitos.sort();
    parametros.sort();

    // Render thead: primera columna "Parámetro / Lectura", luego analitos
    const headRow = document.createElement('tr');
    headRow.innerHTML = ['Parámetro / Lectura', ...analitos].map(h => `<th>${h}</th>`).join('');
    tableHead.appendChild(headRow);

    // Indexar por (parametro, analito, lectura)
    const byKey = new Map();
    for (const r of rows) {
      byKey.set(`${r.parametro}#${r.analito}#${r.lectura_idx}`, r.valor);
    }

    // Render tbody: para cada parametro, filas por lectura_idx
    for (const p of parametros) {
      for (let i = 1; i <= maxLectura; i++) {
        const tr = document.createElement('tr');
        const label = `Lectura ${i} · ${p}`;
        const cells = [`<td>${label}</td>`];
        for (const a of analitos) {
          const v = byKey.get(`${p}#${a}#${i}`);
          cells.push(`<td>${v ?? ''}</td>`);
        }
        tr.innerHTML = cells.join('');
        tableBody.appendChild(tr);
      }
    }
  } catch (err) {
    console.error('[InputsMulti] Error:', err);
    notifyLocal('Error al cargar inputs.', 'error');
  }
});

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
  requestAnimationFrame(()=> el.classList.add('show'));
  setTimeout(()=>{
    el.classList.remove('show');
    setTimeout(()=> el.remove(), 200);
  }, 2200);
}
