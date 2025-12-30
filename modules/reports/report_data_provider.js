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
 * Format a value for display in tables.
 */
function formatValue(value) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'number') {
        if (Number.isNaN(value)) return '-';
        return Math.abs(value) < 1000 ? value.toFixed(4) : value.toFixed(2);
    }
    return String(value);
}

/**
 * Determine status (success/danger/neutral) from conclusion text.
 * IMPORTANT: Check negations FIRST to avoid partial matches (e.g., "no cumple" matching "cumple").
 */
function getConclusionStatus(text) {
    if (!text) return 'neutral';
    const lower = String(text).toLowerCase();
    // Check negations FIRST to avoid partial matches
    if (['no cumple', 'no normal', 'rechazado', 'no homogéneo', 'no aprobado'].some(w => lower.includes(w))) {
        return 'danger';
    }
    // Then check positive matches
    if (['cumple', 'normal', 'sí', 'aprobado', 'homogéneo'].some(w => lower.includes(w))) {
        return 'success';
    }
    return 'neutral';
}

/**
 * Transform snake_case key to Title Case label.
 * Example: 'p_value' → 'P Value', 'desviacion' → 'Desviacion'
 */
function keyToLabel(key) {
    if (!key) return '';
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Convert column keys to column objects with dynamic labels.
 * Preserves original order from data.
 */
function orderColumns(keysSet) {
    return Array.from(keysSet).map(k => ({
        key: k,
        label: keyToLabel(k)
    }));
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
     * @param {Object} config - { group_by, include_graphs, include_tables, analyst_names, execution_date, logo_path }
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
                logo_path: this.config.logo_path || null
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
                                formatted[k] = formatValue(v);
                                colsSet.add(k);
                            }
                            tableRows.push(formatted);
                        }
                    }

                    const columns = orderColumns(colsSet);

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

                    // Conclusion (only for by_analito modes)
                    let conclusion = null;
                    const groupBy = this.config.group_by || 'unified';
                    const showConclusions = filterAnalito !== null || ['by_analito', 'by_analito_nivel'].includes(groupBy);

                    if (showConclusions && rList.length > 0) {
                        const cText = rList[0].conclusion;
                        if (cText) {
                            conclusion = {
                                text: cText,
                                status: getConclusionStatus(cText)
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
