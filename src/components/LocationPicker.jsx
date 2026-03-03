import { useState, useCallback, useEffect } from 'react'
import { Button, Typography } from 'antd'
import { AimOutlined, CheckOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const { Text } = Typography

function CenterTracker({ onCenterChange }) {
    const map = useMapEvents({
        moveend() {
            const center = map.getCenter()
            onCenterChange({ lat: center.lat, lng: center.lng })
        },
    })

    // Trigger an initial change so the state reflects the starting center immediately
    useEffect(() => {
        const center = map.getCenter()
        onCenterChange({ lat: center.lat, lng: center.lng })
    }, [map, onCenterChange])

    return null
}

function LocateControl() {
    const map = useMap()

    const handleLocate = useCallback(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords
                map.flyTo([latitude, longitude], 16, { duration: 1 })
            },
            () => { },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }, [map])

    return (
        <button
            onClick={handleLocate}
            style={{
                position: 'absolute',
                bottom: 80,
                right: 12,
                zIndex: 1000,
                background: '#1a1a2e',
                border: '2px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#00b96b',
                fontSize: 20,
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
            title="Locate me"
        >
            <AimOutlined />
        </button>
    )
}

export default function LocationPicker({ initialCoords, onConfirm, onCancel }) {
    const center = initialCoords
        ? [initialCoords.lat, initialCoords.lng]
        : [13.7563, 100.5018] // Default Bangkok

    const [selected, setSelected] = useState(() => ({
        lat: center[0],
        lng: center[1],
    }))

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: '#0d0d1a',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#1a1a2e',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
                <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    onClick={onCancel}
                    style={{ color: '#e0e0e0' }}
                >
                    Back
                </Button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Text style={{ color: '#e0e0e0', fontSize: 14 }}>Drag map to pin</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        {selected ? `${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}` : ''}
                    </Text>
                </div>
                <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => selected && onConfirm(selected)}
                    disabled={!selected}
                    size="small"
                >
                    OK
                </Button>
            </div>

            {/* Map */}
            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer
                    center={center}
                    zoom={initialCoords ? 16 : 12}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                    zoomControl={false}
                    className="location-picker-map"
                >
                    <TileLayer
                        attribution='&copy; OpenStreetMap'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <CenterTracker onCenterChange={setSelected} />
                    <LocateControl />
                </MapContainer>

                {/* Fixed Center Marker */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -100%)',
                    zIndex: 1000,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                }}>
                    <div style={{
                        fontSize: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))',
                    }}>
                        📍
                    </div>
                </div>
            </div>
        </div>
    )
}
