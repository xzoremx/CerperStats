/**
 * PDF Config Page - JavaScript Logic
 * Handles section navigation, mode selection, options, report generation, and inbox
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Get session ID from sessionStorage
    const sessionId = sessionStorage.getItem('sessionID') || sessionStorage.getItem('sessionSeleccionada');

    // DOM Elements - Navigation
    const menuConfig = document.getElementById('menu-config');
    const menuBuzon = document.getElementById('menu-buzon');
    const viewConfig = document.getElementById('view-config');
    const viewBuzon = document.getElementById('view-buzon');
    const btnNewReport = document.getElementById('btn-new-report');

    // DOM Elements - Config
    const btnBack = document.getElementById('btn-back');
    const btnGenerate = document.getElementById('btn-generate');
    const sessionText = document.getElementById('session-text');
    const modeGrid = document.getElementById('mode-grid');
    const modeCards = modeGrid?.querySelectorAll('.mode-card') || [];
    const optGraphs = document.getElementById('opt-graphs');
    const optTables = document.getElementById('opt-tables');
    const progressSection = document.getElementById('progress-section');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const progressStatus = document.getElementById('progress-status');
    const summaryText = document.getElementById('summary-text');

    // DOM Elements - Previews
    const unifiedPreview = document.getElementById('unified-preview');
    const analitoPreview = document.getElementById('analito-preview');
    const nivelPreview = document.getElementById('nivel-preview');
    const combinedPreview = document.getElementById('combined-preview');

    // DOM Elements - Inbox
    const inboxBadge = document.getElementById('inbox-badge');
    const inboxList = document.getElementById('inbox-list');
    const inboxStats = document.getElementById('inbox-stats');
    const inboxEmpty = document.getElementById('inbox-empty');

    // State
    let activeView = 'config';
    let selectedMode = 'unified';
    let isGenerating = false;
    let resultsData = [];
    let analitos = new Set();
    let niveles = new Set();
    let inboxReports = [];

    // === NAVIGATION ===
    function setActiveView(view) {
        activeView = view;

        // Update menu styles
        menuConfig?.classList.toggle('active', view === 'config');
        menuBuzon?.classList.toggle('active', view === 'buzon');

        // Show/hide views
        viewConfig?.classList.toggle('hidden', view !== 'config');
        viewBuzon?.classList.toggle('hidden', view !== 'buzon');

        // Refresh inbox when switching to it
        if (view === 'buzon') {
            loadInboxReports();
        }
    }

    menuConfig?.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveView('config');
    });

    menuBuzon?.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveView('buzon');
    });

    btnNewReport?.addEventListener('click', () => {
        setActiveView('config');
    });

    // Back button
    btnBack?.addEventListener('click', () => {
        if (window.cerper?.openPage) {
            window.cerper.openPage('evaluation_select.html');
        }
    });

    // Validate session
    if (!sessionId) {
        if (sessionText) {
            sessionText.textContent = 'Sin sesión activa';
            sessionText.classList.add('text-yellow-400');
        }
        if (btnGenerate) btnGenerate.disabled = true;
        return;
    }

    // Load session info and results
    try {
        const [sessionRes, resultsRes] = await Promise.all([
            window.cerper?.getSessionInfo(sessionId),
            window.cerper?.getResultadosPreliminares(sessionId)
        ]);

        if (sessionRes?.ok && sessionRes.data) {
            const s = sessionRes.data;
            const parts = [];
            if (s.lab_nombre || s.lab_key) parts.push(s.lab_nombre || s.lab_key);
            parts.push(`#${sessionId}`);
            if (sessionText) sessionText.textContent = parts.join(' • ');
        }

        if (resultsRes?.ok && Array.isArray(resultsRes.data)) {
            resultsData = resultsRes.data;

            // Extract unique analitos and niveles
            resultsData.forEach(r => {
                if (r.analito) analitos.add(r.analito);
                if (r.nivel != null) niveles.add(r.nivel);
            });

            updatePreviews();
        } else {
            if (sessionText) {
                sessionText.textContent = 'Sin resultados';
                sessionText.classList.add('text-yellow-400');
            }
            if (btnGenerate) btnGenerate.disabled = true;
        }
    } catch (err) {
        console.error('[PDFConfig] Error loading data:', err);
        if (sessionText) {
            sessionText.textContent = 'Error cargando';
            sessionText.classList.add('text-red-400');
        }
    }

    // Mode selection
    modeCards.forEach(card => {
        card.addEventListener('click', () => {
            if (isGenerating) return;

            // Update selection
            modeCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedMode = card.dataset.mode;

            updateSummary();
        });
    });

    function updatePreviews() {
        const analitoCount = analitos.size || 1;
        const nivelCount = niveles.size || 1;
        const combinedCount = analitoCount * nivelCount;

        if (unifiedPreview) unifiedPreview.textContent = '1 PDF';
        if (analitoPreview) analitoPreview.textContent = `${analitoCount} PDF${analitoCount > 1 ? 's' : ''}`;
        if (nivelPreview) nivelPreview.textContent = `${nivelCount} PDF${nivelCount > 1 ? 's' : ''}`;
        if (combinedPreview) combinedPreview.textContent = `${combinedCount} PDF${combinedCount > 1 ? 's' : ''}`;

        updateSummary();
    }

    function updateSummary() {
        let count = 1;
        let description = '';

        switch (selectedMode) {
            case 'by_analito':
                count = analitos.size || 1;
                description = `${count} PDF${count > 1 ? 's' : ''} (uno por analito)`;
                break;
            case 'by_nivel':
                count = niveles.size || 1;
                description = `${count} PDF${count > 1 ? 's' : ''} (uno por nivel)`;
                break;
            case 'by_analito_nivel':
                count = (analitos.size || 1) * (niveles.size || 1);
                description = `${count} PDF${count > 1 ? 's' : ''} (uno por combinación)`;
                break;
            default:
                description = '1 PDF con todo el contenido';
        }

        if (summaryText) {
            summaryText.innerHTML = `<span class="text-indigo-400 font-medium">Se generarán:</span> ${description}`;
        }
    }

    // Generate reports
    btnGenerate?.addEventListener('click', async () => {
        if (isGenerating || !sessionId) return;

        isGenerating = true;
        btnGenerate.disabled = true;
        btnGenerate.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Generando...';
        document.body.classList.add('generating');

        // Show progress
        if (progressSection) progressSection.classList.remove('hidden');
        setProgress(0, 'Preparando datos...');

        const config = {
            group_by: selectedMode,
            include_graphs: optGraphs?.checked !== false,
            include_tables: optTables?.checked !== false
        };

        try {
            setProgress(10, 'Enviando a generador Python...');

            const result = await window.cerper.generateReports(sessionId, config);

            if (!result.ok) {
                throw new Error(result.error || result.message || 'Error desconocido');
            }

            setProgress(80, 'Subiendo PDFs al servidor...');

            const reportCount = result.reports?.length || 0;

            setProgress(100, `¡Listo! ${reportCount} reporte${reportCount !== 1 ? 's' : ''} generado${reportCount !== 1 ? 's' : ''}.`);

            // Refresh inbox and switch to it
            setTimeout(async () => {
                await loadInboxReports();
                setActiveView('buzon');

                // Reset button
                isGenerating = false;
                btnGenerate.disabled = false;
                btnGenerate.innerHTML = '<i data-lucide="file-output" class="w-5 h-5"></i> Generar Reportes';
                if (window.lucide) lucide.createIcons();
                document.body.classList.remove('generating');
                if (progressSection) progressSection.classList.add('hidden');
            }, 1500);

        } catch (err) {
            console.error('[PDFConfig] Generation error:', err);
            setProgress(0, `Error: ${err.message}`);
            if (progressFill) progressFill.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';

            // Re-enable button after error
            setTimeout(() => {
                isGenerating = false;
                btnGenerate.disabled = false;
                btnGenerate.innerHTML = '<i data-lucide="file-output" class="w-5 h-5"></i> Reintentar';
                if (window.lucide) lucide.createIcons();
                document.body.classList.remove('generating');
            }, 2000);
        }
    });

    function setProgress(percent, status) {
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `${percent}%`;
        if (progressStatus) progressStatus.textContent = status;
    }

    // === INBOX FUNCTIONALITY ===

    async function loadInboxReports() {
        if (!sessionId) return;

        try {
            const result = await window.cerper.getSessionReports(sessionId);
            if (result?.ok && Array.isArray(result.data)) {
                inboxReports = result.data;
                renderInboxList();
                updateInboxBadge();
            }
        } catch (err) {
            console.error('[PDFConfig] Error loading inbox:', err);
        }
    }

    function updateInboxBadge() {
        const count = inboxReports.length;
        if (inboxBadge) {
            inboxBadge.textContent = count > 99 ? '99+' : count;
            inboxBadge.classList.toggle('hidden', count === 0);
        }
        if (inboxStats) {
            inboxStats.textContent = `${count} reporte${count !== 1 ? 's' : ''} generado${count !== 1 ? 's' : ''}`;
        }
    }

    function renderInboxList() {
        if (!inboxList) return;

        if (inboxReports.length === 0) {
            if (inboxEmpty) inboxEmpty.classList.remove('hidden');
            // Clear all except empty state
            Array.from(inboxList.children).forEach(child => {
                if (child.id !== 'inbox-empty') child.remove();
            });
            if (window.lucide) lucide.createIcons();
            return;
        }

        if (inboxEmpty) inboxEmpty.classList.add('hidden');

        // Build HTML
        let html = '';
        inboxReports.forEach(report => {
            const tipoLabel = getTipoLabel(report.tipo_informe);
            const planInfo = report.plan_json || {};
            const date = new Date(report.creado_en).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
            const sizeKb = ((report.pdf_size_bytes || 0) / 1024).toFixed(0);

            let iconColor = 'from-indigo-500 to-purple-600';
            if (report.tipo_informe === 'by_analito') iconColor = 'from-blue-500 to-cyan-600';
            if (report.tipo_informe === 'by_nivel') iconColor = 'from-orange-500 to-amber-600';
            if (report.tipo_informe === 'unified') iconColor = 'from-emerald-500 to-teal-600';

            let subtitle = '';
            if (planInfo.analito) subtitle = planInfo.analito;
            if (planInfo.nivel) subtitle += (subtitle ? ' • ' : '') + `Nv.${planInfo.nivel}`;

            html += `
                <div class="report-item flex items-center gap-4" data-report-id="${report.id}">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br ${iconColor} flex items-center justify-center flex-shrink-0">
                        <i data-lucide="file-text" class="w-6 h-6 text-white"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-white truncate">${tipoLabel}</div>
                        <div class="text-sm text-gray-500">${subtitle || date} • ${sizeKb} KB</div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="delete-btn w-10 h-10 rounded-lg flex items-center justify-center transition-all" onclick="deleteInboxReport(${report.id})">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>
                        <button class="download-btn w-10 h-10 rounded-lg flex items-center justify-center transition-all" onclick="downloadInboxReport(${report.id})">
                            <i data-lucide="download" class="w-5 h-5 text-white"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        // Keep empty state element, replace rest
        const emptyEl = inboxEmpty?.cloneNode(true);
        inboxList.innerHTML = html;
        if (emptyEl) {
            emptyEl.classList.add('hidden');
            inboxList.appendChild(emptyEl);
        }

        if (window.lucide) lucide.createIcons();
    }

    function getTipoLabel(tipo) {
        switch (tipo) {
            case 'by_analito': return 'Reporte por Analito';
            case 'by_nivel': return 'Reporte por Nivel';
            case 'by_analito_nivel': return 'Analito + Nivel';
            case 'unified': return 'Reporte Unificado';
            default: return 'Reporte PDF';
        }
    }

    // Global functions for inline onclick handlers
    window.downloadInboxReport = async function (reportId) {
        try {
            const result = await window.cerper.downloadReportPdf(reportId);
            if (!result.ok) throw new Error(result.error);

            // Convert base64 to blob and download
            const byteCharacters = atob(result.pdf_base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte_${reportId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[PDFConfig] Download error:', err);
            alert('Error descargando: ' + err.message);
        }
    };

    window.deleteInboxReport = async function (reportId) {
        if (!confirm('¿Eliminar este reporte?')) return;

        try {
            const result = await window.cerper.deleteReport(reportId);
            if (!result.ok) throw new Error(result.error);

            // Refresh list
            await loadInboxReports();
        } catch (err) {
            console.error('[PDFConfig] Delete error:', err);
            alert('Error eliminando: ' + err.message);
        }
    };

    // Load inbox on page load
    loadInboxReports();

    // Initialize icons
    if (window.lucide) lucide.createIcons();
});
