-- Create trips table
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  start_odometer NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on started_at for faster queries
CREATE INDEX IF NOT EXISTS idx_trips_started_at ON trips(started_at DESC);

-- Add trip_id column to charging_sessions
ALTER TABLE charging_sessions ADD COLUMN IF NOT EXISTS trip_id TEXT REFERENCES trips(id);

-- Create index on trip_id for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_trip_id ON charging_sessions(trip_id);

-- Note: Add RLS policies for trips based on your existing auth/user schema
-- Adjust the policies below based on your actual user authentication setup
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Example policies - adjust based on your auth schema:
-- CREATE POLICY "Users can view own trips" ON trips FOR SELECT USING (true);
-- CREATE POLICY "Users can insert own trips" ON trips FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Users can update own trips" ON trips FOR UPDATE USING (true);
-- CREATE POLICY "Users can delete own trips" ON trips FOR DELETE USING (true);
