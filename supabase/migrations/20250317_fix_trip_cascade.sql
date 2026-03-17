-- Drop the existing foreign key constraint
ALTER TABLE charging_sessions DROP CONSTRAINT IF EXISTS charging_sessions_trip_id_fkey;

-- Re-add with ON DELETE SET NULL
ALTER TABLE charging_sessions
  ADD CONSTRAINT charging_sessions_trip_id_fkey
  FOREIGN KEY (trip_id)
  REFERENCES trips(id)
  ON DELETE SET NULL;
