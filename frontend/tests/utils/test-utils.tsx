import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement, ReactNode } from 'react'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

interface WrapperOptions {
  queryClient?: QueryClient
  initialEntries?: string[]
  withRouter?: boolean
}

function createWrapper({ queryClient, initialEntries, withRouter = false }: WrapperOptions = {}) {
  const client = queryClient ?? createTestQueryClient()

  return function Wrapper({ children }: { children: ReactNode }) {
    const content = <QueryClientProvider client={client}>{children}</QueryClientProvider>

    if (withRouter) {
      return <MemoryRouter initialEntries={initialEntries ?? ['/']}>{content}</MemoryRouter>
    }

    return content
  }
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  initialEntries?: string[]
  withRouter?: boolean
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient, initialEntries, withRouter, ...renderOptions }: RenderWithProvidersOptions = {}
) {
  const client = queryClient ?? createTestQueryClient()
  const wrapper = createWrapper({ queryClient: client, initialEntries, withRouter })

  return {
    ...render(ui, { wrapper, ...renderOptions }),
    queryClient: client,
  }
}

export { render, screen, within, waitFor, act, fireEvent } from '@testing-library/react'
export { renderHook } from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
