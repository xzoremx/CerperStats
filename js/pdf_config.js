/**
 * PDF Config Page - JavaScript Logic
 * Handles section navigation, mode selection, options, report generation, and inbox
 * 
 * PDFs generados se mantienen localmente hasta que el usuario los guarda explícitamente.
 */

// Inline modal dialogs (shared with input_data steps)
function normalizeModalMessage(message) {
    if (message == null) return '';
    return String(message).replace(/\n/g, '<br>');
}

function showInlineModal({ title, message, confirmText, cancelText }) {
    return new Promise((resolve) => {
        const existing = document.querySelector('.cs-inline-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'cs-inline-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'cs-inline-modal';

        const titleEl = document.createElement('h3');
        titleEl.className = 'cs-inline-modal__title';
        titleEl.textContent = title || 'Confirmar';

        const messageEl = document.createElement('p');
        messageEl.className = 'cs-inline-modal__message';
        messageEl.innerHTML = normalizeModalMessage(message);

        const buttons = document.createElement('div');
        buttons.className = 'cs-inline-modal__actions';

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.textContent = confirmText || 'Aceptar';
        confirmBtn.className = 'cs-inline-modal__btn cs-inline-modal__btn--primary';

        buttons.appendChild(confirmBtn);

        let cancelBtn = null;
        if (cancelText) {
            cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.textContent = cancelText;
            cancelBtn.className = 'cs-inline-modal__btn cs-inline-modal__btn--secondary';
            buttons.appendChild(cancelBtn);
        }

        modal.appendChild(titleEl);
        modal.appendChild(messageEl);
        modal.appendChild(buttons);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const closeModal = (value) => {
            document.removeEventListener('keydown', keyHandler);
            overlay.classList.add('is-closing');
            setTimeout(() => {
                overlay.remove();
                resolve(value);
            }, 200);
        };

        const keyHandler = (ev) => {
            if (ev.key === 'Escape') {
                ev.preventDefault();
                closeModal(cancelBtn ? false : true);
            } else if (ev.key === 'Enter') {
                ev.preventDefault();
                closeModal(true);
            }
        };

        confirmBtn.addEventListener('click', () => closeModal(true));
        if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal(false));

        document.addEventListener('keydown', keyHandler);
        confirmBtn.focus();
    });
}

window.showCustomAlert = async function (message, title = 'Información', type = 'info') {
    await showInlineModal({
        title: title || 'Información',
        message,
        confirmText: 'Aceptar'
    });
};

