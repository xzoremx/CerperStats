-- Drop unused columns in tests_catalog and enforce single active module per test

BEGIN;

-- 1) Drop version_actual and activo from tests_catalog if they exist
ALTER TABLE public.tests_catalog
  DROP COLUMN IF EXISTS version_actual,
  DROP COLUMN IF EXISTS activo;

-- 2) Optional: ensure only one active module per catalog in test_modules
--    (requires a boolean column "activo" in test_modules)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_tm_one_active_per_test'
  ) THEN
    CREATE UNIQUE INDEX uq_tm_one_active_per_test
      ON public.test_modules(catalog_id)
      WHERE activo = true;
  END IF;
END $$;

COMMIT;

