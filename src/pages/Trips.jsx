import { useState, useEffect } from 'react'
import { Card, Button, Typography, Empty, Spin, Space, Badge, Tag, Popconfirm, message } from 'antd'
import {
  CarOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  StopOutlined,
  EyeOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useTrips } from '../hooks/useTrips'
import { tripManager } from '../lib/tripManager'
import { syncManager } from '../lib/syncManager'
import { db } from '../lib/db'
import StartTripModal from '../components/StartTripModal'
import EndTripModal from '../components/EndTripModal'
import TripStatsModal from '../components/TripStatsModal'

const { Title, Text } = Typography

export default function Trips() {
  const { trips, loading, refresh } = useTrips()
  const [activeTrip, setActiveTrip] = useState(null)
  const [startModalVisible, setStartModalVisible] = useState(false)
  const [endModalVisible, setEndModalVisible] = useState(false)
  const [statsModalVisible, setStatsModalVisible] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [selectedTripStats, setSelectedTripStats] = useState(null)
  const [messageApi, contextHolder] = message.useMessage()

  useEffect(() => {
    loadActiveTrip()
  }, [trips])

  const loadActiveTrip = async () => {
    const active = await tripManager.getActiveTrip()
    setActiveTrip(active)
  }

  const handleStartTrip = async (values) => {
    try {
      const trip = await syncManager.saveTrip({
        name: values.tripName,
        started_at: new Date().toISOString(),
        ended_at: null,
        start_odometer: values.startOdometer ?? null,
        start_battery_pct: values.startBatteryPct ?? null,
      })
      messageApi.success(`${values.tripName} started!`)
      refresh()
    } catch (err) {
      messageApi.error('Failed to start trip: ' + err.message)
    }
  }

  const handleEndTrip = async (values) => {
    if (!selectedTrip) return

    try {
      await syncManager.updateTrip(selectedTrip.id, {
        ended_at: new Date().toISOString(),
        end_odometer: values.finalOdometer ?? null,
        end_battery_pct: values.endBatteryPct ?? null,
      })

      messageApi.success(`${selectedTrip.name} ended!`)
      refresh()
      setEndModalVisible(false)
    } catch (err) {
      messageApi.error('Failed to end trip: ' + err.message)
    }
  }

  const handleShowStats = async (trip) => {
    const stats = await tripManager.calculateTripStats(trip.id)
    setSelectedTrip(trip)
    setSelectedTripStats(stats)
    setStatsModalVisible(true)
  }

  const handleEndTripClick = async (trip) => {
    const stats = await tripManager.calculateTripStats(trip.id)
    setSelectedTrip(trip)
    setSelectedTripStats(stats)
    setEndModalVisible(true)
  }

  const handleDeleteTrip = async (tripId) => {
    try {
      // First unassign all sessions from this trip and queue for sync
      const sessions = await db.sessions.where('trip_id').equals(tripId).toArray()
      for (const session of sessions) {
        // Use syncManager to ensure updates are queued for sync
        await syncManager.updateSession(session.id, { trip_id: null })
      }

      // Then delete the trip
      await syncManager.deleteTrip(tripId)
      messageApi.success('Trip deleted')
      refresh()
    } catch (err) {
      messageApi.error('Failed to delete trip: ' + err.message)
    }
  }

  const getTripStatusTag = (trip) => {
    if (!trip.ended_at) {
      return <Tag color="green">Active</Tag>
    }
    return <Tag>Completed</Tag>
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="page-container">
      {contextHolder}

      <div className="page-header">
        <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>
          <CarOutlined /> Trips
        </Title>
      </div>

      {/* Active Trip Card */}
      {activeTrip && (
        <Card
          style={{
            marginBottom: 16,
            background: 'linear-gradient(135deg, #00b96b 0%, #008f54 100%)',
            borderColor: '#00b96b',
          }}
          variant="borderless"
        >
          <div style={{ color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <Title level={4} style={{ margin: 0, color: 'white', flex: 1, minWidth: 0 }}>
                {activeTrip.name}
              </Title>
              <Badge
                count="Active"
                style={{ backgroundColor: 'rgba(255,255,255,0.3)', color: 'white', flexShrink: 0 }}
              />
            </div>
            <Text style={{ color: 'rgba(255,255,255,0.9)' }}>
              Started: {formatDate(activeTrip.started_at)}
            </Text>
            <div style={{ marginTop: 12 }}>
              <Space size="small">
                <Button
                  icon={<EyeOutlined />}
                  onClick={() => handleShowStats(activeTrip)}
                  size="small"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
                >
                  Stats
                </Button>
                <Button
                  icon={<StopOutlined />}
                  onClick={() => handleEndTripClick(activeTrip)}
                  danger
                  size="small"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
                >
                  End
                </Button>
              </Space>
            </div>
          </div>
        </Card>
      )}

      {/* Start New Trip Button */}
      {!activeTrip && (
        <Card style={{ marginBottom: 16, textAlign: 'center' }} variant="borderless">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No active trip"
            style={{ marginBottom: 16 }}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => setStartModalVisible(true)}
            >
              Start New Trip
            </Button>
          </Empty>
        </Card>
      )}

      {/* All Trips List */}
      <Title level={5} style={{ marginTop: 24, marginBottom: 16, color: 'var(--text-primary)' }}>
        All Trips
      </Title>
      {trips.length === 0 ? (
        <Card variant="borderless">
          <Empty description="No trips yet. Start your first trip!" />
        </Card>
      ) : (
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          {trips.map((trip) => (
            <Card
              key={trip.id}
              style={{ background: '#1a1a2e' }}
              variant="borderless"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Text strong style={{ color: 'var(--text-primary)', fontSize: 16 }}>
                      {trip.name}
                    </Text>
                    {getTripStatusTag(trip)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Started: {formatDate(trip.started_at)}
                  </Text>
                  {trip.ended_at && (
                    <>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Ended: {formatDate(trip.ended_at)}
                      </Text>
                    </>
                  )}
                </div>
                <Space size={4}>
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    size="small"
                    onClick={() => handleShowStats(trip)}
                    style={{ flexShrink: 0 }}
                  />
                  {!trip.ended_at && (
                    <Button
                      type="text"
                      icon={<StopOutlined />}
                      size="small"
                      danger
                      onClick={() => handleEndTripClick(trip)}
                      style={{ flexShrink: 0 }}
                    />
                  )}
                  <Popconfirm
                    title="Delete this trip?"
                    description="This will unassign all sessions from this trip."
                    onConfirm={() => handleDeleteTrip(trip.id)}
                    okText="Delete"
                    cancelText="Cancel"
                  >
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      size="small"
                      danger
                      style={{ flexShrink: 0 }}
                    />
                  </Popconfirm>
                </Space>
              </div>
            </Card>
          ))}
        </Space>
      )}

      {/* Modals */}
      <StartTripModal
        visible={startModalVisible}
        onClose={() => setStartModalVisible(false)}
        onStart={handleStartTrip}
      />

      {selectedTrip && (
        <>
          <EndTripModal
            visible={endModalVisible}
            onClose={() => setEndModalVisible(false)}
            onEnd={handleEndTrip}
            trip={selectedTrip}
            stats={selectedTripStats || { sessionCount: 0, totalCost: 0, totalEnergy: 0 }}
          />
          <TripStatsModal
            visible={statsModalVisible}
            onClose={() => setStatsModalVisible(false)}
            trip={selectedTrip}
            stats={selectedTripStats || { sessionCount: 0, totalCost: 0, totalEnergy: 0 }}
          />
        </>
      )}
    </div>
  )
}
