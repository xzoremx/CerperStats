/**
 * CerperStats Report Data Provider
 * 
 * Transforms raw session data into structured JSON for HTML report generation.
 * JavaScript port of the Python report_data_provider.py module.
 */

// =============================================================================
// Constants - Only truly fixed exceptions
// =============================================================================

// Only exception: These two DB categories map to the same header
const MERGED_CATEGORIES = {
    'Tratamiento de Resultados': 'PRUEBAS ESTADÍSTICAS APLICADAS A LOS RESULTADOS',
    'Atípicos': 'PRUEBAS ESTADÍSTICAS APLICADAS A LOS RESULTADOS',
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Map database category to display header.
 * Special cases handled via MERGED_CATEGORIES, otherwise uppercase.
 */
function getCategoryHeader(categoria) {
    if (!categoria) return 'OTROS';
    // Check for merged categories first
    if (MERGED_CATEGORIES[categoria]) {
        return MERGED_CATEGORIES[categoria];
    }
    // Default: just uppercase the DB category
    return categoria.toUpperCase();
}

/**
 * Escape HTML special characters
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Sanitize CSS class names
 */
function safeClassList(value) {
    return String(value || '')
        .split(/\s+/)
        .map(t => t.replace(/[^A-Za-z0-9_-]/g, '').trim())
        .filter(Boolean)
        .join(' ');
}

/**
 * Format a value for display in tables.
 * Uses value_mappings from config to apply labels and CSS classes.
 * @param {*} value - Value to format
 * @param {string} key - Column key (optional)
 * @param {Object} valueMappings - Value mappings from config
 */
function formatValue(value, key = null, valueMappings = {}) {
    // Null/undefined
    if (value === null || value === undefined) {
        return '<span class="df-value-null">-</span>';
    }

    // Check for value mappings (strings, booleans converted to string key)
    const mappingKey = typeof value === 'string' ? value : String(value);
    const mapping = valueMappings[mappingKey];

    if (mapping && typeof mapping === 'object') {
        const label = mapping.label != null ? mapping.label : mappingKey;
        const cls = mapping.class != null ? safeClassList(mapping.class) : '';
        const safeLabel = escapeHtml(label);
        const allClasses = safeClassList(`df-value-badge ${cls}`);
        return `<span class="${allClasses}">${safeLabel}</span>`;
    }

    // Column 'n' comes as string from Python, display as-is
    if (typeof value === 'string') {
        if (key && key.toLowerCase() === 'n') {
            return `<span class="df-value-number">${escapeHtml(value)}</span>`;
        }
        return `<span class="df-value-string">${escapeHtml(value)}</span>`;
    }

    // Numbers
    if (typeof value === 'number') {
        if (Number.isNaN(value)) return '<span class="df-value-null">-</span>';
        const formatted = Number.isInteger(value) ? String(value) : value.toFixed(4);
        return `<span class="df-value-number">${formatted}</span>`;
    }

    // Booleans (fallback if no mapping)
    if (typeof value === 'boolean') {
        return `<span class="df-value-string">${value ? 'Sí' : 'No'}</span>`;
    }

    return `<span class="df-value-string">${escapeHtml(String(value))}</span>`;
}

/**
 * Determine status (success/danger/neutral) from conclusion_status.
 * Uses the status provided by Python modules. Falls back to 'neutral' if not available.
 */
function getConclusionStatus(text, conclusionStatus = null) {
    // Use conclusion_status from Python if available and valid
    if (conclusionStatus && ['success', 'danger', 'neutral'].includes(conclusionStatus)) {
        return conclusionStatus;
    }
    
    // Default to neutral if no status provided
    return 'neutral';
}

/**
 * Transform snake_case key to Title Case label (fallback).
 * Example: 'p_value' → 'P Value', 'desviacion' → 'Desviacion'
 */
function keyToLabelFallback(key) {
    if (!key) return '';
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get column label from config or fallback to Title Case.
 * @param {string} key - Column key
 * @param {Object} columnLabels - Column labels from config
 */
function getColumnLabel(key, columnLabels = {}) {
    const strKey = String(key || '');
    const dynamic = columnLabels[strKey];
    if (typeof dynamic === 'string' && dynamic.trim() !== '') return dynamic;
    return keyToLabelFallback(strKey);
}

/**
 * Priority order for columns (appear first)
 */
const PRIORITY_COLUMNS = ["parametro", "n", "prueba_normalidad", "prueba_homogeneidad", "prueba_tendencia"];

/**
 * Convert column keys to column objects with dynamic labels.
 * Applies priority ordering and uses column_labels from config.
 * @param {Set} keysSet - Set of column keys
 * @param {Object} columnLabels - Column labels from config
 */
function orderColumns(keysSet, columnLabels = {}) {
    const allKeys = new Set(keysSet);
    const orderedKeys = [];

    // Add priority columns first (in order)
    for (const key of PRIORITY_COLUMNS) {
        if (allKeys.has(key)) {
            orderedKeys.push(key);
            allKeys.delete(key);
        }
    }

    // Add remaining columns alphabetically
    orderedKeys.push(...Array.from(allKeys).sort());

    return orderedKeys.map(k => ({
        key: k,
        label: getColumnLabel(k, columnLabels)
    }));
}

/**
 * Sanitize color value for CSS (security)
 */
function sanitizeColor(value) {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (raw === '') return null;
    if (raw.toLowerCase() === 'transparent') return 'transparent';

    // #rgb, #rgba, #rrggbb, #rrggbbaa
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) {
        return raw;
    }

    // rgb()/rgba() with numeric channels only
    const m = raw.match(
        /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+)\s*)?\)$/i
    );
    if (!m) return null;

    const r = Math.max(0, Math.min(255, Number(m[1])));
    const g = Math.max(0, Math.min(255, Number(m[2])));
    const b = Math.max(0, Math.min(255, Number(m[3])));
    const hasAlpha = typeof m[4] !== 'undefined';
    if (!hasAlpha) return `rgb(${r}, ${g}, ${b})`;

    const a = Math.max(0, Math.min(1, Number(m[4])));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Sanitize angle value for CSS gradients
 */
