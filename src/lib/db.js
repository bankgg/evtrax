import Dexie from 'dexie'

export const db = new Dexie('evtrax')

db.version(1).stores({
  sessions:
    'id, charging_type, started_at, ended_at, location, provider, start_soc_pct, end_soc_pct, energy_kwh, price_per_kwh, total_cost, note, created_at, updated_at',
  syncQueue: '++queueId, operation, sessionId, timestamp',
})

db.version(2).stores({
  sessions:
    'id, charging_type, started_at, ended_at, location, provider, start_soc_pct, end_soc_pct, energy_kwh, price_per_kwh, total_cost, odometer_km, note, created_at, updated_at',
})

db.version(3).stores({
  sessions:
    'id, charging_type, started_at, ended_at, location, provider, start_soc_pct, end_soc_pct, energy_kwh, price_per_kwh, total_cost, odometer_km, lat, lng, note, created_at, updated_at',
})

db.version(4).stores({
  sessions:
    'id, charging_type, started_at, ended_at, location, provider, start_soc_pct, end_soc_pct, energy_kwh, price_per_kwh, total_cost, odometer_km, lat, lng, note, created_at, updated_at, trip_id',
  trips: '++id, name, started_at, ended_at, created_at, updated_at',
  syncQueue: '++queueId, operation, sessionId, tripId, timestamp',
})

db.version(5).stores({
  trips: 'id, name, started_at, ended_at, start_odometer, created_at, updated_at',
})

db.version(6).stores({
  trips: 'id, name, started_at, ended_at, start_odometer, start_battery_pct, end_battery_pct, created_at, updated_at',
})

db.version(7).stores({
  trips: 'id, name, started_at, ended_at, start_odometer, end_odometer, start_battery_pct, end_battery_pct, created_at, updated_at',
})

// Handle database errors
db.on('blocked', () => {
  console.warn('Database upgrade blocked - another tab is open with the old version')
})

db.on('versionchange', () => {
  // Close the database connection when a version change is detected
  // This allows the other tab to upgrade the database
  db.close()
  console.log('Database version changed - please refresh the page')
})

// Export a helper to check if database needs to be reopened
export function ensureDatabaseOpen() {
  if (!db.isOpen()) {
    return db.open()
  }
  return Promise.resolve()
}
