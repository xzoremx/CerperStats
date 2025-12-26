/**
 * PDF Config Page - JavaScript Logic
 * Handles mode selection, options, and report generation
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Get session ID from sessionStorage
    const sessionId = sessionStorage.getItem('sessionID') || sessionStorage.getItem('sessionSeleccionada');

    // DOM Elements
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

    // Preview elements
    const unifiedPreview = document.getElementById('unified-preview');
    const analitoPreview = document.getElementById('analito-preview');
    const nivelPreview = document.getElementById('nivel-preview');
    const combinedPreview = document.getElementById('combined-preview');

    // State
    let selectedMode = 'unified';
    let isGenerating = false;
    let resultsData = [];
    let analitos = new Set();
    let niveles = new Set();

    // Back button
    btnBack?.addEventListener('click', () => {
        if (window.cerper?.openPage) {
            window.cerper.openPage('evaluation_select.html');
        }
    });

    // Validate session
    if (!sessionId) {
        if (sessionText) {
            sessionText.textContent = 'No hay sesión activa. Vuelve al flujo de evaluación.';
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
            if (s.metodo) parts.push(s.metodo);
            parts.push(`Sesión #${sessionId}`);
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
                sessionText.textContent = 'No hay resultados para generar reportes. Ejecuta las evaluaciones primero.';
                sessionText.classList.add('text-yellow-400');
            }
            if (btnGenerate) btnGenerate.disabled = true;
        }
    } catch (err) {
        console.error('[PDFConfig] Error loading data:', err);
        if (sessionText) {
            sessionText.textContent = 'Error cargando datos de sesión.';
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

            // Wait a moment then redirect to reports browser
            setTimeout(() => {
                sessionStorage.setItem('lastGeneratedReports', JSON.stringify(result.reports));
                if (window.cerper?.openPage) {
                    window.cerper.openPage('reports_browser.html');
                }
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

    // Initialize icons
    if (window.lucide) lucide.createIcons();
});