function sanitizeAngle(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(360, Math.round(n)));
}

/**
 * Build dynamic CSS rules from value_mappings (same logic as dataframe_renderer.js)
 * @param {Object} valueMappings - Value mappings from config
 * @returns {string} CSS rules
 */
function buildDynamicCssRules(valueMappings = {}) {
    const DYNAMIC_CLASS_PREFIX = 'df-';
    const classStyles = new Map();

    const mappings = valueMappings && typeof valueMappings === 'object'
        ? Object.values(valueMappings)
        : [];

    for (const mapping of mappings) {
        if (!mapping || typeof mapping !== 'object') continue;
        const style = mapping.style;
        if (!style || typeof style !== 'object') continue;

        const classTokens = safeClassList(mapping.class)
            .split(/\s+/)
            .filter(t => t.startsWith(DYNAMIC_CLASS_PREFIX));
        if (classTokens.length === 0) continue;

        const textColor = sanitizeColor(style.text_color ?? style.color ?? null);
        const bgFrom = sanitizeColor(style.bg_from ?? style.background_from ?? null);
        const bgTo = sanitizeColor(style.bg_to ?? style.background_to ?? null);
        const angle = sanitizeAngle(style.bg_angle ?? style.background_angle ?? null) ?? 135;

        for (const token of classTokens) {
            if (!token.startsWith(DYNAMIC_CLASS_PREFIX)) continue;
            classStyles.set(token, { textColor, bgFrom, bgTo, angle });
        }
    }

    const rules = [];
    for (const [token, style] of classStyles.entries()) {
        const decl = [];
        if (style.textColor) decl.push(`color: ${style.textColor};`);
        if (style.bgFrom && style.bgTo) {
            decl.push(`background: linear-gradient(${style.angle}deg, ${style.bgFrom} 0%, ${style.bgTo} 100%);`);
        } else if (style.bgFrom) {
            decl.push(`background-color: ${style.bgFrom};`);
        }
        if (decl.length === 0) continue;
        rules.push(`.${token} { ${decl.join(' ')} }`);
    }

    return rules.join('\n');
}

