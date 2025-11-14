-- Test modules adjustments: constraints, defaults, indices, and counter functions

BEGIN;

-- 1) FK with catalog; add only if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'fk_test_modules_catalog'
      AND n.nspname = 'public'
      AND t.relname = 'test_modules'
  ) THEN
    ALTER TABLE public.test_modules
      ADD CONSTRAINT fk_test_modules_catalog
      FOREIGN KEY (catalog_id) REFERENCES public.tests_catalog(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2) Uniqueness per (catalog_id, version)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_test_modules_catalog_version'
  ) THEN
    ALTER TABLE public.test_modules
      ADD CONSTRAINT uq_test_modules_catalog_version UNIQUE (catalog_id, version);
  END IF;
END $$;

-- 3) JSON defaults and NOT NULL
ALTER TABLE public.test_modules
  ALTER COLUMN requisitos_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN parametros_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metricas_json SET DEFAULT '{}'::jsonb;

UPDATE public.test_modules SET requisitos_json = '{}'::jsonb WHERE requisitos_json IS NULL;
UPDATE public.test_modules SET parametros_json = '{}'::jsonb WHERE parametros_json IS NULL;
UPDATE public.test_modules SET metricas_json = '{}'::jsonb WHERE metricas_json IS NULL;

ALTER TABLE public.test_modules
  ALTER COLUMN requisitos_json SET NOT NULL,
  ALTER COLUMN parametros_json SET NOT NULL,
  ALTER COLUMN metricas_json SET NOT NULL;

-- 4) Counter check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_test_modules_exec_count_nonneg'
  ) THEN
    ALTER TABLE public.test_modules
      ADD CONSTRAINT chk_test_modules_exec_count_nonneg CHECK (exec_count >= 0);
  END IF;
END $$;

-- 5) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_test_modules_catalog ON public.test_modules(catalog_id);
CREATE INDEX IF NOT EXISTS idx_test_modules_activo ON public.test_modules(activo) WHERE activo = true;

COMMIT;

-- Utility functions (counters)
CREATE OR REPLACE FUNCTION public.test_modules_increment_exec(p_catalog_ids int[])
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.test_modules
     SET exec_count = exec_count + 1,
         last_executed_at = NOW()
   WHERE catalog_id = ANY (p_catalog_ids)
     AND activo = TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_module_increment_exec(p_catalog_id int)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.test_modules
     SET exec_count = exec_count + 1,
         last_executed_at = NOW()
   WHERE catalog_id = p_catalog_id
     AND activo = TRUE;
END;
$$;

-- Optional: selection per session (auditable), instead of a global selected flag
CREATE TABLE IF NOT EXISTS public.session_selected_tests (
  session_id   int  NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  catalog_id   int  NOT NULL REFERENCES public.tests_catalog(id) ON DELETE CASCADE,
  selected_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, catalog_id)
);

