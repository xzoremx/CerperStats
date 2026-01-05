-- =====================================================
-- Migración: Agregar pruebas multianalito para
-- Homogeneidad de Varianzas y Tendencia Central
-- =====================================================
-- Fecha: 2026-01-05
-- Descripción: Crea entradas en tests_catalog y test_modules
--              para las nuevas pruebas multianalito (carpetas 5 y 6)
-- =====================================================

-- IMPORTANTE: Ejecutar este script en la base de datos PostgreSQL
-- Ajusta 'lab_key' según el laboratorio donde quieras registrar las pruebas

-- =====================================================
-- 1. Insertar en tests_catalog
-- =====================================================

-- Homogeneidad de Varianzas (Multianalito)
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
    'multianalito',                              -- tipo_analisis
    'cuantitativo',                              -- tipo_dato
    NULL,                                        -- modo_cualitativo
    'homogeneidad_varianzas_multianalito',       -- nombre_interno
    'Homogeneidad de Varianzas (Multianalito)', -- titulo
    'Homogeneidad',                              -- categoria
    'Evalúa si las varianzas son homogéneas entre grupos usando Bartlett, Prueba F o Levene según normalidad de los datos. Versión multianalito.',
    'lucide:bar-chart-2'                         -- icon_lib
)
ON CONFLICT (lab_key, nombre_interno) DO NOTHING;

-- Tendencia Central (Multianalito)
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
    'multianalito',                              -- tipo_analisis
    'cuantitativo',                              -- tipo_dato
    NULL,                                        -- modo_cualitativo
    'tendencia_central_multianalito',            -- nombre_interno
    'Tendencia Central (Multianalito)',          -- titulo
    'Tendencia Central',                         -- categoria
    'Evalúa diferencias en la tendencia central usando ANOVA, T-Student, Kruskal-Wallis o Mann-Whitney según normalidad de los datos. Versión multianalito.',
    'lucide:bar-chart-2'                         -- icon_lib
)
ON CONFLICT (lab_key, nombre_interno) DO NOTHING;


-- =====================================================
-- 2. Insertar en test_modules
-- =====================================================

-- Obtener los IDs de los tests recién insertados y crear los módulos
-- Homogeneidad de Varianzas (Multianalito) - module_id = 5
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
WHERE nombre_interno = 'homogeneidad_varianzas_multianalito'
ON CONFLICT (catalog_id, version) DO NOTHING;

-- Tendencia Central (Multianalito) - module_id = 6
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
WHERE nombre_interno = 'tendencia_central_multianalito'
ON CONFLICT (catalog_id, version) DO NOTHING;


-- =====================================================
-- 3. Verificación
-- =====================================================

-- Ejecuta esta consulta para verificar que todo se creó correctamente:
/*
SELECT 
    tc.id AS catalog_id,
    tc.nombre_interno,
    tc.titulo,
    tc.tipo_analisis,
    tm.id AS module_id,
    tm.version,
    tm.activo
FROM tests_catalog tc
LEFT JOIN test_modules tm ON tm.catalog_id = tc.id
WHERE tc.nombre_interno IN (
    'homogeneidad_varianzas_multianalito',
    'tendencia_central_multianalito'
)
ORDER BY tc.id;
*/

-- =====================================================
-- NOTA IMPORTANTE
-- =====================================================
-- Después de ejecutar este script, verifica que los module_id
-- generados coincidan con los del modules_manifest.json.
-- 
-- Si los IDs no coinciden, actualiza modules_manifest.json
-- con los IDs correctos generados por la base de datos.
--
-- Los module_id en el manifest deben ser los IDs de test_modules,
-- no los IDs de tests_catalog.
-- =====================================================
