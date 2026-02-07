import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Unhandled React error:', error, errorInfo)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="app-error-boundary min-h-screen flex items-center justify-center bg-bg-primary p-6">
        <div className="app-error-boundary-content max-w-xl w-full bg-bg-secondary border border-border-default rounded-lg p-6">
          <h1 className="text-xl font-semibold text-text-primary">Something went wrong</h1>
          <p className="mt-2 text-text-secondary">
            The application hit an unexpected error. Reload to recover.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-4 p-3 rounded bg-bg-primary text-xs text-text-muted overflow-x-auto">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-4 px-4 py-2 rounded bg-accent-primary text-white hover:opacity-90 transition-opacity"
          >
            Reload app
          </button>
        </div>
      </div>
    )
  }
}
