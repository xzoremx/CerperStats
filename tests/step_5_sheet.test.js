/**
 * Unit Tests para step_5_sheet.js - Lógica de renderización de datos de sesión
 * 
 * Ejecutar con: npm test
 */

// ============================================================
// Helpers: Extraer lógica pura de sincronizarNivelesDesdeDatos
// ============================================================

/**
 * Calcula el número de analitos únicos de los datos guardados
 * Esta es la lógica extraída de sincronizarNivelesDesdeDatos
 * 
 * @param {Array} datos - Array de objetos con propiedad 'analito'
 * @returns {string[]} - Array de nombres de analitos únicos
 */
function calcularAnalitosUnicos(datos) {
    if (!Array.isArray(datos) || datos.length === 0) return [];

    return [...new Set(
        datos.map(d => (d.analito ?? "").toString().trim()).filter(Boolean)
    )];
}

/**
 * Calcula el número máximo de niveles de los datos
 * 
 * @param {Array} datos - Array de objetos con propiedad 'nivel'
 * @returns {number} - Nivel máximo encontrado
 */
function calcularMaxNivel(datos) {
    if (!Array.isArray(datos) || datos.length === 0) return 1;
    return Math.max(...datos.map(d => Number(d.nivel) || 1), 1);
}

/**
 * Agrupa datos por nivel
 * 
 * @param {Array} datos - Array de objetos con propiedad 'nivel'
 * @returns {Object} - Objeto donde las claves son niveles y valores son arrays de datos
 */
function agruparPorNivel(datos) {
    if (!Array.isArray(datos)) return {};

    const datosPorNivel = {};
    datos.forEach(d => {
        const niv = Number(d.nivel) || 1;
        if (!datosPorNivel[niv]) datosPorNivel[niv] = [];
        datosPorNivel[niv].push(d);
    });
    return datosPorNivel;
}

// ============================================================
// Tests: calcularAnalitosUnicos
// ============================================================
describe('calcularAnalitosUnicos', () => {
    test('extrae analitos únicos sin duplicados', () => {
        const datos = [
            { analito: 'Glucosa', parametro: 'Día 1', valor: 5.5 },
            { analito: 'Hemoglobina', parametro: 'Día 1', valor: 12.3 },
            { analito: 'Glucosa', parametro: 'Día 2', valor: 5.8 },  // duplicado
            { analito: 'Urea', parametro: 'Día 1', valor: 28.0 },
        ];

        const result = calcularAnalitosUnicos(datos);

        expect(result).toHaveLength(3);
        expect(result).toContain('Glucosa');
        expect(result).toContain('Hemoglobina');
        expect(result).toContain('Urea');
    });

    test('maneja 35 analitos únicos correctamente', () => {
        // Simula el caso del bug: 35 analitos evaluados
        const analitosOriginales = Array.from({ length: 35 }, (_, i) => `Analito_${i + 1}`);
        const datos = [];

        // 2 parámetros, 3 niveles, 35 analitos = muchos registros
        for (let nivel = 1; nivel <= 3; nivel++) {
            for (let param = 1; param <= 2; param++) {
                for (const analito of analitosOriginales) {
                    datos.push({
                        analito,
                        parametro: `Día ${param}`,
                        nivel,
                        lectura_idx: 1,
                        valor: Math.random() * 100
                    });
                }
            }
        }

        const result = calcularAnalitosUnicos(datos);

        // DEBE detectar TODOS los 35 analitos, no solo 3
        expect(result).toHaveLength(35);
        expect(result).toContain('Analito_1');
        expect(result).toContain('Analito_35');
    });

    test('retorna array vacío para datos vacíos', () => {
        expect(calcularAnalitosUnicos([])).toHaveLength(0);
        expect(calcularAnalitosUnicos(null)).toHaveLength(0);
        expect(calcularAnalitosUnicos(undefined)).toHaveLength(0);
    });

    test('ignora analitos vacíos o undefined', () => {
        const datos = [
            { analito: 'Glucosa', valor: 5.5 },
            { analito: '', valor: 12.3 },
            { analito: null, valor: 28.0 },
            { valor: 15.0 },  // sin campo analito
        ];

        const result = calcularAnalitosUnicos(datos);

        expect(result).toHaveLength(1);
        expect(result).toContain('Glucosa');
    });

    test('maneja espacios en blanco en nombres', () => {
        const datos = [
            { analito: '  Glucosa  ', valor: 5.5 },
            { analito: 'Glucosa', valor: 5.8 },  // mismo después de trim
        ];

        const result = calcularAnalitosUnicos(datos);

        expect(result).toHaveLength(1);
        expect(result).toContain('Glucosa');
    });
});

