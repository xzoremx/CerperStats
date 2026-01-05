-- =====================================================
-- Plantilla SQL para insertar columnas en tests_catalog y test_modules
-- =====================================================
-- 1. Insertar en tests_catalog
-- =====================================================

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
    'mono',                              -- tipo_analisis
    'cuantitativo',                              -- tipo_dato
    NULL,                                        -- modo_cualitativo
    'atipicos',       -- nombre_interno
    'Detección de Atípicos', -- titulo
    'Tratamiento de Resultados',                              -- categoria
    'Evalúa si los resultados son atípicos usando Z-Score clásico o robusto.',
    'lucide:alert-circle'                         -- icon_lib
)
ON CONFLICT (lab_key, nombre_interno) DO NOTHING;

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
    'multi',                              -- tipo_analisis
    'cuantitativo',                              -- tipo_dato
    NULL,                                        -- modo_cualitativo
    'atipicos_multianalito',            -- nombre_interno
    'Detección de Atípicos (Multianalito)',          -- titulo
    'Tratamiento de Resultados',                         -- categoria
    'Evalúa si los resultados son atípicos usando Z-Score clásico o robusto.',
    'lucide:alert-circle'                         -- icon_lib
)
ON CONFLICT (lab_key, nombre_interno) DO NOTHING;


-- =====================================================
-- 2. Insertar en test_modules
-- =====================================================

-- Obtener los IDs de los tests recién insertados y crear los módulos
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
    '{}'::jsonb,
    'zorem',
    true,
    '{}'::jsonb
FROM tests_catalog
WHERE nombre_interno = 'atipicos'
ON CONFLICT (catalog_id, version) DO NOTHING;

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
    '{}'::jsonb,
    'zorem',
    true,
    '{}'::jsonb
FROM tests_catalog
WHERE nombre_interno = 'atipicos_multianalito'
ON CONFLICT (catalog_id, version) DO NOTHING;


