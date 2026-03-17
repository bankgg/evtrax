-- Add end_odometer column to trips table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_odometer NUMERIC;
