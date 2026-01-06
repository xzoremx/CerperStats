-- Migration: Add formatting configuration columns to tests_catalog
-- Author: Antigravity
-- Date: 2026-01-05

-- Add value_mappings column for test result formatting
ALTER TABLE tests_catalog
ADD COLUMN IF NOT EXISTS value_mappings JSONB DEFAULT '{}';

-- Add column_labels column for column header labels
ALTER TABLE tests_catalog
ADD COLUMN IF NOT EXISTS column_labels JSONB DEFAULT '{}';

COMMENT ON COLUMN tests_catalog.value_mappings IS 'Mapeo de valores a {label, class, style} para formateo en frontend. style permite colores seguros (solo hex/rgb/rgba) desde DB. Ej: {"normal_dist": {"label":"✓ Sí","class":"df-value-true","style":{"text_color":"#059669","bg_from":"rgba(16,185,129,0.12)","bg_to":"rgba(5,150,105,0.08)"}}}';
COMMENT ON COLUMN tests_catalog.column_labels IS 'Mapeo de claves de columna a etiquetas legibles. Ej: {"p_value": "P-Value"}';

-- ==============================================================
-- Update existing tests with their formatting configuration
-- ==============================================================

-- Test 1: Normalidad Monoanalito
UPDATE tests_catalog SET 
  value_mappings = '{
    "normal_dist": {"label": "✓ Sí", "class": "df-value-true", "style": {"text_color": "#059669", "bg_from": "rgba(16,185,129,0.12)", "bg_to": "rgba(5,150,105,0.08)"}},
    "no_normal_dist": {"label": "✗ No", "class": "df-value-false", "style": {"text_color": "#dc2626", "bg_from": "rgba(239,68,68,0.10)", "bg_to": "rgba(220,38,38,0.06)"}}
  }',
  column_labels = '{
    "parametro": "Parámetro",
    "n": "n",
    "media": "Media",
    "desviacion": "Desviación",
    "asimetria": "Asimetría",
    "p_value": "P-Value",
    "normalidad": "Normalidad",
    "prueba_normalidad": "Prueba"
  }'
WHERE id = 1;

-- Test 4: Normalidad Multianalito (same as mono)
UPDATE tests_catalog SET 
  value_mappings = '{
    "normal_dist": {"label": "✓ Sí", "class": "df-value-true", "style": {"text_color": "#059669", "bg_from": "rgba(16,185,129,0.12)", "bg_to": "rgba(5,150,105,0.08)"}},
    "no_normal_dist": {"label": "✗ No", "class": "df-value-false", "style": {"text_color": "#dc2626", "bg_from": "rgba(239,68,68,0.10)", "bg_to": "rgba(220,38,38,0.06)"}}
  }',
  column_labels = '{
    "parametro": "Parámetro",
    "n": "n",
    "media": "Media",
    "desviacion": "Desviación",
    "asimetria": "Asimetría",
    "p_value": "P-Value",
    "normalidad": "Normalidad",
    "prueba_normalidad": "Prueba"
  }'
WHERE id = 4;

-- Test 7: Atípicos Monoanalito
UPDATE tests_catalog SET 
  value_mappings = '{
    "aceptable_outlier": {"label": "✓ Aceptable", "class": "df-value-aceptable", "style": {"text_color": "#059669", "bg_from": "rgba(16,185,129,0.12)", "bg_to": "rgba(5,150,105,0.08)"}},
    "cuestionable_outlier": {"label": "⚠ Cuestionable", "class": "df-value-cuestionable", "style": {"text_color": "#d97706", "bg_from": "rgba(245,158,11,0.15)", "bg_to": "rgba(217,119,6,0.10)"}},
    "atipico_outlier": {"label": "✗ Atípico", "class": "df-value-atipico", "style": {"text_color": "#dc2626", "bg_from": "rgba(239,68,68,0.12)", "bg_to": "rgba(220,38,38,0.08)"}}
  }',
  column_labels = '{
    "parametro": "Parámetro",
    "zscore": "Z-Score",
    "estado": "Estado"
  }'
WHERE id = 7;

-- Test 8: Atípicos Multianalito (same as mono)
UPDATE tests_catalog SET 
  value_mappings = '{
    "aceptable_outlier": {"label": "✓ Aceptable", "class": "df-value-aceptable", "style": {"text_color": "#059669", "bg_from": "rgba(16,185,129,0.12)", "bg_to": "rgba(5,150,105,0.08)"}},
    "cuestionable_outlier": {"label": "⚠ Cuestionable", "class": "df-value-cuestionable", "style": {"text_color": "#d97706", "bg_from": "rgba(245,158,11,0.15)", "bg_to": "rgba(217,119,6,0.10)"}},
    "atipico_outlier": {"label": "✗ Atípico", "class": "df-value-atipico", "style": {"text_color": "#dc2626", "bg_from": "rgba(239,68,68,0.12)", "bg_to": "rgba(220,38,38,0.08)"}}
  }',
  column_labels = '{
    "parametro": "Parámetro",
    "zscore": "Z-Score",
    "estado": "Estado"
  }'
WHERE id = 8;

-- Generic boolean mappings (for tests that don't have specific mappings)
-- These can be added to any test that uses true/false values
