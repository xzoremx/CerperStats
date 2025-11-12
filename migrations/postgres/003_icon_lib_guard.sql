-- Enforce that tests_catalog.icon_lib is always a non-empty lucide:* token
BEGIN;

-- Normalize existing data: set default lucide when NULL/empty or contains inline SVG
UPDATE tests_catalog
SET icon_lib = 'lucide:bar-chart-2'
WHERE icon_lib IS NULL OR btrim(icon_lib) = '' OR icon_lib ~* '^\s*<svg';

-- Optional normalization: lower-case and strip spaces
UPDATE tests_catalog
SET icon_lib = 'lucide:' || regexp_replace(
  regexp_replace(lower(substring(icon_lib from '^\s*lucide:(.*)$')), '\s+', '', 'g'),
  '[^a-z0-9-]', '', 'g'
)
WHERE icon_lib ~* '^\s*lucide:';

-- Set default and NOT NULL
ALTER TABLE tests_catalog ALTER COLUMN icon_lib SET DEFAULT 'lucide:bar-chart-2';
ALTER TABLE tests_catalog ALTER COLUMN icon_lib SET NOT NULL;

-- Allow only lucide:<slug> pattern (lowercase letters, numbers, hyphens)
ALTER TABLE tests_catalog
  ADD CONSTRAINT IF NOT EXISTS icon_lib_lucide_only
  CHECK (icon_lib ~ '^[a-z]*:?lucide:[a-z0-9][a-z0-9-]*$' OR icon_lib ~ '^lucide:[a-z0-9][a-z0-9-]*$');

-- Optional: trigger to normalize incoming values
CREATE OR REPLACE FUNCTION normalize_icon_lib() RETURNS trigger AS $$
BEGIN
  IF NEW.icon_lib IS NULL OR btrim(NEW.icon_lib) = '' OR NEW.icon_lib ~* '^\s*<svg' THEN
    NEW.icon_lib := 'lucide:bar-chart-2';
  ELSIF NEW.icon_lib ~* '^\s*lucide:' THEN
    NEW.icon_lib := 'lucide:' || regexp_replace(
      regexp_replace(lower(substring(NEW.icon_lib from '^\s*lucide:(.*)$')), '\s+', '', 'g'),
      '[^a-z0-9-]', '', 'g'
    );
    IF NEW.icon_lib = 'lucide:' THEN
      NEW.icon_lib := 'lucide:bar-chart-2';
    END IF;
  ELSE
    NEW.icon_lib := 'lucide:bar-chart-2';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_icon_lib ON tests_catalog;
CREATE TRIGGER trg_normalize_icon_lib
BEFORE INSERT OR UPDATE OF icon_lib ON tests_catalog
FOR EACH ROW
EXECUTE FUNCTION normalize_icon_lib();

COMMIT;

