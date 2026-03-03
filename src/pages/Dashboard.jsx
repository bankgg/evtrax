import { useMemo } from 'react'
import { Card, Statistic, Row, Col, Tag, Empty, Typography, Divider, Spin } from 'antd'
import {
    ThunderboltOutlined,
    DollarOutlined,
    DashboardOutlined,
    FireOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSessions } from '../hooks/useSessions'

const { Title, Text } = Typography
const BATTERY_KWH = 58.9

export default function Dashboard() {
    const { sessions, loading } = useSessions()

    const stats = useMemo(() => {
        if (!sessions.length) return null

        const totalCost = sessions.reduce((sum, s) => sum + (Number(s.total_cost) || 0), 0)
        const totalEnergy = sessions.reduce((sum, s) => sum + (Number(s.energy_kwh) || 0), 0)
        const avgCostPerKwh = totalEnergy > 0 ? totalCost / totalEnergy : 0
        const totalSessions = sessions.length

        // Current month stats
        const thisMonth = dayjs().startOf('month')
        const monthSessions = sessions.filter((s) => dayjs(s.started_at).isAfter(thisMonth))
        const monthCost = monthSessions.reduce((sum, s) => sum + (Number(s.total_cost) || 0), 0)
        const monthEnergy = monthSessions.reduce((sum, s) => sum + (Number(s.energy_kwh) || 0), 0)

        return {
            totalCost,
            totalEnergy,
            avgCostPerKwh,
            totalSessions,
            monthCost,
            monthEnergy,
            monthSessions: monthSessions.length,
        }
    }, [sessions])

    const recentSessions = sessions.slice(0, 5)

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
                <Text type="secondary">{dayjs().format('MMMM YYYY')}</Text>
            </div>

            {!stats ? (
                <Empty
                    description="No charging sessions yet"
                    style={{ marginTop: 48 }}
                />
            ) : (
                <>
                    {/* This Month */}
                    <div className="stats-section">
                        <Text className="section-label">This Month</Text>
                        <Row gutter={[12, 12]}>
                            <Col span={12}>
                                <Card className="stat-card stat-card--cost" size="small">
                                    <Statistic
                                        title="Cost"
                                        value={stats.monthCost}
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
                                        value={stats.monthEnergy}
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
                                        value={stats.monthSessions}
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

                    {/* All-time */}
                    <div className="stats-section">
                        <Text className="section-label">All Time</Text>
                        <Row gutter={[12, 12]}>
                            <Col span={8}>
                                <Card className="stat-card" size="small">
                                    <Statistic
                                        title="Total ฿"
                                        value={stats.totalCost}
                                        precision={0}
                                        prefix={<DollarOutlined />}
                                        styles={{ content: { fontSize: 18 } }}
                                    />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card className="stat-card" size="small">
                                    <Statistic
                                        title="kWh"
                                        value={stats.totalEnergy}
                                        precision={0}
                                        prefix={<ThunderboltOutlined />}
                                        styles={{ content: { fontSize: 18 } }}
                                    />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card className="stat-card" size="small">
                                    <Statistic
                                        title="Charges"
                                        value={stats.totalSessions}
                                        prefix={<FireOutlined />}
                                        styles={{ content: { fontSize: 18 } }}
                                    />
                                </Card>
                            </Col>
                        </Row>
                    </div>

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
