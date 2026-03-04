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
  const readyRef = useRef(false)
  const [debugInfo, setDebugInfo] = useState('')

  // Effect 1: Push TWO hash entries so the user lives at index 2.
  // Samsung Internet kills the PWA without firing JS events when back hits index 0.
  // By having index 1 = #guard, pressing back from #app goes to #guard (NOT index 0).
  useEffect(() => {
    if (!isTrappedRef.current) {
      window.location.hash = 'guard' // index 1
      window.location.hash = 'app'   // index 2 — user lives here
      isTrappedRef.current = true
      setDebugInfo('TRAP SET: len=' + window.history.length)
      // Wait for the initial hashchange events to settle before arming the handler
      setTimeout(() => { readyRef.current = true }, 300)
    } else {
      readyRef.current = true
    }

    const onInteract = () => {
      if (!isTrappedRef.current) {
        window.location.hash = 'guard'
        window.location.hash = 'app'
        isTrappedRef.current = true
        setDebugInfo('TRAP SET (tap): len=' + window.history.length)
        setTimeout(() => { readyRef.current = true }, 300)
      }
      window.removeEventListener('click', onInteract, { capture: true })
      window.removeEventListener('touchstart', onInteract, { capture: true })
    }
    window.addEventListener('click', onInteract, { capture: true })
    window.addEventListener('touchstart', onInteract, { capture: true, passive: true })

    return () => {
      window.removeEventListener('click', onInteract, { capture: true })
      window.removeEventListener('touchstart', onInteract, { capture: true })
    }
  }, [])

  // Effect 2: Handle back navigation events
  useEffect(() => {
    const handleBackNavigation = (eventName) => {
      if (isExitingRef.current || !readyRef.current) return

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
        // Push #app back so they stay at a safe index
        window.location.hash = 'app'
      }
    }

    const handlePopState = () => handleBackNavigation('popstate')
    const handleHashChange = () => handleBackNavigation('hashchange')

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [editingSessionId])

  const handleConfirmExit = () => {
    setShowExitConfirm(false)
    isExitingRef.current = true
    window.close()
    // Go all the way back to index 0 to trigger Samsung's PWA exit
    setTimeout(() => {
      window.history.go(-(window.history.length - 1))
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
