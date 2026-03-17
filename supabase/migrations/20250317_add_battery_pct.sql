-- Add battery percentage columns to trips table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_battery_pct NUMERIC;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_battery_pct NUMERIC;

-- Add constraints to ensure valid battery percentages
ALTER TABLE trips ADD CONSTRAINT start_battery_pct_check
  CHECK (start_battery_pct IS NULL OR (start_battery_pct >= 0 AND start_battery_pct <= 100));
ALTER TABLE trips ADD CONSTRAINT end_battery_pct_check
  CHECK (end_battery_pct IS NULL OR (end_battery_pct >= 0 AND end_battery_pct <= 100));
