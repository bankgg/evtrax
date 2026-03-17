import { Modal, Form, Input, InputNumber, Button, Typography } from 'antd'
import { CarOutlined, PlusOutlined } from '@ant-design/icons'

const { Text } = Typography

export default function StartTripModal({ visible, onClose, onStart }) {
  const [form] = Form.useForm()

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      await onStart(values)
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

  return (
    <Modal
      title="Start New Trip"
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={400}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          tripName: '',
          startOdometer: null,
          startBatteryPct: null,
        }}
      >
        <Form.Item
          name="tripName"
          label="Trip Name"
          rules={[{ required: true, message: 'Please enter a trip name' }]}
        >
          <Input
            prefix={<CarOutlined />}
            placeholder="e.g., Summer Road Trip, Chiang Mai, etc."
            size="large"
            autoFocus
          />
        </Form.Item>

        <Form.Item
          name="startOdometer"
          label="Starting Odometer (km)"
          extra="Optional: Record starting odometer for accurate distance tracking"
        >
          <InputNumber
            min={0}
            step={1}
            placeholder="e.g. 12500"
            style={{ width: '100%' }}
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="startBatteryPct"
          label="Starting Battery Level (%)"
          extra="Optional: Record starting battery percentage for accurate energy tracking"
        >
          <InputNumber
            min={0}
            max={100}
            step={1}
            placeholder="e.g. 80"
            style={{ width: '100%' }}
            size="large"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            icon={<PlusOutlined />}
            block
            size="large"
          >
            Start Trip
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
