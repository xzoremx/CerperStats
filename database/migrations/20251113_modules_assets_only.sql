-- Modules: switch to packaged assets + ID
-- Removes signing tables/triggers and code text columns; adds asset references

BEGIN;

-- Drop dependent views if present
DROP VIEW IF EXISTS public.test_modules_approved;

-- Drop central allowlist for modules
DROP TABLE IF EXISTS public.allowed_module_hashes;

-- Drop triggers on test_modules
DROP TRIGGER IF EXISTS tr_auto_hash_test_modules ON public.test_modules;
DROP TRIGGER IF EXISTS tr_clear_hash_if_revoked_tm ON public.test_modules;
DROP TRIGGER IF EXISTS tr_update_test_modules ON public.test_modules;
-- Some environments may also have this forbid-update trigger name
DROP TRIGGER IF EXISTS trg_forbid_update_signed_tm ON public.test_modules;

-- Drop functions used by those triggers
DROP FUNCTION IF EXISTS public.calcular_hash_test_modules();
DROP FUNCTION IF EXISTS public.limpiar_hash_si_revocado_tm();
DROP FUNCTION IF EXISTS public.forbid_update_signed_columns_tm();

-- Drop indexes related to code hash
DROP INDEX IF EXISTS public.idx_test_modules_hash;

-- Add new asset columns (relative paths under modules/)
ALTER TABLE public.test_modules
  ADD COLUMN IF NOT EXISTS module_asset text,
  ADD COLUMN IF NOT EXISTS graph_asset text;

-- Optionally drop legacy columns storing code and signatures
ALTER TABLE public.test_modules
  DROP COLUMN IF EXISTS codigo_principal,
  DROP COLUMN IF EXISTS codigo_dependencias,
  DROP COLUMN IF EXISTS codigo_grafico,
  DROP COLUMN IF EXISTS code_hash,
  DROP COLUMN IF EXISTS code_sig,
  DROP COLUMN IF EXISTS active,
  DROP COLUMN IF EXISTS revoked,
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS published_by;

COMMIT;
