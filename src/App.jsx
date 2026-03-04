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

  const handleEdit = (sessionId) => {
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
    setActiveTab(key)
  }

  // --- App Exit Confirmation Logic ---
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const isTrappedRef = useRef(false)

  // Push the trap state and mark it
  const pushTrapState = () => {
    if (!isTrappedRef.current) {
      window.history.pushState({ isAppTrap: true }, '')
      isTrappedRef.current = true
    }
  }

  // Handle the browser popstate specifically for the hardware back button
  useEffect(() => {
    // 1. Setup the trap immediately if we aren't already trapped
    if (!window.history.state?.isAppTrap) {
      pushTrapState()
    } else {
      isTrappedRef.current = true
    }

    // 2. Also aggressively try to set the trap when the user interact with the app.
    // This helps bypass some PWA restrictions where initial pushState is ignored before user gesture.
    const onInteract = () => {
      pushTrapState()
      window.removeEventListener('click', onInteract)
      window.removeEventListener('touchstart', onInteract)
    }
    window.addEventListener('click', onInteract)
    window.addEventListener('touchstart', onInteract, { passive: true })

    const handlePopState = (e) => {
      // If we are handling an inner modal state (like Edit Session) returning
      if (editingSessionId && e.state?.view !== 'editSession') {
        setEditingSessionId(null)
        setActiveTab('history')
        return
      }

      // If we reach here, the dummy trap state was popped, which means the back button was pressed
      // on the main layer of the application
      isTrappedRef.current = false // We lost the trap state

      // Show the customized confirmation dialog
      setShowExitConfirm(true)

      // Immediately push the trap state back on to prevent the next back button press from closing the app
      pushTrapState()
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('click', onInteract)
      window.removeEventListener('touchstart', onInteract)
    }
  }, [editingSessionId])

  const handleConfirmExit = () => {
    setShowExitConfirm(false)
    // Actually close the app/window now
    window.close()

    // In some PWA environments window.close() might be blocked, so we also go back past our trap
    setTimeout(() => {
      // Temporarily disable the trap flag so we don't catch our own exit
      isTrappedRef.current = false
      window.history.back()
    }, 100)
  }

  const handleCancelExit = () => {
    setShowExitConfirm(false)
    // We already re-pushed the trap state in handlePopState before showing the modal, so we just close the modal.
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
      <div className="app-shell">
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
        cancelText="Cancel"
        centered
      >
        <p>Are you sure you want to stop tracking and exit?</p>
      </Modal>
    </ConfigProvider>
  )
}
