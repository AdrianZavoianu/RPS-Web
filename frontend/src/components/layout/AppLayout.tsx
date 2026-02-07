import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export function AppLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const authDisabled = import.meta.env.DEV
  const pathSegments = location.pathname.split('/').filter(Boolean)
  const hideHeader = pathSegments[0] === 'projects' && pathSegments.length > 1

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Header */}
      {!hideHeader && (
        <header className="h-20 bg-bg-primary flex items-center px-6">
          <span className="rps-logo" aria-label="RPS logo" role="img" />
          <div className="flex-1" />
          <nav className="flex items-center gap-2">
            <NavLink
              to="/home"
              className={({ isActive }) =>
                `nav-button ${isActive ? 'nav-button-active' : ''}`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/projects"
              className={({ isActive }) =>
                `nav-button ${isActive ? 'nav-button-active' : ''}`
              }
            >
              Projects
            </NavLink>
            <NavLink
              to="/docs"
              className={({ isActive }) =>
                `nav-button ${isActive ? 'nav-button-active' : ''}`
              }
            >
              Docs
            </NavLink>
          </nav>
          {!authDisabled && (
            <div className="ml-6 flex items-center gap-4">
              <span className="text-sm text-text-secondary">{user?.username}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
