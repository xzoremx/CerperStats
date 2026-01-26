-- =====================================================
-- Actualizar column_labels y value_mappings para tests 12, 13 y 14
-- (Útil cuando add_tests_12_13_14.sql ya fue ejecutado una vez)
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- ID 12: Tendencia Central (Multianalito)
-- -----------------------------------------------------
UPDATE tests_catalog SET
  column_labels = '{
    "analito": "Analito",
    "parametro": "Parámetro",
    "n": "N",
    "metodo_tendencia": "Método",
    "tendencia_central": "Tendencia Central",
    "rango_min": "Rango Mín",
    "rango_max": "Rango Máx",
    "estado": "Estado"
  }'::jsonb,
  value_mappings = '{
    "dentro_rango": {
      "label": "Dentro del rango",
      "class": "df-value-success",
      "style": {"text_color": "#059669", "bg_from": "rgba(16,185,129,0.12)", "bg_to": "rgba(5,150,105,0.08)"}
    },
    "fuera_rango": {
      "label": "Fuera del rango",
      "class": "df-value-danger",
      "style": {"text_color": "#dc2626", "bg_from": "rgba(239,68,68,0.12)", "bg_to": "rgba(220,38,38,0.08)"}
    },
    "sin_datos": {
      "label": "Sin datos",
      "class": "df-value-neutral",
      "style": {"text_color": "#64748b", "bg_from": "rgba(100,116,139,0.12)", "bg_to": "rgba(71,85,105,0.08)"}
    },
    "rango_no_configurado": {
      "label": "Rango no configurado",
      "class": "df-value-warning",
      "style": {"text_color": "#d97706", "bg_from": "rgba(245,158,11,0.12)", "bg_to": "rgba(217,119,6,0.08)"}
    },
    "media": {
      "label": "Media",
      "class": "df-value-info",
      "style": {"text_color": "#2563eb", "bg_from": "rgba(37,99,235,0.12)", "bg_to": "rgba(29,78,216,0.08)"}
    },
    "mediana": {
      "label": "Mediana",
      "class": "df-value-info",
      "style": {"text_color": "#7c3aed", "bg_from": "rgba(124,58,237,0.12)", "bg_to": "rgba(109,40,217,0.08)"}
    }
  }'::jsonb
WHERE lab_key = 'metales' AND nombre_interno = 'tendencia_central_multi';

-- -----------------------------------------------------
-- ID 13: Veracidad (Multianalito)
-- -----------------------------------------------------
UPDATE tests_catalog SET
  column_labels = '{
    "analito": "Analito",
    "parametro": "Parámetro",
    "n": "N",
    "metodo_veracidad": "Método",
    "veracidad": "Veracidad",
    "rango_min": "Rango Mín",
    "rango_max": "Rango Máx",
    "estado": "Estado"
  }'::jsonb,
  value_mappings = '{
    "dentro_rango": {
      "label": "Dentro del rango",
      "class": "df-value-success",
      "style": {"text_color": "#059669", "bg_from": "rgba(16,185,129,0.12)", "bg_to": "rgba(5,150,105,0.08)"}
    },
    "fuera_rango": {
      "label": "Fuera del rango",
      "class": "df-value-danger",
      "style": {"text_color": "#dc2626", "bg_from": "rgba(239,68,68,0.12)", "bg_to": "rgba(220,38,38,0.08)"}
    },
    "sin_datos": {
      "label": "Sin datos",
      "class": "df-value-neutral",
      "style": {"text_color": "#64748b", "bg_from": "rgba(100,116,139,0.12)", "bg_to": "rgba(71,85,105,0.08)"}
    },
    "rango_no_configurado": {
      "label": "Rango no configurado",
      "class": "df-value-warning",
      "style": {"text_color": "#d97706", "bg_from": "rgba(245,158,11,0.12)", "bg_to": "rgba(217,119,6,0.08)"}
    },
    "media": {
      "label": "Media",
      "class": "df-value-info",
      "style": {"text_color": "#2563eb", "bg_from": "rgba(37,99,235,0.12)", "bg_to": "rgba(29,78,216,0.08)"}
    },
    "mediana": {
      "label": "Mediana",
      "class": "df-value-info",
      "style": {"text_color": "#7c3aed", "bg_from": "rgba(124,58,237,0.12)", "bg_to": "rgba(109,40,217,0.08)"}
    }
  }'::jsonb
WHERE lab_key = 'metales' AND nombre_interno = 'veracidad_multi';

-- -----------------------------------------------------
-- ID 14: Precisión RSD (Multianalito)
-- -----------------------------------------------------
UPDATE tests_catalog SET
  column_labels = '{
    "analito": "Analito",
    "n": "N",
    "rsd_teorico": "RSD Teórico",
    "estado": "Estado",
    "rsd_experimental": "RSD Exp.",
    "rsd_r": "RSDr",
    "rsd_R": "RSDR"
  }'::jsonb,
  value_mappings = '{
    "cumple": {
      "label": "Cumple",
      "class": "df-value-success",
      "style": {"text_color": "#059669", "bg_from": "rgba(16,185,129,0.12)", "bg_to": "rgba(5,150,105,0.08)"}
    },
    "no_cumple": {
      "label": "No cumple",
      "class": "df-value-danger",
      "style": {"text_color": "#dc2626", "bg_from": "rgba(239,68,68,0.12)", "bg_to": "rgba(220,38,38,0.08)"}
    },
    "sin_datos": {
      "label": "Sin datos",
      "class": "df-value-neutral",
      "style": {"text_color": "#64748b", "bg_from": "rgba(100,116,139,0.12)", "bg_to": "rgba(71,85,105,0.08)"}
    },
    "no_evaluable": {
      "label": "No evaluable",
      "class": "df-value-warning",
      "style": {"text_color": "#d97706", "bg_from": "rgba(245,158,11,0.12)", "bg_to": "rgba(217,119,6,0.08)"}
    },
    "config_no_valida": {
      "label": "Config. inválida",
      "class": "df-value-warning",
      "style": {"text_color": "#d97706", "bg_from": "rgba(245,158,11,0.12)", "bg_to": "rgba(217,119,6,0.08)"}
    }
  }'::jsonb
WHERE lab_key = 'metales' AND nombre_interno = 'precision_rsd_multi';

COMMIT;

