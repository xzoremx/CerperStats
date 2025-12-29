/**
 * PDF Config Page - JavaScript Logic
 * Handles section navigation, mode selection, options, report generation, and inbox
 * 
 * PDFs generados se mantienen localmente hasta que el usuario los guarda explícitamente.
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

    // DOM Elements - Filters and Bulk Actions
    const filterTipo = document.getElementById('filter-tipo');
    const searchInput = document.getElementById('search-input');
    const selectionInfo = document.getElementById('selection-info');
    const selectionCount = document.getElementById('selection-count');
    const bulkActionsBar = document.getElementById('bulk-actions-bar');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const bulkSaveForm = document.getElementById('bulk-save-form');
    const bulkComment = document.getElementById('bulk-comment');

    // Analyst names section elements
    const analystNamesSection = document.getElementById('analyst-names-section');
    const analystInputsContainer = document.getElementById('analyst-inputs-container');
    const analystValidationMsg = document.getElementById('analyst-validation-msg');

    // State
    let activeView = 'config';
    let selectedMode = 'unified';
    let isGenerating = false;
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
    // Session parameter info
    let sessionParametro = '';
    let sessionNumParametros = 0;
    let analystNames = []; // Array of analyst names when parametro === 'Analista'
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

        // Add input event listeners to save names
        analystInputsContainer.querySelectorAll('.analyst-name-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                analystNames[idx] = e.target.value.trim();
                // Save to sessionStorage for persistence
                sessionStorage.setItem(`analystNames_${sessionId}`, JSON.stringify(analystNames));
                // Hide validation message when typing
                if (analystValidationMsg) analystValidationMsg.classList.add('hidden');
            });
        });

        if (window.lucide) lucide.createIcons();
    }

    // Validate analyst names (returns true if all filled, or if not Analista mode)
    function validateAnalystNames() {
        if (sessionParametro.toLowerCase() !== 'analista') return true;
        if (analystNames.length === 0) return false;

        const allFilled = analystNames.every(name => name && name.trim().length > 0);

        if (!allFilled && analystValidationMsg) {
            analystValidationMsg.classList.remove('hidden');
        }

        return allFilled;
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
        setProgress(0, 'Preparando datos...');

        const config = {
            group_by: selectedMode,
            include_graphs: optGraphs?.checked !== false,
            include_tables: optTables?.checked !== false,
            // Include analyst names if parametro is Analista
            analyst_names: sessionParametro.toLowerCase() === 'analista' ? analystNames : null
        };

        try {
            setProgress(10, 'Generando PDFs localmente...');

            const result = await window.cerper.generateReports(sessionId, config);

            if (!result.ok) {
                throw new Error(result.error || result.message || 'Error desconocido');
            }

            setProgress(90, 'Preparando vista previa...');

            const reportCount = result.reports?.length || 0;

            // Add to local reports (NOT saved yet) - with timestamp
            const now = Date.now();
            const reportsWithTimestamp = result.reports.map(r => ({
                ...r,
                createdAt: now
            }));
            localReports = [...localReports, ...reportsWithTimestamp];

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

        if (isLocal) {
            return `
                <div class="report-item-container border-amber-500/30 bg-amber-500/5 rounded-xl p-4" data-local-index="${localIndex}">
                    <div class="flex items-center gap-4">
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
                            <button class="delete-btn w-10 h-10 rounded-lg flex items-center justify-center transition-all" onclick="discardLocalReport(${localIndex})" title="Descartar">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                            <button class="btn-secondary w-10 h-10 rounded-lg flex items-center justify-center transition-all" onclick="downloadLocalReport(${localIndex})" title="Descargar">
                                <i data-lucide="download" class="w-5 h-5 text-gray-400"></i>
                            </button>
                            <!-- Comment toggle -->
                            <button id="comment-toggle-${localIndex}" 
                                class="comment-toggle w-10 h-10 rounded-lg flex items-center justify-center transition-all bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white" 
                                onclick="toggleCommentOption(${localIndex})" 
                                title="Agregar comentario">
                                <i data-lucide="message-square" class="w-5 h-5"></i>
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
                            <span class="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Guardado</span>
                        </div>
                        <div class="text-sm text-gray-500">${displaySubtitle ? displaySubtitle + ' • ' : ''}${dateDisplay} • ${sizeKb} KB</div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="delete-btn w-10 h-10 rounded-lg flex items-center justify-center transition-all" onclick="deleteSavedReport(${report.id})" title="Eliminar">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>
                        <button class="download-btn w-10 h-10 rounded-lg flex items-center justify-center transition-all" onclick="downloadSavedReport(${report.id})" title="Descargar">
                            <i data-lucide="download" class="w-5 h-5 text-white"></i>
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
    window.discardLocalReport = function (index) {
        if (!confirm('¿Descartar este reporte? No se ha guardado en el servidor.')) return;
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

    // Save a LOCAL report to database
    window.saveLocalReport = async function (index) {
        const report = localReports[index];
        if (!report) return;

        const itemEl = document.querySelector(`[data-local-index="${index}"]`);
        if (!itemEl) return;

        // If comment is NOT enabled, save directly without form
        if (!commentEnabled.has(index)) {
            await doSaveReport(index, '');
            return;
        }

        // Check if form already exists
        if (itemEl.querySelector('.save-form')) return;

        // Create inline save form for comment
        const formHtml = `
            <div class="save-form mt-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <label class="block text-sm font-medium text-white mb-2">
                    <i data-lucide="message-square" class="w-4 h-4 inline mr-1"></i>
                    Observaciones
                </label>
                <textarea id="save-comment-${index}" rows="2" 
                    class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-emerald-500/50"
                    placeholder="Escribe un comentario o nota sobre este reporte..."></textarea>
                <div class="flex items-center justify-end gap-2 mt-3">
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

        await doSaveReport(index, observaciones);
    };

    // Core save function (used by both direct save and form save)
    async function doSaveReport(index, observaciones) {
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
                observaciones: observaciones
            });

            if (!result.ok) {
                throw new Error(result.error || 'Error desconocido');
            }

            // Remove from local, clear comment state, reload saved
            localReports.splice(index, 1);
            commentEnabled.delete(index);
            await loadSavedReports();
            renderInboxList();

        } catch (err) {
            console.error('[PDFConfig] Save error:', err);
            alert('Error guardando: ' + err.message);

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
            alert('Error descargando: ' + err.message);
        }
    };

    // Delete a SAVED report from database
    window.deleteSavedReport = async function (reportId) {
        if (!confirm('¿Eliminar este reporte del servidor? Esta acción no se puede deshacer.')) return;

        try {
            const result = await window.cerper.deleteReport(reportId);
            if (!result.ok) throw new Error(result.error);

            await loadSavedReports();
            renderInboxList();
        } catch (err) {
            console.error('[PDFConfig] Delete error:', err);
            alert('Error eliminando: ' + err.message);
        }
    };

    // Helper: download base64 as file
    function downloadBase64Pdf(base64, filename) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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

        // Update select all checkbox
        const { local, saved } = getFilteredReports();
        const totalVisible = local.length + saved.length;
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = count > 0 && count === totalVisible;
            selectAllCheckbox.indeterminate = count > 0 && count < totalVisible;
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
            local.forEach((r, i) => selectedItems.add(`local_${i}`));
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

        if (!confirm(msg)) return;

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

    window.showBulkSaveForm = function () {
        // Check if any local items are selected
        const hasLocal = [...selectedItems].some(k => k.startsWith('local_'));
        if (!hasLocal) {
            alert('Solo puedes guardar reportes que no están guardados.');
            return;
        }
        if (bulkSaveForm) {
            bulkSaveForm.classList.remove('hidden');
            bulkComment?.focus();
        }
    };

    window.cancelBulkSave = function () {
        if (bulkSaveForm) bulkSaveForm.classList.add('hidden');
        if (bulkComment) bulkComment.value = '';
    };

    window.confirmBulkSave = async function () {
        const observaciones = bulkComment?.value?.trim() || '';

        // Get local indices to save
        const localIndices = [...selectedItems]
            .filter(k => k.startsWith('local_'))
            .map(k => parseInt(k.replace('local_', '')))
            .sort((a, b) => b - a); // Reverse order for deletion later

        if (localIndices.length === 0) {
            alert('No hay reportes sin guardar seleccionados.');
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
                    observaciones: observaciones
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
        }

        selectedItems.clear();
        await loadSavedReports();
        renderInboxList();
        updateSelectionUI();

        if (bulkSaveForm) bulkSaveForm.classList.add('hidden');
        if (bulkComment) bulkComment.value = '';

        if (errorCount === 0) {
            alert(`✓ ${successCount} reporte${successCount !== 1 ? 's' : ''} guardado${successCount !== 1 ? 's' : ''} exitosamente.`);
        } else {
            alert(`Guardados: ${successCount}, Errores: ${errorCount}`);
        }
    };

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
