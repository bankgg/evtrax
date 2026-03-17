import { db } from './db'

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
    const trip = await db.trips.get(tripId)
    if (!trip) return null

    const sessions = await db.sessions.where('trip_id').equals(tripId).toArray()
    return { ...trip, sessions }
  }

  /**
   * Calculate trip statistics
   * @param {number} tripId - The trip ID
   * @returns {Promise<Object>} Statistics object
   */
  async calculateTripStats(tripId) {
    const trip = await db.trips.get(tripId)
    const sessions = await db.sessions.where('trip_id').equals(tripId).toArray()

    if (!sessions || sessions.length === 0) {
      return {
        totalCost: 0,
        totalEnergy: 0,
        totalDistance: null,
        efficiency: null,
        costPerKm: null,
        sessionCount: 0,
      }
    }

    const totalCost = sessions.reduce((sum, s) => sum + (Number(s.total_cost) || 0), 0)
    const totalEnergy = sessions.reduce((sum, s) => sum + (Number(s.energy_kwh) || 0), 0)
    const sessionCount = sessions.length

    // Odometer-derived stats
    const sessionsWithOdo = sessions.filter((s) => s.odometer_km != null && s.odometer_km > 0)
    let totalDistance = null
    let efficiency = null
    let costPerKm = null

    // Use start odometer if available, otherwise use min from sessions
    let minOdo = trip?.start_odometer && trip.start_odometer > 0 ? Number(trip.start_odometer) : null
    let maxOdo = null

    if (sessionsWithOdo.length > 0) {
      maxOdo = Math.max(...sessionsWithOdo.map((s) => Number(s.odometer_km)))
      if (minOdo === null) {
        minOdo = Math.min(...sessionsWithOdo.map((s) => Number(s.odometer_km)))
      }

      // Only calculate distance if we have a valid max and min
      if (maxOdo !== null && minOdo !== null && maxOdo > minOdo) {
        totalDistance = maxOdo - minOdo

        if (totalDistance > 0) {
          efficiency = totalEnergy > 0 ? (totalEnergy / totalDistance) * 100 : null
          if (totalCost > 0) {
            costPerKm = totalCost / totalDistance
          }
        }
      }
    }

    return {
      totalCost,
      totalEnergy,
      totalDistance,
      efficiency,
      costPerKm,
      sessionCount,
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
    return await db.trips.orderBy('started_at').reverse().toArray()
  }

  /**
   * Get a trip by ID
   * @param {number} tripId - The trip ID
   * @returns {Promise<Object|null>} The trip or null
   */
  async getTrip(tripId) {
    return await db.trips.get(tripId)
  }
}

export const tripManager = new TripManager()
