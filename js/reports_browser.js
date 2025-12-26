/**
 * Reports Browser - JavaScript Logic
 * Displays and manages generated PDF reports
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Get session ID from sessionStorage
    const sessionId = sessionStorage.getItem('sessionID') || sessionStorage.getItem('sessionSeleccionada');

    // DOM Elements
    const btnBack = document.getElementById('btn-back');
    const btnNewReport = document.getElementById('btn-new-report');
    const btnGenerateFirst = document.getElementById('btn-generate-first');
    const sessionSubtitle = document.getElementById('session-subtitle');
    const reportsGrid = document.getElementById('reports-grid');
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');
    const statsCount = document.getElementById('stats-count');
    const statsSize = document.getElementById('stats-size');

    // Navigation
    btnBack?.addEventListener('click', () => {
        if (window.cerper?.openPage) {
            window.cerper.openPage('evaluation_select.html');
        }
    });

    btnNewReport?.addEventListener('click', goToPdfConfig);
    btnGenerateFirst?.addEventListener('click', goToPdfConfig);

    function goToPdfConfig() {
        if (window.cerper?.openPage) {
            window.cerper.openPage('pdf_config.html');
        }
    }

    // Validate session
    if (!sessionId) {
        if (sessionSubtitle) sessionSubtitle.textContent = 'No hay sesión activa';
        showEmpty();
        return;
    }

    if (sessionSubtitle) sessionSubtitle.textContent = `Sesión #${sessionId}`;

    // Show loading
    showLoading();

    // Load reports
    try {
        const result = await window.cerper.getSessionReports(sessionId);

        if (!result.ok) {
            throw new Error(result.error || 'Error cargando reportes');
        }

        const reports = result.data || [];

        if (reports.length === 0) {
            showEmpty();
        } else {
            renderReports(reports);
        }
    } catch (err) {
        console.error('[ReportsBrowser] Error loading reports:', err);
        showEmpty();
    }

    function showLoading() {
        if (loadingState) loadingState.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
        if (reportsGrid) reportsGrid.innerHTML = '';
    }

    function showEmpty() {
        if (loadingState) loadingState.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        if (reportsGrid) reportsGrid.innerHTML = '';
        updateStats(0, 0);
    }

    function renderReports(reports) {
        if (loadingState) loadingState.classList.add('hidden');
        if (emptyState) emptyState.classList.add('hidden');

        if (!reportsGrid) return;

        // Calculate total size
        let totalBytes = 0;
        reports.forEach(r => { totalBytes += r.pdf_size_bytes || 0; });
        updateStats(reports.length, totalBytes);

        // Render cards
        reportsGrid.innerHTML = reports.map(report => {
            const tipoLabel = getTipoLabel(report.tipo_informe);
            const planInfo = report.plan_json || {};
            const date = new Date(report.creado_en).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const sizeKb = ((report.pdf_size_bytes || 0) / 1024).toFixed(1);

            let badgeColor = 'from-indigo-500 to-purple-600';
            if (report.tipo_informe === 'by_analito') badgeColor = 'from-blue-500 to-cyan-600';
            if (report.tipo_informe === 'by_nivel') badgeColor = 'from-orange-500 to-amber-600';
            if (report.tipo_informe === 'by_analito_nivel') badgeColor = 'from-purple-500 to-pink-600';
            if (report.tipo_informe === 'unified') badgeColor = 'from-emerald-500 to-teal-600';

            let subtitle = '';
            if (planInfo.analito) subtitle = `Analito: ${planInfo.analito}`;
            if (planInfo.nivel) subtitle += (subtitle ? ' • ' : '') + `Nivel: ${planInfo.nivel}`;

            return `
        <div class="glass-card report-card rounded-xl p-5" data-report-id="${report.id}">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-lg bg-gradient-to-br ${badgeColor} flex items-center justify-center flex-shrink-0">
              <i data-lucide="file-text" class="w-6 h-6 text-white"></i>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-white mb-1 truncate">${tipoLabel}</h3>
              ${subtitle ? `<p class="text-sm text-gray-400 truncate">${subtitle}</p>` : ''}
              <p class="text-xs text-gray-500 mt-1">${date}</p>
            </div>
          </div>
          
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
            <span class="text-xs text-gray-500">${sizeKb} KB</span>
            <div class="flex items-center gap-2">
              <button class="btn-delete px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 delete-btn">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
              </button>
              <button class="btn-download px-4 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 download-btn">
                <i data-lucide="download" class="w-3 h-3 download-icon"></i>
                Descargar
              </button>
            </div>
          </div>
        </div>
      `;
        }).join('');

        // Reinit icons
        if (window.lucide) lucide.createIcons();

        // Attach event listeners
        reportsGrid.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', handleDownload);
        });

        reportsGrid.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', handleDelete);
        });
    }

    function getTipoLabel(tipo) {
        switch (tipo) {
            case 'by_analito': return 'Reporte por Analito';
            case 'by_nivel': return 'Reporte por Nivel';
            case 'by_analito_nivel': return 'Reporte Analito + Nivel';
            case 'unified': return 'Reporte Unificado';
            default: return 'Reporte';
        }
    }

    function updateStats(count, bytes) {
        if (statsCount) {
            statsCount.textContent = `${count} reporte${count !== 1 ? 's' : ''}`;
        }
        if (statsSize) {
            const kb = (bytes / 1024).toFixed(1);
            const mb = (bytes / (1024 * 1024)).toFixed(2);
            statsSize.textContent = bytes > 1024 * 1024 ? `${mb} MB total` : `${kb} KB total`;
        }
    }

    async function handleDownload(e) {
        e.stopPropagation();
        const card = e.target.closest('.report-card');
        const reportId = card?.dataset.reportId;
        if (!reportId) return;

        // Show downloading state
        card.classList.add('downloading');
        const btn = e.target.closest('.download-btn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Descargando...';
        if (window.lucide) lucide.createIcons();

        try {
            const result = await window.cerper.downloadReportPdf(reportId);

            if (!result.ok) {
                throw new Error(result.error || 'Error descargando');
            }

            // Convert base64 to blob and download
            const byteCharacters = atob(result.pdf_base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });

            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte_${reportId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error('[ReportsBrowser] Download error:', err);
            alert('Error descargando el reporte: ' + err.message);
        } finally {
            card.classList.remove('downloading');
            btn.innerHTML = originalHtml;
            if (window.lucide) lucide.createIcons();
        }
    }

    async function handleDelete(e) {
        e.stopPropagation();
        const card = e.target.closest('.report-card');
        const reportId = card?.dataset.reportId;
        if (!reportId) return;

        if (!confirm('¿Eliminar este reporte permanentemente?')) return;

        try {
            const result = await window.cerper.deleteReport(reportId);

            if (!result.ok) {
                throw new Error(result.error || 'Error eliminando');
            }

            // Remove card with animation
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';

            setTimeout(() => {
                card.remove();

                // Check if empty
                const remaining = reportsGrid.querySelectorAll('.report-card');
                if (remaining.length === 0) {
                    showEmpty();
                } else {
                    // Update stats
                    let totalBytes = 0;
                    remaining.forEach(c => {
                        // Re-fetch would be better, but for now just update count
                    });
                    updateStats(remaining.length, 0);
                }
            }, 300);

        } catch (err) {
            console.error('[ReportsBrowser] Delete error:', err);
            alert('Error eliminando el reporte: ' + err.message);
        }
    }

    // Initialize icons
    if (window.lucide) lucide.createIcons();
});
