import { Modal, Form, InputNumber, Button, Row, Col, Statistic, Typography, Alert } from 'antd'
import { CheckCircleOutlined, DollarOutlined, ThunderboltOutlined, CarOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function EndTripModal({ visible, onClose, onEnd, trip, stats }) {
  const [form] = Form.useForm()

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      await onEnd(values)
      form.resetFields()
      onClose()
    } catch (err) {
      // Form validation failed
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  const formatNumber = (num) => {
    if (num == null) return '-'
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  if (!trip) return null

  return (
    <Modal
      title={`End ${trip.name}`}
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={500}
    >
      <div style={{ padding: '16px 0' }}>
        <Title level={5} style={{ marginBottom: 16 }}>
          Current Trip Statistics
        </Title>

        {stats.sessionCount === 0 ? (
          <Alert
            message="No Sessions"
            description="This trip has no charging sessions yet. Add sessions before ending the trip."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12}>
              <Statistic
                title="Total Distance"
                value={stats.totalDistance ?? '-'}
                suffix={stats.totalDistance != null ? 'km' : null}
                prefix={<CarOutlined />}
                valueStyle={{ fontSize: 18 }}
              />
            </Col>
            <Col xs={12}>
              <Statistic
                title="Total Cost"
                value={stats.totalCost}
                suffix="฿"
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ fontSize: 18 }}
              />
            </Col>
            <Col xs={12}>
              <Statistic
                title="Total Energy"
                value={stats.totalEnergy}
                suffix="kWh"
                prefix={<ThunderboltOutlined />}
                precision={2}
                valueStyle={{ fontSize: 18 }}
              />
            </Col>
            <Col xs={12}>
              <Statistic
                title="Sessions"
                value={stats.sessionCount}
                suffix="total"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ fontSize: 18 }}
              />
            </Col>
            {stats.efficiency != null && (
              <Col xs={12}>
                <Statistic
                  title="Efficiency"
                  value={stats.efficiency}
                  suffix="kWh/100km"
                  precision={2}
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
            )}
            {stats.costPerKm != null && (
              <Col xs={12}>
                <Statistic
                  title="Cost/km"
                  value={stats.costPerKm}
                  suffix="฿/km"
                  precision={2}
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
            )}
          </Row>
        )}

        <Title level={5} style={{ marginBottom: 16, marginTop: 24 }}>
          Final Odometer Reading
        </Title>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            finalOdometer: null,
            endBatteryPct: null,
          }}
        >
          <Form.Item
            name="finalOdometer"
            label="Final Odometer (km)"
            extra="Optional: Enter final odometer for accurate distance tracking"
          >
            <InputNumber
              min={0}
              step={1}
              placeholder="e.g. 13150"
              style={{ width: '100%' }}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="endBatteryPct"
            label="Ending Battery Level (%)"
            extra="Optional: Record ending battery percentage for accurate energy tracking"
          >
            <InputNumber
              min={0}
              max={100}
              step={1}
              placeholder="e.g. 30"
              style={{ width: '100%' }}
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              icon={<CheckCircleOutlined />}
              block
              size="large"
            >
              End Trip
            </Button>
          </Form.Item>
        </Form>
      </div>
    </Modal>
  )
}
