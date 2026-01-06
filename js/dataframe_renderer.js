/**
 * Dataframe Renderer - Utilidades para formatear y renderizar resultados de pruebas estadísticas
 * 
 * Este módulo contiene funciones para:
 * - Formatear valores de dataframes según el tipo de prueba
 * - Generar etiquetas legibles para encabezados de columnas
 * - Renderizar tablas HTML a partir de dataframes
 */

window.DataframeRenderer = (function () {
    'use strict';

    /**
     * Configuración dinámica desde backend (tests_catalog)
     * - value_mappings: { [value: string]: { label: string, class: string, style?: object } }
     * - column_labels: { [key: string]: string }
     */
    let config = {
        value_mappings: {},
        column_labels: {}
    };
    let configLoaded = false;
    let configLoadPromise = null;
    let dynamicStylesApplied = false;

    const DYNAMIC_CLASS_PREFIX = 'df-';
    const STYLE_EL_ID = 'df-dynamic-styles';

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeClassToken(token) {
        return String(token || '')
            .replace(/[^A-Za-z0-9_-]/g, '')
            .trim();
    }

    function safeClassList(value) {
        const tokens = String(value || '')
            .split(/\s+/)
            .map(safeClassToken)
            .filter(Boolean);
        return tokens.join(' ');
    }

    function safeDynamicClassTokens(classList) {
        const tokens = safeClassList(classList)
            .split(/\s+/)
            .filter(Boolean)
            .filter(t => t.startsWith(DYNAMIC_CLASS_PREFIX));
        return tokens;
    }

    function sanitizeAngle(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        const clamped = Math.max(0, Math.min(360, n));
        return Math.round(clamped);
    }

    function sanitizeColor(value) {
        if (value === null || value === undefined) return null;
        const raw = String(value).trim();
        if (raw === '') return null;

        if (raw.toLowerCase() === 'transparent') return 'transparent';

        // #rgb, #rgba, #rrggbb, #rrggbbaa
        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) {
            return raw;
        }

        // rgb()/rgba() with numeric channels only (no percentages)
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
        const aStr = Number.isInteger(a) ? String(a) : String(Math.round(a * 1000) / 1000);
        return `rgba(${r}, ${g}, ${b}, ${aStr})`;
    }

    function ensureStyleElement() {
        if (typeof document === 'undefined' || !document.head) return null;
        let styleEl = document.getElementById(STYLE_EL_ID);
        if (styleEl && styleEl.tagName === 'STYLE') return styleEl;

        styleEl = document.createElement('style');
        styleEl.id = STYLE_EL_ID;
        styleEl.type = 'text/css';
        document.head.appendChild(styleEl);
        return styleEl;
    }

    function normalizeConfig(data) {
        const valueMappings =
            data && typeof data.value_mappings === 'object' && data.value_mappings !== null
                ? data.value_mappings
                : {};
        const columnLabels =
            data && typeof data.column_labels === 'object' && data.column_labels !== null
                ? data.column_labels
                : {};
        return { value_mappings: valueMappings, column_labels: columnLabels };
    }

    function buildDynamicCssRules() {
        const classStyles = new Map();

        const mappings = config?.value_mappings && typeof config.value_mappings === 'object'
            ? Object.values(config.value_mappings)
            : [];

        for (const mapping of mappings) {
            if (!mapping || typeof mapping !== 'object') continue;
            const style = mapping.style;
            if (!style || typeof style !== 'object') continue;

            const classTokens = safeDynamicClassTokens(mapping.class);
            if (classTokens.length === 0) continue;

            const textColor = sanitizeColor(style.text_color ?? style.color ?? null);
            const bgFrom = sanitizeColor(style.bg_from ?? style.background_from ?? null);
            const bgTo = sanitizeColor(style.bg_to ?? style.background_to ?? null);
            const angle = sanitizeAngle(style.bg_angle ?? style.background_angle ?? null) ?? 135;

            for (const token of classTokens) {
                // Only allow styling for df-* classes
                if (!token.startsWith(DYNAMIC_CLASS_PREFIX)) continue;

                classStyles.set(token, { textColor, bgFrom, bgTo, angle });
            }
        }

        const rules = [];
        for (const [token, style] of classStyles.entries()) {
            const decl = [];
            if (style.textColor) decl.push(`color: ${style.textColor};`);
            if (style.bgFrom && style.bgTo) decl.push(`background: linear-gradient(${style.angle}deg, ${style.bgFrom} 0%, ${style.bgTo} 100%);`);
            else if (style.bgFrom) decl.push(`background-color: ${style.bgFrom};`);
            if (decl.length === 0) continue;
            rules.push(`.df-table .${token} { ${decl.join(' ')} }`);
        }

        return rules.join('\n');
    }

    function applyDynamicStyles() {
        const styleEl = ensureStyleElement();
        if (!styleEl) return;

        const cssText = buildDynamicCssRules();
        styleEl.textContent = cssText;
        dynamicStylesApplied = true;
    }

    /**
     * Carga configuración desde backend una sola vez (fallback a defaults).
     */
    async function loadConfig() {
        if (configLoaded) return config;
        if (configLoadPromise) return configLoadPromise;

        configLoadPromise = (async () => {
            try {
                const res = await window.cerper?.getTestsFormattingConfig?.();
                if (res?.ok && res.data) {
                    config = normalizeConfig(res.data);
                }
            } catch (e) {
                console.warn('[DataframeRenderer] Error loading formatting config, using defaults:', e);
            } finally {
                applyDynamicStyles();
                configLoaded = true;
                const finalConfig = config;
                configLoadPromise = null;
                return finalConfig;
            }
        })();

        return configLoadPromise;
    }

    /**
     * Formatea un valor de dataframe según su tipo y contexto de prueba
     * @param {*} value - Valor a formatear
     * @returns {string} HTML formateado
     */
    function formatValue(value) {
        // Asegurar estilos dinámicos si loadConfig fue llamado antes de que exista <head>.
        if (configLoaded && !dynamicStylesApplied) applyDynamicStyles();

        // Valor nulo/vacío
        if (value === null || value === undefined) return '<span class="df-value-string">-</span>';

        // Mapeos dinámicos (strings, booleanos, números, etc. con key string)
        const key = typeof value === 'string' ? value : String(value);
        const mapping = config?.value_mappings?.[key];
        if (mapping && typeof mapping === 'object') {
            const label = mapping.label != null ? mapping.label : key;
            const cls = mapping.class != null ? mapping.class : '';
            const safeCls = safeClassList(cls);
            const safeLabel = escapeHtml(label);
            const allClasses = safeClassList(`df-value-badge ${safeCls}`);
            return allClasses
                ? `<span class="${allClasses}">${safeLabel}</span>`
                : `<span class="df-value-string">${safeLabel}</span>`;
        }

        // Números
        if (typeof value === "number") {
            const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(4);
            return `<span class="df-value-number">${formatted}</span>`;
        }

        // Strings
        if (typeof value === "string") {
            return `<span class="df-value-string">${escapeHtml(value)}</span>`;
        }

        return escapeHtml(value);
    }

    /**
     * Fallback genérico para etiquetas de columnas (si backend no provee label)
     */
    function keyToLabel(key) {
        const str = String(key || '');
        if (!str) return '';
        if (str.length === 1) return str;
        return str
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    /**
     * Obtiene la etiqueta legible para una clave de columna
     * @param {string} key - Clave de la columna
     * @returns {string} Etiqueta legible
     */
    function getColumnLabel(key) {
        const strKey = String(key || '');
        const dynamic = config?.column_labels?.[strKey];
        if (typeof dynamic === 'string' && dynamic.trim() !== '') return dynamic;
        return keyToLabel(strKey);
    }

    /**
     * Orden de prioridad para columnas de prueba
     */
    const PRIORITY_COLUMNS = ["parametro", "prueba_normalidad", "prueba_homogeneidad", "prueba_tendencia"];

    /**
     * Renderiza una tabla HTML a partir de un array de objetos (dataframe)
     * @param {Array} data - Array de objetos con los datos
     * @returns {string} HTML de la tabla
     */
    function renderTable(data) {
        // Intentar cargar configuración (no bloqueante)
        void loadConfig();

        if (!Array.isArray(data) || data.length === 0) {
            return '<p class="text-gray-400">No hay datos disponibles.</p>';
        }

        // Obtener todas las claves únicas de todas las filas
        const allKeys = new Set();
        data.forEach(row => {
            if (row && typeof row === "object") {
                Object.keys(row).forEach(key => allKeys.add(key));
            }
        });

        // Ordenar columnas: prioridad primero, luego el resto alfabéticamente
        const orderedKeys = [];
        PRIORITY_COLUMNS.forEach(key => {
            if (allKeys.has(key)) {
                orderedKeys.push(key);
                allKeys.delete(key);
            }
        });
        orderedKeys.push(...Array.from(allKeys).sort());

        // Construir HTML de la tabla
        let html = '<div class="df-table-container"><table class="df-table"><thead><tr>';
        orderedKeys.forEach(key => {
            html += `<th>${escapeHtml(getColumnLabel(key))}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            orderedKeys.forEach(key => {
                const value = row[key];
                html += `<td>${formatValue(value)}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        return html;
    }

    // API pública
    return {
        loadConfig,
        formatValue,
        getColumnLabel,
        renderTable,
        getConfig: () => config
    };
})();