window.showCustomConfirm = async function (message, title = 'Confirmar', confirmText = 'Aceptar', cancelText = 'Cancelar', type = 'warning') {
    return showInlineModal({
        title: title || 'Confirmar',
        message,
        confirmText: confirmText || 'Aceptar',
        cancelText: cancelText || 'Cancelar'
    });
};

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

    // DOM Elements - Session Status
    const sessionFinalizeCheckbox = document.getElementById('session-finalize-checkbox');
    const sessionEstadoBadge = document.getElementById('session-estado-badge');
    const sessionFinalizeHint = document.getElementById('session-finalize-hint');

    // DOM Elements - Filters and Bulk Actions
    const filterTipo = document.getElementById('filter-tipo');
    const searchInput = document.getElementById('search-input');
    const selectionInfo = document.getElementById('selection-info');
    const selectionCount = document.getElementById('selection-count');
    const bulkActionsBar = document.getElementById('bulk-actions-bar');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const btnBulkDownloadZip = document.getElementById('btn-bulk-download-zip');
    const bulkSaveForm = document.getElementById('bulk-save-form');
    const bulkComment = document.getElementById('bulk-comment');

    // Analyst names section elements
    const analystNamesSection = document.getElementById('analyst-names-section');
    const analystInputsContainer = document.getElementById('analyst-inputs-container');
    const analystValidationMsg = document.getElementById('analyst-validation-msg');

    // Execution date section elements (MANDATORY)
    const executionDateInput = document.getElementById('execution-date-input');
    const executionDateError = document.getElementById('execution-date-error');

    // State
    let activeView = 'config';
    let selectedMode = 'unified';
    let isGenerating = false;
    let sessionEstado = '';
    let resultsData = [];
    let analitos = new Set();
    let niveles = new Set();

    // LOCAL (unsaved) PDFs - kept in memory
    let localReports = [];
    // SAVED PDFs - from database
    let savedReports = [];
    // Selected items (Set of temp_id for local, id for saved)
    let selectedItems = new Set();
    // Track which local reports have comment enabled
    let commentEnabled = new Set();
    // Track which local reports are marked as urgent (a_revisar)
    let urgentReview = new Set();
    // Track which local reports are marked as important/urgent
    let importantReports = new Set();
    // Session parameter info
    let sessionParametro = '';
    let sessionNumParametros = 0;
    let analystNames = []; // Array of analyst names when parametro === 'Analista'

    function normalizeSessionEstado(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return '';
        if (raw === 'activo' || raw === 'activa' || raw === 'abierta' || raw === 'abierto') return 'activo';
        if (raw === 'cerrada' || raw === 'cerrado' || raw === 'cancelado') return 'cancelada';
        if (raw === 'finalizado') return 'finalizada';
        if (raw === 'completada' || raw === 'completado') return 'finalizada';
        return raw;
    }

    function formatSessionEstadoLabel(value) {
        const estado = normalizeSessionEstado(value);
        if (estado === 'activo') return 'ACTIVO';
        if (estado === 'suficiente') return 'SUFICIENTE';
        if (estado === 'finalizada') return 'FINALIZADA';
        if (estado === 'cancelada') return 'CANCELADA';
        return '—';
    }

    function updateSessionEstadoBadge() {
        if (!sessionEstadoBadge) return;

        const estado = normalizeSessionEstado(sessionEstado);
        const base = 'px-2.5 py-1 rounded-full text-xs font-semibold border';
        const variants = {
            activo: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200',
            suficiente: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200',
            finalizada: 'bg-violet-500/10 border-violet-500/20 text-violet-200',
            cancelada: 'bg-red-500/10 border-red-500/20 text-red-200',
            default: 'bg-white/10 border-white/10 text-gray-200'
        };

        sessionEstadoBadge.textContent = formatSessionEstadoLabel(estado);
        sessionEstadoBadge.className = `${base} ${variants[estado] || variants.default}`;
    }

    function updateFinalizeControls() {
        updateSessionEstadoBadge();
        if (!sessionFinalizeCheckbox) return;

        const estado = normalizeSessionEstado(sessionEstado);
        const hasSaved = savedReports.length > 0;
        const canToggle = hasSaved && estado !== 'cancelada';

        sessionFinalizeCheckbox.checked = estado === 'finalizada';
        sessionFinalizeCheckbox.disabled = !canToggle;

        if (sessionFinalizeHint) {
            sessionFinalizeHint.textContent = hasSaved
                ? 'Puedes marcar/desmarcar cuando quieras.'
                : 'Requiere al menos 1 reporte guardado.';
        }
    }

    async function setSessionEstado(nextEstado) {
        const next = normalizeSessionEstado(nextEstado);
        if (!next || !sessionId || !window.cerper?.updateSessionStatus) {
            return { ok: false, error: 'api_unavailable' };
        }
        const res = await window.cerper.updateSessionStatus(sessionId, next);
        if (res?.ok) sessionEstado = next;
        return res;
    }

    async function reconcileSessionEstadoWithReports() {
        const estado = normalizeSessionEstado(sessionEstado);
        const hasSaved = savedReports.length > 0;

        // If there is at least one saved report, session must be at least "suficiente" (unless manually finalizada).
        if (hasSaved && estado !== 'finalizada' && estado !== 'suficiente') {
            const res = await setSessionEstado('suficiente');
            if (!res?.ok) {
                // Fallback (visual only)
                sessionEstado = 'suficiente';
            }
        }

        // If there are no saved reports, session can't be "suficiente/finalizada".
        if (!hasSaved && (estado === 'suficiente' || estado === 'finalizada')) {
            const res = await setSessionEstado('activo');
            if (!res?.ok) {
                // Fallback (visual only)
                sessionEstado = 'activo';
            }
        }

        updateFinalizeControls();
    }
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
            renderInboxList();
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

    // Get lab name element
    const labNameEl = document.getElementById('lab-name');

    // Validate session
    if (!sessionId) {
        if (labNameEl) {
            labNameEl.textContent = 'Sin sesión';
            labNameEl.classList.add('text-yellow-400');
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
            sessionEstado = normalizeSessionEstado(s.estado);
            if (labNameEl) {
                labNameEl.textContent = s.lab_nombre || s.lab_key || 'Laboratorio';
            }

            // Hide analito-based options if monoanalito
            const tipoAnalisis = s.tipo_analisis?.toLowerCase() || '';
            const isMonoanalito = tipoAnalisis === 'mono' || tipoAnalisis === 'monoanalito';

            if (isMonoanalito) {
                // Hide "Por Analito" and "Analito + Nivel" cards
                const byAnalitoCard = document.querySelector('[data-mode="by_analito"]');
                const byAnalitoNivelCard = document.querySelector('[data-mode="by_analito_nivel"]');

                if (byAnalitoCard) byAnalitoCard.style.display = 'none';
                if (byAnalitoNivelCard) byAnalitoNivelCard.style.display = 'none';
            }

            // Check if parameter is "Analista" -> show analyst names form
            sessionParametro = s.parametro || '';
            const isAnalista = sessionParametro.toLowerCase() === 'analista';

            if (isAnalista && analystNamesSection) {
                // Get count of unique parameters (K) from resultsData
                // For now, we'll count from results once loaded
                analystNamesSection.classList.remove('hidden');
            }
        }

        // Render lab icon (same pattern as input_data_sheet.html)
        const DEFAULT_LAB_ICON = 'flask-conical';
        const DEFAULT_LAB_COLOR = '#22d3ee';
        const iconSlot = document.getElementById('header-lab-icon');

        if (iconSlot) {
            const storedIcon = sessionStorage.getItem('labIcon') || localStorage.getItem('labIcon') || '';
            const labIcon = storedIcon || DEFAULT_LAB_ICON;

            const storedColor = sessionStorage.getItem('labColor') || localStorage.getItem('labColor') || '';
            const labColor = (storedColor || DEFAULT_LAB_COLOR).trim();
            if (labColor) {
                iconSlot.style.color = labColor;
            }

            // Use IconSafety if available, else fallback to direct lucide
            if (window.IconSafety?.attachIcon) {
                window.IconSafety.attachIcon(iconSlot, labIcon).then((ok) => {
                    if (!ok) {
                        iconSlot.innerHTML = `<i data-lucide="${DEFAULT_LAB_ICON}"></i>`;
                    }
                    if (window.lucide?.createIcons) {
                        window.lucide.createIcons();
                    }
                });
            } else {
                iconSlot.innerHTML = `<i data-lucide="${labIcon}"></i>`;
                if (window.lucide?.createIcons) {
                    window.lucide.createIcons();
                }
            }
        }

        if (resultsRes?.ok && Array.isArray(resultsRes.data)) {
            resultsData = resultsRes.data;

            // Extract unique analitos and niveles from results
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

        // If parameter is Analista, fetch unique parameter labels from inputs
        if (sessionParametro.toLowerCase() === 'analista' && analystInputsContainer) {
            try {
                const metaRes = await window.cerper?.getTestsWithMetadata(sessionId);
                if (metaRes?.ok && metaRes.meta?.parametros_unicos?.length > 0) {
                    renderAnalystInputs(metaRes.meta.parametros_unicos);
                }
            } catch (err) {
                console.warn('[PDFConfig] Error fetching parametros_unicos:', err);
            }
        }
    } catch (err) {
        console.error('[PDFConfig] Error loading data:', err);
        if (sessionText) {
            sessionText.textContent = 'Error cargando';
            sessionText.classList.add('text-red-400');
        }
    }

    // Load saved reports from DB
    async function loadSavedReports() {
        if (!sessionId) return;
        try {
            const result = await window.cerper.getSessionReports(sessionId);
            if (result?.ok && Array.isArray(result.data)) {
                savedReports = result.data;
            }
        } catch (err) {
            console.error('[PDFConfig] Error loading saved reports:', err);
        }
        await reconcileSessionEstadoWithReports();
    }

    // Initial load
    await loadSavedReports();
    updateInboxBadge();

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

    // Render analyst name input fields
    function renderAnalystInputs(paramLabels) {
        if (!analystInputsContainer) return;

        // Try to load from sessionStorage first
        const savedNames = sessionStorage.getItem(`analystNames_${sessionId}`);
        if (savedNames) {
            try {
                analystNames = JSON.parse(savedNames);
            } catch (e) {
                analystNames = [];
            }
        } else {
            analystNames = new Array(paramLabels.length).fill('');
        }

        // Table-like structure: Name input | Analista X
        analystInputsContainer.innerHTML = `
            <div class="border border-white/10 rounded-lg overflow-hidden">
                ${paramLabels.map((label, i) => `
                    <div class="flex items-center border-b border-white/10 last:border-b-0">
                        <input type="text" 
                            id="analyst-name-${i}" 
                            data-index="${i}"
                            value="${analystNames[i] || ''}"
                            placeholder="Nombre del analista"
                            class="analyst-name-input flex-1 px-4 py-3 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none focus:bg-white/5 transition-colors border-r border-white/10"
                        >
                        <div class="w-32 px-4 py-3 text-sm text-gray-400 text-center bg-white/5 flex-shrink-0">
                            Analista ${i + 1}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Add input event listeners to save names and validate in real-time
        analystInputsContainer.querySelectorAll('.analyst-name-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                analystNames[idx] = e.target.value.trim();
                // Save to sessionStorage for persistence
                sessionStorage.setItem(`analystNames_${sessionId}`, JSON.stringify(analystNames));
                // Hide global validation message when typing
                if (analystValidationMsg) analystValidationMsg.classList.add('hidden');

                // Real-time inline validation
                validateInputInline(e.target, idx);
            });

            // Also validate on blur (when user leaves the field)
            input.addEventListener('blur', (e) => {
                const idx = parseInt(e.target.dataset.index);
                validateInputInline(e.target, idx);
            });
        });

        // Inline validation helper - just visual feedback, no inline messages
        function validateInputInline(inputEl, idx) {
            const result = validateSingleAnalystName(analystNames[idx]);

            if (!result.valid && analystNames[idx]?.length > 0) {
                // Just highlight the input with red border
                inputEl.classList.add('!border-red-500/50');
            } else {
                inputEl.classList.remove('!border-red-500/50');
            }
        }

        if (window.lucide) lucide.createIcons();
    }

    // Validate a single analyst name - returns { valid: boolean, error: string|null }
    function validateSingleAnalystName(name) {
        if (!name || name.trim().length === 0) {
            return { valid: false, error: 'El nombre es requerido' };
        }

        const trimmedName = name.trim();

        // Rule 1: Minimum length of 3 characters
        if (trimmedName.length < 3) {
            return { valid: false, error: 'Mínimo 3 caracteres' };
        }

        // Rule 2: No numbers allowed
        if (/\d/.test(trimmedName)) {
            return { valid: false, error: 'No puede contener números' };
        }

        return { valid: true, error: null };
    }

    // Validate all analyst names (returns true if all valid, or if not Analista mode)
    function validateAnalystNames() {
        if (sessionParametro.toLowerCase() !== 'analista') return true;
        if (analystNames.length === 0) return false;

        let allValid = true;
        const errors = [];

        analystNames.forEach((name, idx) => {
            const result = validateSingleAnalystName(name);
            const inputEl = document.getElementById(`analyst-name-${idx}`);

            if (!result.valid) {
                allValid = false;
                errors.push(`• Analista ${idx + 1}: ${result.error}`);
                // Highlight invalid input
                inputEl?.classList.add('!border-red-500/50', '!bg-red-500/10');
            } else {
                inputEl?.classList.remove('!border-red-500/50', '!bg-red-500/10');
            }
        });

        if (!allValid) {
            // Show notification with errors using toast
            const errorMsg = errors.length === 1
                ? errors[0].replace('• ', '')
                : `${errors.length} errores en nombres de analistas`;
            notify(errorMsg, 'error');
        }

        return allValid;
    }

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

    // Generate reports (LOCAL only - no auto-upload)
    btnGenerate?.addEventListener('click', async () => {
        if (isGenerating || !sessionId) return;

        // Validate execution date (MANDATORY)
        const executionDate = executionDateInput?.value;
        if (!executionDate) {
            if (executionDateError) executionDateError.classList.remove('hidden');
            if (executionDateInput) executionDateInput.classList.add('!border-red-500/50');
            executionDateInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            notify('La fecha de ejecución es obligatoria', 'error');
            return;
        } else {
            if (executionDateError) executionDateError.classList.add('hidden');
            if (executionDateInput) executionDateInput.classList.remove('!border-red-500/50');
        }

        // Validate analyst names if required
        if (!validateAnalystNames()) {
            // Scroll to analyst section
            analystNamesSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        isGenerating = true;
        btnGenerate.disabled = true;
        btnGenerate.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Generando...';
        document.body.classList.add('generating');

        // Show progress
        if (progressSection) progressSection.classList.remove('hidden');
        // Reset any previous error styling
        if (progressFill) progressFill.style.background = '';
        setProgress(0, 'Preparando datos...');

        // Dynamic progress updates from main process
        const requestId = (window.crypto?.randomUUID)
            ? window.crypto.randomUUID()
            : `reports_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        let lastPercent = 0;
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const percentFromCounts = (current, total) => {
            const t = Number(total);
            const c = Number(current);
            if (!t || t <= 0) return 10;
            return clamp(10 + Math.round((c / t) * 80), 10, 90);
        };

        const unsubscribeProgress = window.cerper?.onReportsProgress
            ? window.cerper.onReportsProgress((data) => {
                if (!data || data.requestId !== requestId) return;
                if (!isGenerating) return;

                const stage = String(data.stage || '');
                const message = String(data.message || '');

                if (stage === 'start') {
                    lastPercent = Math.max(lastPercent, 5);
                    setProgress(lastPercent, message || 'Iniciando...');
                } else if (stage === 'plan') {
                    lastPercent = Math.max(lastPercent, 10);
                    setProgress(lastPercent, message || 'Preparando reportes...');
                } else if (stage === 'render') {
                    const next = percentFromCounts(data.current, data.total);
                    if (next >= lastPercent) {
                        lastPercent = next;
                        const fileHint = data.filename ? ` • ${data.filename}` : '';
                        setProgress(lastPercent, (message || 'Generando PDFs...') + fileHint);
                    }
                } else if (stage === 'done') {
                    lastPercent = 100;
                    setProgress(100, message || 'Listo.');
                } else if (stage === 'error') {
                    lastPercent = 0;
                    setProgress(0, `Error: ${message || 'Error desconocido'}`);
                    if (progressFill) progressFill.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
                }
            })
            : null;

        // Format execution date to DD/MM/YYYY for the PDF
        const dateObj = new Date(executionDate + 'T12:00:00');
        const formattedDate = dateObj.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const config = {
            group_by: selectedMode,
            include_graphs: optGraphs?.checked !== false,
            include_tables: optTables?.checked !== false,
            // Execution date (MANDATORY)
            execution_date: formattedDate,
            // Include analyst names if parametro is Analista
            analyst_names: sessionParametro.toLowerCase() === 'analista' ? analystNames : null
        };

        try {
            lastPercent = Math.max(lastPercent, 10);
            setProgress(lastPercent, 'Generando PDFs localmente...');

            const result = await window.cerper.generateReports(sessionId, config, requestId);

            if (!result.ok) {
                throw new Error(result.error || result.message || 'Error desconocido');
            }

            if (lastPercent < 95) {
                lastPercent = 95;
                setProgress(lastPercent, 'Preparando vista previa...');
            }

            const reportCount = result.reports?.length || 0;

            // Add to local reports (NOT saved yet) - with timestamp
            const now = Date.now();
            const reportsWithTimestamp = result.reports.map(r => ({
                ...r,
                createdAt: now
            }));
            localReports = [...localReports, ...reportsWithTimestamp];

            lastPercent = 100;
            setProgress(100, `¡Listo! ${reportCount} reporte${reportCount !== 1 ? 's' : ''} generado${reportCount !== 1 ? 's' : ''}.`);

            // Switch to inbox after a moment
            setTimeout(() => {
                setActiveView('buzon');

                // Reset button
                isGenerating = false;
                btnGenerate.disabled = false;
                btnGenerate.innerHTML = '<i data-lucide="file-output" class="w-5 h-5"></i> Generar Reportes';
                if (window.lucide) lucide.createIcons();
                document.body.classList.remove('generating');
                if (progressSection) progressSection.classList.add('hidden');
            }, 1000);

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
        } finally {
            try { if (unsubscribeProgress) unsubscribeProgress(); } catch (_) { }
        }
    });

    function setProgress(percent, status) {
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `${percent}%`;
        if (progressStatus) progressStatus.textContent = status;
    }

    // === INBOX FUNCTIONALITY ===

    function updateInboxBadge() {
        const totalCount = localReports.length + savedReports.length;
        const unsavedCount = localReports.length;

        if (inboxBadge) {
            // Show unsaved count if any, otherwise total
            const displayCount = unsavedCount > 0 ? unsavedCount : totalCount;
            inboxBadge.textContent = displayCount > 99 ? '99+' : displayCount;
            inboxBadge.classList.toggle('hidden', totalCount === 0);
            // Orange badge for unsaved, normal for saved
            if (unsavedCount > 0) {
                inboxBadge.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
            } else {
                inboxBadge.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            }
        }
        if (inboxStats) {
            const parts = [];
            if (localReports.length > 0) {
                parts.push(`${localReports.length} sin guardar`);
            }
            if (savedReports.length > 0) {
                parts.push(`${savedReports.length} guardado${savedReports.length !== 1 ? 's' : ''}`);
            }
            inboxStats.textContent = parts.length > 0 ? parts.join(' • ') : '0 reportes';
        }
    }

    function renderInboxList() {
        if (!inboxList) return;

        const { local: filteredLocal, saved: filteredSaved } = getFilteredReports();
        const allEmpty = filteredLocal.length === 0 && filteredSaved.length === 0;
        const hasAnyReports = localReports.length > 0 || savedReports.length > 0;
        const hasActiveFilters = (filterTipo?.value && filterTipo.value !== '') || (searchInput?.value && searchInput.value.trim() !== '');

        if (allEmpty) {
            // Check if it's a filter/search empty result vs no reports at all
            if (hasAnyReports && hasActiveFilters) {
                // Show "no search results" message
                if (inboxEmpty) inboxEmpty.classList.add('hidden');
                Array.from(inboxList.children).forEach(child => {
                    if (child.id !== 'inbox-empty') child.remove();
                });

                const noResultsHtml = `
                    <div class="text-center py-16">
                        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                            <i data-lucide="search-x" class="w-8 h-8 text-gray-500"></i>
                        </div>
                        <p class="text-gray-400 mb-2">No se encontró nada</p>
                        <p class="text-sm text-gray-500">Intenta con otros términos de búsqueda o filtros</p>
                    </div>
                `;
                inboxList.insertAdjacentHTML('afterbegin', noResultsHtml);
            } else {
                // Show default empty inbox message
                if (inboxEmpty) inboxEmpty.classList.remove('hidden');
                Array.from(inboxList.children).forEach(child => {
                    if (child.id !== 'inbox-empty') child.remove();
                });
            }

            if (window.lucide) lucide.createIcons();
            updateInboxBadge();
            updateSelectionUI();
            return;
        }

        if (inboxEmpty) inboxEmpty.classList.add('hidden');

        let html = '';

        // Render LOCAL (unsaved) reports first - with prominent "GUARDAR" button
        if (filteredLocal.length > 0) {
            html += `<div class="mb-4"><h3 class="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                <i data-lucide="alert-circle" class="w-4 h-4"></i>
                Sin guardar en servidor (${filteredLocal.length})
            </h3></div>`;

            // Find original index for each filtered item
            filteredLocal.forEach(report => {
                const originalIndex = localReports.indexOf(report);
                html += renderReportItem(report, 'local', originalIndex);
            });
        }

        // Render SAVED reports
        if (filteredSaved.length > 0) {
            if (filteredLocal.length > 0) {
                html += `<div class="border-t border-white/10 my-6"></div>`;
            }
            html += `<div class="mb-4"><h3 class="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                <i data-lucide="check-circle" class="w-4 h-4"></i>
                Guardados en servidor (${filteredSaved.length})
            </h3></div>`;

            filteredSaved.forEach(report => {
                html += renderReportItem(report, 'saved');
            });
        }

        // Keep empty state element
        const emptyEl = inboxEmpty?.cloneNode(true);
        inboxList.innerHTML = html;
        if (emptyEl) {
            emptyEl.classList.add('hidden');
            inboxList.appendChild(emptyEl);
        }

        if (window.lucide) lucide.createIcons();
        updateInboxBadge();
        updateSelectionUI();
    }

    function renderReportItem(report, type, localIndex = null) {
        const isLocal = type === 'local';
        const tipoLabel = getTipoLabel(report.tipo_informe);
        const planInfo = report.plan_json || {};
        const sizeKb = ((report.pdf_size_bytes || 0) / 1024).toFixed(0);

        // Icon text color (glass style)
        let iconTextColor = 'text-purple-400';
        if (report.tipo_informe === 'by_analito') iconTextColor = 'text-cyan-400';
        if (report.tipo_informe === 'by_nivel') iconTextColor = 'text-amber-400';
        if (report.tipo_informe === 'unified') iconTextColor = 'text-emerald-400';

        // Build specific title from analito/nivel
        let specificTitle = '';
        if (planInfo.analito) specificTitle = planInfo.analito;
        if (planInfo.nivel != null) specificTitle += (specificTitle ? ' • ' : '') + `Nivel ${planInfo.nivel}`;

        // Use specific title if available, otherwise use type label
        const displayTitle = specificTitle || tipoLabel;
        const displaySubtitle = specificTitle ? tipoLabel : '';

        // For saved reports, use server date; for local, use dynamic timeago
        let dateDisplay;
        if (isLocal && report.createdAt) {
            dateDisplay = `<span class="timeago" data-created-at="${report.createdAt}">${getTimeAgo(report.createdAt)}</span>`;
        } else if (report.creado_en) {
            dateDisplay = new Date(report.creado_en).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        } else {
            dateDisplay = 'Recién generado';
        }

        // Selection key and checked state
        const selectKey = isLocal ? `local_${localIndex}` : `saved_${report.id}`;
        const isChecked = selectedItems.has(selectKey);
        const estadoDisplay = !isLocal ? (report.estado || report.estado_informe || report.status || '') : '';
        const isUrgent = estadoDisplay === 'a_revisar';

        if (isLocal) {
            return `
                <div class="report-item-container border-amber-500/30 bg-amber-500/5 rounded-xl p-4 relative" data-local-index="${localIndex}">
                    <!-- Delete button in top-right corner -->
                    <button class="delete-btn absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all z-10" onclick="discardLocalReport(${localIndex})" title="Descartar">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                    <div class="flex items-center gap-4 pr-8">
                        <!-- Checkbox -->
                        <input type="checkbox" data-select-id="${selectKey}" 
                            ${isChecked ? 'checked' : ''} 
                            onchange="toggleSelectItem(${localIndex}, true)"
                            class="w-5 h-5 rounded accent-indigo-500 flex-shrink-0 cursor-pointer">
                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/15 shadow-lg backdrop-blur-sm flex items-center justify-center flex-shrink-0 ${iconTextColor}">
                            <i data-lucide="file-text" class="w-6 h-6"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-white truncate">${displayTitle}</div>
                            <div class="text-sm text-gray-500">${displaySubtitle ? displaySubtitle + ' • ' : ''}${dateDisplay} • ${sizeKb} KB</div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button class="btn-secondary w-10 h-10 rounded-lg flex items-center justify-center transition-all" onclick="downloadLocalReport(${localIndex})" title="Descargar">
                                <i data-lucide="download" class="w-5 h-5 text-gray-400"></i>
                            </button>
                            <!-- Comment toggle -->
                            <button id="comment-toggle-${localIndex}" 
                                class="comment-toggle w-10 h-10 rounded-lg flex items-center justify-center transition-all ${commentEnabled.has(localIndex) ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'}" 
                                onclick="toggleCommentOption(${localIndex})" 
                                title="Agregar comentario">
                                <i data-lucide="message-square" class="w-5 h-5"></i>
                            </button>
                            <!-- Important/Urgent toggle -->
                            <button id="important-toggle-${localIndex}" 
                                class="important-toggle w-10 h-10 rounded-lg flex items-center justify-center transition-all ${importantReports.has(localIndex) ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'}" 
                                onclick="toggleImportantOption(${localIndex})" 
                                title="Marcar como importante/urgente">
                                <i data-lucide="alert-circle" class="w-5 h-5"></i>
                            </button>
                            <button class="save-btn px-4 py-2 rounded-lg flex items-center gap-2 font-semibold text-white transition-all" onclick="saveLocalReport(${localIndex})" 
                                style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);">
                                <i data-lucide="upload-cloud" class="w-5 h-5"></i>
                                Guardar
                            </button>
                        </div>
                    </div>
                    <!-- Save form will be inserted here -->
                </div>
            `;
        } else {
            return `
                <div class="report-item flex items-center gap-4 rounded-xl p-4" data-report-id="${report.id}">
                    <!-- Checkbox -->
                    <input type="checkbox" data-select-id="${selectKey}" 
                        ${isChecked ? 'checked' : ''} 
                        onchange="toggleSelectItem(${report.id}, false)"
                        class="w-5 h-5 rounded accent-indigo-500 flex-shrink-0 cursor-pointer">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/15 shadow-lg backdrop-blur-sm flex items-center justify-center flex-shrink-0 ${iconTextColor}">
                        <i data-lucide="file-text" class="w-6 h-6"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-white truncate flex items-center gap-2">
                            ${displayTitle}
                            ${isUrgent ? '<i data-lucide="alert-circle" class="w-4 h-4 text-amber-400 flex-shrink-0" title="Importante/Urgente"></i>' : ''}
                            <span class="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Guardado</span>
                            ${estadoDisplay === 'a_revisar' ? '<span class="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">A Revisar</span>' : ''}
                        </div>
                        <div class="text-sm text-gray-500">${displaySubtitle ? displaySubtitle + ' • ' : ''}${dateDisplay} • ${sizeKb} KB</div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="download-btn w-10 h-10 rounded-lg flex items-center justify-center transition-all" onclick="downloadSavedReport(${report.id})" title="Descargar">
                            <i data-lucide="download" class="w-5 h-5 text-white"></i>
                        </button>
                        <button class="delete-btn w-10 h-10 rounded-lg flex items-center justify-center transition-all" onclick="deleteSavedReport(${report.id})" title="Eliminar">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `;
        }
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

    // === GLOBAL FUNCTIONS ===

    // Download a LOCAL (unsaved) report
    window.downloadLocalReport = function (index) {
        const report = localReports[index];
        if (!report || !report.pdf_base64) return;

        downloadBase64Pdf(report.pdf_base64, report.filename || `reporte_local_${index}.pdf`);
    };

    // Discard a LOCAL report (remove from memory)
    window.discardLocalReport = async function (index) {
        const confirmed = await showCustomConfirm(
            '¿Descartar este reporte? No se ha guardado en el servidor.',
            'Descartar reporte',
            'Descartar',
            'Cancelar',
            'warning'
        );
        if (!confirmed) return;
        localReports.splice(index, 1);
        renderInboxList();
    };

    // Toggle comment option for a local report
    window.toggleCommentOption = function (index) {
        const toggleBtn = document.getElementById(`comment-toggle-${index}`);
        if (!toggleBtn) return;

        if (commentEnabled.has(index)) {
            commentEnabled.delete(index);
            toggleBtn.classList.remove('bg-emerald-500/20', 'border-emerald-500/40', 'text-emerald-400');
            toggleBtn.classList.add('bg-white/5', 'border-white/10', 'text-gray-400');
        } else {
            commentEnabled.add(index);
            toggleBtn.classList.remove('bg-white/5', 'border-white/10', 'text-gray-400');
            toggleBtn.classList.add('bg-emerald-500/20', 'border-emerald-500/40', 'text-emerald-400');
        }
    };

    // Toggle important/urgent option for a local report
    window.toggleImportantOption = function (index) {
        const toggleBtn = document.getElementById(`important-toggle-${index}`);
        if (!toggleBtn) return;

        if (importantReports.has(index)) {
            importantReports.delete(index);
            toggleBtn.classList.remove('bg-amber-500/20', 'border-amber-500/40', 'text-amber-400');
            toggleBtn.classList.add('bg-white/5', 'border-white/10', 'text-gray-400');
        } else {
            importantReports.add(index);
            toggleBtn.classList.remove('bg-white/5', 'border-white/10', 'text-gray-400');
            toggleBtn.classList.add('bg-amber-500/20', 'border-amber-500/40', 'text-amber-400');
        }
    };

    // Save a LOCAL report to database
    window.saveLocalReport = async function (index) {
        const report = localReports[index];
        if (!report) return;

        const itemEl = document.querySelector(`[data-local-index="${index}"]`);
        if (!itemEl) return;

        // Check if both comment and important are enabled - only then show form
        const hasComment = commentEnabled.has(index);
        const isImportant = importantReports.has(index);

        // If comment is NOT enabled OR important is NOT enabled, save directly without form
        if (!hasComment || !isImportant) {
            // Determine estado based on important flag
            const estado = isImportant ? 'a_revisar' : 'generado';
            await doSaveReport(index, '', estado);
            return;
        }

        // Check if form already exists
        if (itemEl.querySelector('.save-form')) return;

        // Show form only when both comment and important are enabled
        const formHtml = `
            <div class="save-form mt-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <div>
                    <label class="block text-sm font-medium text-white mb-2">
                        <i data-lucide="message-square" class="w-4 h-4 inline mr-1"></i>
                        Observaciones
                    </label>
                    <textarea id="save-comment-${index}" rows="3" 
                        class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-emerald-500/50"
                        placeholder="Escribe un comentario o nota sobre este reporte..."></textarea>
                </div>
                
                <div class="flex items-center justify-end gap-2 mt-4">
                    <button onclick="cancelSaveForm(${index})" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                        Cancelar
                    </button>
                    <button onclick="confirmSaveReport(${index})" class="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 transition-all"
                        style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);">
                        <i data-lucide="upload-cloud" class="w-4 h-4"></i>
                        Confirmar y Guardar
                    </button>
                </div>
            </div>
        `;

        // Insert form after the item
        itemEl.insertAdjacentHTML('beforeend', formHtml);
        if (window.lucide) lucide.createIcons();

        // Focus textarea
        const textarea = document.getElementById(`save-comment-${index}`);
        if (textarea) textarea.focus();
    };

    // Cancel save form
    window.cancelSaveForm = function (index) {
        const itemEl = document.querySelector(`[data-local-index="${index}"]`);
        const form = itemEl?.querySelector('.save-form');
        if (form) form.remove();
    };

    // Confirm and save with comment
    window.confirmSaveReport = async function (index) {
        const report = localReports[index];
        if (!report) return;

        const textarea = document.getElementById(`save-comment-${index}`);
        const observaciones = textarea?.value?.trim() || '';

        // Determine estado based on important flag
        const estado = importantReports.has(index) ? 'a_revisar' : 'generado';

        await doSaveReport(index, observaciones, estado);
    };

    // Core save function (used by both direct save and form save)
    async function doSaveReport(index, observaciones, estado = 'generado') {
        const report = localReports[index];
        if (!report) return;

        // Show saving state on save button if exists
        const itemEl = document.querySelector(`[data-local-index="${index}"]`);
        const saveBtn = itemEl?.querySelector('.save-btn');
        const originalHtml = saveBtn?.innerHTML;

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Guardando...';
            if (window.lucide) lucide.createIcons();
        }

        try {
            const result = await window.cerper.saveReportToDb(sessionId, {
                pdf_base64: report.pdf_base64,
                tipo_informe: report.tipo_informe,
                plan_json: report.plan_json,
                hash: report.hash,
                tests_included: report.tests_included,
                observaciones: observaciones,
                estado: estado
            });

            if (!result.ok) {
                throw new Error(result.error || 'Error desconocido');
            }

            // Remove from local, clear comment state, reload saved
            localReports.splice(index, 1);
            commentEnabled.delete(index);
            importantReports.delete(index);
            await loadSavedReports();
            renderInboxList();

        } catch (err) {
            console.error('[PDFConfig] Save error:', err);
            await showCustomAlert('Error guardando: ' + err.message, 'Error', 'error');

            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalHtml || '<i data-lucide="upload-cloud" class="w-5 h-5"></i> Guardar';
                if (window.lucide) lucide.createIcons();
            }
        }
    }

    // Download a SAVED report from database
    window.downloadSavedReport = async function (reportId) {
        try {
            const result = await window.cerper.downloadReportPdf(reportId);
            if (!result.ok) throw new Error(result.error);

            downloadBase64Pdf(result.pdf_base64, `reporte_${reportId}.pdf`);
        } catch (err) {
            console.error('[PDFConfig] Download error:', err);
            await showCustomAlert('Error descargando: ' + err.message, 'Error', 'error');
        }
    };

    // Delete a SAVED report from database
    window.deleteSavedReport = async function (reportId) {
        const confirmed = await showCustomConfirm(
            '¿Eliminar este reporte del servidor? Esta acción no se puede deshacer.',
            'Eliminar Reporte',
            'Eliminar',
            'Cancelar',
            'danger'
        );
        if (!confirmed) return;

        try {
            const result = await window.cerper.deleteReport(reportId);
            if (!result.ok) throw new Error(result.error);

            await loadSavedReports();
            renderInboxList();
        } catch (err) {
            console.error('[PDFConfig] Delete error:', err);
            await showCustomAlert('Error eliminando: ' + err.message, 'Error', 'error');
        }
    };

    // Helpers: binary + downloads
    function base64ToUint8Array(base64) {
        const byteCharacters = atob(base64);
        const bytes = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            bytes[i] = byteCharacters.charCodeAt(i);
        }
        return bytes;
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Revoke after a tick to avoid canceling large downloads
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function downloadBase64Pdf(base64, filename) {
        const blob = new Blob([base64ToUint8Array(base64)], { type: 'application/pdf' });
        downloadBlob(blob, filename);
    }

    // Helpers: ZIP filenames
    function sanitizeZipFilename(filename) {
        const raw = String(filename || '').trim() || 'reporte.pdf';
        // Avoid zip-slip and invalid filename chars (Windows + common restrictions)
        const cleaned = raw
            .replace(/[\\/:*?"<>|\x00-\x1F]/g, '_')
            .replace(/\s+/g, ' ')
            .trim();
        // Prevent relative/absolute paths inside the zip
        const safe = cleaned.replace(/^\.+/g, '').replace(/\.\.+/g, '_');
        return safe || 'reporte.pdf';
    }

    function ensurePdfExtension(name) {
        const v = String(name || '').trim();
        if (!v) return 'reporte.pdf';
        return v.toLowerCase().endsWith('.pdf') ? v : `${v}.pdf`;
    }

    function uniqueZipName(name, used) {
        const base = String(name || 'reporte.pdf');
        if (!used.has(base)) {
            used.add(base);
            return base;
        }
        const dot = base.lastIndexOf('.');
        const stem = dot > 0 ? base.slice(0, dot) : base;
        const ext = dot > 0 ? base.slice(dot) : '';
        let i = 2;
        while (used.has(`${stem} (${i})${ext}`)) i++;
        const next = `${stem} (${i})${ext}`;
        used.add(next);
        return next;
    }

    // === FILTERS ===
    filterTipo?.addEventListener('change', () => {
        renderInboxList();
    });

    // Search input - debounced for performance
    let searchTimeout;
    searchInput?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            renderInboxList();
        }, 200); // 200ms debounce
    });

    function getFilteredReports() {
        const tipoFilter = filterTipo?.value || '';
        const searchQuery = (searchInput?.value || '').toLowerCase().trim();

        let filteredLocal = localReports;
        let filteredSaved = savedReports;

        // Filter by tipo
        if (tipoFilter) {
            filteredLocal = filteredLocal.filter(r => r.tipo_informe === tipoFilter);
            filteredSaved = filteredSaved.filter(r => r.tipo_informe === tipoFilter);
        }

        // Filter by search text (analito, nivel, tipo)
        if (searchQuery) {
            const matchesSearch = (report) => {
                const planInfo = report.plan_json || {};
                const searchableText = [
                    planInfo.analito || '',
                    planInfo.nivel != null ? `nivel ${planInfo.nivel}` : '',
                    report.tipo_informe || '',
                    getTipoLabel(report.tipo_informe) || ''
                ].join(' ').toLowerCase();

                return searchableText.includes(searchQuery);
            };

            filteredLocal = filteredLocal.filter(matchesSearch);
            filteredSaved = filteredSaved.filter(matchesSearch);
        }

        return { local: filteredLocal, saved: filteredSaved };
    }

    // === SELECTION ===
    function updateSelectionUI() {
        const count = selectedItems.size;

        if (selectionInfo) {
            selectionInfo.classList.toggle('hidden', count === 0);
        }
        if (selectionCount) {
            selectionCount.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
        }
        if (bulkActionsBar) {
            bulkActionsBar.classList.toggle('hidden', count === 0);
        }

        // Update select all checkbox (only visible items)
        const { local, saved } = getFilteredReports();
        const visibleKeys = new Set();
        local.forEach((report) => {
            const originalIndex = localReports.indexOf(report);
            if (originalIndex !== -1) visibleKeys.add(`local_${originalIndex}`);
        });
        saved.forEach((report) => {
            if (report?.id != null) visibleKeys.add(`saved_${report.id}`);
        });

        let visibleSelectedCount = 0;
        visibleKeys.forEach((key) => {
            if (selectedItems.has(key)) visibleSelectedCount++;
        });

        const totalVisible = visibleKeys.size;
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = totalVisible > 0 && visibleSelectedCount === totalVisible;
            selectAllCheckbox.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < totalVisible;
        }

        // Hide bulk save form when selection changes
        if (bulkSaveForm) bulkSaveForm.classList.add('hidden');
    }

    window.toggleSelectItem = function (itemId, isLocal) {
        const key = isLocal ? `local_${itemId}` : `saved_${itemId}`;
        if (selectedItems.has(key)) {
            selectedItems.delete(key);
        } else {
            selectedItems.add(key);
        }
        updateSelectionUI();

        // Update checkbox visual
        const checkbox = document.querySelector(`input[data-select-id="${key}"]`);
        if (checkbox) checkbox.checked = selectedItems.has(key);
    };

    window.clearSelection = function () {
        selectedItems.clear();
        updateSelectionUI();
        // Uncheck all checkboxes
        document.querySelectorAll('[data-select-id]').forEach(cb => cb.checked = false);
    };

    // Select all checkbox
    selectAllCheckbox?.addEventListener('change', () => {
        const { local, saved } = getFilteredReports();

        if (selectAllCheckbox.checked) {
            // Select all visible
            local.forEach((report) => {
                const originalIndex = localReports.indexOf(report);
                if (originalIndex !== -1) selectedItems.add(`local_${originalIndex}`);
            });
            saved.forEach(r => selectedItems.add(`saved_${r.id}`));
        } else {
            // Deselect all
            selectedItems.clear();
        }
        updateSelectionUI();
        renderInboxList();
    });

    // === BULK ACTIONS ===
    window.bulkDeleteSelected = async function () {
        if (selectedItems.size === 0) return;

        const localCount = [...selectedItems].filter(k => k.startsWith('local_')).length;
        const savedCount = [...selectedItems].filter(k => k.startsWith('saved_')).length;

        let msg = `¿Eliminar ${selectedItems.size} reporte${selectedItems.size !== 1 ? 's' : ''}?`;
        if (savedCount > 0) {
            msg += `\n\n⚠️ ${savedCount} están guardados en el servidor y se eliminarán permanentemente.`;
        }

        const confirmed = await showCustomConfirm(msg, 'Eliminar Reportes', 'Eliminar', 'Cancelar', 'danger');
        if (!confirmed) return;

        // Delete saved first
        for (const key of selectedItems) {
            if (key.startsWith('saved_')) {
                const id = parseInt(key.replace('saved_', ''));
                try {
                    await window.cerper.deleteReport(id);
                } catch (err) {
                    console.error('[PDFConfig] Bulk delete error:', err);
                }
            }
        }

        // Delete local (collect indices, delete from highest to lowest)
        const localIndices = [...selectedItems]
            .filter(k => k.startsWith('local_'))
            .map(k => parseInt(k.replace('local_', '')))
            .sort((a, b) => b - a); // Reverse order to avoid index shifting

        for (const idx of localIndices) {
            localReports.splice(idx, 1);
        }

        selectedItems.clear();
        await loadSavedReports();
        renderInboxList();
        updateSelectionUI();
    };

    function tipoInformeSlug(tipo) {
        switch (tipo) {
            case 'unified': return 'unificado';
            case 'by_analito': return 'por_analito';
            case 'by_nivel': return 'por_nivel';
            case 'by_analito_nivel': return 'analito_nivel';
            default: return 'reporte';
        }
    }

    function buildReportFilename(report, fallbackId) {
        const plan = report?.plan_json || {};
        const parts = ['reporte', tipoInformeSlug(report?.tipo_informe)];
        if (plan.analito) parts.push(String(plan.analito));
        if (plan.nivel != null) parts.push(`nivel_${plan.nivel}`);
        if (fallbackId) parts.push(String(fallbackId));
        return ensurePdfExtension(parts.join('_'));
    }

    window.bulkDownloadZip = async function () {
        if (selectedItems.size === 0) {
            await showCustomAlert('Selecciona al menos un reporte para descargar.', 'Selección requerida', 'warning');
            return;
        }

        if (!window.JSZip) {
            await showCustomAlert(
                'No se pudo cargar el generador de ZIP (JSZip). Verifica tu conexión a internet y recarga la página.',
                'Error',
                'error'
            );
            return;
        }

        const btn = btnBulkDownloadZip || document.getElementById('btn-bulk-download-zip');
        const originalHtml = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Creando ZIP...';
            if (window.lucide) lucide.createIcons();
        }

        try {
            const zip = new window.JSZip();
            const usedNames = new Set();
            let added = 0;

            const localIndices = [...selectedItems]
                .filter(k => k.startsWith('local_'))
                .map(k => parseInt(k.replace('local_', ''), 10))
                .filter(idx => !isNaN(idx) && idx >= 0 && idx < localReports.length);

            const savedIds = [...selectedItems]
                .filter(k => k.startsWith('saved_'))
                .map(k => parseInt(k.replace('saved_', ''), 10))
                .filter(id => !isNaN(id) && id > 0);

            for (const idx of localIndices) {
                const report = localReports[idx];
                if (!report?.pdf_base64) continue;

                const desiredName = report.filename || buildReportFilename(report, `local_${idx}`);
                const name = uniqueZipName(sanitizeZipFilename(ensurePdfExtension(desiredName)), usedNames);
                zip.file(name, base64ToUint8Array(report.pdf_base64));
                added++;
            }

            for (const id of savedIds) {
                const meta = savedReports.find(r => Number(r.id) === Number(id));
                const desiredName = meta?.filename || buildReportFilename(meta, `id_${id}`);

                const res = await window.cerper.downloadReportPdf(id);
                if (!res?.ok || !res.pdf_base64) {
                    throw new Error(res?.error || `No se pudo descargar el reporte ${id}`);
                }

                const name = uniqueZipName(sanitizeZipFilename(ensurePdfExtension(desiredName)), usedNames);
                zip.file(name, base64ToUint8Array(res.pdf_base64));
                added++;
            }

            if (added === 0) {
                await showCustomAlert('No se encontraron PDFs válidos en la selección.', 'Sin archivos', 'info');
                return;
            }

            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const zipName = `reportes_${sessionId || 'sesion'}_${stamp}.zip`;

            const zipBlob = await zip.generateAsync(
                { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
                (metadata) => {
                    if (btn && metadata?.percent != null) {
                        const p = Math.max(0, Math.min(100, Math.round(metadata.percent)));
                        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> ZIP ${p}%`;
                        if (window.lucide) lucide.createIcons();
                    }
                }
            );

            downloadBlob(zipBlob, zipName);
            if (window.notify) notify(`ZIP descargado (${added} PDF${added !== 1 ? 's' : ''}).`, 'success');
        } catch (err) {
            console.error('[PDFConfig] Bulk ZIP download error:', err);
            await showCustomAlert('No se pudo crear el ZIP: ' + err.message, 'Error', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml || '<i data-lucide="archive" class="w-4 h-4"></i> Descargar ZIP';
                if (window.lucide) lucide.createIcons();
            }
        }
    };

    // Mark selected items as important/urgent (set estado to 'a_revisar')
    window.bulkMarkAsImportant = async function () {
        if (selectedItems.size === 0) {
            await showCustomAlert('Por favor selecciona al menos un reporte para marcar como importante.', 'Selección Requerida', 'warning');
            return;
        }

        console.log('[PDFConfig] Marking as important, selectedItems:', Array.from(selectedItems));

        // Mark local reports as important
        const localIndices = [...selectedItems]
            .filter(k => k.startsWith('local_'))
            .map(k => parseInt(k.replace('local_', '')))
            .filter(idx => !isNaN(idx) && idx >= 0 && idx < localReports.length);

        console.log('[PDFConfig] Local indices to mark:', localIndices);

        localIndices.forEach(idx => {
            importantReports.add(idx);
            console.log('[PDFConfig] Marked local report at index', idx, 'as important');
        });

        // Mark saved reports as urgent via API (set estado to 'a_revisar')
        const savedIds = [...selectedItems]
            .filter(k => k.startsWith('saved_'))
            .map(k => parseInt(k.replace('saved_', '')))
            .filter(id => !isNaN(id) && id > 0);

        console.log('[PDFConfig] Saved IDs to mark:', savedIds);

        if (savedIds.length > 0) {
            try {
                const result = await window.cerper.markReportsAsUrgent(savedIds);
                if (!result.ok) {
                    console.error('[PDFConfig] Error marking saved reports as urgent:', result.error);
                    await showCustomAlert('Error al marcar algunos reportes guardados como importantes: ' + (result.error || 'Error desconocido'), 'Error', 'error');
                } else {
                    console.log('[PDFConfig] Successfully marked', savedIds.length, 'saved reports as urgent');
                }
            } catch (err) {
                console.error('[PDFConfig] Error marking saved reports as urgent:', err);
                await showCustomAlert('Error al marcar reportes guardados como importantes: ' + err.message, 'Error', 'error');
            }
        }

        // Refresh the list to show updated icons
        if (savedIds.length > 0) {
            await loadSavedReports();
        }

        // Re-render to show updated visual state
        renderInboxList();

        // Ensure Lucide icons are recreated after re-render
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }

        // Show success message
        const totalMarked = localIndices.length + savedIds.length;
        if (totalMarked > 0) {
            console.log('[PDFConfig] Successfully marked', totalMarked, 'reports as important');
            // Optionally show a brief success message
            // You can uncomment this if you want user feedback
            // alert(`✓ ${totalMarked} reporte${totalMarked !== 1 ? 's' : ''} marcado${totalMarked !== 1 ? 's' : ''} como importante${totalMarked !== 1 ? 's' : ''}.`);
        } else {
            console.warn('[PDFConfig] No reports were marked as important');
            await showCustomAlert('No se pudo marcar ningún reporte como importante. Verifica que hayas seleccionado reportes válidos.', 'Advertencia', 'warning');
        }
    };

    window.showBulkSaveForm = async function () {
        // Check if any local items are selected
        const hasLocal = [...selectedItems].some(k => k.startsWith('local_'));
        if (!hasLocal) {
            await showCustomAlert('Solo puedes guardar reportes que no están guardados.', 'Información', 'info');
            return;
        }
        if (bulkSaveForm) {
            bulkSaveForm.classList.remove('hidden');
            // Set up event listeners for bulk form
            const bulkUrgentCheckbox = document.getElementById('bulk-urgent');
            const bulkEstadoSelect = document.getElementById('bulk-estado');
            if (bulkUrgentCheckbox && bulkEstadoSelect) {
                // Remove existing listeners by cloning
                const newCheckbox = bulkUrgentCheckbox.cloneNode(true);
                bulkUrgentCheckbox.parentNode.replaceChild(newCheckbox, bulkUrgentCheckbox);
                const newSelect = bulkEstadoSelect.cloneNode(true);
                bulkEstadoSelect.parentNode.replaceChild(newSelect, bulkEstadoSelect);

                // Add new listeners
                newCheckbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        newSelect.value = 'a_revisar';
                    }
                });
                newSelect.addEventListener('change', (e) => {
                    if (e.target.value === 'a_revisar') {
                        newCheckbox.checked = true;
                    }
                });
            }
            bulkComment?.focus();
        }
    };

    window.cancelBulkSave = function () {
        if (bulkSaveForm) bulkSaveForm.classList.add('hidden');
        if (bulkComment) bulkComment.value = '';
    };

    window.confirmBulkSave = async function () {
        const observaciones = bulkComment?.value?.trim() || '';
        const estadoSelect = document.getElementById('bulk-estado');
        const urgentCheckbox = document.getElementById('bulk-urgent');
        // Si está marcado como urgente, forzar estado a 'a_revisar'
        let estado = estadoSelect?.value || 'generado';
        if (urgentCheckbox?.checked) {
            estado = 'a_revisar';
        }

        // Get local indices to save
        const localIndices = [...selectedItems]
            .filter(k => k.startsWith('local_'))
            .map(k => parseInt(k.replace('local_', '')))
            .sort((a, b) => b - a); // Reverse order for deletion later

        if (localIndices.length === 0) {
            await showCustomAlert('No hay reportes sin guardar seleccionados.', 'Información', 'info');
            return;
        }

        // Disable button
        const btn = document.querySelector('#bulk-save-form button:last-child');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Guardando...';
            if (window.lucide) lucide.createIcons();
        }

        let successCount = 0;
        let errorCount = 0;

        // Save each, lowest index last (so we can delete properly)
        for (const idx of [...localIndices].reverse()) {
            const report = localReports[idx];
            if (!report) continue;

            try {
                const result = await window.cerper.saveReportToDb(sessionId, {
                    pdf_base64: report.pdf_base64,
                    tipo_informe: report.tipo_informe,
                    plan_json: report.plan_json,
                    hash: report.hash,
                    tests_included: report.tests_included,
                    observaciones: observaciones,
                    estado: estado
                });

                if (result.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (err) {
                console.error('[PDFConfig] Bulk save error:', err);
                errorCount++;
            }
        }

        // Remove saved items from localReports (highest index first)
        for (const idx of localIndices) {
            localReports.splice(idx, 1);
            importantReports.delete(idx);
        }

        selectedItems.clear();
        await loadSavedReports();
        renderInboxList();
        updateSelectionUI();

        if (bulkSaveForm) bulkSaveForm.classList.add('hidden');
        if (bulkComment) bulkComment.value = '';
        if (estadoSelect) estadoSelect.value = 'generado';
        if (urgentCheckbox) urgentCheckbox.checked = false;

        if (errorCount === 0) {
            await showCustomAlert(
                `${successCount} reporte${successCount !== 1 ? 's' : ''} guardado${successCount !== 1 ? 's' : ''} exitosamente.`,
                'Éxito',
                'success'
            );
        } else {
            await showCustomAlert(
                `Guardados: ${successCount}, Errores: ${errorCount}`,
                'Resultado',
                'warning'
            );
        }
    };

    // Manual session finalization toggle (revocable)
    let finalizing = false;
    sessionFinalizeCheckbox?.addEventListener('change', async () => {
        if (!sessionId || finalizing) return;

        const hasSaved = savedReports.length > 0;
        const wantFinal = Boolean(sessionFinalizeCheckbox.checked);

        if (wantFinal && !hasSaved) {
            sessionFinalizeCheckbox.checked = false;
            await showCustomAlert(
                'Debes guardar al menos 1 reporte antes de marcar el proceso como finalizado.',
                'No disponible',
                'warning'
            );
            updateFinalizeControls();
            return;
        }

        const next = wantFinal ? 'finalizada' : (hasSaved ? 'suficiente' : 'activo');

        finalizing = true;
        sessionFinalizeCheckbox.disabled = true;
        try {
            const res = await setSessionEstado(next);
            if (!res?.ok) {
                throw new Error(res?.error || 'No se pudo actualizar el estado');
            }
        } catch (err) {
            console.error('[PDFConfig] Error updating session status:', err);
            await showCustomAlert(
                'No se pudo actualizar el estado de la sesión.',
                'Error',
                'error'
            );
        } finally {
            finalizing = false;
            updateFinalizeControls();
        }
    });

    // === TIME AGO FUNCTIONALITY ===
    function getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 30) return 'Recién generado';
        if (seconds < 60) return `hace ${seconds} segundos`;
        if (seconds < 120) return 'hace 1 minuto';
        if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} minutos`;
        return 'hace más de una hora';
    }

    // Update timeago elements every 30 seconds
    setInterval(() => {
        document.querySelectorAll('.timeago[data-created-at]').forEach(el => {
            const timestamp = parseInt(el.dataset.createdAt);
            if (timestamp) {
                el.textContent = getTimeAgo(timestamp);
            }
        });
    }, 30000); // 30 seconds

    // Initialize icons
    if (window.lucide) lucide.createIcons();
});
