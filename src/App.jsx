import { useState, useEffect, useRef } from 'react'
import { ConfigProvider, theme as antTheme, Modal } from 'antd'
import {
  DashboardOutlined,
  PlusCircleOutlined,
  UnorderedListOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'
import Dashboard from './pages/Dashboard'
import NewCharge from './pages/NewCharge'
import History from './pages/History'
import ChargingMap from './pages/ChargingMap'
import SyncStatusBar from './components/SyncStatusBar'
import './App.css'

const tabs = [
  { key: 'dashboard', label: 'Dashboard', icon: <DashboardOutlined /> },
  { key: 'new', label: 'Charge', icon: <PlusCircleOutlined /> },
  { key: 'history', label: 'History', icon: <UnorderedListOutlined /> },
  { key: 'map', label: 'Map', icon: <EnvironmentOutlined /> },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [editingSessionId, setEditingSessionId] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const isTrappedRef = useRef(false)
  const isExitingRef = useRef(false)
  const activeTabRef = useRef('dashboard')

  useEffect(() => { activeTabRef.current = activeTab }, [activeTab])

  // Samsung Internet PWA ONLY respects pushState called inside React element onClick.
  // This pushes a two-layer trap (guard + active) via pushState.
  const ensureTrap = () => {
    if (!isTrappedRef.current) {
      window.history.pushState({ guard: true }, '')
      window.history.pushState({ active: true, tab: activeTabRef.current }, '')
      isTrappedRef.current = true
    }
  }

  const handleAppClick = () => ensureTrap()

  const handleEdit = (sessionId) => {
    ensureTrap()
    window.history.pushState({ view: 'editSession' }, '')
    setEditingSessionId(sessionId)
    setActiveTab('new')
  }

  const handleDoneEditing = () => {
    setEditingSessionId(null)
    setActiveTab('history')
    if (window.history.state?.view === 'editSession') {
      window.history.back()
    }
  }

  const handleTabChange = (key) => {
    if (key !== 'new') {
      if (editingSessionId) {
        setEditingSessionId(null)
        if (window.history.state?.view === 'editSession') {
          window.history.back()
        }
      }
    }
    ensureTrap()
    setActiveTab(key)
  }

  useEffect(() => {
    const handlePopState = (e) => {
      if (isExitingRef.current) return

      const s = e.state

      if (editingSessionId && s?.view !== 'editSession') {
        setEditingSessionId(null)
        setActiveTab('history')
        return
      }

      if (s?.overlay) return
      if (s?.active) return
      if (s?.view) return

      // Guard layer or null — exit attempt
      setShowExitConfirm(true)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [editingSessionId])

  const handleConfirmExit = () => {
    setShowExitConfirm(false)
    isExitingRef.current = true
    // Navigate to index 0. Samsung Internet only exits PWAs via
    // hardware back button, so the next back press will close the app.
    window.history.back()
  }

  const handleCancelExit = () => {
    setShowExitConfirm(false)
    // Re-establish the trap from this button's onClick (Samsung respects this).
    window.history.pushState({ active: true, tab: activeTabRef.current }, '')
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: antTheme.darkAlgorithm,
        token: {
          colorPrimary: '#00b96b',
          colorBgContainer: '#141414',
          colorBgElevated: '#1f1f1f',
          borderRadius: 12,
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        components: {
          Card: {
            colorBgContainer: '#1a1a2e',
          },
          Input: {
            colorBgContainer: '#2a2a3e',
          },
          InputNumber: {
            colorBgContainer: '#2a2a3e',
          },
          DatePicker: {
            colorBgContainer: '#2a2a3e',
          },
          Select: {
            colorBgContainer: '#2a2a3e',
          },
          Segmented: {
            itemSelectedBg: '#00b96b',
            itemSelectedColor: '#fff',
          },
        },
      }}
    >
      <div className="app-shell" onClick={handleAppClick}>
        <SyncStatusBar />

        <main className="app-content">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'new' && (
            <NewCharge
              editSessionId={editingSessionId}
              onDone={handleDoneEditing}
            />
          )}
          {activeTab === 'history' && <History onEdit={handleEdit} />}
          {activeTab === 'map' && <ChargingMap />}
        </main>

        <nav className="bottom-nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`nav-item ${activeTab === tab.key ? 'nav-item--active' : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <Modal
        title="Exit App?"
        open={showExitConfirm}
        onOk={handleConfirmExit}
        onCancel={handleCancelExit}
        okText="Exit"
        cancelText="Stay"
        centered
      >
        <p>Press back once more after exiting to close the app.</p>
      </Modal>
    </ConfigProvider>
  )
}

