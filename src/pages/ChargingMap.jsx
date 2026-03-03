import { useMemo, useState } from 'react'
import { Typography, Empty, Card, Tag, Spin } from 'antd'
import { EnvironmentOutlined, ThunderboltOutlined, DollarOutlined } from '@ant-design/icons'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useSessions } from '../hooks/useSessions'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// Fix default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const dcIcon = new L.DivIcon({
    className: 'custom-marker',
    html: '<div style="background:#00b96b;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:2px solid #fff;">⚡</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
})

const acIcon = new L.DivIcon({
    className: 'custom-marker',
    html: '<div style="background:#1677ff;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:2px solid #fff;">🏠</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
})

export default function ChargingMap() {
    const { sessions, loading } = useSessions()

    const geoSessions = useMemo(() =>
        sessions.filter((s) => s.lat && s.lng),
        [sessions]
    )

    // Group sessions by location name for analytics
    const locationStats = useMemo(() => {
        const map = {}
        geoSessions.forEach((s) => {
            const key = s.location || 'Unknown'
            if (!map[key]) {
                map[key] = {
                    name: key,
                    lat: s.lat,
                    lng: s.lng,
                    sessions: [],
                    totalCost: 0,
                    totalKwh: 0,
                    types: new Set(),
                }
            }
            map[key].sessions.push(s)
            map[key].totalCost += s.total_cost || 0
            map[key].totalKwh += s.energy_kwh || 0
            map[key].types.add(s.charging_type)
            // Use the latest coordinates for this location
            map[key].lat = s.lat
            map[key].lng = s.lng
        })
        return Object.values(map).sort((a, b) => b.sessions.length - a.sessions.length)
    }, [geoSessions])

    // Center map on the average of all locations, default to Bangkok
    const center = useMemo(() => {
        if (geoSessions.length === 0) return [13.7563, 100.5018]
        const avgLat = geoSessions.reduce((s, g) => s + g.lat, 0) / geoSessions.length
        const avgLng = geoSessions.reduce((s, g) => s + g.lng, 0) / geoSessions.length
        return [avgLat, avgLng]
    }, [geoSessions])

    if (loading) {
        return (
            <div className="page-container" style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}>
                <Spin size="large" />
            </div>
        )
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>
                    <EnvironmentOutlined /> Charging Map
                </Title>
                <Text type="secondary">{geoSessions.length} pinned session{geoSessions.length !== 1 ? 's' : ''}</Text>
            </div>

            {geoSessions.length === 0 ? (
                <Empty description="No sessions with GPS data yet" style={{ marginTop: 40 }} />
            ) : (
                <>
                    <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 16, height: 300 }}>
                        <MapContainer
                            center={center}
                            zoom={11}
                            style={{ height: '100%', width: '100%' }}
                            scrollWheelZoom={true}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {locationStats.map((loc) => (
                                <Marker
                                    key={loc.name}
                                    position={[loc.lat, loc.lng]}
                                    icon={loc.types.has('dc') ? dcIcon : acIcon}
                                >
                                    <Popup>
                                        <div style={{ minWidth: 160 }}>
                                            <strong>{loc.name}</strong><br />
                                            <span>⚡ {loc.sessions.length} session{loc.sessions.length !== 1 ? 's' : ''}</span><br />
                                            <span>🔋 {loc.totalKwh.toFixed(1)} kWh total</span><br />
                                            <span>💰 ฿{loc.totalCost.toFixed(0)} total</span><br />
                                            <span style={{ fontSize: 11, color: '#888' }}>
                                                Last: {dayjs(loc.sessions[0].started_at).format('D MMM YYYY')}
                                            </span>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>

                    {/* Location Analytics */}
                    <Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
                        📊 Location Breakdown
                    </Title>

                    {locationStats.map((loc) => {
                        const avgCostPerKwh = loc.totalKwh > 0 ? loc.totalCost / loc.totalKwh : 0
                        return (
                            <Card
                                key={loc.name}
                                size="small"
                                className="form-section-card"
                                style={{ marginBottom: 8 }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <Text strong style={{ fontSize: 14 }}>
                                            {loc.types.has('dc') ? '⚡' : '🏠'} {loc.name}
                                        </Text>
                                        <br />
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {loc.sessions.length} visit{loc.sessions.length !== 1 ? 's' : ''}
                                            {' · '}
                                            {loc.totalKwh.toFixed(1)} kWh
                                            {avgCostPerKwh > 0 && ` · ฿${avgCostPerKwh.toFixed(2)}/kWh`}
                                        </Text>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <Text strong style={{ fontSize: 16, color: '#00b96b' }}>
                                            ฿{loc.totalCost.toFixed(0)}
                                        </Text>
                                        <br />
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            total spent
                                        </Text>
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </>
            )}
        </div>
    )
}
