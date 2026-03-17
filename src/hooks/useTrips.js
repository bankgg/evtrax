import { useState, useEffect, useCallback } from 'react'
import { db, ensureDatabaseOpen } from '../lib/db'
import { syncManager } from '../lib/syncManager'

export function useTrips() {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      await ensureDatabaseOpen()
      const all = await db.trips.orderBy('started_at').reverse().toArray()
      setTrips(all)
    } catch (err) {
      console.error('Failed to load trips:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial load
    refresh()

    // Pull remote data on first load
    syncManager.pullFromRemote().then(refresh)

    // Subscribe to sync changes
    const unsub = syncManager.subscribe(refresh)
    return unsub
  }, [refresh])

  return { trips, loading, refresh }
}
