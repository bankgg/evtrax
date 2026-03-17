import { Modal, Row, Col, Statistic, Typography, Empty, Divider } from 'antd'
import {
  DollarOutlined,
  ThunderboltOutlined,
  CarOutlined,
  DashboardOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

export default function TripStatsModal({ visible, onClose, trip, stats }) {
  if (!trip) return null

  const formatNumber = (num) => {
    if (num == null) return '-'
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const formatCost = (cost) => {
    if (cost == null) return '-'
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cost)
  }

  return (
    <Modal
      title={trip.name}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <div style={{ padding: '16px 0' }}>
        <Title level={5} style={{ marginBottom: 16 }}>
          Trip Statistics
        </Title>

        {stats.sessionCount === 0 ? (
          <Empty description="No charging sessions in this trip yet" />
        ) : (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={12}>
                <Statistic
                  title="Total Distance"
                  value={stats.totalDistance ?? '-'}
                  suffix={stats.totalDistance != null ? 'km' : null}
                  prefix={<CarOutlined />}
                  valueStyle={{ color: stats.totalDistance != null ? '#00b96b' : '#888' }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title="Total Cost"
                  value={stats.totalCost}
                  suffix="฿"
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#00b96b' }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title="Total Energy"
                  value={stats.totalEnergy}
                  suffix="kWh"
                  prefix={<ThunderboltOutlined />}
                  precision={2}
                  valueStyle={{ color: '#00b96b' }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title="Session Count"
                  value={stats.sessionCount}
                  suffix="sessions"
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#00b96b' }}
                />
              </Col>
              {stats.efficiency != null && (
                <Col xs={12}>
                  <Statistic
                    title="Efficiency"
                    value={stats.efficiency}
                    suffix="kWh/100km"
                    prefix={<DashboardOutlined />}
                    precision={2}
                    valueStyle={{ color: '#00b96b' }}
                  />
                </Col>
              )}
              {stats.costPerKm != null && (
                <Col xs={12}>
                  <Statistic
                    title="Cost per km"
                    value={stats.costPerKm}
                    suffix="฿/km"
                    prefix={<DollarOutlined />}
                    precision={2}
                    valueStyle={{ color: '#00b96b' }}
                  />
                </Col>
              )}
            </Row>

            {(stats.totalDistance == null || stats.efficiency == null) && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {stats.totalDistance == null &&
                    'Add charging sessions with odometer readings to see distance statistics.' +
                    (trip.start_odometer ? ' Start odometer is set.' : ' Set a start odometer when creating a trip for better tracking.')}
                  {stats.totalDistance != null && stats.efficiency == null &&
                    'Add more energy data to calculate efficiency.'}
                </Text>
              </>
            )}
          </>
        )}

        <Divider style={{ margin: '16px 0' }} />

        <div style={{ fontSize: 12, color: '#888' }}>
          <div>
            Started: {new Date(trip.started_at).toLocaleString('th-TH')}
          </div>
          {trip.start_odometer && (
            <div>
              Start Odometer: {Number(trip.start_odometer).toLocaleString()} km
            </div>
          )}
          {trip.ended_at && (
            <div>
              Ended: {new Date(trip.ended_at).toLocaleString('th-TH')}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
