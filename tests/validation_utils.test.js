/**
 * Unit Tests para validation_utils.js
 * 
 * Ejecutar con: npm test
 */

const {
    parseNumericValue,
    capitalize,
    isValidCuantitativo,
    isValidCualitativo,
    validateCellValue,
    findDuplicates,
    generarColores,
    calcularFilasValidas,
    estaDentroDeRango
} = require('../js/input_data/validation_utils.js');

// ============================================================
// Tests: parseNumericValue
// ============================================================
describe('parseNumericValue', () => {
    test('convierte número con punto decimal', () => {
        expect(parseNumericValue('3.14')).toBe(3.14);
    });

    test('convierte número con coma decimal', () => {
        expect(parseNumericValue('3,14')).toBe(3.14);
    });

    test('convierte entero', () => {
        expect(parseNumericValue('42')).toBe(42);
    });

    test('retorna NaN para texto no numérico', () => {
        expect(parseNumericValue('abc')).toBeNaN();
    });

    test('retorna NaN para null', () => {
        expect(parseNumericValue(null)).toBeNaN();
    });

    test('retorna NaN para undefined', () => {
        expect(parseNumericValue(undefined)).toBeNaN();
    });

    test('maneja espacios en blanco', () => {
        expect(parseNumericValue('  3.14  ')).toBe(3.14);
    });
});

// ============================================================
// Tests: capitalize
// ============================================================
describe('capitalize', () => {
    test('capitaliza primera letra', () => {
        expect(capitalize('hello')).toBe('Hello');
    });

    test('maneja string vacía', () => {
        expect(capitalize('')).toBe('');
    });

    test('no cambia ya capitalizada', () => {
        expect(capitalize('Hello')).toBe('Hello');
    });

    test('maneja null/undefined', () => {
        expect(capitalize(null)).toBe('');
        expect(capitalize(undefined)).toBe('');
    });
});

// ============================================================
// Tests: isValidCuantitativo
// ============================================================
describe('isValidCuantitativo', () => {
    test('acepta número positivo', () => {
        expect(isValidCuantitativo(5)).toBe(true);
    });

    test('acepta decimal positivo', () => {
        expect(isValidCuantitativo(3.14)).toBe(true);
    });

    test('rechaza cero', () => {
        expect(isValidCuantitativo(0)).toBe(false);
    });

    test('rechaza negativo', () => {
        expect(isValidCuantitativo(-5)).toBe(false);
    });

    test('rechaza NaN', () => {
        expect(isValidCuantitativo(NaN)).toBe(false);
    });

    test('rechaza string', () => {
        expect(isValidCuantitativo('5')).toBe(false);
    });
});

// ============================================================
// Tests: isValidCualitativo
// ============================================================
describe('isValidCualitativo', () => {
    const permitidos = [1, 2, 3, 4, 5];

    test('acepta entero en lista permitida', () => {
        expect(isValidCualitativo(3, permitidos)).toBe(true);
    });

    test('rechaza entero fuera de lista', () => {
        expect(isValidCualitativo(10, permitidos)).toBe(false);
    });

    test('rechaza decimal aunque esté en rango', () => {
        expect(isValidCualitativo(3.5, [3, 4])).toBe(false);
    });

    test('rechaza si no hay lista permitida', () => {
        expect(isValidCualitativo(3, null)).toBe(false);
    });

    test('rechaza si lista no es array', () => {
        expect(isValidCualitativo(3, 'abc')).toBe(false);
    });
});

