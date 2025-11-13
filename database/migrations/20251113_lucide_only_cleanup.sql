-- Lucide-only cleanup migration
-- Drops signing-related tables/columns/triggers and keeps icon_lib only
-- Run in a transaction in your PostgreSQL database

BEGIN;

-- 1) Drop dependent view if present
DROP VIEW IF EXISTS public.tests_catalog_icons_approved;

-- 2) Drop triggers related to icon signing on tests_catalog
DROP TRIGGER IF EXISTS tr_auto_hash_tests_catalog ON public.tests_catalog;
DROP TRIGGER IF EXISTS tr_clear_hash_if_revoked_tc ON public.tests_catalog;
DROP TRIGGER IF EXISTS trg_forbid_update_signed_tc ON public.tests_catalog;

-- 3) Drop functions used by those triggers (safe if unused)
DROP FUNCTION IF EXISTS public.calcular_hash_tests_catalog();
DROP FUNCTION IF EXISTS public.limpiar_hash_si_revocado_tc();
DROP FUNCTION IF EXISTS public.forbid_update_signed_columns_tc();

-- 4) Drop signing-related column index
DROP INDEX IF EXISTS public.idx_tests_catalog_icon_hash;

-- 5) Remove signing-related columns from tests_catalog
ALTER TABLE public.tests_catalog
  DROP COLUMN IF EXISTS icon_svg,
  DROP COLUMN IF EXISTS icon_css,
  DROP COLUMN IF EXISTS icon_js,
  DROP COLUMN IF EXISTS icon_sig,
  DROP COLUMN IF EXISTS icon_hash,
  DROP COLUMN IF EXISTS icon_active,
  DROP COLUMN IF EXISTS icon_revoked;

-- 6) Keep icon_lib only; optional: enforce sanitized names (lowercase, [a-z0-9-])
-- Uncomment if you want a strict constraint (ensure existing rows comply first)
-- ALTER TABLE public.tests_catalog
--   ALTER COLUMN icon_lib SET DEFAULT 'bar-chart-2';
-- ALTER TABLE public.tests_catalog
--   ADD CONSTRAINT chk_icon_lib_lucide_name
--   CHECK (icon_lib ~ '^[a-z0-9-]+$');

-- 7) Drop central allowlist table (no longer used)
DROP TABLE IF EXISTS public.allowed_icon_hashes;

COMMIT;

