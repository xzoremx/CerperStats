/**
 * validation_utils.js
 * Funciones puras de validación compartidas entre step_5_sheet.js y step_6_validation.js
 * 
 * IMPORTANTE: Este módulo NO depende de DOM ni sessionStorage.
 * Todas las funciones reciben sus dependencias como parámetros.
 */

// ============================================================
// PARSING Y CONVERSIÓN
// ============================================================

/**
 * Convierte un texto a número, soportando comas como separador decimal
 * @param {string} text - Texto a convertir (ej: "3,14" o "3.14")
 * @returns {number} Número parseado o NaN si no es válido
 */
function parseNumericValue(text) {
    if (text === null || text === undefined) return NaN;
    const cleaned = String(text).trim().replace(",", ".");
    return parseFloat(cleaned);
}

/**
 * Capitaliza la primera letra de un texto
 * @param {string} text 
 * @returns {string}
 */
function capitalize(text) {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// ============================================================
// VALIDACIÓN DE VALORES
// ============================================================

/**
 * Valida si un valor es válido para tipo cuantitativo (número > 0)
 * @param {number} value - Valor numérico a validar
 * @returns {boolean}
 */
function isValidCuantitativo(value) {
    return typeof value === "number" && !isNaN(value) && value > 0;
}

/**
 * Valida si un valor es válido para tipo cualitativo (entero en lista permitida)
 * @param {number} value - Valor numérico a validar
 * @param {number[]} allowedValues - Lista de valores permitidos
 * @returns {boolean}
 */
function isValidCualitativo(value, allowedValues) {
    if (!Array.isArray(allowedValues)) return false;
    return Number.isInteger(value) && allowedValues.includes(value);
}

/**
 * Valida un valor según el tipo de dato y configuración
 * @param {string} rawValue - Valor como texto (ej: "3,14")
 * @param {Object} config - Configuración de validación
 * @param {string} config.tipoDato - "cuantitativo" o "cualitativo"
 * @param {number[]|null} config.valoresPermitidos - Valores permitidos para cualitativo
 * @returns {{ valid: boolean, value: number, error?: string }}
 */
function validateCellValue(rawValue, config) {
    const { tipoDato = "cuantitativo", valoresPermitidos = null } = config || {};
    const trimmed = (rawValue ?? "").toString().trim();

    // Celda vacía
    if (trimmed === "") {
        return { valid: false, value: NaN, isEmpty: true };
    }

    const num = parseNumericValue(trimmed);

    // No es número
    if (isNaN(num)) {
        return { valid: false, value: NaN, error: "Valor no numérico" };
    }

    // Validar según tipo
    if (tipoDato === "cuantitativo") {
        if (isValidCuantitativo(num)) {
            return { valid: true, value: num };
        }
        return { valid: false, value: num, error: "Debe ser > 0" };
    }

    if (tipoDato === "cualitativo") {
        if (!valoresPermitidos) {
            return { valid: false, value: num, error: "No hay valores permitidos definidos" };
        }
        if (isValidCualitativo(num, valoresPermitidos)) {
            return { valid: true, value: num };
        }
        return { valid: false, value: num, error: `Permitidos: ${valoresPermitidos.join(", ")}` };
    }

    return { valid: false, value: num, error: "Tipo de dato no reconocido" };
}

// ============================================================
// DETECCIÓN DE DUPLICADOS
// ============================================================

/**
 * Encuentra elementos duplicados en un array (ignora vacíos)
 * @param {string[]} array - Array de strings
 * @returns {string[]} Array con los valores duplicados (sin repetir)
 */
function findDuplicates(array) {
    if (!Array.isArray(array)) return [];
    const seen = new Set();
    const duplicates = new Set();

    for (const item of array) {
        // Ignorar strings vacías
        if (!item || item.trim() === "") continue;
        const normalized = item.trim().toLowerCase();
        if (seen.has(normalized)) {
            duplicates.add(item.trim());
        }
        seen.add(normalized);
    }

    return [...duplicates];
}

// ============================================================
// GENERACIÓN DE COLORES
// ============================================================

/**
 * Genera array de colores HSLA para K elementos, evitando rojos
 * @param {number} K - Cantidad de colores a generar
 * @returns {string[]} Array de colores HSLA
 */
function generarColores(K) {
    const colores = [];
    // Rango seguro: de 50° (amarillo-verde) a 300° (violeta), evitando rojos
    const hueMin = 50;
    const hueMax = 300;
    const hueRange = hueMax - hueMin;

    for (let i = 0; i < K; i++) {
        const hue = hueMin + (i * hueRange) / Math.max(K - 1, 1);
        colores.push(`hsla(${Math.round(hue)}, 70%, 50%, 0.25)`);
    }
    return colores;
}

// ============================================================
// UTILIDADES DE RANGO
// ============================================================

/**
 * Calcula el total de filas válidas según K parámetros y lecturas por parámetro
 * @param {number} K - Cantidad de parámetros
 * @param {number[]} lecturas - Lecturas por parámetro
 * @returns {number}
 */
function calcularFilasValidas(K, lecturas) {
    let total = 0;
    for (let i = 0; i < K; i++) {
        total += lecturas[i] || lecturas[0] || 1;
    }
    return total;
}

/**
 * Verifica si una posición (fila, columna) está dentro del rango válido
 * @param {number} fila - Índice de fila (1-indexed, excluyendo header)
 * @param {number} columna - Índice de columna
 * @param {number} K - Cantidad de columnas/parámetros válidos
 * @param {number[]} lecturas - Lecturas por parámetro
 * @returns {boolean}
 */
function estaDentroDeRango(fila, columna, K, lecturas) {
    if (columna >= K) return false;
    const filasEsperadas = lecturas[columna] || lecturas[0] || 1;
    return fila <= filasEsperadas;
}

// ============================================================
// EXPORTS (para browser y Node.js)
// ============================================================

// Para uso en browser (window global)
if (typeof window !== "undefined") {
    window.ValidationUtils = {
        parseNumericValue,
        capitalize,
        isValidCuantitativo,
        isValidCualitativo,
        validateCellValue,
        findDuplicates,
        generarColores,
        calcularFilasValidas,
        estaDentroDeRango
    };
}

// Para uso en Node.js (tests con Jest)
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        parseNumericValue,
        capitalize,
        isValidCuantitativo,
        isValidCualitativo,
        validateCellValue,
        findDuplicates,
        generarColores,
        calcularFilasValidas,
        estaDentroDeRango
    };
}
