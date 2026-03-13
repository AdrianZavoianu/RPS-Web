import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'

export function AppLayout() {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
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
    <div className="h-screen flex flex-col bg-bg-primary">
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
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle ml-4"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
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
