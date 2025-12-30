-- Migration: Add conclusion_status column to results_general table
-- Date: 2025-01-XX
-- Description: Adds a column to store the conclusion status (success/danger/neutral) 
--              directly from Python modules instead of analyzing text in JavaScript

-- Add the new column with a default value of NULL
ALTER TABLE results_general 
ADD COLUMN IF NOT EXISTS conclusion_status VARCHAR(10) CHECK (conclusion_status IN ('success', 'danger', 'neutral'));

-- Add a comment to document the column
COMMENT ON COLUMN results_general.conclusion_status IS 'Status de la conclusión: success (verde), danger (rojo), neutral (gris). Generado por los módulos Python.';

-- Create an index for better query performance if needed
CREATE INDEX IF NOT EXISTS idx_results_general_conclusion_status 
ON results_general(conclusion_status) 
WHERE conclusion_status IS NOT NULL;
