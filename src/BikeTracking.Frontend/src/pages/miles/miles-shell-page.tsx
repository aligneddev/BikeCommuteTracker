import { useAuth } from '../../context/auth-context'
import './miles-shell-page.css'

export function MilesShellPage() {
  const { user } = useAuth()

  return (
    <main className="miles-shell">
      <div className="miles-welcome">
        <h1>Welcome, {user?.userName}.</h1>
        <p>Your miles dashboard is coming soon.</p>
      </div>

      <div className="miles-placeholder" aria-label="Miles content placeholder">
        <p>Miles tracking will appear here.</p>
      </div>
    </main>
  )
}
