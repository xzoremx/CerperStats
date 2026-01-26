-- =====================================================
-- Insertar pruebas 12, 13 y 14 (versiones multianalito)
-- =====================================================

-- =====================================================
-- 1. TESTS_CATALOG - Registro de las pruebas
-- =====================================================

-- -----------------------------------------------------
-- ID 12: Tendencia Central (Multianalito)
-- -----------------------------------------------------
INSERT INTO tests_catalog (
    id,
    lab_key,
    tipo_analisis,
    tipo_dato,
    modo_cualitativo,
    nombre_interno,
    titulo,
    categoria,
    descripcion,
    icon_lib,
    column_labels,
    value_mappings
) VALUES (
    12,
    'metales',
    'multi',
    'cuantitativo',
    NULL,
    'tendencia_central_multi',
    'Tendencia Central',
    'Tendencia Central',
    'Evalúa si la tendencia central (media o mediana) de cada parámetro está dentro del rango porcentual permitido respecto a la tendencia central global. Versión multianalito.',
    'lucide:target',
    '{
      "analito": "Analito",
      "parametro": "Parámetro",
      "n": "N",
      "metodo_tendencia": "Método",
      "tendencia_central": "Tendencia Central",
      "rango_min": "Rango Mín",
      "rango_max": "Rango Máx",
      "estado": "Estado"
    }'::jsonb,
    '{
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
)
ON CONFLICT (lab_key, nombre_interno) DO NOTHING;

-- -----------------------------------------------------
-- ID 13: Veracidad (Multianalito)
-- -----------------------------------------------------
INSERT INTO tests_catalog (
    id,
    lab_key,
    tipo_analisis,
    tipo_dato,
    modo_cualitativo,
    nombre_interno,
    titulo,
    categoria,
    descripcion,
    icon_lib,
    column_labels,
    value_mappings
) VALUES (
    13,
    'metales',
    'multi',
    'cuantitativo',
    NULL,
    'veracidad_multi',
    'Veracidad',
    'Veracidad',
    'Evalúa la veracidad de cada parámetro verificando que esté dentro del rango porcentual permitido respecto a la tendencia central global. Versión multianalito.',
    'lucide:check-circle',
    '{
      "analito": "Analito",
      "parametro": "Parámetro",
      "n": "N",
      "metodo_veracidad": "Método",
      "veracidad": "Veracidad",
      "rango_min": "Rango Mín",
      "rango_max": "Rango Máx",
      "estado": "Estado"
    }'::jsonb,
    '{
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
)
ON CONFLICT (lab_key, nombre_interno) DO NOTHING;

-- -----------------------------------------------------
-- ID 14: Precisión RSD (Multianalito)
-- -----------------------------------------------------
INSERT INTO tests_catalog (
    id,
    lab_key,
    tipo_analisis,
    tipo_dato,
    modo_cualitativo,
    nombre_interno,
    titulo,
    categoria,
    descripcion,
    icon_lib,
    column_labels,
    value_mappings
) VALUES (
    14,
    'metales',
    'multi',
    'cuantitativo',
    NULL,
    'precision_rsd_multi',
    'Precisión (RSD)',
    'Precisión',
    'Evalúa la precisión comparando los RSD individuales de cada parámetro contra un RSD teórico configurable. Calcula RSDexp, RSDr y RSDR según ISO 5725. Versión multianalito.',
    'lucide:percent',
    '{
      "analito": "Analito",
      "n": "N",
      "rsd_teorico": "RSD Teórico",
      "estado": "Estado",
      "rsd_experimental": "RSD Exp.",
      "rsd_r": "RSDr",
      "rsd_R": "RSDR"
    }'::jsonb,
    '{
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
)
ON CONFLICT (lab_key, nombre_interno) DO NOTHING;

-- =====================================================
-- 2. TEST_MODULES - Configuración de parámetros de usuario
-- =====================================================

-- -----------------------------------------------------
-- Módulo 12: Tendencia Central (Multianalito)
-- -----------------------------------------------------
INSERT INTO test_modules (
    catalog_id,
    version,
    parametros_json,
    autor,
    activo,
    requisitos_json
) VALUES (
    12,
    'v1.0',
    '{
      "user_input_schema": {
        "enabled": true,
        "fields": [
          {
            "name": "porcentaje_min",
            "type": "number",
            "label": "Porcentaje Mínimo (%)",
            "description": "Porcentaje mínimo permitido respecto a la tendencia central global (ej: 70 = 70%)",
            "required": true,
            "default": 70,
            "validation": { "min": 0, "max": 100 }
          },
          {
            "name": "porcentaje_max",
            "type": "number",
            "label": "Porcentaje Máximo (%)",
            "description": "Porcentaje máximo permitido respecto a la tendencia central global (ej: 130 = 130%)",
            "required": true,
            "default": 130,
            "validation": { "min": 0, "gt_field": "porcentaje_min" }
          }
        ],
        "layout": { "columns": 2, "title": "Configurar Rango de Variación Porcentual" }
      }
    }'::jsonb,
    'sistema',
    true,
    '{}'::jsonb
)
ON CONFLICT (catalog_id, version) DO NOTHING;

-- -----------------------------------------------------
-- Módulo 13: Veracidad (Multianalito)
-- -----------------------------------------------------
INSERT INTO test_modules (
    catalog_id,
    version,
    parametros_json,
    autor,
    activo,
    requisitos_json
) VALUES (
    13,
    'v1.0',
    '{
      "user_input_schema": {
        "enabled": true,
        "fields": [
          {
            "name": "porcentaje_min",
            "type": "number",
            "label": "Porcentaje Mínimo (%)",
            "description": "Porcentaje mínimo permitido respecto a la tendencia central global (ej: 70 = 70%)",
            "required": true,
            "default": 70,
            "validation": { "min": 0, "max": 100 }
          },
          {
            "name": "porcentaje_max",
            "type": "number",
            "label": "Porcentaje Máximo (%)",
            "description": "Porcentaje máximo permitido respecto a la tendencia central global (ej: 130 = 130%)",
            "required": true,
            "default": 130,
            "validation": { "min": 0, "gt_field": "porcentaje_min" }
          }
        ],
        "layout": { "columns": 2, "title": "Configurar Rango de Variación Porcentual" }
      }
    }'::jsonb,
    'sistema',
    true,
    '{}'::jsonb
)
ON CONFLICT (catalog_id, version) DO NOTHING;

-- -----------------------------------------------------
-- Módulo 14: Precisión RSD (Multianalito)
-- -----------------------------------------------------
INSERT INTO test_modules (
    catalog_id,
    version,
    parametros_json,
    autor,
    activo,
    requisitos_json
) VALUES (
    14,
    'v1.0',
    '{
      "user_input_schema": {
        "enabled": true,
        "fields": [
          {
            "name": "rsd_teorico",
            "type": "number",
            "label": "RSD Teórico (%)",
            "description": "Umbral de RSD para comparar contra los RSD individuales de cada parámetro",
            "required": true,
            "default": 22,
            "validation": { "min": 0.0000001 }
          }
        ],
        "layout": { "columns": 1, "title": "Configurar Precisión (RSD)" }
      }
    }'::jsonb,
    'sistema',
    true,
    '{}'::jsonb
)
ON CONFLICT (catalog_id, version) DO NOTHING;

-- =====================================================
-- 3. Sincronizar secuencia de IDs (si es necesario)
-- =====================================================
SELECT setval('tests_catalog_id_seq', GREATEST((SELECT MAX(id) FROM tests_catalog), 14));
SELECT setval('test_modules_id_seq', GREATEST((SELECT MAX(id) FROM test_modules), 14));
