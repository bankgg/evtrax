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

