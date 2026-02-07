import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { useAuthStore } from './stores/authStore'

const AppLayout = lazy(() =>
  import('./components/layout/AppLayout').then((module) => ({ default: module.AppLayout }))
)
const DocsPage = lazy(() =>
  import('./pages/DocsPage').then((module) => ({ default: module.DocsPage }))
)
const HomePage = lazy(() =>
  import('./pages/HomePage').then((module) => ({ default: module.HomePage }))
)
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage }))
)
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage').then((module) => ({ default: module.ProjectsPage }))
)
const ProjectDetailPage = lazy(() =>
  import('./pages/ProjectDetailPage').then((module) => ({ default: module.ProjectDetailPage }))
)

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const authDisabled = import.meta.env.DEV

  if (!authDisabled && !isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  const authDisabled = import.meta.env.DEV
  const routeFallback = (
    <div className="h-full min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="text-text-secondary">Loading page...</div>
    </div>
  )

  return (
    <ErrorBoundary>
      <Suspense fallback={routeFallback}>
        <Routes>
          <Route
            path="/login"
            element={authDisabled ? <Navigate to="/projects" replace /> : <LoginPage />}
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/projects" replace />} />
            <Route path="home" element={<HomePage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:slug/*" element={<ProjectDetailPage />} />
            <Route path="docs" element={<DocsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
