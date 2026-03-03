import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useSessions } from '../hooks/useSessions'
import { CloudOutlined, DisconnectOutlined, SyncOutlined } from '@ant-design/icons'
import { Tag } from 'antd'

export default function SyncStatusBar() {
    const isOnline = useOnlineStatus()
    const { pendingCount } = useSessions()

    return (
        <div className="sync-status-bar">
            {isOnline ? (
                pendingCount > 0 ? (
                    <Tag icon={<SyncOutlined spin />} color="processing">
                        Syncing {pendingCount} item{pendingCount > 1 ? 's' : ''}…
                    </Tag>
                ) : (
                    <Tag icon={<CloudOutlined />} color="success">
                        All synced
                    </Tag>
                )
            ) : (
                <Tag icon={<DisconnectOutlined />} color="warning">
                    Offline · {pendingCount > 0 ? `${pendingCount} pending` : 'saved locally'}
                </Tag>
            )}
        </div>
    )
}
