import { db } from './db'
import { supabase } from './supabase'

class SyncManager {
  constructor() {
    this._listeners = new Set()
    this._syncing = false

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.flushQueue())
    }
  }

  subscribe(listener) {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  _notify() {
    this._listeners.forEach((fn) => fn())
  }

  // ── Save a new session ──────────────────────────────────
  async saveSession(data) {
    const id = data.id || crypto.randomUUID()
    const now = new Date().toISOString()
    const session = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    }

    await db.sessions.put(session)
    await db.syncQueue.add({
      operation: 'upsert',
      sessionId: id,
      timestamp: Date.now(),
    })

    this._notify()

    if (navigator.onLine) {
      this.flushQueue()
    }

    return session
  }

  // ── Update an existing session ──────────────────────────
  async updateSession(id, changes) {
    const now = new Date().toISOString()
    await db.sessions.update(id, { ...changes, updated_at: now })
    await db.syncQueue.add({
      operation: 'upsert',
      sessionId: id,
      timestamp: Date.now(),
    })

    this._notify()

    if (navigator.onLine) {
      this.flushQueue()
    }
  }

  // ── Delete a session ────────────────────────────────────
  async deleteSession(id) {
    await db.sessions.delete(id)
    await db.syncQueue.add({
      operation: 'delete',
      sessionId: id,
      timestamp: Date.now(),
    })

    this._notify()

    if (navigator.onLine) {
      this.flushQueue()
    }
  }

  // ── Trip methods ─────────────────────────────────────────

  // ── Save a new trip ─────────────────────────────────────
  async saveTrip(data) {
    const id = data.id || crypto.randomUUID()
    const now = new Date().toISOString()
    const trip = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    }

    await db.trips.put(trip)
    await db.syncQueue.add({
      operation: 'upsert_trip',
      tripId: id,
      timestamp: Date.now(),
    })

    this._notify()

    if (navigator.onLine) {
      this.flushQueue()
    }

    return trip
  }

  // ── Update an existing trip ─────────────────────────────
  async updateTrip(id, changes) {
    const now = new Date().toISOString()
    await db.trips.update(id, { ...changes, updated_at: now })
    await db.syncQueue.add({
      operation: 'upsert_trip',
      tripId: id,
      timestamp: Date.now(),
    })

    this._notify()

    if (navigator.onLine) {
      this.flushQueue()
    }
  }

  // ── Delete a trip ───────────────────────────────────────
  async deleteTrip(id) {
    await db.trips.delete(id)
    await db.syncQueue.add({
      operation: 'delete_trip',
      tripId: id,
      timestamp: Date.now(),
    })

    this._notify()

    if (navigator.onLine) {
      this.flushQueue()
    }
  }

  // ── Flush pending operations to Supabase ────────────────
  async flushQueue() {
    if (this._syncing || !navigator.onLine) return
    this._syncing = true
    this._notify()

    try {
      const pending = await db.syncQueue.orderBy('timestamp').toArray()
      if (pending.length === 0) {
        this._syncing = false
        this._notify()
        return
      }

      // Deduplicate: keep latest op per sessionId/tripId
      const latest = new Map()
      for (const item of pending) {
        if (item.sessionId) {
          latest.set(`session_${item.sessionId}`, item)
        } else if (item.tripId) {
          latest.set(`trip_${item.tripId}`, item)
        }
      }

      for (const [key, item] of latest) {
        try {
          if (item.operation === 'delete') {
            await supabase
              .from('charging_sessions')
              .delete()
              .eq('id', item.sessionId)
          } else if (item.operation === 'delete_trip') {
            await supabase
              .from('trips')
              .delete()
              .eq('id', item.tripId)
          } else if (item.operation === 'upsert_trip') {
            const trip = await db.trips.get(item.tripId)
            if (trip) {
              const { ...record } = trip
              await supabase.from('trips').upsert(record, {
                onConflict: 'id',
              })
            }
          } else {
            const session = await db.sessions.get(item.sessionId)
            if (session) {
              const { ...record } = session
              await supabase.from('charging_sessions').upsert(record, {
                onConflict: 'id',
              })
            }
          }

          // Remove all queue items for this entity
          if (item.sessionId) {
            await db.syncQueue
              .where('sessionId')
              .equals(item.sessionId)
              .delete()
          } else if (item.tripId) {
            await db.syncQueue
              .where('tripId')
              .equals(item.tripId)
              .delete()
          }
        } catch (err) {
          console.error(`Sync failed for ${key}:`, err)
          // Leave in queue to retry next time
        }
      }
    } finally {
      this._syncing = false
      this._notify()
    }
  }

  // ── Pull all sessions from Supabase (initial load) ──────
  async pullFromRemote() {
    if (!navigator.onLine) return

    try {
      // Pull sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('charging_sessions')
        .select('*')
        .order('started_at', { ascending: false })

      if (sessionsError) throw sessionsError

      if (sessionsData) {
        // Merge: remote wins for synced items, local wins for pending items
        const pendingIds = new Set(
          (await db.syncQueue.toArray())
            .filter((q) => q.sessionId)
            .map((q) => q.sessionId)
        )
        const remoteIds = new Set(sessionsData.map((r) => r.id))

        // Remove local sessions that are not in remote AND not pending sync
        const localSessions = await db.sessions.toArray()
        for (const local of localSessions) {
          if (!remoteIds.has(local.id) && !pendingIds.has(local.id)) {
            await db.sessions.delete(local.id)
          }
        }

        // Add/update remote sessions
        for (const remote of sessionsData) {
          if (!pendingIds.has(remote.id)) {
            await db.sessions.put(remote)
          }
        }
      }

      // Pull trips
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .order('started_at', { ascending: false })

      if (tripsError) throw tripsError

      if (tripsData) {
        const pendingTripIds = new Set(
          (await db.syncQueue.toArray())
            .filter((q) => q.tripId)
            .map((q) => q.tripId)
        )
        const remoteTripIds = new Set(tripsData.map((r) => r.id))

        // Remove local trips that are not in remote AND not pending sync
        const localTrips = await db.trips.toArray()
        for (const local of localTrips) {
          if (!remoteTripIds.has(local.id) && !pendingTripIds.has(local.id)) {
            await db.trips.delete(local.id)
          }
        }

        // Add/update remote trips
        for (const remote of tripsData) {
          if (!pendingTripIds.has(remote.id)) {
            await db.trips.put(remote)
          }
        }
      }

      this._notify()
    } catch (err) {
      console.error('Pull from remote failed:', err)
    }
  }

  // ── Get sync status ──────────────────────────────────────
  async getPendingCount() {
    const items = await db.syncQueue.toArray()
    // Deduplicate by sessionId or tripId
    const uniqueSessions = new Set(items.filter((i) => i.sessionId).map((i) => `session_${i.sessionId}`))
    const uniqueTrips = new Set(items.filter((i) => i.tripId).map((i) => `trip_${i.tripId}`))
    return uniqueSessions.size + uniqueTrips.size
  }

  get isSyncing() {
    return this._syncing
  }
}

export const syncManager = new SyncManager()
