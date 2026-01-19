-- =====================================================
-- Migración: Soporte para Pruebas Parametrizables
-- Fecha: 2026-01-18
-- Descripción: Crea tabla session_test_params para almacenar
--              parámetros de usuario por sesión/prueba
-- =====================================================

-- =====================================================
-- 1. Crear tabla session_test_params
-- =====================================================
CREATE TABLE IF NOT EXISTS session_test_params (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    catalog_id INTEGER NOT NULL,
    params_json JSONB NOT NULL DEFAULT '{}',
    creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    CONSTRAINT fk_stp_session FOREIGN KEY (session_id)
        REFERENCES sessions(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_stp_catalog FOREIGN KEY (catalog_id)
        REFERENCES tests_catalog(id) ON UPDATE CASCADE ON DELETE CASCADE,

    -- Unique constraint: solo un registro por sesión+prueba
    CONSTRAINT uq_session_test_params UNIQUE (session_id, catalog_id)
);

-- =====================================================
-- 2. Índices para rendimiento
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_stp_session_id
    ON session_test_params(session_id);

CREATE INDEX IF NOT EXISTS idx_stp_catalog_id
    ON session_test_params(catalog_id);

CREATE INDEX IF NOT EXISTS idx_stp_session_catalog
    ON session_test_params(session_id, catalog_id);

-- =====================================================
-- 3. Trigger para actualizar timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION actualizar_timestamp_session_test_params()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_session_test_params ON session_test_params;

CREATE TRIGGER tr_update_session_test_params
    BEFORE UPDATE ON session_test_params
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp_session_test_params();

-- =====================================================
-- 4. Comentarios de documentación
-- =====================================================
COMMENT ON TABLE session_test_params IS
    'Almacena parámetros de usuario para pruebas parametrizables por sesión';

COMMENT ON COLUMN session_test_params.params_json IS
    'JSON con los valores de parámetros ingresados por el usuario. Ej: {"rango_min": 95, "rango_max": 105}';

-- =====================================================
-- 5. Ejemplo de uso (comentado)
-- =====================================================
-- INSERT INTO session_test_params (session_id, catalog_id, params_json)
-- VALUES (1, 10, '{"rango_min": 95, "rango_max": 105, "usar_mediana": false}'::jsonb)
-- ON CONFLICT (session_id, catalog_id)
-- DO UPDATE SET params_json = EXCLUDED.params_json;
