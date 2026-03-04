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
  const isExitingRef = useRef(false)

  // 1. Initialize a two-layer history trap.
  // We use the event capture phase to ensure this runs BEFORE any React synthetic events,
  // preventing a scenario where a child component calls pushState before the trap is laid.
  useEffect(() => {
    const initTrap = () => {
      if (!isTrappedRef.current) {
        // We push two states. The first is a safe 'root' buffer to never hit index 0.
        // The second is the 'active' state where the user actually lives.
        window.history.pushState({ appLayer: 'root' }, '')
        window.history.pushState({ appLayer: 'active' }, '')
        isTrappedRef.current = true
      }
    }

    // Try on mount
    initTrap()

    const onInteract = () => {
      initTrap()
      window.removeEventListener('click', onInteract, { capture: true })
      window.removeEventListener('touchstart', onInteract, { capture: true })
    }
    // Listen in the capture phase to intercept the absolute first gesture!
    window.addEventListener('click', onInteract, { capture: true })
    window.addEventListener('touchstart', onInteract, { capture: true, passive: true })

    return () => {
      window.removeEventListener('click', onInteract, { capture: true })
      window.removeEventListener('touchstart', onInteract, { capture: true })
    }
  }, []) // Empty dependency array so we don't re-bind on tab changes

  // 2. Handle popstate routing and showing the modal
  useEffect(() => {
    const handlePopState = (e) => {
      // If we are actively tearing down the app, ignore all popstates
      if (isExitingRef.current) return

      // If we are handling an inner modal state (like Edit Session) returning
      // We clear the edit mode if the state isn't the edit mode state anymore.
      if (editingSessionId && e.state?.view !== 'editSession') {
        setEditingSessionId(null)
        setActiveTab('history')
        // We do not return here, because if they hit the root layer, we want the modal to show.
      }

      // If the user hit our 'root' buffer layer, they pressed back from the PWA main content.
      if (e.state?.appLayer === 'root') {
        // Show the customized confirmation dialog
        setShowExitConfirm(true)

        // Immediately push the active layer back on so the NEXT back button press does not close the app
        window.history.pushState({ appLayer: 'active' }, '')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [editingSessionId])

  const handleConfirmExit = () => {
    setShowExitConfirm(false)
    isExitingRef.current = true // Prevent popstate loops manually

    // Naturally close PWA
    window.close()

    // In Android contexts window.close() is often blocked, so we trigger history physically backwards 
    // past our root buffer. We are at 'active' (index 2+), so go(-2) hits index 0, commanding the OS to exit.
    setTimeout(() => {
      window.history.go(-2)
    }, 100)
  }

  const handleCancelExit = () => {
    setShowExitConfirm(false)
    // We already re-pushed the 'active' state in handlePopState!
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
