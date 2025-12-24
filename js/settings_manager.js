/**
 * Settings Manager Module
 * Manages application settings with localStorage persistence
 * Used for timezone display, glass effects, and UI preferences
 */

(function (global) {
    'use strict';

    // Default settings
    const DEFAULTS = {
        // Regional settings
        timezone: 'America/Bogota',
        dateFormat: 'DD/MM/YYYY HH:mm',

        // Glass effect settings
        glassMode: 'standard',
        glassBlur: 0.1,
        glassSaturation: 140,
        glassDisplacement: 120,
        glassAberration: 2,
        glassElasticity: 0.15,
        glassCenterDistortion: 1,

        // Appearance
        animationsEnabled: true
    };

    // Common timezones for Latin America and general use
    const TIMEZONES = [
        { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
        { value: 'America/Lima', label: 'Lima (GMT-5)' },
        { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
        { value: 'America/Santiago', label: 'Santiago (GMT-3/GMT-4)' },
        { value: 'America/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
        { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
        { value: 'America/New_York', label: 'Nueva York (GMT-5/GMT-4)' },
        { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8/GMT-7)' },
        { value: 'Europe/Madrid', label: 'Madrid (GMT+1/GMT+2)' },
        { value: 'Europe/London', label: 'Londres (GMT/GMT+1)' },
        { value: 'UTC', label: 'UTC (GMT+0)' }
    ];

    const DATE_FORMATS = [
        { value: 'DD/MM/YYYY HH:mm', label: '24/12/2025 15:30' },
        { value: 'MM/DD/YYYY HH:mm', label: '12/24/2025 15:30' },
        { value: 'YYYY-MM-DD HH:mm', label: '2025-12-24 15:30' },
        { value: 'DD/MM/YYYY hh:mm A', label: '24/12/2025 03:30 PM' },
        { value: 'MMM DD, YYYY HH:mm', label: 'Dic 24, 2025 15:30' }
    ];

    const STORAGE_KEY = 'cerperStats_settings';

    let settings = {};

    const SettingsManager = {
        TIMEZONES,
        DATE_FORMATS,
        DEFAULTS,

        /**
         * Initialize settings from localStorage
         */
        init: function () {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    settings = { ...DEFAULTS, ...JSON.parse(stored) };
                } else {
                    settings = { ...DEFAULTS };
                }
            } catch (e) {
                console.warn('[SettingsManager] Error loading settings:', e);
                settings = { ...DEFAULTS };
            }
            return this;
        },

        /**
         * Get a setting value
         * @param {string} key - Setting key
         * @returns {any} Setting value
         */
        get: function (key) {
            return settings[key] ?? DEFAULTS[key];
        },

        /**
         * Get all settings
         * @returns {Object} All settings
         */
        getAll: function () {
            return { ...settings };
        },

        /**
         * Set a setting value
         * @param {string} key - Setting key
         * @param {any} value - Setting value
         */
        set: function (key, value) {
            settings[key] = value;
            this._save();

            // Auto-apply glass settings if glass-related
            if (key.startsWith('glass')) {
                this.applyGlassSettings();
            }
        },

        /**
         * Set multiple settings at once
         * @param {Object} newSettings - Object with settings to update
         */
        setMultiple: function (newSettings) {
            let hasGlassChanges = false;
            Object.entries(newSettings).forEach(([key, value]) => {
                settings[key] = value;
                if (key.startsWith('glass')) hasGlassChanges = true;
            });
            this._save();

            if (hasGlassChanges) {
                this.applyGlassSettings();
            }
        },

        /**
         * Reset all settings to defaults
         */
        reset: function () {
            settings = { ...DEFAULTS };
            this._save();
            this.applyGlassSettings();
        },

        /**
         * Reset only glass settings to defaults
         */
        resetGlass: function () {
            Object.keys(DEFAULTS).forEach(key => {
                if (key.startsWith('glass')) {
                    settings[key] = DEFAULTS[key];
                }
            });
            this._save();
            this.applyGlassSettings();
        },

        /**
         * Save settings to localStorage
         */
        _save: function () {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            } catch (e) {
                console.warn('[SettingsManager] Error saving settings:', e);
            }
        },

        /**
         * Apply current glass settings to the main panel
         */
        applyGlassSettings: function () {
            const mainPanel = document.getElementById('main-content-panel');
            if (!mainPanel || !window.LiquidGlass) return;

            const glassConfig = {
                cornerRadius: 28,
                mode: this.get('glassMode'),
                blurAmount: this.get('glassBlur'),
                saturation: this.get('glassSaturation'),
                displacementScale: this.get('glassDisplacement'),
                aberrationIntensity: this.get('glassAberration'),
                elasticity: this.get('glassElasticity'),
                centerDistortion: this.get('glassCenterDistortion')
            };

            // Get existing instance and update, or apply fresh
            const instance = window.LiquidGlass.instances.get(mainPanel);
            if (instance) {
                window.LiquidGlass._updateConfig(mainPanel, glassConfig);
            } else {
                window.LiquidGlass.apply(mainPanel, glassConfig);
            }
        },

        /**
         * Get glass settings as config object
         * @returns {Object} Glass configuration object
         */
        getGlassConfig: function () {
            return {
                cornerRadius: 28,
                mode: this.get('glassMode'),
                blurAmount: this.get('glassBlur'),
                saturation: this.get('glassSaturation'),
                displacementScale: this.get('glassDisplacement'),
                aberrationIntensity: this.get('glassAberration'),
                elasticity: this.get('glassElasticity'),
                centerDistortion: this.get('glassCenterDistortion')
            };
        },

        /**
         * Format a date for the configured timezone
         * @param {Date|string|number} date - Date to format
         * @returns {string} Formatted date string
         */
        formatDate: function (date) {
            const d = date instanceof Date ? date : new Date(date);
            const tz = this.get('timezone');
            const format = this.get('dateFormat');

            try {
                // Use Intl.DateTimeFormat for timezone conversion
                const options = {
                    timeZone: tz,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: format.includes('A') || format.includes('a')
                };

                const formatter = new Intl.DateTimeFormat('es-ES', options);
                const parts = formatter.formatToParts(d);

                const p = {};
                parts.forEach(part => {
                    p[part.type] = part.value;
                });

                // Build formatted string based on format pattern
                let result = format;

                // Replace patterns
                result = result.replace('YYYY', p.year || '');
                result = result.replace('MM', p.month || '');
                result = result.replace('DD', p.day || '');
                result = result.replace('HH', p.hour || '');
                result = result.replace('hh', p.hour || '');
                result = result.replace('mm', p.minute || '');
                result = result.replace('A', p.dayPeriod?.toUpperCase() || '');

                // Handle month name format (MMM)
                if (format.includes('MMM')) {
                    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                    const monthIdx = parseInt(p.month, 10) - 1;
                    result = result.replace('MMM', monthNames[monthIdx] || p.month);
                }

                return result;
            } catch (e) {
                console.warn('[SettingsManager] Date format error:', e);
                return d.toLocaleString('es-ES', { timeZone: tz });
            }
        },

        /**
         * Get timezone label for current setting
         * @returns {string} Timezone label
         */
        getTimezoneLabel: function () {
            const tz = this.get('timezone');
            const found = TIMEZONES.find(t => t.value === tz);
            return found ? found.label : tz;
        }
    };

    // Auto-initialize
    SettingsManager.init();

    // Export to global
    global.SettingsManager = SettingsManager;

})(typeof window !== 'undefined' ? window : this);
