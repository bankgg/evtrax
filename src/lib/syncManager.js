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

      // Deduplicate: keep latest op per sessionId
      const latest = new Map()
      for (const item of pending) {
        latest.set(item.sessionId, item)
      }

      for (const [sessionId, item] of latest) {
        try {
          if (item.operation === 'delete') {
            await supabase
              .from('charging_sessions')
              .delete()
              .eq('id', sessionId)
          } else {
            const session = await db.sessions.get(sessionId)
            if (session) {
              const { ...record } = session
              await supabase.from('charging_sessions').upsert(record, {
                onConflict: 'id',
              })
            }
          }

          // Remove all queue items for this session
          await db.syncQueue
            .where('sessionId')
            .equals(sessionId)
            .delete()
        } catch (err) {
          console.error(`Sync failed for session ${sessionId}:`, err)
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
      const { data, error } = await supabase
        .from('charging_sessions')
        .select('*')
        .order('started_at', { ascending: false })

      if (error) throw error

      if (data) {
        // Merge: remote wins for synced items, local wins for pending items
        const pendingIds = new Set(
          (await db.syncQueue.toArray()).map((q) => q.sessionId)
        )
        const remoteIds = new Set(data.map((r) => r.id))

        // Remove local sessions that are not in remote AND not pending sync
        const localSessions = await db.sessions.toArray()
        for (const local of localSessions) {
          if (!remoteIds.has(local.id) && !pendingIds.has(local.id)) {
            await db.sessions.delete(local.id)
          }
        }

        // Add/update remote sessions
        for (const remote of data) {
          if (!pendingIds.has(remote.id)) {
            await db.sessions.put(remote)
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
    // Deduplicate by sessionId
    const unique = new Set(items.map((i) => i.sessionId))
    return unique.size
  }

  get isSyncing() {
    return this._syncing
  }
}

export const syncManager = new SyncManager()
