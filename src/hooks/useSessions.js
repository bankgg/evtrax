import { useState, useEffect, useCallback } from 'react'
import { db } from '../lib/db'
import { syncManager } from '../lib/syncManager'

export function useSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const all = await db.sessions.orderBy('started_at').reverse().toArray()
      setSessions(all)
      const count = await syncManager.getPendingCount()
      setPendingCount(count)
    } catch (err) {
      console.error('Failed to load sessions:', err)
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

  return { sessions, loading, pendingCount, refresh }
}
