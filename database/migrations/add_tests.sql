-- =====================================================
-- Plantilla SQL para insertar columnas en tests_catalog y test_modules
-- =====================================================

-- -----------------------------------------------------
-- Veracidad (Recuperación) - Monoanalito
-- -----------------------------------------------------
INSERT INTO tests_catalog (
    lab_key,
    tipo_analisis,
    tipo_dato,
    modo_cualitativo,
    nombre_interno,
    titulo,
    categoria,
    descripcion,
    icon_lib
) VALUES (
    'metales',                                    -- Ajustar según tu lab_key
    'mono',                                       -- tipo_analisis
    'cuantitativo',                               -- tipo_dato
    NULL,                                         -- modo_cualitativo
    'veracidad_recuperacion',                     -- nombre_interno
    'Veracidad (Recuperación)',                   -- titulo
    'Veracidad',                  -- categoria
    'Evalúa la veracidad en términos de recuperación usando adición y rango de aceptación.',
    'lucide:check-circle'                         -- icon_lib
)
ON CONFLICT (lab_key, nombre_interno) DO NOTHING;

-- -----------------------------------------------------
-- Precisión (RSD) - Monoanalito
-- -----------------------------------------------------
INSERT INTO tests_catalog (
    lab_key,
    tipo_analisis,
    tipo_dato,
    modo_cualitativo,
    nombre_interno,
    titulo,
    categoria,
    descripcion,
    icon_lib
) VALUES (
    'metales',                                    -- Ajustar según tu lab_key
    'mono',                                       -- tipo_analisis
    'cuantitativo',                               -- tipo_dato
    NULL,                                         -- modo_cualitativo
    'precision_rsd',                              -- nombre_interno
    'Precisión (RSD)',                            -- titulo
    'Precisión',                  -- categoria
    'Evalúa la precisión comparando los RSD individuales contra un RSD teórico.',
    'lucide:target'                               -- icon_lib
)
ON CONFLICT (lab_key, nombre_interno) DO NOTHING;

-- =====================================================
-- 2. Insertar en test_modules
-- =====================================================

-- Veracidad (Recuperación) - parámetros (adición + rango)
INSERT INTO test_modules (
    catalog_id,
    version,
    parametros_json,
    autor,
    activo,
    requisitos_json
)
SELECT 
    id,
    'v1.0',
    '{
      "user_input_schema": {
        "enabled": true,
        "fields": [
          {
            "name": "adicion",
            "type": "number",
            "label": "Adición (unidad de medida)",
            "description": "Valor de adición del estándar de trabajo",
            "required": true,
            "default": null,
            "validation": { "min": 0.0000001 }
          },
          {
            "name": "rango_min",
            "type": "number",
            "label": "Recuperación mínima (%)",
            "description": "Límite inferior del porcentaje de recuperación",
            "required": true,
            "default": 70,
            "validation": { "min": 0 }
          },
          {
            "name": "rango_max",
            "type": "number",
            "label": "Recuperación máxima (%)",
            "description": "Límite superior del porcentaje de recuperación",
            "required": true,
            "default": 120,
            "validation": { "min": 0, "gt_field": "rango_min" }
          }
        ],
        "layout": { "columns": 2, "title": "Configurar Veracidad (Recuperación)" }
      }
    }'::jsonb,
    'sistema',
    true,
    '{}'::jsonb
FROM tests_catalog
WHERE nombre_interno = 'veracidad_recuperacion'
ON CONFLICT (catalog_id, version) DO NOTHING;

-- Precisión (RSD) - parámetro (RSD teórico)
INSERT INTO test_modules (
    catalog_id,
    version,
    parametros_json,
    autor,
    activo,
    requisitos_json
)
SELECT 
    id,
    'v1.0',
    '{
      "user_input_schema": {
        "enabled": true,
        "fields": [
          {
            "name": "rsd_teorico",
            "type": "number",
            "label": "RSD Teórico (%)",
            "description": "Umbral de RSD para comparar contra los RSD individuales",
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
FROM tests_catalog
WHERE nombre_interno = 'precision_rsd'
ON CONFLICT (catalog_id, version) DO NOTHING;










