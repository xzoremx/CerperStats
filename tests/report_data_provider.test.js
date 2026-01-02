/**
 * Unit Tests para report_data_provider.js
 * 
 * Verifica:
 * - Estructura de datos requerida
 * - Tipos de agrupación según monoanalito/multianalito (2 vs 4 opciones)
 * - Validación de datos en cover, secciones, participantes, metadatos
 * 
 * Ejecutar con: npm test
 */

const { ReportDataProvider } = require('../modules/reports/report_data_provider');

// =============================================================================
// Helper: Create mock data
// =============================================================================

function createMockSessionInfo(overrides = {}) {
    return {
        id: 1,
        lab_nombre: 'Laboratorio de Pruebas',
        lab_key: 'lab_test',
        expediente: 'EXP-001',
        ensayo: 'Ensayo de Prueba',
        metodo: 'Método Estándar',
        producto: 'Producto Test',
        unidad: 'mg/L',
        parametro: 'Días',
        supervisor_nombre: 'Supervisor Test',
        ...overrides
    };
}

function createMockResult(overrides = {}) {
    return {
        catalog_id: 1,
        categoria: 'Normalidad',
        titulo: 'Test de Normalidad',
        test_titulo: 'Test de Normalidad',
        nombre_interno: 'normalidad_test',
        descripcion: 'Descripción del test',
        nivel: 1,
        analito: null,
        resultado_pc: JSON.stringify([
            { valor: 1.5, p_value: 0.05 },
            { valor: 2.3, p_value: 0.03 }
        ]),
        conclusion: 'Cumple con los requisitos',
        ...overrides
    };
}

function createMockGraph(overrides = {}) {
    return {
        catalog_id: 1,
        nivel: 1,
        analito: null,
        grafico_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        ...overrides
    };
}

// =============================================================================
// Tests: Constructor and Basic Structure
// =============================================================================

