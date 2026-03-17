import { useState, useEffect } from 'react'
import {
    Form,
    InputNumber,
    Input,
    Button,
    Segmented,
    AutoComplete,
    Typography,
    message,
    Card,
    Tag,
} from 'antd'
import {
    ThunderboltOutlined,
    HomeOutlined,
    EnvironmentOutlined,
    SaveOutlined,
    SyncOutlined,
    CarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { syncManager } from '../lib/syncManager'
import { db } from '../lib/db'
import { tripManager } from '../lib/tripManager'
import LocationPicker from '../components/LocationPicker'

const { Title, Text } = Typography
const BATTERY_KWH = 58.9

const NativeDatetimePicker = ({ value, onChange, placeholder, ...props }) => {
    const strValue = value ? value.format('YYYY-MM-DDTHH:mm') : ''

    return (
        <Input
            type="datetime-local"
            value={strValue}
            onChange={(e) => {
                const val = e.target.value
                onChange(val ? dayjs(val) : null)
            }}
            placeholder={placeholder}
            {...props}
        />
    )
}

export default function NewCharge({ editSessionId, onDone }) {
    const [form] = Form.useForm()
    const [chargingType, setChargingType] = useState('dc')
    const [saving, setSaving] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [messageApi, contextHolder] = message.useMessage()
    const [pastLocations, setPastLocations] = useState([])
    const [pastProviders, setPastProviders] = useState([])
    const [geoCoords, setGeoCoords] = useState(null)
    const [geoStatus, setGeoStatus] = useState('idle') // idle | loading | done | error
    const [showMapPicker, setShowMapPicker] = useState(false)
    const [activeTrip, setActiveTrip] = useState(null)

    const openMapPicker = () => {
        window.history.pushState({ overlay: 'mapPicker' }, '')
        setShowMapPicker(true)
    }

    const closeMapPicker = () => {
        setShowMapPicker(false)
        if (window.history.state?.overlay === 'mapPicker') {
            window.history.back()
        }
    }

    useEffect(() => {
        const handlePopState = (e) => {
            if (showMapPicker && e.state?.overlay !== 'mapPicker') {
                setShowMapPicker(false)
            }
        }
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [showMapPicker])

    // Auto-capture GPS on mount (unless editing with existing coords)
    const captureLocation = () => {
        setGeoStatus('loading')
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                setGeoStatus('done')
            },
            () => setGeoStatus('error'),
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    useEffect(() => {
        if (!editSessionId) captureLocation()
    }, [])

    // Load past locations & providers for autocomplete
    useEffect(() => {
        db.sessions.toArray().then((sessions) => {
            const locs = [...new Set(sessions.map((s) => s.location).filter(Boolean))]
            const provs = [...new Set(sessions.map((s) => s.provider).filter(Boolean))]
            setPastLocations(locs)
            setPastProviders(provs)
        })
    }, [])

    // Load active trip
    useEffect(() => {
        tripManager.getActiveTrip().then(setActiveTrip)
    }, [])

    useEffect(() => {
        if (editSessionId) {
            db.sessions.get(editSessionId).then((session) => {
                if (session) {
                    setIsEditing(true)
                    setChargingType(session.charging_type)
                    if (session.lat && session.lng) {
                        setGeoCoords({ lat: session.lat, lng: session.lng })
                        setGeoStatus('done')
                    }
                    form.setFieldsValue({
                        ...session,
                        started_at: session.started_at ? dayjs(session.started_at) : null,
                        ended_at: session.ended_at ? dayjs(session.ended_at) : null,
                    })
                }
            })
        }
    }, [editSessionId, form])

    const handleSubmit = async (values) => {
        setSaving(true)
        try {
            const data = {
                charging_type: chargingType,
                started_at: values.started_at
                    ? values.started_at.toISOString()
                    : new Date().toISOString(),
                ended_at: values.ended_at ? values.ended_at.toISOString() : null,
                location: values.location || null,
                provider: values.provider || null,
                start_soc_pct: values.start_soc_pct ?? null,
                end_soc_pct: values.end_soc_pct ?? null,
                energy_kwh: values.energy_kwh ?? null,
                price_per_kwh: values.price_per_kwh ?? null,
                total_cost: values.total_cost ?? null,
                odometer_km: values.odometer_km ?? null,
                lat: geoCoords?.lat ?? null,
                lng: geoCoords?.lng ?? null,
                note: values.note || null,
                trip_id: activeTrip?.id || null,
            }

            // Auto-calculate energy if both SoC are provided and energy is not
            if (
                data.energy_kwh == null &&
                data.start_soc_pct != null &&
                data.end_soc_pct != null
            ) {
                data.energy_kwh =
                    Math.round(
                        ((data.end_soc_pct - data.start_soc_pct) / 100) * BATTERY_KWH * 100
                    ) / 100
            }

            // Auto-calculate total cost for DC if energy and price are available
            if (
                data.total_cost == null &&
                data.energy_kwh != null &&
                data.price_per_kwh != null
            ) {
                data.total_cost = Math.round(data.energy_kwh * data.price_per_kwh * 100) / 100
            }

            if (isEditing) {
                await syncManager.updateSession(editSessionId, data)
                messageApi.success('Session updated!')
            } else {
                await syncManager.saveSession(data)
                messageApi.success('Charging session saved!')
                form.resetFields()
                form.setFieldsValue({ started_at: dayjs() })
            }

            if (onDone) onDone()
        } catch (err) {
            messageApi.error('Failed to save: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <div className="page-container">
                {contextHolder}

                <div className="page-header">
                    <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>
                        {isEditing ? '✏️ Edit Session' : '⚡ New Charge'}
                    </Title>
                </div>

                {/* Active Trip Indicator */}
                {activeTrip && !isEditing && (
                    <Card
                        size="small"
                        style={{
                            marginBottom: 16,
                            background: 'linear-gradient(135deg, rgba(0, 185, 107, 0.1) 0%, rgba(0, 143, 84, 0.1) 100%)',
                            borderColor: '#00b96b',
                        }}
                        styles={{ body: { padding: '8px 12px' } }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CarOutlined style={{ color: '#00b96b' }} />
                            <Text style={{ color: 'var(--text-primary)' }}>
                                Will be added to{' '}
                                <Tag color="green" style={{ margin: 0 }}>
                                    {activeTrip.name}
                                </Tag>
                            </Text>
                        </div>
                    </Card>
                )}

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        started_at: dayjs(),
                    }}
                    className="charge-form"
                >
                    {/* Charging Type */}
                    <Form.Item label="Charging Type">
                        <Segmented
                            value={chargingType}
                            onChange={setChargingType}
                            block
                            options={[
                                {
                                    label: (
                                        <span>
                                            <ThunderboltOutlined /> DC Station
                                        </span>
                                    ),
                                    value: 'dc',
                                },
                                {
                                    label: (
                                        <span>
                                            <HomeOutlined /> AC Home
                                        </span>
                                    ),
                                    value: 'ac',
                                },
                            ]}
                            className="charging-type-toggle"
                        />
                    </Form.Item>

                    {/* When */}
                    <Card
                        size="small"
                        className="form-section-card"
                        title="When"
                    >
                        <Form.Item
                            name="started_at"
                            label="Start Time"
                            rules={[{ required: true, message: 'Required' }]}
                        >
                            <NativeDatetimePicker
                                style={{ width: '100%' }}
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item name="ended_at" label="End Time">
                            <NativeDatetimePicker
                                style={{ width: '100%' }}
                                size="large"
                            />
                        </Form.Item>
                    </Card>

                    {/* Where */}
                    <Card
                        size="small"
                        className="form-section-card"
                        title={
                            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Where
                                <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, cursor: 'pointer' }}>
                                    {geoStatus === 'loading' && '📍 Locating...'}
                                    {
                                        geoStatus === 'done' && (
                                            <span onClick={openMapPicker}>
                                                📍 {geoCoords.lat.toFixed(4)}, {geoCoords.lng.toFixed(4)}{' '}
                                                <EnvironmentOutlined style={{ marginLeft: 4 }} />
                                            </span>
                                        )
                                    }
                                    {
                                        geoStatus === 'error' && (
                                            <span onClick={openMapPicker} style={{ color: '#ff7875' }}>
                                                📍 Pick location
                                            </span>
                                        )
                                    }
                                    {
                                        geoStatus === 'idle' && (
                                            <span onClick={openMapPicker}>
                                                📍 Pick location
                                            </span>
                                        )
                                    }
                                </Text>
                            </span>
                        }
                    >
                        <Form.Item name="location" label="Location">
                            <AutoComplete
                                options={pastLocations.map((l) => ({ value: l }))}
                                placeholder={chargingType === 'ac' ? 'Home' : 'Station name'}
                                size="large"
                                filterOption={(input, option) =>
                                    (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                            />
                        </Form.Item>

                        {
                            chargingType === 'dc' && (
                                <Form.Item name="provider" label="Provider / Network">
                                    <AutoComplete
                                        options={pastProviders.map((p) => ({ value: p }))}
                                        placeholder="e.g. PEA VOLTA, EA Anywhere"
                                        size="large"
                                        filterOption={(input, option) =>
                                            (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                                        }
                                    />
                                </Form.Item>
                            )
                        }
                    </Card>

                    {/* Car */}
                    <Card
                        size="small"
                        className="form-section-card"
                        title="Car"
                    >
                        <Form.Item
                            name="odometer_km"
                            label="Odometer (km)"
                            extra="Enables km driven, efficiency & cost/km stats"
                        >
                            <InputNumber
                                min={0}
                                step={1}
                                placeholder="e.g. 1250"
                                style={{ width: '100%' }}
                                size="large"
                            />
                        </Form.Item>
                    </Card>

                    {/* Battery */}
                    <Card
                        size="small"
                        className="form-section-card"
                        title="Battery"
                    >
                        <Form.Item name="start_soc_pct" label="Start SoC (%)">
                            <InputNumber
                                min={0}
                                max={100}
                                placeholder="e.g. 20"
                                style={{ width: '100%' }}
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item name="end_soc_pct" label="End SoC (%)">
                            <InputNumber
                                min={0}
                                max={100}
                                placeholder="e.g. 80"
                                style={{ width: '100%' }}
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item
                            name="energy_kwh"
                            label="Energy Charged (kWh)"
                            extra="From charger display, or auto-calculated from SoC"
                        >
                            <InputNumber
                                min={0}
                                max={BATTERY_KWH}
                                step={0.1}
                                placeholder="e.g. 35.2"
                                style={{ width: '100%' }}
                                size="large"
                            />
                        </Form.Item>
                    </Card>

                    {/* Cost */}
                    <Card
                        size="small"
                        className="form-section-card"
                        title="Cost"
                    >
                        {chargingType === 'dc' && (
                            <Form.Item
                                name="price_per_kwh"
                                label="Price per kWh (฿)"
                            >
                                <InputNumber
                                    min={0}
                                    step={0.5}
                                    placeholder="e.g. 7.50"
                                    style={{ width: '100%' }}
                                    size="large"
                                />
                            </Form.Item>
                        )}

                        <Form.Item
                            name="total_cost"
                            label="Total Cost (฿)"
                            extra={
                                chargingType === 'dc'
                                    ? 'Auto-calculated if energy & price are filled'
                                    : 'From your electricity bill or meter'
                            }
                        >
                            <InputNumber
                                min={0}
                                step={1}
                                placeholder="e.g. 264.00"
                                style={{ width: '100%' }}
                                size="large"
                            />
                        </Form.Item>
                    </Card>

                    {/* Note */}
                    <Form.Item name="note" label="Note">
                        <Input.TextArea
                            rows={2}
                            placeholder="Anything to remember…"
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            icon={<SaveOutlined />}
                            loading={saving}
                            block
                            size="large"
                            className="save-btn"
                        >
                            {isEditing ? 'Update Session' : 'Save Charging Session'}
                        </Button>
                    </Form.Item>
                </Form>
            </div>

            {showMapPicker && (
                <LocationPicker
                    initialCoords={geoCoords}
                    onConfirm={(coords) => {
                        setGeoCoords(coords)
                        setGeoStatus('done')
                        closeMapPicker()
                    }}
                    onCancel={closeMapPicker}
                />
            )}
        </>
    )
}