// ============================================================
// Tests: calcularMaxNivel
// ============================================================
describe('calcularMaxNivel', () => {
    test('encuentra el nivel máximo correctamente', () => {
        const datos = [
            { nivel: 1, analito: 'A' },
            { nivel: 2, analito: 'B' },
            { nivel: 3, analito: 'C' },
        ];

        expect(calcularMaxNivel(datos)).toBe(3);
    });

    test('retorna 1 para datos sin nivel explícito', () => {
        const datos = [
            { analito: 'A' },
            { analito: 'B' },
        ];

        expect(calcularMaxNivel(datos)).toBe(1);
    });

    test('retorna 1 para array vacío', () => {
        expect(calcularMaxNivel([])).toBe(1);
    });

    test('maneja niveles mezclados con undefined', () => {
        const datos = [
            { nivel: 2, analito: 'A' },
            { analito: 'B' },  // sin nivel = 1
            { nivel: 5, analito: 'C' },
        ];

        expect(calcularMaxNivel(datos)).toBe(5);
    });
});

// ============================================================
// Tests: agruparPorNivel
// ============================================================
describe('agruparPorNivel', () => {
    test('agrupa datos correctamente por nivel', () => {
        const datos = [
            { nivel: 1, analito: 'A', valor: 1 },
            { nivel: 1, analito: 'B', valor: 2 },
            { nivel: 2, analito: 'A', valor: 3 },
            { nivel: 3, analito: 'A', valor: 4 },
        ];

        const result = agruparPorNivel(datos);

        expect(Object.keys(result)).toHaveLength(3);
        expect(result[1]).toHaveLength(2);
        expect(result[2]).toHaveLength(1);
        expect(result[3]).toHaveLength(1);
    });

    test('asigna nivel 1 a datos sin nivel explícito', () => {
        const datos = [
            { analito: 'A', valor: 1 },
            { analito: 'B', valor: 2 },
        ];

        const result = agruparPorNivel(datos);

        expect(Object.keys(result)).toHaveLength(1);
        expect(result[1]).toHaveLength(2);
    });

    test('retorna objeto vacío para array vacío', () => {
        expect(agruparPorNivel([])).toEqual({});
    });

    test('maneja null/undefined', () => {
        expect(agruparPorNivel(null)).toEqual({});
        expect(agruparPorNivel(undefined)).toEqual({});
    });
});

// ============================================================
// Tests: Integración - Simulación del flujo de restauración
// ============================================================
describe('Flujo de restauración multianalito', () => {
    test('simula correctamente el cálculo de columnas para 35 analitos', () => {
        // Datos como vendrían de la base de datos
        const DEFAULT_ANALITOS_COLUMNS = 3;
        const analitos = Array.from({ length: 35 }, (_, i) => `Analito_${i + 1}`);
        const datos = [];

        // Simula datos guardados: 2 parámetros, 1 nivel, 35 analitos
        for (let param = 1; param <= 2; param++) {
            for (let lectura = 1; lectura <= 5; lectura++) {
                for (const analito of analitos) {
                    datos.push({
                        parametro: `Día ${param}`,
                        analito,
                        nivel: 1,
                        lectura_idx: lectura,
                        valor: Math.random() * 100
                    });
                }
            }
        }

        // Lógica que ahora está en sincronizarNivelesDesdeDatos
        const analitosUnicos = calcularAnalitosUnicos(datos);
        const numAnalitosReal = analitosUnicos.length || DEFAULT_ANALITOS_COLUMNS;

        // VERIFICACIÓN CRÍTICA: debe detectar 35, no 3
        expect(numAnalitosReal).toBe(35);
        expect(numAnalitosReal).not.toBe(DEFAULT_ANALITOS_COLUMNS);
    });

    test('usa DEFAULT_ANALITOS_COLUMNS cuando no hay datos', () => {
        const DEFAULT_ANALITOS_COLUMNS = 3;
        const datos = [];

        const analitosUnicos = calcularAnalitosUnicos(datos);
        const numAnalitosReal = analitosUnicos.length || DEFAULT_ANALITOS_COLUMNS;

        expect(numAnalitosReal).toBe(DEFAULT_ANALITOS_COLUMNS);
    });
});

