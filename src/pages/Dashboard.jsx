import { useMemo, useState } from 'react'
import { Card, Statistic, Row, Col, Tag, Empty, Typography, Divider, Spin, Segmented, DatePicker } from 'antd'
import {
    ThunderboltOutlined,
    DollarOutlined,
    DashboardOutlined,
    FireOutlined,
    CarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSessions } from '../hooks/useSessions'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const BATTERY_KWH = 58.9

const RANGE_OPTIONS = ['Month', 'Prev', '3M', 'Custom', 'All']

function getDateRange(preset) {
    const now = dayjs()
    switch (preset) {
        case 'Month': return [now.startOf('month'), now.endOf('month')]
        case 'Prev': return [now.subtract(1, 'month').startOf('month'), now.subtract(1, 'month').endOf('month')]
        case '3M': return [now.subtract(3, 'month').startOf('month'), now.endOf('month')]
        default: return null
    }
}

export default function Dashboard() {
    const { sessions, loading } = useSessions()
    const [rangePreset, setRangePreset] = useState(() => localStorage.getItem('evtrax_range') || 'Month')
    const [customRange, setCustomRange] = useState(null)

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

    const stats = useMemo(() => {
        if (!filtered.length) return null

        const totalCost = filtered.reduce((sum, s) => sum + (Number(s.total_cost) || 0), 0)
        const totalEnergy = filtered.reduce((sum, s) => sum + (Number(s.energy_kwh) || 0), 0)
        const avgCostPerKwh = totalEnergy > 0 ? totalCost / totalEnergy : 0
        const totalSessions = filtered.length

        // Odometer-derived stats
        const sessionsWithOdo = filtered.filter((s) => s.odometer_km != null)
        let totalDistance = null
        let efficiency = null
        let costPerKm = null

        if (sessionsWithOdo.length >= 2) {
            const maxOdo = Math.max(...sessionsWithOdo.map((s) => Number(s.odometer_km)))
            const minOdo = Math.min(...sessionsWithOdo.map((s) => Number(s.odometer_km)))
            totalDistance = maxOdo - minOdo

            if (totalDistance > 0) {
                efficiency = (totalEnergy / totalDistance) * 100
                if (totalCost > 0) {
                    costPerKm = totalCost / totalDistance
                }
            }
        }

        return {
            totalCost,
            totalEnergy,
            avgCostPerKwh,
            totalSessions,
            totalDistance,
            efficiency,
            costPerKm,
        }
    }, [filtered])

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
            </div>

            <Segmented
                value={rangePreset}
                onChange={handleRangeChange}
                options={RANGE_OPTIONS}
                block
                style={{ marginBottom: rangePreset === 'Custom' ? 8 : 16 }}
            />

            {rangePreset === 'Custom' && (
                <RangePicker
                    value={customRange}
                    onChange={setCustomRange}
                    style={{ width: '100%', marginBottom: 16 }}
                    size="large"
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
                                    <Card className="stat-card" size="small">
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
                                    <Card className="stat-card stat-card--energy" size="small">
                                        <Statistic
                                            title="kWh/100km"
                                            value={stats.efficiency}
                                            precision={1}
                                            styles={{ content: { color: '#1890ff', fontSize: 18 } }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card className="stat-card stat-card--cost" size="small">
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
        </div>
    )
}
