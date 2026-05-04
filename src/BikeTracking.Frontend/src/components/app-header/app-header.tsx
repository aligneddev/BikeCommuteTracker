import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/auth-context'
import './app-header.css'

export function AppHeader() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState<boolean>(false)

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <NavLink to="/dashboard" className="app-header-brand">
          Commute Bike Tracker
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
        </nav>

        <div
          className="app-header-user"
          onMouseEnter={() => setMenuOpen(true)}
          onMouseLeave={() => setMenuOpen(false)}
        >
          <button
            type="button"
            className="app-header-user-trigger"
            onClick={() => setMenuOpen((current) => !current)}
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
            <button type="button" className="header-logout-btn" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
