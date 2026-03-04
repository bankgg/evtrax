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
  const exitModalRef = useRef(null)

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
  const trapPushedRef = useRef(false)

  useEffect(() => {
    // 1) Push a dummy hash state so there's an explicit URL change in history
    const ensureTrap = () => {
      if (!trapPushedRef.current) {
        if (window.location.hash !== '#app') {
          // Push the trap hash
          window.history.pushState({ appExitTrap: true }, '', '#app')
        }
        trapPushedRef.current = true
      }
    }

    // Try immediately
    ensureTrap()

    // Bind to first interaction to ensure it sticks in Android PWAs aggressively ignoring initial pushState
    const onInteract = () => {
      ensureTrap()
      window.removeEventListener('click', onInteract)
      window.removeEventListener('touchstart', onInteract)
    }
    window.addEventListener('click', onInteract)
    window.addEventListener('touchstart', onInteract, { passive: true })

    const handlePopState = (e) => {
      // If user came back to a state that is still within the app (hash is #app)
      if (window.location.hash === '#app') {
        // Handle child views like editSession closing
        if (editingSessionId && e.state?.view !== 'editSession') {
          setEditingSessionId(null)
          setActiveTab('history')
        }
        // Don't trigger exit modal, because they are still deep in the app's history
        return
      }

      // If we are here, we popped out of the #app trap (meaning hash is gone, user pressed back to exit)
      trapPushedRef.current = false // reset flag since we left the trap state

      // If an overlay was somehow open when they exited the trap, just close it and restore trap
      if (editingSessionId) {
        setEditingSessionId(null)
        setActiveTab('history')
        ensureTrap()
        return
      }

      if (exitModalRef.current) {
        ensureTrap()
        return
      }

      exitModalRef.current = Modal.confirm({
        title: 'Exit App?',
        content: 'Are you sure you want to stop tracking and exit?',
        okText: 'Exit',
        cancelText: 'Cancel',
        centered: true,
        onOk: () => {
          exitModalRef.current = null
          // Attempt to naturally close PWA
          window.close()
          // Go back again physically
          window.history.back()
        },
        onCancel: () => {
          exitModalRef.current = null
          // User canceled, push the trap state back on to prevent exit next time
          ensureTrap()
        },
      })
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('click', onInteract)
      window.removeEventListener('touchstart', onInteract)
    }
  }, [editingSessionId])

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
    </ConfigProvider>
  )
}