// ============================================================
// Tests: Cálculo de parámetros y lecturas
// ============================================================
describe('Cálculo de parámetros y lecturas', () => {
    /**
     * Calcula parámetros únicos y lecturas por parámetro desde los datos
     */
    function calcularParametrosYLecturas(datos) {
        if (!Array.isArray(datos) || datos.length === 0) {
            return { parametros: [], lecturas: [] };
        }

        const parametrosUnicos = [...new Set(
            datos.map(d => (d.parametro ?? "").toString().trim()).filter(Boolean)
        )];

        const lecturasPorParam = parametrosUnicos.map(param => {
            const datosParam = datos.filter(d => (d.parametro ?? "").toString().trim() === param);
            return Math.max(...datosParam.map(d => Number(d.lectura_idx) || 1), 1);
        });

        return { parametros: parametrosUnicos, lecturas: lecturasPorParam };
    }

    test('calcula parámetros y lecturas correctamente', () => {
        const datos = [
            { parametro: 'Día 1', analito: 'Glucosa', lectura_idx: 1, valor: 5.5 },
            { parametro: 'Día 1', analito: 'Glucosa', lectura_idx: 2, valor: 5.6 },
            { parametro: 'Día 1', analito: 'Glucosa', lectura_idx: 3, valor: 5.7 },
            { parametro: 'Día 2', analito: 'Glucosa', lectura_idx: 1, valor: 5.8 },
            { parametro: 'Día 2', analito: 'Glucosa', lectura_idx: 2, valor: 5.9 },
        ];

        const { parametros, lecturas } = calcularParametrosYLecturas(datos);

        expect(parametros).toEqual(['Día 1', 'Día 2']);
        expect(lecturas).toEqual([3, 2]); // Día 1 tiene 3 lecturas, Día 2 tiene 2
    });

    test('maneja datos con lecturas no consecutivas', () => {
        const datos = [
            { parametro: 'Día 1', lectura_idx: 1, valor: 1 },
            { parametro: 'Día 1', lectura_idx: 5, valor: 5 }, // salto en lecturas
        ];

        const { parametros, lecturas } = calcularParametrosYLecturas(datos);

        expect(lecturas[0]).toBe(5); // Usa el máximo lectura_idx
    });

    test('retorna arrays vacíos para datos inválidos', () => {
        expect(calcularParametrosYLecturas([])).toEqual({ parametros: [], lecturas: [] });
        expect(calcularParametrosYLecturas(null)).toEqual({ parametros: [], lecturas: [] });
    });
});

// ============================================================
// Tests: Multi-nivel
// ============================================================
describe('Datos multi-nivel', () => {
    test('agrupa correctamente datos de múltiples niveles', () => {
        const datos = [
            { nivel: 1, parametro: 'Día 1', analito: 'A', valor: 1 },
            { nivel: 1, parametro: 'Día 2', analito: 'A', valor: 2 },
            { nivel: 2, parametro: 'Día 1', analito: 'A', valor: 3 },
            { nivel: 2, parametro: 'Día 2', analito: 'A', valor: 4 },
            { nivel: 3, parametro: 'Día 1', analito: 'A', valor: 5 },
        ];

        const datosPorNivel = agruparPorNivel(datos);
        const maxNivel = calcularMaxNivel(datos);

        expect(maxNivel).toBe(3);
        expect(datosPorNivel[1]).toHaveLength(2);
        expect(datosPorNivel[2]).toHaveLength(2);
        expect(datosPorNivel[3]).toHaveLength(1);
    });

    test('los analitos son consistentes entre niveles', () => {
        const datos = [
            { nivel: 1, analito: 'Glucosa', valor: 1 },
            { nivel: 1, analito: 'Urea', valor: 2 },
            { nivel: 2, analito: 'Glucosa', valor: 3 },
            { nivel: 2, analito: 'Urea', valor: 4 },
        ];

        const analitosNivel1 = calcularAnalitosUnicos(datos.filter(d => d.nivel === 1));
        const analitosNivel2 = calcularAnalitosUnicos(datos.filter(d => d.nivel === 2));

        // Los analitos deben ser los mismos en ambos niveles
        expect(analitosNivel1.sort()).toEqual(analitosNivel2.sort());
    });
});

// ============================================================
// Tests: Casos borde (edge cases)
// ============================================================
describe('Casos borde', () => {
    test('maneja analitos con caracteres especiales', () => {
        const datos = [
            { analito: 'Glucosa (mg/dL)', valor: 100 },
            { analito: 'HbA1c %', valor: 6.5 },
            { analito: 'Colesterol-LDL', valor: 120 },
        ];

        const analitos = calcularAnalitosUnicos(datos);

        expect(analitos).toHaveLength(3);
        expect(analitos).toContain('Glucosa (mg/dL)');
        expect(analitos).toContain('HbA1c %');
        expect(analitos).toContain('Colesterol-LDL');
    });

    test('maneja valores numéricos como strings en analito', () => {
        const datos = [
            { analito: 123, valor: 1 },
            { analito: '456', valor: 2 },
        ];

        const analitos = calcularAnalitosUnicos(datos);

        expect(analitos).toHaveLength(2);
        expect(analitos).toContain('123');
        expect(analitos).toContain('456');
    });

    test('mantiene orden de aparición de analitos', () => {
        const datos = [
            { analito: 'C', valor: 1 },
            { analito: 'A', valor: 2 },
            { analito: 'B', valor: 3 },
            { analito: 'A', valor: 4 }, // duplicado
        ];

        const analitos = calcularAnalitosUnicos(datos);

        // El orden debe ser C, A, B (orden de primera aparición)
        expect(analitos).toEqual(['C', 'A', 'B']);
    });

    test('maneja gran cantidad de niveles', () => {
        const datos = Array.from({ length: 100 }, (_, i) => ({
            nivel: i + 1,
            analito: 'Test',
            valor: i
        }));

        const maxNivel = calcularMaxNivel(datos);

        expect(maxNivel).toBe(100);
    });
});
