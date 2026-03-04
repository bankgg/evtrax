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
  const [debugInfo, setDebugInfo] = useState('')

  useEffect(() => {
    // 1. Use DIRECT hash assignment (not pushState) — this performs a real navigation
    // that Samsung Internet's PWA engine must respect.
    const lockHash = () => {
      if (!isTrappedRef.current && window.location.hash !== '#app') {
        window.location.hash = 'app' // Direct assignment, NOT pushState
        isTrappedRef.current = true
        setDebugInfo('TRAP SET: len=' + window.history.length)
      }
    }

    lockHash()

    // 2. Also ensure interaction lock in case PWA ignores on-mount hash changes.
    const onInteract = () => {
      lockHash()
      window.removeEventListener('click', onInteract, { capture: true })
      window.removeEventListener('touchstart', onInteract, { capture: true })
    }
    window.addEventListener('click', onInteract, { capture: true })
    window.addEventListener('touchstart', onInteract, { capture: true, passive: true })

    // 3. Listen to BOTH popstate and hashchange for maximum compatibility
    const handleBackNavigation = (eventName) => {
      if (isExitingRef.current) return

      const currentHash = window.location.hash
      setDebugInfo(eventName + ': hash=' + currentHash + ', len=' + window.history.length)

      // Handle Edit Session returning
      if (editingSessionId) {
        const state = window.history.state
        if (state?.view !== 'editSession') {
          setEditingSessionId(null)
          setActiveTab('history')
        }
      }

      // Back Button Trap: if hash is no longer #app, user is trying to exit
      if (currentHash !== '#app') {
        setShowExitConfirm(true)
        // Push hash back to prevent exit
        window.location.hash = 'app'
      }
    }

    const handlePopState = () => handleBackNavigation('popstate')
    const handleHashChange = () => handleBackNavigation('hashchange')

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('hashchange', handleHashChange)

    // Also try beforeunload as a last resort for Samsung Internet
    const handleBeforeUnload = (e) => {
      if (!isExitingRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('click', onInteract, { capture: true })
      window.removeEventListener('touchstart', onInteract, { capture: true })
    }
  }, [editingSessionId])

  const handleConfirmExit = () => {
    setShowExitConfirm(false)
    isExitingRef.current = true
    window.close()
    setTimeout(() => {
      window.history.go(-2)
    }, 100)
  }

  const handleCancelExit = () => {
    setShowExitConfirm(false)
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
