BEGIN;

-- 1) Remove email column (no longer used)
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS email;

-- 2) Add sede and validate values
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS sede VARCHAR(20);
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS check_sede;
ALTER TABLE public.usuarios
  ADD CONSTRAINT check_sede CHECK (sede IN ('Paita', 'Chimbote', 'Arequipa', 'Callao'));

-- 3) Ensure accounts are inactive by default
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT FALSE;
ALTER TABLE public.usuarios ALTER COLUMN activo SET DEFAULT FALSE;
UPDATE public.usuarios SET activo = FALSE WHERE activo IS NULL;

-- 4) Enforce case-insensitive uniqueness for username
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.usuarios
    GROUP BY lower(username)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate usernames exist ignoring case; resolve before creating unique index.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_username_lower
  ON public.usuarios (lower(username));

COMMIT;