/**
 * Sanitize filename for Windows compatibility.
 * Removes invalid characters: < > : " / \ | ? * and control characters.
 */
function safeFilename(str) {
    if (!str) return 'unnamed';
    return str
        .replace(/\s+/g, '_')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-') // Remove Windows-invalid chars and control chars
        .replace(/-+/g, '-') // Collapse multiple dashes
        .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
}

// =============================================================================
// Report Data Provider Class
// =============================================================================

class ReportDataProvider {
    /**
     * @param {Object} data - { session_id, session_info, results, graphs }
     * @param {Object} config - { group_by, include_graphs, include_tables, analyst_names, execution_date, logo_path, value_mappings, column_labels }
     */
    constructor(data, config) {
        this.sessionId = data.session_id;
        this.sessionInfo = data.session_info || {};
        this.results = data.results || [];
        this.graphs = data.graphs || [];
        this.config = config || {};

        // Index graphs by (catalog_id, nivel, analito)
        this.graphIndex = new Map();
        for (const g of this.graphs) {
            const key = `${g.catalog_id}-${g.nivel}-${g.analito || ''}`;
            this.graphIndex.set(key, g.grafico_data);
        }
    }

    _getGraph(catalogId, nivel, analito = null) {
        // Try specific match
        let g = this.graphIndex.get(`${catalogId}-${nivel}-${analito || ''}`);
        if (g) return g;
        // Try generic (no analito)
        return this.graphIndex.get(`${catalogId}-${nivel}-`);
    }

    /**
     * Main entry point. Returns array of report objects based on grouping config.
     */
    getReportData() {
        const groupBy = this.config.group_by || 'unified';

        switch (groupBy) {
            case 'by_analito_nivel':
                return this._generateByAnalitoNivel();
            case 'by_analito':
                return this._generateByAnalito();
            case 'by_nivel':
                return this._generateByNivel();
            default:
                return this._generateUnified();
        }
    }

    // =========================================================================
    // Generation Strategies
    // =========================================================================

    _generateUnified() {
        return [this._buildReportStructure(this.results, 'Unificado', 'unificado')];
    }

    _generateByNivel() {
        const byNivel = new Map();
        for (const r of this.results) {
            const nivel = r.nivel || 1;
            if (!byNivel.has(nivel)) byNivel.set(nivel, []);
            byNivel.get(nivel).push(r);
        }

        return Array.from(byNivel.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([nivel, subset]) =>
                this._buildReportStructure(subset, `Nivel ${nivel}`, `nivel_${nivel}`, null, nivel)
            );
    }

    _generateByAnalito() {
        const byAnalito = new Map();
        for (const r of this.results) {
            const analito = r.analito;
            if (!analito) continue;
            if (!byAnalito.has(analito)) byAnalito.set(analito, []);
            byAnalito.get(analito).push(r);
        }

        return Array.from(byAnalito.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([analito, subset]) =>
                this._buildReportStructure(subset, analito, safeFilename(analito), analito)
            );
    }

    _generateByAnalitoNivel() {
        const grouped = new Map();
        for (const r of this.results) {
            const analito = r.analito;
            const nivel = r.nivel || 1;
            if (!analito) continue;
            const key = `${analito}|${nivel}`;
            if (!grouped.has(key)) grouped.set(key, { analito, nivel, results: [] });
            grouped.get(key).results.push(r);
        }

        return Array.from(grouped.values())
            .sort((a, b) => a.analito.localeCompare(b.analito) || a.nivel - b.nivel)
            .map(({ analito, nivel, results }) =>
                this._buildReportStructure(
                    results,
                    `${analito} - Nivel ${nivel}`,
                    `${safeFilename(analito)}_nivel_${nivel}`,
                    analito,
                    nivel
                )
            );
    }

    // =========================================================================
    // Structure Builder
    // =========================================================================

