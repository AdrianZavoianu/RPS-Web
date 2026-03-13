import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../../src/components/common/ErrorBoundary'

function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render crash')
  }

  return <p>Healthy content</p>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Healthy content')).toBeInTheDocument()
  })

  it('shows fallback UI when child crashes and supports reload action', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    )

    rerender(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByText('The application hit an unexpected error. Reload to recover.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Healthy content')).not.toBeInTheDocument()

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Reload app' }))
    }).not.toThrow()
  })
})
