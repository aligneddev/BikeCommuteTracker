import { NavLink } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/auth-context'
import { getPwaSnapshot, subscribePwaSnapshot } from '../../services/pwa/bootstrap'
import './app-header.css'

function getUpdateStatusMessage(status: string): string | null {
  if (status === 'checking') {
    return 'Checking for updates...'
  }

  if (status === 'downloading') {
    return 'Downloading update...'
  }

  if (status === 'failed') {
    return 'Update failed. Refresh to retry.'
  }

  return null
}

export function AppHeader() {
  const { user, logout } = useAuth()
  const [pwaSnapshot, setPwaSnapshot] = useState(() => getPwaSnapshot())
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const closeMenuTimeoutRef = useRef<number | null>(null)
  const updateStatusMessage = getUpdateStatusMessage(pwaSnapshot.updateState.status)

  function clearCloseMenuTimeout(): void {
    if (closeMenuTimeoutRef.current !== null) {
      window.clearTimeout(closeMenuTimeoutRef.current)
      closeMenuTimeoutRef.current = null
    }
  }

  function openMenu(): void {
    clearCloseMenuTimeout()
    setMenuOpen(true)
  }

  function scheduleMenuClose(): void {
    clearCloseMenuTimeout()
    closeMenuTimeoutRef.current = window.setTimeout(() => {
      setMenuOpen(false)
      closeMenuTimeoutRef.current = null
    }, 180)
  }

  useEffect(() => {
    return () => {
      clearCloseMenuTimeout()
    }
  }, [])

  useEffect(() => {
    return subscribePwaSnapshot((next) => {
      setPwaSnapshot(next)
    })
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      const headerUser = document.querySelector('.app-header-user')
      if (headerUser && !headerUser.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [menuOpen])

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <NavLink to="/dashboard" className="app-header-brand">
          <img
            className="app-header-brand-logo"
            src="/logo-wordmark.svg"
            alt="BikeTracking"
            width="240"
            height="60"
          />
        </NavLink>

        <nav className="app-header-nav" aria-label="Main navigation">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link-active' : 'nav-link'
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/dashboard/advanced"
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link-active' : 'nav-link'
            }
          >
            Advanced Stats
          </NavLink>
          <NavLink
            to="/dashboard/year-stats"
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link-active' : 'nav-link'
            }
          >
            Year Stats
          </NavLink>
          <NavLink
            to="/rides/record"
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link-active' : 'nav-link'
            }
          >
            Record Ride
          </NavLink>
          <NavLink
            to="/rides/history"
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link-active' : 'nav-link'
            }
          >
            Ride History
          </NavLink>
          <NavLink
            to="/expenses/entry"
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link-active' : 'nav-link'
            }
          >
            Record Expense
          </NavLink>
          <NavLink
            to="/expenses/history"
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link-active' : 'nav-link'
            }
          >
            Expense History
          </NavLink>

          <span className="app-header-install-indicator" role="status" aria-live="polite">
            {pwaSnapshot.launchContext.mode === 'installed_window'
              ? 'Installed'
              : pwaSnapshot.installationState.installPromptAvailable
                ? 'Install Ready'
                : 'Browser Mode'}
          </span>
        </nav>

        <div
          className="app-header-user"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleMenuClose}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              clearCloseMenuTimeout()
              setMenuOpen(false)
            }
          }}
        >
          <button
            type="button"
            className="app-header-user-trigger"
            onClick={() => {
              clearCloseMenuTimeout()
              setMenuOpen((current) => !current)
            }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {user?.userName}
          </button>

          <div className={`app-header-user-menu ${menuOpen ? 'app-header-user-menu-open' : ''}`}>
            <NavLink
              to="/settings"
              className="app-header-user-menu-link"
              onClick={() => setMenuOpen(false)}
            >
              Settings
            </NavLink>
            <button
              type="button"
              className="header-logout-btn"
              onClick={(e) => {
                logout()
                setMenuOpen(false)
                e.preventDefault()
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      {updateStatusMessage ? (
        <p className="app-header-update-banner" role="status" aria-live="polite">
          {updateStatusMessage}
        </p>
      ) : null}
    </header>
  )
}
