import { db, ensureDatabaseOpen } from './db'

class TripManager {
  /**
   * Create a new trip
   * @param {string} name - Trip name (e.g., 'Trip A', 'Trip B', or custom)
   * @returns {Promise<Object>} The created trip
   */
  async createTrip(name) {
    const now = new Date().toISOString()
    const trip = {
      name,
      started_at: now,
      ended_at: null,
      created_at: now,
      updated_at: now,
    }
    const id = await db.trips.add(trip)
    return { ...trip, id }
  }

  /**
   * End a trip
   * @param {number} tripId - The trip ID to end
   * @returns {Promise<void>}
   */
  async endTrip(tripId) {
    const now = new Date().toISOString()
    await db.trips.update(tripId, { ended_at: now, updated_at: now })
  }

  /**
   * Get the currently active trip (where ended_at is null)
   * @returns {Promise<Object|null>} The active trip or null
   */
  async getActiveTrip() {
    await ensureDatabaseOpen()
    const allTrips = await db.trips.toArray()
    const activeTrips = allTrips.filter((trip) => trip.ended_at === null)
    return activeTrips.length > 0 ? activeTrips[0] : null
  }

  /**
   * Get a trip with all its associated sessions
   * @param {number} tripId - The trip ID
   * @returns {Promise<Object>} Trip with sessions array
   */
  async getTripWithSessions(tripId) {
    await ensureDatabaseOpen()
    const trip = await db.trips.get(tripId)
    if (!trip) return null

    const sessions = await db.sessions.where('trip_id').equals(tripId).toArray()
    return { ...trip, sessions }
  }

  /**
   * Calculate trip statistics
   * @param {number} tripId - The trip ID
   * @returns {Promise<Object>} Statistics object with dual metrics (charged vs used)
   */
  async calculateTripStats(tripId) {
    await ensureDatabaseOpen()
    const trip = await db.trips.get(tripId)
    const sessions = await db.sessions.where('trip_id').equals(tripId).toArray()

    // Battery capacity constant
    const BATTERY_KWH = 58.9

    if (!sessions || sessions.length === 0) {
      return {
        totalCost: 0,
        totalEnergy: 0,
        energyCharged: 0,
        costCharged: 0,
        energyUsed: null,
        costUsed: null,
        totalDistance: null,
        efficiency: null,
        costPerKm: null,
        sessionCount: 0,
        batteryChangePct: null,
        batteryChangeKwh: null,
        avgCostPerKwh: null,
        hasBatteryData: false,
      }
    }

    // Charged metrics (from all sessions)
    const energyCharged = sessions.reduce((sum, s) => sum + (Number(s.energy_kwh) || 0), 0)
    const costCharged = sessions.reduce((sum, s) => sum + (Number(s.total_cost) || 0), 0)
    const sessionCount = sessions.length

    // Battery-aware metrics
    const hasBatteryData = trip?.start_battery_pct != null && trip?.end_battery_pct != null

    let energyUsed = null
    let costUsed = null
    let batteryChangePct = null
    let batteryChangeKwh = null

    if (hasBatteryData) {
      // Energy used = battery drop percentage × battery capacity
      const batteryDropPct = Number(trip.start_battery_pct) - Number(trip.end_battery_pct)
      energyUsed = (batteryDropPct / 100) * BATTERY_KWH
      batteryChangePct = -batteryDropPct // For display purposes (negative of drop)
      batteryChangeKwh = -energyUsed // For display purposes

      const avgCostPerKwh = energyCharged > 0 ? costCharged / energyCharged : 0
      costUsed = energyUsed > 0 ? energyUsed * avgCostPerKwh : 0
    }

    // Odometer-derived stats
    const sessionsWithOdo = sessions.filter((s) => s.odometer_km != null && s.odometer_km > 0)
    let totalDistance = null
    let efficiency = null
    let costPerKm = null

    // Use trip odometers if available, otherwise use session odometers
    let minOdo = trip?.start_odometer && trip.start_odometer > 0 ? Number(trip.start_odometer) : null
    let maxOdo = trip?.end_odometer && trip.end_odometer > 0 ? Number(trip.end_odometer) : null

    // Fall back to session odometers if trip odometers not available
    if (maxOdo === null && sessionsWithOdo.length > 0) {
      maxOdo = Math.max(...sessionsWithOdo.map((s) => Number(s.odometer_km)))
      if (minOdo === null) {
        minOdo = Math.min(...sessionsWithOdo.map((s) => Number(s.odometer_km)))
      }
    }

    // Only calculate distance if we have a valid max and min
    if (maxOdo !== null && minOdo !== null && maxOdo > minOdo) {
      totalDistance = maxOdo - minOdo

      if (totalDistance > 0) {
        // Use energyUsed when available for efficiency, otherwise fall back to energyCharged
        const energyForEfficiency = energyUsed || energyCharged
        efficiency = energyForEfficiency > 0 ? (energyForEfficiency / totalDistance) * 100 : null

        // Use costUsed when available for costPerKm, otherwise fall back to costCharged
        const costForCalculation = costUsed || costCharged
        if (costForCalculation > 0) {
          costPerKm = costForCalculation / totalDistance
        }
      }
    }

    const avgCostPerKwh = energyCharged > 0 ? costCharged / energyCharged : null

    return {
      // Legacy metrics (for backward compatibility)
      totalCost: costCharged,
      totalEnergy: energyCharged,

      // New dual metrics
      energyCharged,
      costCharged,
      energyUsed,
      costUsed,

      // Existing metrics (now using used energy when available)
      totalDistance,
      efficiency,
      costPerKm,
      sessionCount,

      // New metadata
      batteryChangePct,
      batteryChangeKwh,
      avgCostPerKwh,
      hasBatteryData,
    }
  }

  /**
   * Assign a session to a trip
   * @param {string} sessionId - The session ID
   * @param {number} tripId - The trip ID
   * @returns {Promise<void>}
   */
  async assignSessionToTrip(sessionId, tripId) {
    await db.sessions.update(sessionId, { trip_id: tripId })
  }

  /**
   * Remove a session from its trip
   * @param {string} sessionId - The session ID
   * @returns {Promise<void>}
   */
  async unassignSessionFromTrip(sessionId) {
    await db.sessions.update(sessionId, { trip_id: null })
  }

  /**
   * Update a trip
   * @param {number} tripId - The trip ID
   * @param {Object} changes - The changes to apply
   * @returns {Promise<void>}
   */
  async updateTrip(tripId, changes) {
    const now = new Date().toISOString()
    await db.trips.update(tripId, { ...changes, updated_at: now })
  }

  /**
   * Delete a trip (local only - use syncManager.deleteTrip for full sync)
   * @param {string} tripId - The trip ID
   * @returns {Promise<void>}
   */
  async deleteTrip(tripId) {
    // Unassign all sessions from this trip first
    const sessions = await db.sessions.where('trip_id').equals(tripId).toArray()
    for (const session of sessions) {
      await this.unassignSessionFromTrip(session.id)
    }
    await db.trips.delete(tripId)
  }

  /**
   * Get all trips
   * @returns {Promise<Array>} Array of all trips
   */
  async getAllTrips() {
    await ensureDatabaseOpen()
    return await db.trips.orderBy('started_at').reverse().toArray()
  }

  /**
   * Get a trip by ID
   * @param {number} tripId - The trip ID
   * @returns {Promise<Object|null>} The trip or null
   */
  async getTrip(tripId) {
    await ensureDatabaseOpen()
    return await db.trips.get(tripId)
  }
}

export const tripManager = new TripManager()