// ============================================================
// Tests: validateCellValue
// ============================================================
describe('validateCellValue', () => {
    describe('tipo cuantitativo', () => {
        const config = { tipoDato: 'cuantitativo' };

        test('valor vacío marcado como isEmpty', () => {
            const result = validateCellValue('', config);
            expect(result.valid).toBe(false);
            expect(result.isEmpty).toBe(true);
        });

        test('número positivo es válido', () => {
            const result = validateCellValue('5.5', config);
            expect(result.valid).toBe(true);
            expect(result.value).toBe(5.5);
        });

        test('cero es inválido', () => {
            const result = validateCellValue('0', config);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Debe ser > 0');
        });

        test('texto no numérico es inválido', () => {
            const result = validateCellValue('abc', config);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Valor no numérico');
        });
    });

    describe('tipo cualitativo', () => {
        const config = {
            tipoDato: 'cualitativo',
            valoresPermitidos: [1, 2, 3]
        };

        test('entero permitido es válido', () => {
            const result = validateCellValue('2', config);
            expect(result.valid).toBe(true);
            expect(result.value).toBe(2);
        });

        test('entero no permitido es inválido', () => {
            const result = validateCellValue('5', config);
            expect(result.valid).toBe(false);
        });

        test('decimal es inválido', () => {
            const result = validateCellValue('2.5', config);
            expect(result.valid).toBe(false);
        });

        test('sin valoresPermitidos retorna error', () => {
            const result = validateCellValue('2', { tipoDato: 'cualitativo' });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('No hay valores permitidos');
        });
    });
});

// ============================================================
// Tests: findDuplicates
// ============================================================
describe('findDuplicates', () => {
    test('encuentra duplicados simples', () => {
        expect(findDuplicates(['a', 'b', 'a', 'c'])).toContain('a');
    });

    test('ignora strings vacías', () => {
        expect(findDuplicates(['', '', 'a'])).toHaveLength(0);
    });

    test('retorna array vacío sin duplicados', () => {
        expect(findDuplicates(['a', 'b', 'c'])).toHaveLength(0);
    });

    test('es case-insensitive', () => {
        expect(findDuplicates(['A', 'a'])).toHaveLength(1);
    });

    test('maneja null/undefined', () => {
        expect(findDuplicates(null)).toEqual([]);
        expect(findDuplicates(undefined)).toEqual([]);
    });
});

// ============================================================
// Tests: generarColores
// ============================================================
describe('generarColores', () => {
    test('genera cantidad correcta de colores', () => {
        expect(generarColores(5)).toHaveLength(5);
    });

    test('genera colores HSLA válidos', () => {
        const colores = generarColores(3);
        colores.forEach(color => {
            expect(color).toMatch(/^hsla\(\d+, 70%, 50%, 0\.25\)$/);
        });
    });

    test('genera un solo color para K=1', () => {
        expect(generarColores(1)).toHaveLength(1);
    });

    test('evita colores rojos (hue 50-300)', () => {
        const colores = generarColores(10);
        colores.forEach(color => {
            const hue = parseInt(color.match(/hsla\((\d+)/)[1]);
            expect(hue).toBeGreaterThanOrEqual(50);
            expect(hue).toBeLessThanOrEqual(300);
        });
    });
});

// ============================================================
// Tests: calcularFilasValidas
// ============================================================
describe('calcularFilasValidas', () => {
    test('suma lecturas correctamente', () => {
        expect(calcularFilasValidas(3, [5, 5, 5])).toBe(15);
    });

    test('usa primer valor como fallback', () => {
        expect(calcularFilasValidas(3, [10])).toBe(30);
    });

    test('usa 1 si array vacío', () => {
        expect(calcularFilasValidas(3, [])).toBe(3);
    });
});

// ============================================================
// Tests: estaDentroDeRango
// ============================================================
describe('estaDentroDeRango', () => {
    const lecturas = [5, 5, 5];

    test('retorna true para posición válida', () => {
        expect(estaDentroDeRango(3, 1, 3, lecturas)).toBe(true);
    });

    test('retorna false para columna fuera de rango', () => {
        expect(estaDentroDeRango(1, 5, 3, lecturas)).toBe(false);
    });

    test('retorna false para fila fuera de rango', () => {
        expect(estaDentroDeRango(10, 1, 3, lecturas)).toBe(false);
    });

    test('borde: última fila válida', () => {
        expect(estaDentroDeRango(5, 0, 3, lecturas)).toBe(true);
    });

    test('borde: primera fila inválida', () => {
        expect(estaDentroDeRango(6, 0, 3, lecturas)).toBe(false);
    });
});
