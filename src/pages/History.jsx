import { useState } from 'react'
import { Tag, Typography, Empty, Input, Button, Popconfirm, Spin, message } from 'antd'
import {
    SearchOutlined,
    DeleteOutlined,
    EditOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSessions } from '../hooks/useSessions'
import { syncManager } from '../lib/syncManager'

const { Title, Text } = Typography

export default function History({ onEdit }) {
    const { sessions, loading } = useSessions()
    const [search, setSearch] = useState('')
    const [messageApi, contextHolder] = message.useMessage()

    const filtered = sessions.filter((s) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
            (s.location || '').toLowerCase().includes(q) ||
            (s.provider || '').toLowerCase().includes(q) ||
            (s.note || '').toLowerCase().includes(q) ||
            s.charging_type.includes(q)
        )
    })

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
                <Text type="secondary">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</Text>
            </div>

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
