import { useState, useMemo } from 'react'
import { Tag, Typography, Empty, Input, Button, Popconfirm, Spin, Segmented, DatePicker, message } from 'antd'
import {
    SearchOutlined,
    DeleteOutlined,
    EditOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import { useSessions } from '../hooks/useSessions'
import { syncManager } from '../lib/syncManager'

dayjs.extend(duration)

const { Title, Text } = Typography
const { RangePicker } = DatePicker

function formatDuration(startedAt, endedAt) {
    const start = dayjs(startedAt)
    const end = dayjs(endedAt)
    const diff = dayjs.duration(end.diff(start))
    const hours = Math.floor(diff.asHours())
    const minutes = diff.minutes()
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
}

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

export default function History({ onEdit }) {
    const { sessions, loading } = useSessions()
    const [search, setSearch] = useState('')
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
    const [messageApi, contextHolder] = message.useMessage()

    const filtered = useMemo(() => {
        let result = sessions

        // Date range filter
        if (dateRange) {
            const [start, end] = dateRange
            result = result.filter((s) => {
                const d = dayjs(s.started_at)
                return d.isAfter(start.startOf('day')) && d.isBefore(end.endOf('day'))
            })
        }

        // Text search filter
        if (search) {
            const q = search.toLowerCase()
            result = result.filter((s) =>
                (s.location || '').toLowerCase().includes(q) ||
                (s.provider || '').toLowerCase().includes(q) ||
                (s.note || '').toLowerCase().includes(q) ||
                s.charging_type.includes(q)
            )
        }

        return result
    }, [sessions, dateRange, search])

    const handleDelete = async (id) => {
        await syncManager.deleteSession(id)
        messageApi.success('Session deleted')
    }

    return (
        <div className="page-container">
            {contextHolder}
            <div className="page-header">
                <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>
                    📋 History
                </Title>
                <Text type="secondary">{filtered.length} session{filtered.length !== 1 ? 's' : ''}</Text>
            </div>

            <Segmented
                value={rangePreset}
                onChange={handleRangeChange}
                options={RANGE_OPTIONS}
                block
                style={{ marginBottom: rangePreset === 'Custom' ? 8 : 8 }}
            />

            {rangePreset === 'Custom' && (
                <RangePicker
                    value={customRange}
                    onChange={setCustomRange}
                    style={{ width: '100%', marginBottom: 8 }}
                    size="large"
                />
            )}

            <Input
                prefix={<SearchOutlined />}
                placeholder="Search location, provider, notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                size="large"
                className="search-input"
            />

            {loading ? (
                <div style={{ textAlign: 'center', paddingTop: 48 }}>
                    <Spin size="large" />
                </div>
            ) : filtered.length === 0 ? (
                <Empty description="No sessions found" style={{ marginTop: 48 }} />
            ) : (
                <div className="history-list">
                    {filtered.map((session) => {
                        const isComplete = session.ended_at && session.total_cost != null
                        const hasDuration = session.started_at && session.ended_at
                        return (
                            <div key={session.id} className="history-list-item">
                                <div className="history-card">
                                    <div className="history-card-top">
                                        <div className="history-card-left">
                                            <Tag
                                                color={session.charging_type === 'dc' ? 'blue' : 'green'}
                                                style={{ fontWeight: 600, fontSize: 13 }}
                                            >
                                                {session.charging_type === 'dc' ? '⚡ DC' : '🏠 AC'}
                                            </Tag>
                                            {isComplete ? (
                                                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                                            ) : (
                                                <ClockCircleOutlined style={{ color: '#faad14', fontSize: 12 }} />
                                            )}
                                        </div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {dayjs(session.started_at).format('D MMM YYYY · HH:mm')}
                                        </Text>
                                    </div>

                                    <div className="history-card-body">
                                        <Text strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>
                                            {session.location ||
                                                (session.charging_type === 'ac' ? 'Home' : 'Station')}
                                        </Text>
                                        {session.provider && (
                                            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                                                {session.provider}
                                            </Text>
                                        )}
                                    </div>

                                    <div className="history-card-stats">
                                        {session.energy_kwh != null && (
                                            <span className="stat-chip">
                                                ⚡ {Number(session.energy_kwh).toFixed(1)} kWh
                                            </span>
                                        )}
                                        {session.total_cost != null && (
                                            <span className="stat-chip stat-chip--cost">
                                                ฿{Number(session.total_cost).toFixed(2)}
                                            </span>
                                        )}
                                        {session.start_soc_pct != null && session.end_soc_pct != null && (
                                            <span className="stat-chip">
                                                🔋 {session.start_soc_pct}% → {session.end_soc_pct}%
                                            </span>
                                        )}
                                        {session.price_per_kwh != null && (
                                            <span className="stat-chip">
                                                ฿{Number(session.price_per_kwh).toFixed(2)}/kWh
                                            </span>
                                        )}
                                        {session.odometer_km != null && (
                                            <span className="stat-chip">
                                                🚗 {Number(session.odometer_km).toLocaleString()} km
                                            </span>
                                        )}
                                        {hasDuration && (
                                            <span className="stat-chip">
                                                ⏱ {formatDuration(session.started_at, session.ended_at)}
                                            </span>
                                        )}
                                    </div>

                                    {session.note && (
                                        <Text
                                            type="secondary"
                                            style={{ fontSize: 12, display: 'block', marginTop: 4 }}
                                        >
                                            💬 {session.note}
                                        </Text>
                                    )}

                                    <div className="history-card-actions">
                                        <Button
                                            type="text"
                                            icon={<EditOutlined />}
                                            size="small"
                                            onClick={() => onEdit(session.id)}
                                        >
                                            Edit
                                        </Button>
                                        <Popconfirm
                                            title="Delete this session?"
                                            onConfirm={() => handleDelete(session.id)}
                                            okText="Delete"
                                            okType="danger"
                                        >
                                            <Button
                                                type="text"
                                                danger
                                                icon={<DeleteOutlined />}
                                                size="small"
                                            >
                                                Delete
                                            </Button>
                                        </Popconfirm>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
