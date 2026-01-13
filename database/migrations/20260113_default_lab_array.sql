BEGIN;

-- Convert usuarios.default_lab from single value to a list (max 2 labs).
-- Note: Postgres cannot enforce FK constraints over arrays, so the old FK is removed.

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS fk_usuario_lab;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
      AND column_name = 'default_lab'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE public.usuarios
      ALTER COLUMN default_lab
      TYPE text[]
      USING CASE
        WHEN default_lab IS NULL OR btrim(default_lab) = '' THEN NULL
        ELSE ARRAY[default_lab]
      END;
  END IF;
END $$;

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS check_default_lab_max2;
ALTER TABLE public.usuarios
  ADD CONSTRAINT check_default_lab_max2 CHECK (COALESCE(array_length(default_lab, 1), 0) <= 2);

COMMIT;
