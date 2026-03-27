import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/auth-context'
import './app-header.css'

export function AppHeader() {
  const { user, logout } = useAuth()

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <NavLink to="/miles" className="app-header-brand">
          Commute Bike Tracker
        </NavLink>

        <nav className="app-header-nav" aria-label="Main navigation">
          <NavLink
            to="/miles"
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link-active' : 'nav-link'
            }
          >
            Dashboard
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
        </nav>

        <div className="app-header-user">
          <span className="app-header-username">{user?.userName}</span>
          <button type="button" className="header-logout-btn" onClick={logout}>
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}