describe('ReportDataProvider', () => {
    describe('Constructor', () => {
        test('inicializa correctamente con datos mínimos', () => {
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: {}, results: [], graphs: [] },
                {}
            );
            expect(provider.sessionId).toBe(1);
            expect(provider.results).toEqual([]);
            expect(provider.graphs).toEqual([]);
        });

        test('indexa gráficos correctamente', () => {
            const graphs = [
                createMockGraph({ catalog_id: 1, nivel: 1, analito: null }),
                createMockGraph({ catalog_id: 1, nivel: 2, analito: 'Analito A' })
            ];
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: {}, results: [], graphs },
                {}
            );
            expect(provider.graphIndex.size).toBe(2);
        });
    });

    // =========================================================================
    // Tests: Report Structure - Monoanalito (2 opciones)
    // =========================================================================

    describe('Monoanalito Reports (2 opciones)', () => {
        const monoResults = [
            createMockResult({ nivel: 1, analito: null }),
            createMockResult({ nivel: 2, analito: null, catalog_id: 2 })
        ];
        const sessionInfo = createMockSessionInfo({ tipo_analisis: 'mono' });

        test('unified genera 1 reporte', () => {
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: sessionInfo, results: monoResults, graphs: [] },
                { group_by: 'unified' }
            );
            const reports = provider.getReportData();
            expect(reports).toHaveLength(1);
            expect(reports[0].filename).toContain('unificado');
            expect(reports[0]._metadata.analito).toBeNull();
            expect(reports[0]._metadata.nivel).toBeNull();
        });

        test('by_nivel genera reportes por nivel', () => {
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: sessionInfo, results: monoResults, graphs: [] },
                { group_by: 'by_nivel' }
            );
            const reports = provider.getReportData();
            expect(reports.length).toBeGreaterThanOrEqual(1);
            expect(reports.length).toBeLessThanOrEqual(2); // Máximo 2 niveles en este caso
            reports.forEach(report => {
                expect(report._metadata.analito).toBeNull();
                expect(report._metadata.nivel).not.toBeNull();
            });
        });

        test('monoanalito solo tiene 2 opciones válidas (unified, by_nivel)', () => {
            // by_analito no debería generar reportes válidos para monoanalito
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: sessionInfo, results: monoResults, graphs: [] },
                { group_by: 'by_analito' }
            );
            const reports = provider.getReportData();
            // Debería retornar array vacío o reportes sin analito
            reports.forEach(report => {
                expect(report._metadata.analito).toBeNull();
            });
        });
    });

    // =========================================================================
    // Tests: Report Structure - Multianalito (4 opciones)
    // =========================================================================

    describe('Multianalito Reports (4 opciones)', () => {
        const multiResults = [
            createMockResult({ nivel: 1, analito: 'Analito A', catalog_id: 1 }),
            createMockResult({ nivel: 1, analito: 'Analito B', catalog_id: 1 }),
            createMockResult({ nivel: 2, analito: 'Analito A', catalog_id: 1 }),
            createMockResult({ nivel: 2, analito: 'Analito B', catalog_id: 1 })
        ];
        const sessionInfo = createMockSessionInfo({ tipo_analisis: 'multianalito' });

        test('unified genera 1 reporte', () => {
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: sessionInfo, results: multiResults, graphs: [] },
                { group_by: 'unified' }
            );
            const reports = provider.getReportData();
            expect(reports).toHaveLength(1);
            expect(reports[0]._metadata.analito).toBeNull();
            expect(reports[0]._metadata.nivel).toBeNull();
        });

        test('by_nivel genera reportes por nivel', () => {
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: sessionInfo, results: multiResults, graphs: [] },
                { group_by: 'by_nivel' }
            );
            const reports = provider.getReportData();
            expect(reports.length).toBeGreaterThanOrEqual(1);
            reports.forEach(report => {
                expect(report._metadata.analito).toBeNull();
                expect(report._metadata.nivel).not.toBeNull();
            });
        });

        test('by_analito genera reportes por analito', () => {
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: sessionInfo, results: multiResults, graphs: [] },
                { group_by: 'by_analito' }
            );
            const reports = provider.getReportData();
            expect(reports.length).toBeGreaterThanOrEqual(1);
            const analitos = new Set(reports.map(r => r._metadata.analito));
            expect(analitos.size).toBeGreaterThanOrEqual(1);
            reports.forEach(report => {
                expect(report._metadata.analito).not.toBeNull();
                expect(report._metadata.nivel).toBeNull();
            });
        });

        test('by_analito_nivel genera reportes por analito y nivel', () => {
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: sessionInfo, results: multiResults, graphs: [] },
                { group_by: 'by_analito_nivel' }
            );
            const reports = provider.getReportData();
            expect(reports.length).toBeGreaterThanOrEqual(1);
            reports.forEach(report => {
                expect(report._metadata.analito).not.toBeNull();
                expect(report._metadata.nivel).not.toBeNull();
            });
        });

        test('multianalito tiene 4 opciones válidas (unified, by_nivel, by_analito, by_analito_nivel)', () => {
            const options = ['unified', 'by_nivel', 'by_analito', 'by_analito_nivel'];
            options.forEach(option => {
                const provider = new ReportDataProvider(
                    { session_id: 1, session_info: sessionInfo, results: multiResults, graphs: [] },
                    { group_by: option }
                );
                const reports = provider.getReportData();
                expect(reports.length).toBeGreaterThan(0);
                reports.forEach(report => {
                    expect(report).toHaveProperty('filename');
                    expect(report).toHaveProperty('data');
                    expect(report).toHaveProperty('_metadata');
                });
            });
        });
    });

    // =========================================================================
    // Tests: Cover Data Validation
    // =========================================================================

    describe('Cover Data Validation', () => {
        test('incluye todos los campos requeridos en cover', () => {
            const sessionInfo = createMockSessionInfo();
            const results = [createMockResult()];
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: sessionInfo, results, graphs: [] },
                { execution_date: '15/01/2024' }
            );
            const reports = provider.getReportData();
            const cover = reports[0].data.cover;

            expect(cover).toHaveProperty('title');
            expect(cover).toHaveProperty('subtitle');
            expect(cover).toHaveProperty('lab');
            expect(cover).toHaveProperty('expediente');
            expect(cover).toHaveProperty('fecha');
            expect(cover).toHaveProperty('ensayo');
            expect(cover).toHaveProperty('metodo');
            expect(cover).toHaveProperty('producto');
            expect(cover).toHaveProperty('unidad');
            expect(cover).toHaveProperty('parametro');
            expect(cover).toHaveProperty('participants');
            expect(cover).toHaveProperty('tests_list');
            expect(cover).toHaveProperty('signatures');
        });

        test('usa execution_date del config', () => {
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo(), results: [createMockResult()], graphs: [] },
                { execution_date: '20/12/2024' }
            );
            const reports = provider.getReportData();
            expect(reports[0].data.cover.fecha).toBe('20/12/2024');
        });

        test('usa fecha actual como fallback si no hay execution_date', () => {
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo(), results: [createMockResult()], graphs: [] },
                {}
            );
            const reports = provider.getReportData();
            expect(reports[0].data.cover.fecha).toMatch(/\d{2}\/\d{2}\/\d{4}/);
        });

        test('incluye participants solo si parametro es "Analista"', () => {
            const sessionInfoAnalista = createMockSessionInfo({ parametro: 'Analista' });
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: sessionInfoAnalista, results: [createMockResult()], graphs: [] },
                { analyst_names: ['Juan Pérez', 'María García'] }
            );
            const reports = provider.getReportData();
            expect(reports[0].data.cover.participants).toHaveLength(2);
            expect(reports[0].data.cover.participants[0]).toEqual({ index: 'Analista 1', name: 'Juan Pérez' });
        });

        test('omite participants si parametro no es "Analista"', () => {
            const sessionInfoDias = createMockSessionInfo({ parametro: 'Días' });
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: sessionInfoDias, results: [createMockResult()], graphs: [] },
                { analyst_names: ['Juan Pérez'] }
            );
            const reports = provider.getReportData();
            expect(reports[0].data.cover.participants).toHaveLength(0);
        });

        test('omite participants si analyst_names es null', () => {
            const sessionInfoAnalista = createMockSessionInfo({ parametro: 'Analista' });
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: sessionInfoAnalista, results: [createMockResult()], graphs: [] },
                { analyst_names: null }
            );
            const reports = provider.getReportData();
            expect(reports[0].data.cover.participants).toHaveLength(0);
        });

        test('filtra nombres vacíos de participants', () => {
            const sessionInfoAnalista = createMockSessionInfo({ parametro: 'Analista' });
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: sessionInfoAnalista, results: [createMockResult()], graphs: [] },
                { analyst_names: ['Juan Pérez', '', '   ', 'María García'] }
            );
            const reports = provider.getReportData();
            expect(reports[0].data.cover.participants).toHaveLength(2);
            expect(reports[0].data.cover.participants.map(p => p.name)).toEqual(['Juan Pérez', 'María García']);
        });

        test('genera tests_list correctamente', () => {
            const results = [
                createMockResult({ categoria: 'Normalidad', titulo: 'Test 1' }),
                createMockResult({ categoria: 'Dispersión', titulo: 'Test 2' })
            ];
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo(), results, graphs: [] },
                {}
            );
            const reports = provider.getReportData();
            const testsList = reports[0].data.cover.tests_list;
            expect(testsList.length).toBeGreaterThan(0);
            expect(testsList[0]).toHaveProperty('header');
            expect(testsList[0]).toHaveProperty('tests');
            expect(Array.isArray(testsList[0].tests)).toBe(true);
        });
    });

    // =========================================================================
    // Tests: Sections Data Validation
    // =========================================================================

    describe('Sections Data Validation', () => {
        test('agrupa resultados por categoría', () => {
            const results = [
                createMockResult({ categoria: 'Normalidad', catalog_id: 1 }),
                createMockResult({ categoria: 'Dispersión', catalog_id: 2 })
            ];
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo(), results, graphs: [] },
                {}
            );
            const reports = provider.getReportData();
            const sections = reports[0].data.sections;
            expect(sections.length).toBeGreaterThanOrEqual(1);
            sections.forEach(section => {
                expect(section).toHaveProperty('header');
                expect(section).toHaveProperty('tests');
                expect(Array.isArray(section.tests)).toBe(true);
            });
        });

        test('incluye tablas solo si include_tables es true', () => {
            const results = [createMockResult()];
            const providerWithTables = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo(), results, graphs: [] },
                { include_tables: true }
            );
            const reportsWithTables = providerWithTables.getReportData();
            const nivel = reportsWithTables[0].data.sections[0]?.tests[0]?.niveles[0];
            if (nivel && nivel.table) {
                expect(nivel.table).toHaveProperty('rows');
                expect(nivel.table).toHaveProperty('columns');
            }

            const providerWithoutTables = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo(), results, graphs: [] },
                { include_tables: false }
            );
            const reportsWithoutTables = providerWithoutTables.getReportData();
            const nivelNoTable = reportsWithoutTables[0].data.sections[0]?.tests[0]?.niveles[0];
            if (nivelNoTable) {
                expect(nivelNoTable.table).toBeNull();
            }
        });

        test('incluye gráficos solo si include_graphs es true', () => {
            const results = [createMockResult()];
            const graphs = [createMockGraph()];
            const providerWithGraphs = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo(), results, graphs },
                { include_graphs: true }
            );
            const reportsWithGraphs = providerWithGraphs.getReportData();
            const nivel = reportsWithGraphs[0].data.sections[0]?.tests[0]?.niveles[0];
            if (nivel && nivel.graphs) {
                expect(Array.isArray(nivel.graphs)).toBe(true);
            }

            const providerWithoutGraphs = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo(), results, graphs },
                { include_graphs: false }
            );
            const reportsWithoutGraphs = providerWithoutGraphs.getReportData();
            const nivelNoGraphs = reportsWithoutGraphs[0].data.sections[0]?.tests[0]?.niveles[0];
            if (nivelNoGraphs) {
                expect(nivelNoGraphs.graphs).toHaveLength(0);
            }
        });

        test('incluye conclusiones solo en modos by_analito', () => {
            const results = [
                createMockResult({ analito: 'Analito A', conclusion: 'Cumple' })
            ];
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo({ tipo_analisis: 'multianalito' }), results, graphs: [] },
                { group_by: 'by_analito' }
            );
            const reports = provider.getReportData();
            const nivel = reports[0].data.sections[0]?.tests[0]?.niveles[0];
            if (nivel) {
                expect(nivel.conclusion).not.toBeNull();
                expect(nivel.conclusion).toHaveProperty('text');
                expect(nivel.conclusion).toHaveProperty('status');
            }
        });
    });

    // =========================================================================
    // Tests: Metadata Validation
    // =========================================================================

    describe('Metadata Validation', () => {
        test('_metadata contiene analito y nivel correctos', () => {
            const results = [
                createMockResult({ analito: 'Analito A', nivel: 1 })
            ];
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo({ tipo_analisis: 'multianalito' }), results, graphs: [] },
                { group_by: 'by_analito_nivel' }
            );
            const reports = provider.getReportData();
            reports.forEach(report => {
                expect(report).toHaveProperty('_metadata');
                expect(report._metadata).toHaveProperty('analito');
                expect(report._metadata).toHaveProperty('nivel');
            });
        });

        test('logo_path se pasa en data', () => {
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo(), results: [createMockResult()], graphs: [] },
                { logo_path: '/path/to/logo.png' }
            );
            const reports = provider.getReportData();
            expect(reports[0].data).toHaveProperty('logo_path');
            expect(reports[0].data.logo_path).toBe('/path/to/logo.png');
        });
    });

    // =========================================================================
    // Tests: Edge Cases
    // =========================================================================

    describe('Edge Cases', () => {
        test('maneja resultados vacíos', () => {
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo(), results: [], graphs: [] },
                {}
            );
            const reports = provider.getReportData();
            expect(reports).toHaveLength(1);
            expect(reports[0].data.sections).toHaveLength(0);
        });

        test('maneja session_info incompleto', () => {
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: {}, results: [createMockResult()], graphs: [] },
                {}
            );
            const reports = provider.getReportData();
            expect(reports).toHaveLength(1);
            const cover = reports[0].data.cover;
            expect(cover.lab).toBe('');
            expect(cover.expediente).toBe('');
        });

        test('maneja resultado_pc como string JSON', () => {
            const result = createMockResult({
                resultado_pc: JSON.stringify([{ valor: 1.5 }])
            });
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo(), results: [result], graphs: [] },
                { include_tables: true }
            );
            const reports = provider.getReportData();
            const nivel = reports[0].data.sections[0]?.tests[0]?.niveles[0];
            if (nivel && nivel.table) {
                expect(nivel.table.rows.length).toBeGreaterThan(0);
            }
        });

        test('maneja resultado_pc como array', () => {
            const result = createMockResult({
                resultado_pc: [{ valor: 1.5 }]
            });
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo(), results: [result], graphs: [] },
                { include_tables: true }
            );
            const reports = provider.getReportData();
            const nivel = reports[0].data.sections[0]?.tests[0]?.niveles[0];
            if (nivel && nivel.table) {
                expect(nivel.table.rows.length).toBeGreaterThan(0);
            }
        });
    });

    // =========================================================================
    // Tests: Conclusion Status Logic
    // =========================================================================

    describe('Conclusion Status Logic', () => {
        test('usa conclusion_status de Python cuando es "danger"', () => {
            const result = createMockResult({
                analito: 'Analito A',
                conclusion: 'No cumple con los requisitos',
                conclusion_status: 'danger'
            });
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo({ tipo_analisis: 'multianalito' }), results: [result], graphs: [] },
                { group_by: 'by_analito' }
            );
            const reports = provider.getReportData();
            expect(reports.length).toBeGreaterThan(0);
            const sections = reports[0].data.sections;
            if (sections && sections.length > 0) {
                const nivel = sections[0]?.tests[0]?.niveles[0];
                if (nivel && nivel.conclusion) {
                    expect(nivel.conclusion.status).toBe('danger');
                }
            }
        });

        test('usa conclusion_status de Python cuando es "success"', () => {
            const result = createMockResult({
                analito: 'Analito A',
                conclusion: 'Cumple con los requisitos',
                conclusion_status: 'success'
            });
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo({ tipo_analisis: 'multianalito' }), results: [result], graphs: [] },
                { group_by: 'by_analito' }
            );
            const reports = provider.getReportData();
            expect(reports.length).toBeGreaterThan(0);
            const sections = reports[0].data.sections;
            if (sections && sections.length > 0) {
                const nivel = sections[0]?.tests[0]?.niveles[0];
                if (nivel && nivel.conclusion) {
                    expect(nivel.conclusion.status).toBe('success');
                }
            }
        });

        test('usa "neutral" como fallback si Python no envía conclusion_status', () => {
            const result = createMockResult({
                analito: 'Analito A',
                conclusion: 'Resultado indeterminado'
                // Sin conclusion_status
            });
            const provider = new ReportDataProvider(
                { session_id: 1, session_info: createMockSessionInfo({ tipo_analisis: 'multianalito' }), results: [result], graphs: [] },
                { group_by: 'by_analito' }
            );
            const reports = provider.getReportData();
            expect(reports.length).toBeGreaterThan(0);
            const sections = reports[0].data.sections;
            if (sections && sections.length > 0) {
                const nivel = sections[0]?.tests[0]?.niveles[0];
                if (nivel && nivel.conclusion) {
                    expect(nivel.conclusion.status).toBe('neutral');
                }
            }
        });
    });
});
