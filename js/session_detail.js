document.addEventListener("DOMContentLoaded", async () => {
  const sessionId =
    sessionStorage.getItem("sessionSeleccionada") ||
    sessionStorage.getItem("sessionID");
  if (!sessionId) {
    notify("No hay sesion seleccionada.", "error");
    if (window.cerper?.openPage) window.cerper.openPage("sessions_panel.html");
    else window.location.href = "sessions_panel.html";
    return;
  }

  const btnResults = document.getElementById("btn-results");
  const btnReport = document.getElementById("btn-report");
  const btnReuse = document.getElementById("btn-reuse");
  const btnVolver = document.getElementById("btn-volver");

  // Session meta elements (new UI)
  const sessionSubtitle = document.getElementById("session-subtitle");
  const sessionChipId = document.getElementById("session-chip-id");
  const sessionChipStatus = document.getElementById("session-chip-status");
  const sessionChipAnalisis = document.getElementById("session-chip-analisis");
  const sessionChipDato = document.getElementById("session-chip-dato");
  const sessionChipModo = document.getElementById("session-chip-modo");

  const sessionProcedureEl = document.getElementById("session-procedure");
  const sessionMetodoEl = document.getElementById("session-metodo");
  const sessionEnsayoEl = document.getElementById("session-ensayo");
  const sessionExpedienteEl = document.getElementById("session-expediente");
  const sessionUnidadEl = document.getElementById("session-unidad");
  const rowModoCualitativo = document.getElementById("row-modo-cualitativo");
  const sessionModoCualitativoEl = document.getElementById("session-modo-cualitativo");
  const sessionParametroEl = document.getElementById("session-parametro");
  const sessionEstadoEl = document.getElementById("session-estado");
  const sessionCreadoEl = document.getElementById("session-creado");

  // Inputs viewer elements
  const inputsSubtitle = document.getElementById("inputs-subtitle");
  const inputsTabMono = document.getElementById("inputs-tab-mono");
  const inputsTabMulti = document.getElementById("inputs-tab-multi");
  const inputsLevelSelect = document.getElementById("inputs-level");
  const btnCopyInputs = document.getElementById("btn-copy-inputs");
  const inputsLoading = document.getElementById("inputs-loading");
  const inputsEmpty = document.getElementById("inputs-empty");
  const inputsError = document.getElementById("inputs-error");
  const inputsTables = document.getElementById("inputs-tables");

  const inputsState = {
    activeType: "mono",
    activeLevel: "all",
    available: { mono: false, multi: false },
    levels: { mono: [], multi: [] },
    data: { mono: [], multi: [] },
  };

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeModalMessage(message) {
    if (message == null) return "";
    return String(message).replace(/\n/g, "<br>");
  }

  function showInlineModal({ title, message, confirmText, cancelText }) {
    return new Promise((resolve) => {
      const existing = document.querySelector(".cs-inline-modal-overlay");
      if (existing) existing.remove();

      const overlay = document.createElement("div");
      overlay.className = "cs-inline-modal-overlay";

      const modal = document.createElement("div");
      modal.className = "cs-inline-modal";

      const titleEl = document.createElement("h3");
      titleEl.className = "cs-inline-modal__title";
      titleEl.textContent = title || "Confirmar";

      const messageEl = document.createElement("p");
      messageEl.className = "cs-inline-modal__message";
      messageEl.innerHTML = normalizeModalMessage(message);

      const buttons = document.createElement("div");
      buttons.className = "cs-inline-modal__actions";

      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.textContent = confirmText || "Aceptar";
      confirmBtn.className = "cs-inline-modal__btn cs-inline-modal__btn--primary";

      buttons.appendChild(confirmBtn);

      let cancelBtn = null;
      if (cancelText) {
        cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = cancelText;
        cancelBtn.className = "cs-inline-modal__btn cs-inline-modal__btn--secondary";
        buttons.appendChild(cancelBtn);
      }

      modal.appendChild(titleEl);
      modal.appendChild(messageEl);
      modal.appendChild(buttons);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const closeModal = (value) => {
        document.removeEventListener("keydown", keyHandler);
        overlay.classList.add("is-closing");
        setTimeout(() => {
          overlay.remove();
          resolve(value);
        }, 200);
      };

      const keyHandler = (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          closeModal(false);
        } else if (ev.key === "Enter") {
          ev.preventDefault();
          closeModal(true);
        }
      };

      confirmBtn.addEventListener("click", () => closeModal(true));
      if (cancelBtn) cancelBtn.addEventListener("click", () => closeModal(false));

      document.addEventListener("keydown", keyHandler);
      confirmBtn.focus();
    });
  }

  function normalizeTipoAnalisis(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "mono";
    if (raw === "multi" || raw === "multianalito" || raw.includes("multi")) return "multi";
    if (raw === "mono" || raw === "monoanalito" || raw.includes("mono")) return "mono";
    return raw;
  }

  const DEFAULT_LAB_COLOR = "#22d3ee";
  const DEFAULT_LAB_ICON = "flask-conical";

  function sanitizeIcon(raw) {
    const value = String(raw || "").trim().toLowerCase();
    if (!value) return DEFAULT_LAB_ICON;
    const normalized = value.startsWith("lucide:") ? value.slice(7) : value;
    const safe = normalized.replace(/[^a-z0-9-]/g, "");
    return safe || DEFAULT_LAB_ICON;
  }

  function normalizeColor(raw) {
    const value = String(raw || "").trim();
    return value || DEFAULT_LAB_COLOR;
  }

  let PROCEDURE_DICT = null;

  async function loadProcedureDictionary() {
    if (PROCEDURE_DICT && typeof PROCEDURE_DICT === "object") return PROCEDURE_DICT;
    try {
      const res = await fetch("config/procedure_descriptions.json", { cache: "no-cache" });
      if (res.ok) {
        const json = await res.json();
        PROCEDURE_DICT = json && typeof json === "object" ? json : {};
        return PROCEDURE_DICT;
      }
    } catch (_) { }
    PROCEDURE_DICT = {};
    return PROCEDURE_DICT;
  }

  function safeProcedureAssetId(value) {
    const normalized = normalizeText(value)
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 80);
    return normalized || "autorizaciones";
  }

  function resolveProcedureMetaFromTitle(procTitle) {
    const dict = PROCEDURE_DICT && typeof PROCEDURE_DICT === "object" ? PROCEDURE_DICT : {};
    const target = normalizeText(procTitle);

    // Match by dict key first (when procedure is saved as ID)
    const byKey = dict[target];
    if (byKey) {
      return {
        title: byKey.title || procTitle || "Procedimiento",
        description: byKey.description || "",
        image: byKey.image || `assets/logos/procedures/${safeProcedureAssetId(target)}.webp`,
      };
    }

    // Match by title (most common: sessions store the human title)
    for (const meta of Object.values(dict)) {
      if (!meta) continue;
      if (normalizeText(meta.title) === target) {
        return {
          title: meta.title || procTitle || "Procedimiento",
          description: meta.description || "",
          image:
            meta.image || `assets/logos/procedures/${safeProcedureAssetId(meta.title || procTitle)}.webp`,
        };
      }
    }

    // Fallback
    return {
      title: procTitle || "Procedimiento",
      description: "",
      image: `assets/logos/procedures/${safeProcedureAssetId(procTitle)}.webp`,
    };
  }

  function inferKAndLecturas(inputsRows) {
    const rows = Array.isArray(inputsRows) ? inputsRows : [];
    const orderedParams = [];
    const seen = new Set();

    for (const r of rows) {
      const param = String(r?.parametro ?? "").trim();
      if (!param) continue;
      if (!seen.has(param)) {
        seen.add(param);
        orderedParams.push(param);
      }
    }

    if (!orderedParams.length) {
      const maxIdx = Math.max(...rows.map((r) => Number(r?.lectura_idx) || 0), 0);
      return { K: 1, lecturasPorParametro: [Math.max(1, maxIdx || 1)] };
    }

    const lecturasPorParametro = orderedParams.map((param) => {
      const byLevel = new Map();
      for (const r of rows) {
        if (String(r?.parametro ?? "").trim() !== param) continue;
        const level = Number(r?.nivel) || 1;
        const idx = Number(r?.lectura_idx) || 0;
        if (idx < 1) continue;
        if (!byLevel.has(level)) byLevel.set(level, new Set());
        byLevel.get(level).add(idx);
      }
      let maxCount = 0;
      for (const set of byLevel.values()) {
        maxCount = Math.max(maxCount, set.size);
      }
      return Math.max(1, maxCount || 1);
    });

    return { K: orderedParams.length, lecturasPorParametro };
  }

  function asNumber(value, fallback = null) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function formatCellValue(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return "";
      return Number.isInteger(value) ? String(value) : String(value);
    }
    return String(value);
  }

  function setInputsStateView(view, message = "") {
    if (!inputsLoading || !inputsEmpty || !inputsError || !inputsTables) return;

    inputsLoading.classList.toggle("hidden", view !== "loading");
    inputsEmpty.classList.toggle("hidden", view !== "empty");
    inputsError.classList.toggle("hidden", view !== "error");

    if (view === "error") {
      inputsError.textContent = message || "Error al cargar inputs.";
    }

    if (view === "ready") {
      inputsLoading.classList.add("hidden");
      inputsEmpty.classList.add("hidden");
      inputsError.classList.add("hidden");
    }
  }

  async function fetchInputs(tipo) {
    try {
      const res = await window.cerper.getInputsBySession(sessionId, tipo);
      if (!res?.ok) {
        return { ok: false, error: res?.error || "Error leyendo inputs" };
      }
      return { ok: true, data: Array.isArray(res.data) ? res.data : [] };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  function extractLevels(rows) {
    const set = new Set();
    for (const r of rows || []) {
      set.add(asNumber(r.nivel, 1) || 1);
    }
    return Array.from(set).sort((a, b) => a - b);
  }

  function inferPreferredInputsType(tipoAnalisisRaw) {
    const norm = normalizeText(tipoAnalisisRaw);
    const isMulti =
      norm === "multi" || norm === "multianalito" || norm.includes("multi");
    return isMulti ? "multi" : "mono";
  }

  function formatAnalisisLabel(tipoAnalisisRaw) {
    const norm = normalizeText(tipoAnalisisRaw);
    const isMulti =
      norm === "multi" || norm === "multianalito" || norm.includes("multi");
    const isMono = norm === "mono" || norm === "monoanalito" || norm.includes("mono");
    if (isMulti) return "Multianalito";
    if (isMono) return "Monoanalito";
    const raw = String(tipoAnalisisRaw || "").trim();
    if (!raw) return "—";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function formatDatoLabel(tipoDatoRaw) {
    const norm = normalizeText(tipoDatoRaw);
    if (!norm) return "—";
    if (norm.includes("cual")) return "Cualitativo";
    if (norm.includes("cuant")) return "Cuantitativo";
    const raw = String(tipoDatoRaw || "").trim();
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "—";
  }

  function formatDateTimePeru(value) {
    const raw = value == null ? "" : String(value);
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return raw || "—";
    try {
      const fmt = new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      return `${fmt.format(d)} (Perú)`;
    } catch (_) {
      // Fallback to local timezone formatting (still readable)
      return `${d.toLocaleString("es-PE", { hour12: false })}`;
    }
  }

  function setActiveTab(type) {
    inputsState.activeType = type;

    if (inputsTabMono) {
      inputsTabMono.setAttribute(
        "aria-selected",
        type === "mono" ? "true" : "false"
      );
    }
    if (inputsTabMulti) {
      inputsTabMulti.setAttribute(
        "aria-selected",
        type === "multi" ? "true" : "false"
      );
    }
  }

  function rebuildLevelSelect() {
    if (!inputsLevelSelect) return;

    const levels = inputsState.levels[inputsState.activeType] || [];
    inputsLevelSelect.innerHTML = "";

    if (levels.length > 1) {
      const optAll = document.createElement("option");
      optAll.value = "all";
      optAll.textContent = "Todos";
      inputsLevelSelect.appendChild(optAll);
    }

    for (const lvl of levels) {
      const opt = document.createElement("option");
      opt.value = String(lvl);
      opt.textContent = `Nivel ${lvl}`;
      inputsLevelSelect.appendChild(opt);
    }

    // Normalize current selection
    const allowed = new Set(levels.map((n) => String(n)));
    const hasAll = levels.length > 1;

    if (!hasAll && inputsState.activeLevel === "all") {
      inputsState.activeLevel = levels[0] != null ? String(levels[0]) : "all";
    }
    if (
      inputsState.activeLevel !== "all" &&
      !allowed.has(String(inputsState.activeLevel))
    ) {
      inputsState.activeLevel = hasAll ? "all" : String(levels[0] || 1);
    }

    inputsLevelSelect.value = String(inputsState.activeLevel);
    inputsLevelSelect.disabled = levels.length <= 1;
  }

  function buildTable(headers, rows) {
    const table = document.createElement("table");
    table.className = "inputs-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const h of headers) {
      const th = document.createElement("th");
      th.textContent = h;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const row of rows) {
      const tr = document.createElement("tr");
      for (const cell of row) {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    return table;
  }

  function renderMonoLevel(levelRows) {
    const parametros = [];
    const parametrosSet = new Set();
    const lecturaSet = new Set();

    const byKey = new Map();
    for (const r of levelRows) {
      const p = String(r.parametro || "").trim();
      if (p && !parametrosSet.has(p)) {
        parametrosSet.add(p);
        parametros.push(p);
      }
      const lectura = asNumber(r.lectura_idx, null);
      if (lectura != null) lecturaSet.add(lectura);

      if (p && lectura != null) {
        byKey.set(`${p}#${lectura}`, formatCellValue(r.valor));
      }
    }

    const lecturas = Array.from(lecturaSet)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    const headers = ["Resultados", ...parametros];
    const rows = [];

    for (const lectura of lecturas) {
      const row = [`Resultado ${lectura}`];
      for (const p of parametros) {
        row.push(byKey.get(`${p}#${lectura}`) ?? "");
      }
      rows.push(row);
    }

    return buildTable(headers, rows);
  }

  function renderMultiLevel(levelRows) {
    const analitos = [];
    const analitosSet = new Set();
    const parametros = [];
    const parametrosSet = new Set();
    const lecturaSet = new Set();

    const byKey = new Map();
    for (const r of levelRows) {
      const a = String(r.analito || "").trim();
      const p = String(r.parametro || "").trim();
      const lectura = asNumber(r.lectura_idx, null);

      if (a && !analitosSet.has(a)) {
        analitosSet.add(a);
        analitos.push(a);
      }
      if (p && !parametrosSet.has(p)) {
        parametrosSet.add(p);
        parametros.push(p);
      }
      if (lectura != null) lecturaSet.add(lectura);

      if (p && a && lectura != null) {
        byKey.set(`${p}#${a}#${lectura}`, formatCellValue(r.valor));
      }
    }

    analitos.sort((x, y) => x.localeCompare(y));
    parametros.sort((x, y) => x.localeCompare(y));

    const lecturas = Array.from(lecturaSet)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    const headers = ["Resultado / Parámetro", ...analitos];
    const rows = [];

    for (const p of parametros) {
      for (const lectura of lecturas) {
        const row = [`Resultado ${lectura} · ${p}`];
        for (const a of analitos) {
          row.push(byKey.get(`${p}#${a}#${lectura}`) ?? "");
        }
        rows.push(row);
      }
    }

    return buildTable(headers, rows);
  }

  function renderInputsTables() {
    if (!inputsTables) return;
    inputsTables.innerHTML = "";

    const type = inputsState.activeType;
    const allRows = inputsState.data[type] || [];
    if (!allRows.length) {
      setInputsStateView("empty");
      return;
    }

    const byLevel = new Map();
    for (const r of allRows) {
      const lvl = asNumber(r.nivel, 1) || 1;
      if (inputsState.activeLevel !== "all" && String(lvl) !== String(inputsState.activeLevel)) {
        continue;
      }
      if (!byLevel.has(lvl)) byLevel.set(lvl, []);
      byLevel.get(lvl).push(r);
    }

    const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);
    if (!levels.length) {
      setInputsStateView("empty");
      return;
    }

    for (const lvl of levels) {
      const levelRows = byLevel.get(lvl) || [];
      const block = document.createElement("section");
      block.className = "inputs-level-block";
      block.dataset.level = String(lvl);

      // Only show level title if there are multiple levels
      if (levels.length > 1) {
        const title = document.createElement("div");
        title.className = "inputs-level-title";
        title.textContent = `Nivel ${lvl}`;
        block.appendChild(title);
      }

      const scroll = document.createElement("div");
      scroll.className = "inputs-table-scroll";

      const table = type === "multi"
        ? renderMultiLevel(levelRows)
        : renderMonoLevel(levelRows);
      scroll.appendChild(table);
      block.appendChild(scroll);

      inputsTables.appendChild(block);
    }

    setInputsStateView("ready");
  }

  function updateInputsSubtitle() {
    if (!inputsSubtitle) return;
    const monoCount = inputsState.data.mono?.length || 0;
    const multiCount = inputsState.data.multi?.length || 0;
    const monoLvls = inputsState.levels.mono || [];
    const multiLvls = inputsState.levels.multi || [];

    const parts = [];
    // Only show levels if there are multiple levels
    if (monoCount > 0) {
      const lvlText = monoLvls.length > 1 ? ` · Niveles ${monoLvls.join(", ")}` : '';
      parts.push(`${monoCount} registros${lvlText}`);
    }
    if (multiCount > 0) {
      const lvlText = multiLvls.length > 1 ? ` · Niveles ${multiLvls.join(", ")}` : '';
      parts.push(`${multiCount} registros${lvlText}`);
    }
    if (parts.length === 0) parts.push("Que raro, no hay inputs guardados para esta sesión.");

    inputsSubtitle.textContent = parts.join(" | ");
  }

  function updateTabAvailability() {
    if (inputsTabMono) inputsTabMono.disabled = !inputsState.available.mono;
    if (inputsTabMulti) inputsTabMulti.disabled = !inputsState.available.multi;
  }

  function setActiveType(type) {
    if (!inputsState.available[type]) return;
    setActiveTab(type);
    rebuildLevelSelect();
    renderInputsTables();
  }

  async function loadInputs(tipoAnalisisPreferido) {
    setInputsStateView("loading");
    if (inputsSubtitle) inputsSubtitle.textContent = "Cargando inputs...";

    const [monoRes, multiRes] = await Promise.all([
      fetchInputs("mono"),
      fetchInputs("multi"),
    ]);

    inputsState.data.mono = monoRes.ok ? monoRes.data : [];
    inputsState.data.multi = multiRes.ok ? multiRes.data : [];
    inputsState.available.mono = inputsState.data.mono.length > 0;
    inputsState.available.multi = inputsState.data.multi.length > 0;
    inputsState.levels.mono = extractLevels(inputsState.data.mono);
    inputsState.levels.multi = extractLevels(inputsState.data.multi);

    updateInputsSubtitle();
    updateTabAvailability();

    if (!inputsState.available.mono && !inputsState.available.multi) {
      const errors = [];
      if (!monoRes.ok) errors.push(`Monoanalito: ${monoRes.error}`);
      if (!multiRes.ok) errors.push(`Multianalito: ${multiRes.error}`);
      // If both were ok but empty, show empty instead of error.
      if (errors.length > 0) {
        setInputsStateView("error", errors.join(" | "));
      } else {
        setInputsStateView("empty");
      }
      return;
    }

    let preferred = tipoAnalisisPreferido || "mono";
    if (preferred === "multi" && !inputsState.available.multi && inputsState.available.mono) {
      preferred = "mono";
    }
    if (preferred === "mono" && !inputsState.available.mono && inputsState.available.multi) {
      preferred = "multi";
    }

    setActiveType(preferred);
  }

  try {
    const res = await window.cerper.getSessionInfo(sessionId);
    if (!res.ok) throw new Error(res.error);

    const info = res.data;
    const labName = info.lab_nombre || info.lab_key || '';
    const analisisLabel = formatAnalisisLabel(info.tipo_analisis);
    const datoLabel = formatDatoLabel(info.tipo_dato);
    const modoCualitativo = info.modo_cualitativo && String(info.modo_cualitativo).toLowerCase() !== 'null'
      ? String(info.modo_cualitativo)
      : '';

    if (sessionSubtitle) {
      const producto = info.producto ? String(info.producto) : '';
      sessionSubtitle.textContent = [labName, producto].filter(Boolean).join(' · ') || '—';
    }
    if (sessionChipId) sessionChipId.textContent = `Sesión #${info.id ?? '—'}`;
    if (sessionChipStatus) sessionChipStatus.textContent = String(info.estado || '—').toUpperCase();
    if (sessionChipAnalisis) sessionChipAnalisis.textContent = analisisLabel;
    if (sessionChipDato) sessionChipDato.textContent = datoLabel;
    if (sessionChipModo) {
      if (modoCualitativo) {
        sessionChipModo.textContent = modoCualitativo;
        sessionChipModo.classList.remove('hidden');
      } else {
        sessionChipModo.classList.add('hidden');
      }
    }

    if (sessionProcedureEl) sessionProcedureEl.textContent = String(info.procedure || '—');
    if (sessionMetodoEl) sessionMetodoEl.textContent = String(info.metodo || '—');
    if (sessionEnsayoEl) sessionEnsayoEl.textContent = String(info.ensayo || '—');
    if (sessionExpedienteEl) sessionExpedienteEl.textContent = String(info.expediente || '—');
    if (sessionUnidadEl) sessionUnidadEl.textContent = String(info.unidad || '—');

    if (rowModoCualitativo && sessionModoCualitativoEl) {
      if (modoCualitativo) {
        rowModoCualitativo.classList.remove('hidden');
        sessionModoCualitativoEl.textContent = modoCualitativo;
      } else {
        rowModoCualitativo.classList.add('hidden');
        sessionModoCualitativoEl.textContent = '—';
      }
    }

    if (sessionParametroEl) sessionParametroEl.textContent = String(info.parametro || '—');
    if (sessionEstadoEl) sessionEstadoEl.textContent = String(info.estado || '—');

    if (sessionCreadoEl) {
      sessionCreadoEl.textContent = formatDateTimePeru(info.creado_en);
      sessionCreadoEl.title = info.creado_en ? String(info.creado_en) : '';
    }

    // Prepare inputs viewer (auto-detect based on session tipo_analisis)
    const preferredInputsType = inferPreferredInputsType(info.tipo_analisis);
    await loadInputs(preferredInputsType);

    btnResults?.addEventListener("click", () => {
      // Ir directo a evaluation_results para revisar resultados/gráficos históricos.
      try {
        if (sessionId) {
          sessionStorage.setItem("sessionSeleccionada", sessionId);
          sessionStorage.setItem("evalResultsSessionId", sessionId);
        }
        sessionStorage.setItem("evalResultsView", "visualizaciones");
      } catch (_) { }

      const target = "evaluation_results.html";
      if (window.cerper?.openPage) window.cerper.openPage(target);
      else window.location.href = target;
    });

    btnReport?.addEventListener("click", () => {
      try {
        if (sessionId) {
          sessionStorage.setItem("sessionSeleccionada", sessionId);
        }
      } catch (_) { }
      const target = "reports.html";
      if (window.cerper?.openPage) window.cerper.openPage(target);
      else window.location.href = target;
    });

    btnReuse?.addEventListener("click", async () => {
      if (!window.cerper?.reuseSession) {
        notify("Esta versión no soporta 'Reutilizar sesión'.", "error");
        return;
      }

      const ok = await showInlineModal({
        title: "Reutilizar sesión",
        message: [
          `Se creará una nueva sesión basada en la sesión <strong>#${escapeHtml(info.id)}</strong>.`,
          "Se copiará la metadata y los inputs guardados.",
          "No se copiarán resultados ni reportes.",
        ].join("\n"),
        confirmText: "Crear nueva sesión",
        cancelText: "Cancelar",
      });
      if (!ok) return;

      const usuarioId = Number(sessionStorage.getItem("usuario_id")) || null;
      if (!usuarioId) {
        notify("No se pudo determinar el usuario actual.", "error");
        return;
      }

      const prevText = btnReuse.textContent;
      btnReuse.disabled = true;
      btnReuse.textContent = "Reutilizando...";

      try {
        notify("Creando nueva sesión y copiando inputs...", "info");
        const reuseRes = await window.cerper.reuseSession(info.id, usuarioId);
        if (!reuseRes?.ok || !reuseRes.session_id) {
          throw new Error(reuseRes?.error || "No se pudo reutilizar la sesión");
        }

        const newSessionId = String(reuseRes.session_id);

        // Preparar contexto para poder volver a input_data_sheet desde evaluation_select.
        try {
          sessionStorage.setItem("sessionID", newSessionId);
          sessionStorage.setItem("sessionSeleccionada", newSessionId);
          if (info.lab_key) sessionStorage.setItem("labSeleccionado", String(info.lab_key));
          if (info.lab_nombre || info.lab_key) {
            sessionStorage.setItem("labNombreVisible", String(info.lab_nombre || info.lab_key));
          }
          if (info.procedure) {
            const procTitle = String(info.procedure);
            sessionStorage.setItem("procedimientoSeleccionado", procTitle);
            await loadProcedureDictionary();
            const procMeta = resolveProcedureMetaFromTitle(procTitle);
            sessionStorage.setItem("procedimientoTitulo", procMeta.title || procTitle);
            sessionStorage.setItem("procedimientoDescripcion", procMeta.description || "");
            sessionStorage.setItem("procedimientoImagen", procMeta.image || "");
          }

          // Completar metadata visual del laboratorio (icono/color) para evitar usar el lab del menú.
          if (info.lab_key && window.cerper?.getLabByKey) {
            try {
              const labRes = await window.cerper.getLabByKey(String(info.lab_key));
              if (labRes?.ok && labRes.data) {
                const lab = labRes.data;
                const nombreVisible =
                  (lab.nombre || info.lab_nombre || info.lab_key || "").trim() ||
                  String(info.lab_key);
                sessionStorage.setItem("labNombreVisible", nombreVisible);
                sessionStorage.setItem("labColor", normalizeColor(lab.color));
                sessionStorage.setItem("labIcon", sanitizeIcon(lab.icon_lucide || lab.icono || lab.icon));
              }
            } catch (_) { }
          }

          if (info.metodo != null) sessionStorage.setItem("metodo", String(info.metodo || ""));
          if (info.producto != null) sessionStorage.setItem("producto", String(info.producto || ""));
          if (info.ensayo != null) sessionStorage.setItem("ensayo", String(info.ensayo || ""));
          if (info.expediente != null) sessionStorage.setItem("expediente", String(info.expediente || ""));
          if (info.unidad != null) sessionStorage.setItem("unidad", String(info.unidad || ""));

          const tipoAnalisis = normalizeTipoAnalisis(info.tipo_analisis);
          sessionStorage.setItem("tipoAnalisis", tipoAnalisis);
          if (info.parametro != null) sessionStorage.setItem("parametroSeleccionado", String(info.parametro || ""));
          if (info.tipo_dato != null) sessionStorage.setItem("tipoDato", String(info.tipo_dato || ""));
          if (info.modo_cualitativo != null && String(info.modo_cualitativo).trim()) {
            sessionStorage.setItem("modoCualitativo", String(info.modo_cualitativo));
          } else {
            sessionStorage.removeItem("modoCualitativo");
          }

          const inputsRes = await window.cerper.getInputsBySession(newSessionId, tipoAnalisis);
          const { K, lecturasPorParametro } = inferKAndLecturas(inputsRes?.ok ? inputsRes.data : []);
          sessionStorage.setItem("K", String(K));
          sessionStorage.setItem("lecturasPorParametro", JSON.stringify(lecturasPorParametro));
        } catch (_) { }

        notify(`Sesión creada (#${newSessionId}). Abriendo evaluaciones...`, "success");
        if (window.cerper?.openPage) window.cerper.openPage("evaluation_select.html");
        else window.location.href = "evaluation_select.html";
      } catch (e) {
        console.error("[SessionDetail] Reuse failed:", e);
        notify(e?.message || "No se pudo reutilizar la sesión.", "error");
      } finally {
        btnReuse.disabled = false;
        btnReuse.textContent = prevText;
      }
    });

    // Inputs viewer events
    inputsTabMono?.addEventListener("click", () => setActiveType("mono"));
    inputsTabMulti?.addEventListener("click", () => setActiveType("multi"));

    inputsLevelSelect?.addEventListener("change", () => {
      inputsState.activeLevel = inputsLevelSelect.value || "all";
      renderInputsTables();
    });

    btnCopyInputs?.addEventListener("click", async () => {
      try {
        const tables = Array.from(inputsTables?.querySelectorAll("table.inputs-table") || []);
        if (tables.length === 0) {
          notify("No hay tabla visible para copiar.", "warning");
          return;
        }

        const parts = [];
        for (const table of tables) {
          const level = table.closest(".inputs-level-block")?.dataset.level;
          if (level) parts.push(`Nivel ${level}`);
          parts.push(tableToTSV(table));
          parts.push("");
        }

        const tsv = parts.join("\n").trim();
        await navigator.clipboard.writeText(tsv);
        notify("Inputs copiados al portapapeles.", "success");
      } catch (e) {
        console.error("[SessionDetail] Copy failed:", e);
        notify("No se pudo copiar la tabla.", "error");
      }
    });
  } catch (err) {
    console.error("[SessionDetail] Error:", err);
    notify("Error al cargar detalles.", "error");
    setInputsStateView("error", err?.message || String(err));
  }

  btnVolver?.addEventListener("click", () => {
    if (window.cerper?.openPage) window.cerper.openPage("sessions_panel.html");
    else window.location.href = "sessions_panel.html";
  });
});

function tableToTSV(table) {
  const rows = [];
  const head = table.tHead?.rows[0];
  if (head) rows.push([...head.cells].map((c) => cellText(c)).join("\t"));
  for (const tr of table.tBodies[0]?.rows || []) {
    rows.push([...tr.cells].map((c) => cellText(c)).join("\t"));
  }
  return rows.join("\n");
}

function cellText(cell) {
  return String(cell.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}
