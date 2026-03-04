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

  // 1. Setup the trap ONLY on the first user interaction.
  // If we pushState on mount without interaction, Android PWAs convert it to a replaceState, destroying the history root!
  useEffect(() => {
    const onInteract = () => {
      if (!isTrappedRef.current) {
        window.history.pushState({ isAppTrap: true }, '')
        isTrappedRef.current = true
      }
      window.removeEventListener('click', onInteract)
      window.removeEventListener('touchstart', onInteract)
    }
    window.addEventListener('click', onInteract)
    window.addEventListener('touchstart', onInteract, { passive: true })

    return () => {
      window.removeEventListener('click', onInteract)
      window.removeEventListener('touchstart', onInteract)
    }
  }, []) // Empty dependency array so we don't re-bind on tab changes

  // 2. Handle popstate routing and showing the modal
  useEffect(() => {
    const handlePopState = (e) => {
      // If we are actively tearing down the app, ignore all popstates
      if (isExitingRef.current) return

      // If we are handling an inner modal state (like Edit Session) returning
      if (editingSessionId && e.state?.view !== 'editSession') {
        setEditingSessionId(null)
        setActiveTab('history')
        return
      }

      // If the state is precisely the trap state, the user navigated BACK from an overlay (like Map Picker)
      // to the root layout. We just let them arrive safely.
      if (e.state?.isAppTrap) {
        return
      }

      // If the state has views or overlays, they are going forward. Normal navigation.
      if (e.state?.view || e.state?.overlay) {
        return
      }

      // If we reach here, it means the dummy trap state was physically popped.
      // We are at the Android WebApk root view and the back button signifies an Exit Intent.
      isTrappedRef.current = false // We lost the trap state

      // Show the customized confirmation dialog
      setShowExitConfirm(true)

      // Immediately push the trap state back on to prevent the NEXT back button press from closing the app
      window.history.pushState({ isAppTrap: true }, '')
      isTrappedRef.current = true
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
    // past our trap to engage the kernel-level close protocol.
    setTimeout(() => {
      window.history.back()
    }, 100)
  }

  const handleCancelExit = () => {
    setShowExitConfirm(false)
    // We already re-pushed the trap state in handlePopState before showing the modal!
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
