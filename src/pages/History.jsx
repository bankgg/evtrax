import { useState, useMemo, useEffect } from 'react'
import { Tag, Typography, Empty, Input, Button, Popconfirm, Spin, Segmented, DatePicker, message, Select } from 'antd'
import {
    SearchOutlined,
    DeleteOutlined,
    EditOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import { useSessions } from '../hooks/useSessions'
import { useTrips } from '../hooks/useTrips'
import { syncManager } from '../lib/syncManager'
import { db } from '../lib/db'

dayjs.extend(duration)

const { Title, Text } = Typography

function formatDuration(startedAt, endedAt) {
    const start = dayjs(startedAt)
    const end = dayjs(endedAt)
    const diff = dayjs.duration(end.diff(start))
    const hours = Math.floor(diff.asHours())
    const minutes = diff.minutes()
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
}

const RANGE_OPTIONS = ['Month', 'Prev', 'Custom', 'All']

function getDateRange(preset) {
    const now = dayjs()
    switch (preset) {
        case 'Month': return [now.startOf('month'), now.endOf('month')]
        case 'Prev': return [now.subtract(1, 'month').startOf('month'), now.subtract(1, 'month').endOf('month')]
        default: return null
    }
}

export default function History({ onEdit }) {
    const { sessions, loading } = useSessions()
    const { trips } = useTrips()
    const [search, setSearch] = useState('')
    const [rangePreset, setRangePreset] = useState(() => localStorage.getItem('evtrax_range') || 'Month')
    const [customRange, setCustomRange] = useState(null)
    const [rangeOpen, setRangeOpen] = useState(false)
    const [tripFilter, setTripFilter] = useState(null)
    const [tripsMap, setTripsMap] = useState(new Map())

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
    const [messageApi, contextHolder] = message.useMessage()

    // Build a map of session id → previous session's odometer (chronologically)
    const prevOdometerMap = useMemo(() => {
        const map = {}
        // sessions are sorted by started_at DESC, so iterate in reverse for chronological order
        const sorted = [...sessions].reverse()
        let lastOdo = null
        for (const s of sorted) {
            if (s.odometer_km != null) {
                map[s.id] = lastOdo
                lastOdo = Number(s.odometer_km)
            }
        }
        return map
    }, [sessions])

    // Build trips map for easy lookup
    useEffect(() => {
        const map = new Map()
        trips.forEach(trip => map.set(trip.id, trip))
        setTripsMap(map)
    }, [trips])

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

        // Trip filter
        if (tripFilter !== null) {
            if (tripFilter === 'unassigned') {
                result = result.filter((s) => !s.trip_id)
            } else {
                result = result.filter((s) => s.trip_id === tripFilter)
            }
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
    }, [sessions, dateRange, search, tripFilter])

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
                <DatePicker.RangePicker
                    value={customRange}
                    onChange={handleCustomChange}
                    open={rangeOpen}
                    onOpenChange={setRangeOpen}
                    style={{ width: '100%', marginBottom: 8 }}
                    size="large"
                    popupClassName="single-panel-range"
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

            <Select
                placeholder="Filter by trip"
                value={tripFilter}
                onChange={setTripFilter}
                allowClear
                size="large"
                style={{ width: '100%', marginBottom: 8 }}
                options={[
                    { value: 'unassigned', label: 'Unassigned' },
                    ...trips.map(trip => ({ value: trip.id, label: trip.name })),
                ]}
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
                                            {session.trip_id && tripsMap.has(session.trip_id) && (
                                                <Tag
                                                    icon={<CarOutlined />}
                                                    color="purple"
                                                    style={{ fontWeight: 500, fontSize: 12 }}
                                                >
                                                    {tripsMap.get(session.trip_id)?.name}
                                                </Tag>
                                            )}
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
                                        {session.odometer_km != null && (() => {
                                            const currentOdo = Number(session.odometer_km)
                                            const prevOdo = prevOdometerMap[session.id]
                                            const distance = prevOdo != null ? currentOdo - prevOdo : null
                                            return (
                                                <span className="stat-chip">
                                                    🚗{' '}
                                                    {prevOdo != null ? (
                                                        <>
                                                            {prevOdo.toLocaleString()} → {currentOdo.toLocaleString()} km
                                                            {distance > 0 && (
                                                                <span style={{ opacity: 0.65, marginLeft: 4 }}>
                                                                    · {distance.toLocaleString()} km
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>{currentOdo.toLocaleString()} km</>
                                                    )}
                                                </span>
                                            )
                                        })()}
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
