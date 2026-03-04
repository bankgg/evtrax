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
  const [debugInfo, setDebugInfo] = useState('')

  // Keep ref in sync with state
  useEffect(() => { activeTabRef.current = activeTab }, [activeTab])

  // Samsung Internet PWA ONLY respects pushState called inside React element onClick.
  // It ignores: hash changes, window-level listeners, mount-time pushState.
  // This function pushes a two-layer trap (guard + active) via pushState.
  const ensureTrap = () => {
    if (!isTrappedRef.current) {
      window.history.pushState({ guard: true }, '')
      window.history.pushState({ active: true, tab: activeTabRef.current }, '')
      isTrappedRef.current = true
      setDebugInfo('TRAP SET: len=' + window.history.length)
    }
  }

  // Called on ANY click inside the app shell — sets the trap on first touch
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

  // Handle popstate — the ONLY event listener we need
  useEffect(() => {
    const handlePopState = (e) => {
      if (isExitingRef.current) return

      const s = e.state
      setDebugInfo('pop: ' + JSON.stringify(s) + ' len=' + window.history.length)

      // Handle Edit Session returning
      if (editingSessionId && s?.view !== 'editSession') {
        setEditingSessionId(null)
        setActiveTab('history')
        return
      }

      // Handle overlay states (like MapPicker) — let the component's own handler deal with it
      if (s?.overlay) return

      // If we landed on the 'active' layer, user returned from an overlay — safe, do nothing
      if (s?.active) return

      // If we landed on a view state, it's a forward navigation — do nothing
      if (s?.view) return

      // We hit the 'guard' layer or null — this is an exit attempt!
      setShowExitConfirm(true)
      // NOTE: We do NOT pushState here because Samsung Internet ignores pushState inside popstate handlers.
      // The trap will be re-established from the Cancel button's onClick handler instead.
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [editingSessionId])

  const handleConfirmExit = () => {
    setShowExitConfirm(false)
    isExitingRef.current = true
    // Samsung only exits on hardware back at index 0.
    // We're at the guard layer (index 1). Go back one step to index 0.
    // Then one more hardware back press will exit the PWA.
    window.history.back()
  }

  const handleCancelExit = () => {
    setShowExitConfirm(false)
    // Push ONLY the active state above the current guard.
    // Since pushState from index 1 discards old forward entries,
    // history stays flat: [null(0), guard(1), active(2)] — no accumulation.
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
      {/* onClick on the shell ensures the pushState trap is set on the FIRST tap */}
      <div className="app-shell" onClick={handleAppClick}>
        <SyncStatusBar />
        {/* DEBUG: Remove after testing */}
        {debugInfo && (
          <div style={{ background: '#ff0', color: '#000', padding: 4, fontSize: 11, textAlign: 'center', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999 }}>
            {debugInfo}
          </div>
        )}

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