    _buildReportStructure(resultsSubset, titleSuffix, filenameSuffix, filterAnalito = null, filterNivel = null) {
        // Generate dynamic CSS from value_mappings
        const dynamicCss = buildDynamicCssRules(this.config.value_mappings || {});

        return {
            filename: `informe_sesion_${this.sessionId}_${filenameSuffix}.pdf`,
            // Store metadata for main.js to extract
            _metadata: {
                analito: filterAnalito,
                nivel: filterNivel
            },
            data: {
                cover: this._buildCoverData(resultsSubset, titleSuffix),
                sections: this._buildSectionsData(resultsSubset, filterAnalito, filterNivel),
                // Pass logo_path to template
                logo_path: this.config.logo_path || null,
                // Pass tipo_analisis to template for table rendering logic
                tipo_analisis: this.sessionInfo.tipo_analisis || null,
                // Dynamic CSS for badge styles (from value_mappings)
                dynamic_css: dynamicCss
            }
        };
    }

    _buildCoverData(results, titleSuffix) {
        const info = this.sessionInfo;
        // Use execution_date from config (formatted as DD/MM/YYYY from pdf_config.js)
        // Fallback to current date if not provided
        const execDate = this.config.execution_date || new Date().toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        // Participants (only if parametro == 'Analista')
        const participants = [];
        // Get analyst_names from config (array or null/undefined)
        const analystNames = this.config.analyst_names;
        // Verify that parametro is 'analista' (case-insensitive)
        const isAnalystParam = (info.parametro || '').toLowerCase() === 'analista';

        // Only add participants if:
        // 1. parametro is 'analista' AND
        // 2. analyst_names is provided (not null/undefined) AND
        // 3. analyst_names is a non-empty array
        if (isAnalystParam && Array.isArray(analystNames) && analystNames.length > 0) {
            analystNames.forEach((name, i) => {
                // Only add non-empty names
                if (name && String(name).trim()) {
                    participants.push({ index: `Analista ${i + 1}`, name: String(name).trim() });
                }
            });
        }

        // Tests list for cover
        const testsByCategory = new Map();
        const seenTests = new Set();

        for (const r of results) {
            const header = getCategoryHeader(r.categoria);
            const name = r.titulo || r.test_titulo || r.nombre_interno;
            const key = `${header}|${name}`;

            if (!seenTests.has(key)) {
                if (!testsByCategory.has(header)) testsByCategory.set(header, []);
                testsByCategory.get(header).push(name);
                seenTests.add(key);
            }
        }

        const testsList = [];
        // Use order of appearance in data (from testsByCategory map)
        const orderedHeaders = Array.from(testsByCategory.keys());

        for (const header of orderedHeaders) {
            testsList.push({
                header,
                tests: testsByCategory.get(header)
            });
        }

        return {
            title: 'INFORME ESTADÍSTICO',
            subtitle: titleSuffix,
            lab: info.lab_nombre || info.lab_key || '',
            expediente: info.expediente || '',
            fecha: execDate,
            ensayo: info.ensayo || '',
            metodo: info.metodo || '',
            producto: info.producto || '',
            unidad: info.unidad || '',
            parametro: info.parametro || '',
            participants,
            tests_list: testsList,
            signatures: {
                supervisor_name: info.supervisor_nombre || info.supervisor || '_________________',
                supervisor_role: 'Supervisor / Responsable de laboratorio'
            }
        };
    }

