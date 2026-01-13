document.addEventListener("DOMContentLoaded", async () => {
  const sessionIdRaw =
    sessionStorage.getItem("sessionSeleccionada") ||
    sessionStorage.getItem("sessionID") ||
    sessionStorage.getItem("evalResultsSessionId");

  const sessionId = Number(sessionIdRaw);
  const subtitleEl = document.getElementById("session-subtitle");
  const reportsStatsEl = document.getElementById("reports-stats");
  const reportsListEl = document.getElementById("reports-list");
  const reportsLoadingEl = document.getElementById("reports-loading");
  const reportsEmptyEl = document.getElementById("reports-empty");
  const reportsErrorEl = document.getElementById("reports-error");
  const searchInputEl = document.getElementById("search-input");
  const filterEstadoEl = document.getElementById("filter-estado");
  const btnBack = document.getElementById("btn-back");
  const btnRefresh = document.getElementById("btn-refresh");

  const state = {
    loading: true,
    error: "",
    reports: [],
    filtered: [],
    query: "",
    estado: "",
  };

  const STATUS_OPTIONS = [
    { value: "generado", label: "Generado" },
    { value: "a_revisar", label: "A revisar" },
    { value: "aprobado", label: "Aprobado" },
    { value: "rechazado", label: "Desaprobado" },
    { value: "archivado", label: "Archivado" },
  ];

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatTipoInforme(tipo) {
    switch (String(tipo || "").toLowerCase()) {
      case "by_analito":
        return "Por analito";
      case "by_nivel":
        return "Por nivel";
      case "by_analito_nivel":
        return "Analito × nivel";
      case "unified":
        return "Unificado";
      case "resultado":
        return "Resultado";
      default:
        return String(tipo || "—");
    }
  }

  function formatEstado(estado) {
    const value = String(estado || "").toLowerCase();
    if (value === "a_revisar") return "A revisar";
    if (value === "aprobado") return "Aprobado";
    if (value === "rechazado") return "Desaprobado";
    if (value === "archivado") return "Archivado";
    if (value === "generado") return "Generado";
    return value ? value : "—";
  }

  function estadoBadgeClasses(estado) {
    const value = String(estado || "").toLowerCase();
    if (value === "aprobado") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    if (value === "rechazado") return "bg-red-500/15 text-red-300 border-red-500/30";
    if (value === "a_revisar") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    if (value === "archivado") return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    return "bg-sky-500/15 text-sky-300 border-sky-500/30";
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatSize(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  function computeFiltered() {
    const q = normalize(state.query);
    const e = String(state.estado || "").trim().toLowerCase();

    const filtered = (state.reports || []).filter((r) => {
      if (e && String(r.estado || "").toLowerCase() !== e) return false;
      if (!q) return true;

      const haystack = normalize(
        [
          r.id,
          r.tipo_informe,
          r.version_informe,
          r.estado,
          r.hash_documento,
          r.observaciones,
          r.usuario,
          r.session_id,
        ]
          .filter(Boolean)
          .join(" ")
      );
      return haystack.includes(q);
    });

    state.filtered = filtered;
  }

  function setLoading(view, message = "") {
    if (reportsLoadingEl) reportsLoadingEl.classList.toggle("hidden", view !== "loading");
    if (reportsEmptyEl) reportsEmptyEl.classList.toggle("hidden", view !== "empty");
    if (reportsErrorEl) reportsErrorEl.classList.toggle("hidden", view !== "error");

    if (view === "error" && reportsErrorEl) {
      reportsErrorEl.textContent = message || "Error cargando reportes.";
    }
  }

  function renderStats() {
    if (!reportsStatsEl) return;
    const total = state.reports.length;
    const showing = state.filtered.length;
    const suffix = total === 1 ? "reporte" : "reportes";
    if (total === showing) {
      reportsStatsEl.textContent = `${total} ${suffix}`;
    } else {
      reportsStatsEl.textContent = `${showing} de ${total} ${suffix}`;
    }
  }

  function renderList() {
    computeFiltered();
    renderStats();

    if (!reportsListEl) return;

    reportsListEl.querySelectorAll('[data-rendered="reports"]').forEach((n) => n.remove());

    if (state.loading) {
      setLoading("loading");
      return;
    }

    if (state.error) {
      setLoading("error", state.error);
      return;
    }

    if (!state.filtered.length) {
      setLoading("empty");
      return;
    }

    setLoading("ready");

    const html = state.filtered
      .map((report) => {
        const id = report.id;
        const tipo = formatTipoInforme(report.tipo_informe);
        const estado = String(report.estado || "").toLowerCase();
        const estadoLabel = formatEstado(report.estado);
        const badgeClasses = estadoBadgeClasses(estado);

        const created = formatDate(report.creado_en);
        const updated = formatDate(report.actualizado_en);
        const size = formatSize(report.pdf_size_bytes);
        const usuario = report.usuario ? String(report.usuario) : "—";
        const obs = report.observaciones ? String(report.observaciones) : "";
        const testsCount = Array.isArray(report.tests_included) ? report.tests_included.length : 0;

        const statusOptionsHtml = STATUS_OPTIONS.map((o) => {
          const selected = o.value === estado ? "selected" : "";
          return `<option value="${o.value}" ${selected}>${escapeHtml(o.label)}</option>`;
        }).join("");

        return `
          <div class="report-item flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-report-id="${id}">
            <div class="flex items-start gap-4">
              <div class="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-300 flex-shrink-0">
                <i data-lucide="file-text" class="w-5 h-5"></i>
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <div class="text-white font-semibold truncate max-w-[420px]">Reporte #${id} · ${escapeHtml(tipo)}</div>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${badgeClasses}">${escapeHtml(estadoLabel)}</span>
                </div>
                <div class="text-sm text-gray-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span><span class="text-gray-500">Creado:</span> ${escapeHtml(created)}</span>
                  <span><span class="text-gray-500">Actualizado:</span> ${escapeHtml(updated)}</span>
                  <span><span class="text-gray-500">Tamaño:</span> ${escapeHtml(size)}</span>
                  <span><span class="text-gray-500">Usuario:</span> ${escapeHtml(usuario)}</span>
                  <span><span class="text-gray-500">Tests:</span> ${testsCount}</span>
                </div>
                ${
                  obs
                    ? `<div class="text-sm text-gray-400 mt-2"><span class="text-gray-500">Obs:</span> ${escapeHtml(obs)}</div>`
                    : ""
                }
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
              <select class="filter-select px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                data-action="status" data-report-id="${id}" data-prev-value="${escapeHtml(estado)}">
                ${statusOptionsHtml}
              </select>
              <button class="download-btn px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
                data-action="download" data-report-id="${id}">
                <i data-lucide="download" class="w-4 h-4"></i>
                Descargar
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    const wrapper = document.createElement("div");
    wrapper.dataset.rendered = "reports";
    wrapper.className = "space-y-3";
    wrapper.innerHTML = html;
    reportsListEl.appendChild(wrapper);

    if (window.lucide?.createIcons) {
      try {
        window.lucide.createIcons();
      } catch (_) {}
    }
  }

  async function downloadReport(reportId) {
    const id = Number(reportId);
    if (!id) return;

    const btn = reportsListEl?.querySelector(`button[data-action="download"][data-report-id="${id}"]`);
    if (btn) {
      btn.disabled = true;
      btn.classList.add("opacity-70");
    }

    try {
      const res = await window.cerper.downloadReportPdf(id);
      if (!res?.ok || !res.pdf_base64) throw new Error(res?.error || "No se pudo descargar el PDF");

      const byteChars = atob(res.pdf_base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });

      const a = document.createElement("a");
      const found = state.reports.find((r) => Number(r.id) === id);
      const tipo = found?.tipo_informe ? String(found.tipo_informe) : "resultado";
      const filename = `reporte_${tipo}_session_${sessionId}_${id}.pdf`;
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);

      notify("PDF descargado.", "success");
    } catch (err) {
      console.error("[Reports] Download error:", err);
      notify(err?.message || "No se pudo descargar el PDF.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("opacity-70");
      }
    }
  }

  async function updateStatus(reportId, estado) {
    const id = Number(reportId);
    const next = String(estado || "").trim().toLowerCase();
    if (!id || !next) return;

    const select = reportsListEl?.querySelector(`select[data-action="status"][data-report-id="${id}"]`);
    const prev = select ? String(select.dataset.prevValue || "") : "";

    if (select) {
      select.disabled = true;
      select.classList.add("opacity-70");
    }

    try {
      const res = await window.cerper.updateReportStatus(id, next);
      if (!res?.ok) throw new Error(res?.error || "No se pudo actualizar el estado");

      const idx = state.reports.findIndex((r) => Number(r.id) === id);
      if (idx >= 0) state.reports[idx].estado = next;
      if (select) select.dataset.prevValue = next;

      notify("Estado actualizado.", "success");
      renderList();
    } catch (err) {
      console.error("[Reports] Status update error:", err);
      notify(err?.message || "No se pudo actualizar el estado.", "error");

      if (select) {
        if (prev) select.value = prev;
      }
    } finally {
      if (select) {
        select.disabled = false;
        select.classList.remove("opacity-70");
      }
    }
  }

  async function loadSessionMeta() {
    if (!subtitleEl) return;
    try {
      const res = await window.cerper.getSessionInfo(sessionId);
      if (!res?.ok) throw new Error(res?.error || "No se pudo cargar la sesión");
      const info = res.data || {};
      const labName = info.lab_nombre || info.lab_key || "";
      const producto = info.producto ? String(info.producto) : "";
      subtitleEl.textContent = `Sesión #${info.id ?? sessionId}${[labName, producto].filter(Boolean).length ? " · " : ""}${[labName, producto].filter(Boolean).join(" · ")}`.trim();
    } catch (err) {
      subtitleEl.textContent = `Sesión #${sessionId}`;
    }
  }

  async function loadReports() {
    state.loading = true;
    state.error = "";
    renderList();

    try {
      const res = await window.cerper.getSessionReports(sessionId);
      if (!res?.ok) throw new Error(res?.error || "No se pudo listar reportes");
      state.reports = Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      state.error = err?.message || "Error cargando reportes.";
      state.reports = [];
    } finally {
      state.loading = false;
      renderList();
    }
  }

  function goBack() {
    try {
      sessionStorage.setItem("sessionID", String(sessionId));
      sessionStorage.setItem("sessionSeleccionada", String(sessionId));
    } catch (_) {}

    const target = "session_detail.html";
    if (window.cerper?.openPage) window.cerper.openPage(target);
    else window.location.href = target;
  }

  if (!sessionId) {
    notify("No hay sesión seleccionada.", "error");
    if (window.cerper?.openPage) window.cerper.openPage("sessions_panel.html");
    else window.location.href = "sessions_panel.html";
    return;
  }

  btnBack?.addEventListener("click", goBack);
  btnRefresh?.addEventListener("click", () => loadReports());

  searchInputEl?.addEventListener("input", (e) => {
    state.query = e.target.value || "";
    renderList();
  });

  filterEstadoEl?.addEventListener("change", (e) => {
    state.estado = e.target.value || "";
    renderList();
  });

  reportsListEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action][data-report-id]");
    if (!btn) return;
    const action = btn.dataset.action;
    const reportId = btn.dataset.reportId;
    if (action === "download") downloadReport(reportId);
  });

  reportsListEl?.addEventListener("change", (e) => {
    const select = e.target.closest("select[data-action='status'][data-report-id]");
    if (!select) return;
    updateStatus(select.dataset.reportId, select.value);
  });

  await loadSessionMeta();
  await loadReports();
});
