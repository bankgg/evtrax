import { Modal, Row, Col, Statistic, Typography, Empty, Divider, Alert } from 'antd'
import {
  DollarOutlined,
  ThunderboltOutlined,
  CarOutlined,
  DashboardOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Text } = Typography

export default function TripStatsModal({ visible, onClose, trip, stats }) {
  if (!trip) return null

  // Helper for remark text
  const Remark = ({ children }) => (
    <div style={{ fontSize: '11px', color: '#999', marginTop: 2, lineHeight: 1.2 }}>
      {children}
    </div>
  )

  // Format date
  const formatDate = (dateStr) => {
    return dayjs(dateStr).format('D MMM YYYY · HH:mm')
  }

  // Helper for styled suffix
  const StyledSuffix = ({ children }) => (
    <span style={{ fontSize: '13px', color: '#aaa', marginLeft: 4 }}>{children}</span>
  )

  return (
    <Modal
      title={trip.name}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <div style={{ paddingTop: 4 }}>
        {stats.sessionCount === 0 ? (
          <Empty description="No charging sessions in this trip yet" />
        ) : (
          <>
            {/* Energy & Cost Section */}
            <Row gutter={[16, 16]}>
              <Col xs={12}>
                <Statistic
                  title="Energy"
                  value={stats.hasBatteryData ? stats.energyUsed : stats.energyCharged}
                  suffix={<StyledSuffix>kWh</StyledSuffix>}
                  prefix={<ThunderboltOutlined />}
                  precision={2}
                  styles={{
                    content: { color: '#1890ff', fontSize: '17px', fontWeight: 500 },
                    title: { fontSize: '12px', color: '#888' }
                  }}
                />
                {stats.hasBatteryData && (
                  <Remark>Charged: {stats.energyCharged.toFixed(2)} kWh</Remark>
                )}
              </Col>
              <Col xs={12}>
                <Statistic
                  title="Cost"
                  value={stats.hasBatteryData ? stats.costUsed : stats.costCharged}
                  suffix={<StyledSuffix>฿</StyledSuffix>}
                  prefix={<DollarOutlined />}
                  precision={2}
                  styles={{
                    content: { color: '#52c41a', fontSize: '17px', fontWeight: 500 },
                    title: { fontSize: '12px', color: '#888' }
                  }}
                />
                {stats.hasBatteryData && (
                  <Remark>Charged: {stats.costCharged.toFixed(2)} ฿</Remark>
                )}
              </Col>
            </Row>

            {/* No battery data alert */}
            {!stats.hasBatteryData && (
              <Alert
                message="Add battery % when starting/ending trips for accurate energy tracking"
                type="info"
                showIcon
                style={{ marginTop: 12, fontSize: 12, padding: '8px 12px' }}
              />
            )}

            <Divider style={{ margin: '12px 0' }} />

            {/* Distance and Efficiency Stats */}
            <Row gutter={[16, 16]}>
              <Col xs={12}>
                <Statistic
                  title="Total Distance"
                  value={stats.totalDistance ?? '-'}
                  suffix={stats.totalDistance != null ? <StyledSuffix>km</StyledSuffix> : null}
                  prefix={<CarOutlined />}
                  styles={{
                    content: {
                      color: stats.totalDistance != null ? '#52c41a' : '#888',
                      fontSize: '17px',
                      fontWeight: 500
                    },
                    title: { fontSize: '12px', color: '#888' }
                  }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title="Sessions"
                  value={stats.sessionCount}
                  prefix={<CheckCircleOutlined />}
                  styles={{
                    content: { color: '#52c41a', fontSize: '17px', fontWeight: 500 },
                    title: { fontSize: '12px', color: '#888' }
                  }}
                />
              </Col>
              {stats.efficiency != null && (
                <Col xs={12}>
                  <Statistic
                    title="Efficiency"
                    value={stats.efficiency}
                    suffix={<StyledSuffix>kWh/100km</StyledSuffix>}
                    prefix={<DashboardOutlined />}
                    precision={2}
                    styles={{
                      content: { color: '#52c41a', fontSize: '17px', fontWeight: 500 },
                      title: { fontSize: '12px', color: '#888' }
                    }}
                  />
                </Col>
              )}
              {stats.costPerKm != null && (
                <Col xs={12}>
                  <Statistic
                    title="Cost/km"
                    value={stats.costPerKm}
                    suffix={<StyledSuffix>฿/km</StyledSuffix>}
                    prefix={<DollarOutlined />}
                    precision={2}
                    styles={{
                      content: { color: '#52c41a', fontSize: '17px', fontWeight: 500 },
                      title: { fontSize: '12px', color: '#888' }
                    }}
                  />
                </Col>
              )}
              {stats.avgCostPerKwh != null && (
                <Col xs={12}>
                  <Statistic
                    title="Avg ฿/kWh"
                    value={stats.avgCostPerKwh}
                    suffix={<StyledSuffix>฿/kWh</StyledSuffix>}
                    prefix={<DollarOutlined />}
                    precision={2}
                    styles={{
                      content: { color: '#52c41a', fontSize: '17px', fontWeight: 500 },
                      title: { fontSize: '12px', color: '#888' }
                    }}
                  />
                </Col>
              )}
            </Row>

            {(stats.totalDistance == null || stats.efficiency == null) && (
              <>
                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {stats.totalDistance == null && 'Add odometer readings to see distance statistics.'}
                  {stats.totalDistance != null && stats.efficiency == null && 'Add more energy data to calculate efficiency.'}
                </Text>
              </>
            )}
          </>
        )}

        {/* Redesigned footer */}
        <Divider style={{ margin: '16px 0' }} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px 16px',
          fontSize: 11,
          color: '#999'
        }}>
          <div>
            <span style={{ color: '#bbb' }}>Start:</span> {formatDate(trip.started_at)}
          </div>
          {trip.ended_at && (
            <div>
              <span style={{ color: '#bbb' }}>End:</span> {formatDate(trip.ended_at)}
            </div>
          )}
          {trip.start_odometer && (
            <div>
              <span style={{ color: '#bbb' }}>Start Odo:</span> {Number(trip.start_odometer).toLocaleString()} km
            </div>
          )}
          {trip.end_odometer && (
            <div>
              <span style={{ color: '#bbb' }}>End Odo:</span> {Number(trip.end_odometer).toLocaleString()} km
            </div>
          )}
          {trip.start_battery_pct != null && (
            <div>
              <span style={{ color: '#bbb' }}>Start Batt:</span> {Number(trip.start_battery_pct)}%
            </div>
          )}
          {trip.end_battery_pct != null && (
            <div>
              <span style={{ color: '#bbb' }}>End Batt:</span> {Number(trip.end_battery_pct)}%
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