    _buildSectionsData(results, filterAnalito, filterNivel) {
        // Group: Header -> TestKey -> Nivel -> [results]
        const grouped = new Map();

        for (const r of results) {
            const header = getCategoryHeader(r.categoria);
            const testId = r.catalog_id;
            const testName = r.titulo || r.test_titulo || r.nombre_interno;
            const testDesc = r.descripcion || '';
            const testKey = `${testId}|${testName}|${testDesc}`;
            const nivel = r.nivel || 1;

            if (!grouped.has(header)) grouped.set(header, new Map());
            if (!grouped.get(header).has(testKey)) grouped.get(header).set(testKey, new Map());
            if (!grouped.get(header).get(testKey).has(nivel)) grouped.get(header).get(testKey).set(nivel, []);

            grouped.get(header).get(testKey).get(nivel).push(r);
        }

        // Build sections - use order of appearance in data
        const sections = [];
        const orderedHeaders = Array.from(grouped.keys());

        for (const header of orderedHeaders) {
            const testsMap = grouped.get(header);
            const testsData = [];

            // Sort by catalog_id
            const sortedTestKeys = Array.from(testsMap.keys()).sort((a, b) => {
                const idA = parseInt(a.split('|')[0]) || 0;
                const idB = parseInt(b.split('|')[0]) || 0;
                return idA - idB;
            });

            for (const testKey of sortedTestKeys) {
                const [testIdStr, testName, testDesc] = testKey.split('|');
                const testId = parseInt(testIdStr) || null;
                const nivelesMap = testsMap.get(testKey);
                const nivelesData = [];

                const sortedNiveles = Array.from(nivelesMap.keys()).sort((a, b) => a - b);

                for (const nivel of sortedNiveles) {
                    const rList = nivelesMap.get(nivel);
                    if (!rList.length) continue;

                    // Build table rows
                    const tableRows = [];
                    const colsSet = new Set();

                    for (const r of rList) {
                        let rawPc = r.resultado_pc;
                        if (typeof rawPc === 'string') {
                            try { rawPc = JSON.parse(rawPc); } catch { rawPc = []; }
                        }
                        if (!Array.isArray(rawPc)) rawPc = [];

                        for (const row of rawPc) {
                            const formatted = {};
                            for (const [k, v] of Object.entries(row)) {
                                formatted[k] = formatValue(v, k, this.config.value_mappings || {});
                                colsSet.add(k);
                            }
                            tableRows.push(formatted);
                        }
                    }

                    const columns = orderColumns(colsSet, this.config.column_labels || {});

                    // Build table only if include_tables is enabled
                    let table = null;
                    if (this.config.include_tables !== false && tableRows.length > 0) {
                        table = { rows: tableRows, columns };
                    }

                    // Graphs
                    const graphs = [];
                    if (this.config.include_graphs !== false) {
                        for (const r of rList) {
                            const analito = r.analito;
                            const gData = this._getGraph(testId, nivel, analito);
                            if (gData) {
                                graphs.push({
                                    data: gData.startsWith('data:') ? gData : `data:image/png;base64,${gData}`,
                                    label: rList.length > 1 ? analito : null
                                });
                            }
                        }
                    }

                    // Conclusion logic:
                    // - For multianalito: only show when grouped by analito (filterAnalito !== null)
                    // - For monoanalito: always show when it exists
                    let conclusion = null;
                    const tipoAnalisis = (this.sessionInfo.tipo_analisis || '').toLowerCase();
                    const isMultianalito = tipoAnalisis === 'multi' || tipoAnalisis === 'multianalito';
                    const groupBy = this.config.group_by || 'unified';
                    
                    // Show conclusions if:
                    // 1. It's monoanalito (always show), OR
                    // 2. It's multianalito AND we're filtering by analito (filterAnalito !== null) OR grouping by analito
                    const showConclusions = !isMultianalito || 
                        filterAnalito !== null || 
                        ['by_analito', 'by_analito_nivel'].includes(groupBy);
                    
                    if (showConclusions && rList.length > 0) {
                        // Try to find conclusion and conclusion_status from any result in the list
                        const resultWithConclusion = rList.find(r => r.conclusion) || rList[0];
                        const cText = resultWithConclusion?.conclusion;
                        const cStatus = resultWithConclusion?.conclusion_status || null;
                        if (cText) {
                            conclusion = {
                                text: cText,
                                status: getConclusionStatus(cText, cStatus)
                            };
                        }
                    }

                    nivelesData.push({
                        nivel,
                        table,
                        conclusion,
                        graphs
                    });
                }

                testsData.push({
                    name: testName,
                    description: testDesc,
                    niveles: nivelesData
                });
            }

            sections.push({
                header,
                tests: testsData
            });
        }

        return sections;
    }
}

module.exports = { ReportDataProvider };
