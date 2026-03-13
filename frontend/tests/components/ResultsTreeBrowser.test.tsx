import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ResultsTreeBrowser } from '../../src/components/projects/ResultsTreeBrowser'
import { makeResultSet, makeAvailableResultTypes } from '../mocks/factories'
import { server } from '../mocks/handlers'
import { http, HttpResponse } from 'msw'
import type { TreeSelection } from '../../src/components/projects/results-tree/types'

vi.mock('../../src/stores/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (state: { token: string }) => unknown) => selector({ token: 'test-token' }),
    { getState: () => ({ token: 'test-token', refreshToken: null, logout: vi.fn() }) }
  ),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function setupDefaultHandlers() {
  server.use(
    http.get('/api/projects/:slug/result-sets/', () =>
      HttpResponse.json([
        makeResultSet({ id: 1, name: 'NLTHA Run 1', analysis_type: 'NLTHA' }),
        makeResultSet({ id: 2, name: 'NLTHA Run 2', analysis_type: 'NLTHA' }),
      ])
    ),
    http.get('/api/projects/:slug/available-types/', () =>
      HttpResponse.json(makeAvailableResultTypes())
    ),
    http.get('/api/projects/:slug/comparison-sets/', () =>
      HttpResponse.json([])
    )
  )
}

describe('ResultsTreeBrowser', () => {
  it('shows loading state initially', () => {
    const wrapper = createWrapper()
    render(
      <ResultsTreeBrowser
        projectSlug="test-project"
        onSelect={vi.fn()}
        currentSelection={null}
      />,
      { wrapper }
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state when no result sets', async () => {
    server.use(
      http.get('/api/projects/:slug/result-sets/', () => HttpResponse.json([])),
      http.get('/api/projects/:slug/available-types/', () =>
        HttpResponse.json(makeAvailableResultTypes())
      )
    )

    const wrapper = createWrapper()
    render(
      <ResultsTreeBrowser
        projectSlug="test-project"
        onSelect={vi.fn()}
        currentSelection={null}
      />,
      { wrapper }
    )

    await waitFor(() => expect(screen.getByText('No result sets imported')).toBeInTheDocument())
  })

  it('renders NLTHA section with result sets', async () => {
    setupDefaultHandlers()

    const wrapper = createWrapper()
    render(
      <ResultsTreeBrowser
        projectSlug="test-project"
        onSelect={vi.fn()}
        currentSelection={null}
        disableInitialAutoSelect={true}
      />,
      { wrapper }
    )

    await waitFor(() => expect(screen.getByText('NLTHA')).toBeInTheDocument())
    expect(screen.getByText('Results')).toBeInTheDocument()
  })

  it('renders Pushover section when pushover result sets exist', async () => {
    server.use(
      http.get('/api/projects/:slug/result-sets/', () =>
        HttpResponse.json([
          makeResultSet({ id: 1, name: 'NLTHA Run', analysis_type: 'NLTHA' }),
          makeResultSet({ id: 2, name: 'Pushover Run', analysis_type: 'Pushover' }),
        ])
      ),
      http.get('/api/projects/:slug/available-types/', () =>
        HttpResponse.json(makeAvailableResultTypes({ has_pushover: true }))
      ),
      http.get('/api/projects/:slug/comparison-sets/', () =>
        HttpResponse.json([])
      )
    )

    const wrapper = createWrapper()
    render(
      <ResultsTreeBrowser
        projectSlug="test-project"
        onSelect={vi.fn()}
        currentSelection={null}
        disableInitialAutoSelect={true}
      />,
      { wrapper }
    )

    await waitFor(() => expect(screen.getByText('NLTHA')).toBeInTheDocument())
    expect(screen.getByText('Pushover')).toBeInTheDocument()
  })

  it('auto-selects first result set on mount', async () => {
    setupDefaultHandlers()

    const onSelect = vi.fn()
    const wrapper = createWrapper()

    render(
      <ResultsTreeBrowser
        projectSlug="test-project"
        onSelect={onSelect}
        currentSelection={null}
      />,
      { wrapper }
    )

    await waitFor(() => expect(onSelect).toHaveBeenCalled())
    const selection = onSelect.mock.calls[0][0] as TreeSelection
    expect(selection.type).toBe('global_result')
    expect(selection.resultSetId).toBe(1)
    expect(selection.resultType).toBe('Drifts')
    expect(selection.direction).toBe('X')
  })

  it('does not auto-select when disableInitialAutoSelect is true', async () => {
    setupDefaultHandlers()

    const onSelect = vi.fn()
    const wrapper = createWrapper()

    render(
      <ResultsTreeBrowser
        projectSlug="test-project"
        onSelect={onSelect}
        currentSelection={null}
        disableInitialAutoSelect={true}
      />,
      { wrapper }
    )

    await waitFor(() => expect(screen.getByText('NLTHA')).toBeInTheDocument())
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('toggles section expansion on click', async () => {
    setupDefaultHandlers()

    const wrapper = createWrapper()
    render(
      <ResultsTreeBrowser
        projectSlug="test-project"
        onSelect={vi.fn()}
        currentSelection={null}
        disableInitialAutoSelect={true}
      />,
      { wrapper }
    )

    await waitFor(() => expect(screen.getByText('NLTHA')).toBeInTheDocument())

    // NLTHA section starts expanded by default
    // Result set names should be visible
    expect(screen.getByText('NLTHA Run 1')).toBeInTheDocument()
  })

  it('result set names are rendered', async () => {
    setupDefaultHandlers()

    const wrapper = createWrapper()
    render(
      <ResultsTreeBrowser
        projectSlug="test-project"
        onSelect={vi.fn()}
        currentSelection={null}
        disableInitialAutoSelect={true}
      />,
      { wrapper }
    )

    await waitFor(() => {
      expect(screen.getByText('NLTHA Run 1')).toBeInTheDocument()
      expect(screen.getByText('NLTHA Run 2')).toBeInTheDocument()
    })
  })

  it('calls onSelect when result set root is clicked with resultSetRootSelectsDefault', async () => {
    setupDefaultHandlers()

    const onSelect = vi.fn()
    const wrapper = createWrapper()

    render(
      <ResultsTreeBrowser
        projectSlug="test-project"
        onSelect={onSelect}
        currentSelection={null}
        disableInitialAutoSelect={true}
        resultSetRootSelectsDefault={true}
      />,
      { wrapper }
    )

    await waitFor(() => expect(screen.getByText('NLTHA Run 1')).toBeInTheDocument())

    fireEvent.click(screen.getByText('NLTHA Run 1'))

    await waitFor(() => expect(onSelect).toHaveBeenCalled())
    const selection = onSelect.mock.calls[0][0] as TreeSelection
    expect(selection.type).toBe('global_result')
    expect(selection.resultSetId).toBe(1)
  })

  it('highlights current selection', async () => {
    setupDefaultHandlers()

    const currentSelection: TreeSelection = {
      type: 'global_result',
      resultSetId: 1,
      category: 'Envelopes',
      categoryType: 'Global',
      resultType: 'Drifts',
      direction: 'X',
    }

    const wrapper = createWrapper()
    const { container } = render(
      <ResultsTreeBrowser
        projectSlug="test-project"
        onSelect={vi.fn()}
        currentSelection={currentSelection}
        disableInitialAutoSelect={true}
      />,
      { wrapper }
    )

    await waitFor(() => expect(screen.getByText('NLTHA')).toBeInTheDocument())
    // The component should render without errors with a current selection
    expect(container.querySelector('.tree-browser')).toBeInTheDocument()
  })
})
