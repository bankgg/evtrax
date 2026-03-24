import { useMemo, useState, useEffect } from 'react'
import { Card, Statistic, Row, Col, Tag, Empty, Typography, Divider, Spin, Segmented, DatePicker } from 'antd'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
    ThunderboltOutlined,
    DollarOutlined,
    DashboardOutlined,
    FireOutlined,
    CarOutlined,
    ShareAltOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSessions } from '../hooks/useSessions'
import { useTrips } from '../hooks/useTrips'
import { db } from '../lib/db'
import ReportModal from '../components/ReportModal'

const { Title, Text } = Typography
const BATTERY_KWH = 58.9

const RANGE_OPTIONS = ['Month', 'Prev', 'Custom', 'All']

function getDateRange(preset) {
    const now = dayjs()
    switch (preset) {
        case 'Month': return [now.startOf('month'), now.endOf('month')]
        case 'Prev': return [now.subtract(1, 'month').startOf('month'), now.subtract(1, 'month').endOf('month')]
        default: return null
    }
}

export default function Dashboard() {
    const { sessions, loading } = useSessions()
    const { trips } = useTrips()
    const [rangePreset, setRangePreset] = useState(() => localStorage.getItem('evtrax_range') || 'Month')
    const [customRange, setCustomRange] = useState(null)
    const [rangeOpen, setRangeOpen] = useState(false)
    const [reportOpen, setReportOpen] = useState(false)

    // Build trips map for efficient lookup
    const tripsMap = useMemo(() => {
        const map = new Map()
        trips.forEach(trip => map.set(trip.id, trip))
        return map
    }, [trips])

    const handleCustomChange = (dates) => {
        setCustomRange(dates)
        if (dates && dates[0] && dates[1]) {
            setRangeOpen(false)
        }
    }

    const handleRangeChange = (val) => {
        setRangePreset(val)
        localStorage.setItem('evtrax_range', val)
    }

    const dateRange = useMemo(() => {
        if (rangePreset === 'Custom') return customRange
        return getDateRange(rangePreset)
    }, [rangePreset, customRange])

    const filtered = useMemo(() => {
        if (!dateRange) return sessions
        const [start, end] = dateRange
        return sessions.filter((s) => {
            const d = dayjs(s.started_at)
            return d.isAfter(start.startOf('day')) && d.isBefore(end.endOf('day'))
        })
    }, [sessions, dateRange])

    const chartData = useMemo(() => {
        const sorted = [...sessions].sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
        const data = []

        for (let i = 1; i < sorted.length; i++) {
            const prevSession = sorted[i - 1]
            const currSession = sorted[i]

            const prevOdo = Number(prevSession.odometer_km)
            const currOdo = Number(currSession.odometer_km)

            // Calculate distance between sessions
            if (prevOdo > 0 && currOdo > 0 && currOdo > prevOdo) {
                const distance = currOdo - prevOdo

                // Calculate energy used from battery drop
                const prevEndSoc = prevSession.end_soc_pct
                const currStartSoc = currSession.start_soc_pct

                if (prevEndSoc != null && currStartSoc != null) {
                    const batteryDrop = Number(prevEndSoc) - Number(currStartSoc)
                    if (batteryDrop > 0) {
                        const energyUsed = (batteryDrop / 100) * BATTERY_KWH
                        const efficiency = (energyUsed / distance) * 100
                        data.push({
                            date: currSession.started_at,
                            efficiency: Number(efficiency.toFixed(1)),
                            formattedDate: dayjs(currSession.started_at).format('MMM D'),
                        })
                    }
                }
            }
        }

        if (!dateRange || !dateRange[0] || !dateRange[1]) return data
        const [start, end] = dateRange
        return data.filter((d) => {
            const dt = dayjs(d.date)
            return dt.isAfter(start.startOf('day')) && dt.isBefore(end.endOf('day'))
        })
    }, [sessions, dateRange])

    const stats = useMemo(() => {
        if (!filtered.length) return null

        const totalCost = filtered.reduce((sum, s) => sum + (Number(s.total_cost) || 0), 0)
        const totalEnergyCharged = filtered.reduce((sum, s) => sum + (Number(s.energy_kwh) || 0), 0)
        const avgCostPerKwh = totalEnergyCharged > 0 ? totalCost / totalEnergyCharged : 0
        const totalSessions = filtered.length

        // Odometer-derived stats - account for trip start odometers
        const sessionsWithOdo = filtered.filter((s) => s.odometer_km != null)
        let totalDistance = null
        let efficiency = null
        let costPerKm = null
        let totalEnergyUsed = null

        const BATTERY_KWH = 58.9

        if (sessionsWithOdo.length >= 1) {
            // Group sessions by trip to calculate accurate distances and battery-aware energy/cost
            const sessionsByTrip = new Map()

            // First, group sessions by trip_id
            filtered.forEach(session => {
                const tripId = session.trip_id
                if (!sessionsByTrip.has(tripId)) {
                    sessionsByTrip.set(tripId, [])
                }
                sessionsByTrip.get(tripId).push(session)
            })

            // Calculate distance, energy and cost for each trip group
            let calculatedDistance = 0
            let calculatedEnergyUsed = 0
            let calculatedCostUsed = 0

            for (const [tripId, tripSessions] of sessionsByTrip) {
                const sessionsWithOdoInTrip = tripSessions.filter((s) => s.odometer_km != null)

                if (sessionsWithOdoInTrip.length === 0) continue

                // Calculate energy and cost for this trip
                const tripEnergyCharged = tripSessions.reduce((sum, s) => sum + (Number(s.energy_kwh) || 0), 0)
                const tripCostCharged = tripSessions.reduce((sum, s) => sum + (Number(s.total_cost) || 0), 0)
                let tripEnergyUsed = tripEnergyCharged // default to charged
                let tripCostUsed = tripCostCharged // default to charged

                // If trip has battery data, calculate actual energy used from battery drop
                if (tripId && tripsMap.has(tripId)) {
                    const trip = tripsMap.get(tripId)
                    if (trip.start_battery_pct != null && trip.end_battery_pct != null) {
                        // Energy used = battery drop percentage × battery capacity
                        const batteryDropPct = Number(trip.start_battery_pct) - Number(trip.end_battery_pct)
                        tripEnergyUsed = (batteryDropPct / 100) * BATTERY_KWH

                        // Calculate cost used based on energy used ratio
                        const avgCostPerKwh = tripEnergyCharged > 0 ? tripCostCharged / tripEnergyCharged : 0
                        tripCostUsed = tripEnergyUsed > 0 ? tripEnergyUsed * avgCostPerKwh : 0
                    }
                } else {
                    // No trip assigned - calculate energy used from battery drop between consecutive sessions
                    const sortedSessions = [...tripSessions].sort((a, b) =>
                        new Date(a.started_at) - new Date(b.started_at)
                    )

                    let energyFromBatteryDrop = 0
                    for (let i = 1; i < sortedSessions.length; i++) {
                        const prevSession = sortedSessions[i - 1]
                        const currSession = sortedSessions[i]

                        // Sessions use start_soc_pct and end_soc_pct (SoC = State of Charge)
                        // Energy used = (prev end SoC - curr start SoC) × capacity
                        const prevEndSoc = prevSession.end_soc_pct
                        const currStartSoc = currSession.start_soc_pct

                        if (prevEndSoc != null && currStartSoc != null) {
                            const batteryDrop = Number(prevEndSoc) - Number(currStartSoc)
                            if (batteryDrop > 0) {
                                energyFromBatteryDrop += (batteryDrop / 100) * BATTERY_KWH
                            }
                        }
                    }

                    if (energyFromBatteryDrop > 0) {
                        tripEnergyUsed = energyFromBatteryDrop
                        const avgCostPerKwh = tripEnergyCharged > 0 ? tripCostCharged / tripEnergyCharged : 0
                        tripCostUsed = tripEnergyUsed * avgCostPerKwh
                    }
                }

                calculatedEnergyUsed += tripEnergyUsed
                calculatedCostUsed += tripCostUsed

                // Calculate distance for this trip
                if (tripId && tripsMap.has(tripId)) {
                    // Use trip's odometers
                    const trip = tripsMap.get(tripId)
                    const startOdo = trip.start_odometer && trip.start_odometer > 0 ? Number(trip.start_odometer) : null
                    const endOdo = trip.end_odometer && trip.end_odometer > 0 ? Number(trip.end_odometer) : null

                    if (startOdo != null && endOdo != null && endOdo > startOdo) {
                        calculatedDistance += (endOdo - startOdo)
                    } else if (startOdo != null) {
                        // Use max from sessions if no end odometer
                        const maxOdo = Math.max(...sessionsWithOdoInTrip.map((s) => Number(s.odometer_km)))
                        if (maxOdo > startOdo) {
                            calculatedDistance += (maxOdo - startOdo)
                        }
                    }
                } else if (sessionsWithOdoInTrip.length >= 2) {
                    // No trip - use min/max from sessions
                    const maxOdo = Math.max(...sessionsWithOdoInTrip.map((s) => Number(s.odometer_km)))
                    const minOdo = Math.min(...sessionsWithOdoInTrip.map((s) => Number(s.odometer_km)))
                    if (maxOdo > minOdo) {
                        calculatedDistance += (maxOdo - minOdo)
                    }
                }
            }

            if (calculatedDistance > 0) {
                totalDistance = calculatedDistance
                totalEnergyUsed = calculatedEnergyUsed
                efficiency = (totalEnergyUsed / totalDistance) * 100
                if (calculatedCostUsed > 0) {
                    costPerKm = calculatedCostUsed / totalDistance
                }
            }
        }

        return {
            totalCost,
            totalEnergy: totalEnergyCharged, // Show total charged energy in summary
            avgCostPerKwh,
            totalSessions,
            totalDistance,
            efficiency, // Efficiency uses battery-drop calculation internally
            costPerKm,
        }
    }, [filtered, tripsMap])

    const recentSessions = filtered.slice(0, 5)



    if (loading) {
        return (
            <div className="page-container" style={{ textAlign: 'center', paddingTop: 64 }}>
                <Spin size="large" />
            </div>
        )
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>
                    <DashboardOutlined /> Dashboard
                </Title>
                {stats && (
                    <button
                        className="report-trigger-btn"
                        onClick={() => setReportOpen(true)}
                        aria-label="Generate Report"
                    >
                        <ShareAltOutlined />
                    </button>
                )}
            </div>

            <Segmented
                value={rangePreset}
                onChange={handleRangeChange}
                options={RANGE_OPTIONS}
                block
                style={{ marginBottom: rangePreset === 'Custom' ? 8 : 16 }}
            />

            {rangePreset === 'Custom' && (
                <DatePicker.RangePicker
                    value={customRange}
                    onChange={handleCustomChange}
                    open={rangeOpen}
                    onOpenChange={setRangeOpen}
                    style={{ width: '100%', marginBottom: 16 }}
                    size="large"
                    popupClassName="single-panel-range"
                />
            )}

            {!stats ? (
                <Empty
                    description={dateRange ? 'No sessions in this range' : 'No charging sessions yet'}
                    style={{ marginTop: 48 }}
                />
            ) : (
                <>
                    {/* Summary */}
                    <div className="stats-section">
                        <Text className="section-label">
                            {dateRange ? `${dateRange[0].format('D MMM')} – ${dateRange[1].format('D MMM YYYY')}` : 'All Time'}
                        </Text>
                        <Row gutter={[12, 12]}>
                            <Col span={12}>
                                <Card className="stat-card stat-card--cost" size="small">
                                    <Statistic
                                        title="Cost"
                                        value={stats.totalCost}
                                        precision={2}
                                        prefix="฿"
                                        styles={{ content: { color: '#52c41a', fontSize: 22 } }}
                                    />
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card className="stat-card stat-card--energy" size="small">
                                    <Statistic
                                        title="Energy"
                                        value={stats.totalEnergy}
                                        precision={1}
                                        suffix="kWh"
                                        styles={{ content: { color: '#1890ff', fontSize: 22 } }}
                                    />
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card className="stat-card" size="small">
                                    <Statistic
                                        title="Sessions"
                                        value={stats.totalSessions}
                                        styles={{ content: { fontSize: 22 } }}
                                    />
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card className="stat-card" size="small">
                                    <Statistic
                                        title="Avg ฿/kWh"
                                        value={stats.avgCostPerKwh}
                                        precision={2}
                                        prefix="฿"
                                        styles={{ content: { fontSize: 22 } }}
                                    />
                                </Card>
                            </Col>
                        </Row>
                    </div>

                    {/* Efficiency — only shown when odometer data is available */}
                    {stats.totalDistance != null && (
                        <div className="stats-section">
                            <Text className="section-label">Efficiency</Text>
                            <Row gutter={[12, 12]}>
                                <Col span={8}>
                                    <Card className="stat-card stat-card--efficiency" size="small">
                                        <Statistic
                                            title="Distance"
                                            value={stats.totalDistance}
                                            precision={0}
                                            suffix="km"
                                            prefix={<CarOutlined />}
                                            styles={{ content: { fontSize: 18 } }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card className="stat-card stat-card--energy stat-card--efficiency" size="small">
                                        <Statistic
                                            title="kWh/100km"
                                            value={stats.efficiency}
                                            precision={1}
                                            styles={{ content: { color: '#1890ff', fontSize: 18 } }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card className="stat-card stat-card--cost stat-card--efficiency" size="small">
                                        <Statistic
                                            title="฿/km"
                                            value={stats.costPerKm}
                                            precision={2}
                                            prefix="฿"
                                            styles={{ content: { color: '#52c41a', fontSize: 18 } }}
                                        />
                                    </Card>
                                </Col>
                            </Row>
                        </div>
                    )}

                    {/* Efficiency Chart */}
                    {chartData.length > 0 && (
                        <div className="stats-section" style={{ marginTop: 24, marginBottom: 24 }}>
                            <Text className="section-label">Efficiency Trend</Text>
                            <Card size="small" style={{ paddingTop: 24, paddingRight: 24 }}>
                                <div style={{ width: '100%', height: 250 }}>
                                    <ResponsiveContainer>
                                        <LineChart data={chartData} accessibilityLayer={false}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                            <XAxis
                                                dataKey="formattedDate"
                                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                                tickLine={false}
                                                axisLine={false}
                                                minTickGap={20}
                                            />
                                            <YAxis
                                                domain={['auto', 'auto']}
                                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                                tickLine={false}
                                                axisLine={false}
                                                width={40}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--bg-elevated)',
                                                    borderColor: 'var(--border-color)',
                                                    borderRadius: 8,
                                                    color: 'var(--text-primary)'
                                                }}
                                                itemStyle={{ color: '#1890ff' }}
                                                formatter={(value) => [`${value} kWh/100km`, 'Efficiency']}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="efficiency"
                                                stroke="#1890ff"
                                                strokeWidth={3}
                                                dot={{ fill: '#1890ff', strokeWidth: 2, r: 4 }}
                                                activeDot={{ r: 6 }}
                                                animationDuration={1500}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Recent Sessions */}
                    <Divider style={{ borderColor: 'var(--border-color)' }} />
                    <Text className="section-label">Recent Sessions</Text>
                    <div className="recent-sessions-list">
                        {recentSessions.map((session) => (
                            <div key={session.id} className="session-list-item">
                                <div className="session-item-content">
                                    <div className="session-item-left">
                                        <Tag
                                            color={session.charging_type === 'dc' ? 'blue' : 'green'}
                                            style={{ marginRight: 8, fontWeight: 600 }}
                                        >
                                            {session.charging_type === 'dc' ? '⚡ DC' : '🏠 AC'}
                                        </Tag>
                                        <div>
                                            <Text strong style={{ color: 'var(--text-primary)' }}>
                                                {session.location || (session.charging_type === 'ac' ? 'Home' : 'Station')}
                                            </Text>
                                            <br />
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {dayjs(session.started_at).format('D MMM · HH:mm')}
                                            </Text>
                                        </div>
                                    </div>
                                    <div className="session-item-right">
                                        {session.total_cost != null && (
                                            <Text strong style={{ color: 'var(--text-primary)', fontSize: 16 }}>
                                                ฿{Number(session.total_cost).toFixed(2)}
                                            </Text>
                                        )}
                                        {session.energy_kwh != null && (
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {Number(session.energy_kwh).toFixed(1)} kWh
                                            </Text>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <ReportModal
                open={reportOpen}
                onClose={() => setReportOpen(false)}
                stats={stats}
                dateRange={dateRange}
                hasEfficiency={stats?.totalDistance != null}
            />
        </div>
    )
}
