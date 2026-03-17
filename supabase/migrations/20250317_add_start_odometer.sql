-- Add start_odometer column to trips table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_odometer NUMERIC;
