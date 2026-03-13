import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useExportDialogState } from '../../src/components/exports/useExportDialogState'
import { makeResultSet, makeExportJob, makeAvailableResultTypes } from '../mocks/factories'

const mockStartExportMutation = { mutateAsync: vi.fn(), isPending: false }
const mockCancelExportMutation = { mutateAsync: vi.fn(), isPending: false }
const mockExportJobData = { data: undefined as ReturnType<typeof makeExportJob> | undefined }
const mockResultSetsData = { data: undefined as ReturnType<typeof makeResultSet>[] | undefined }
const mockAvailableTypesData = { data: undefined as ReturnType<typeof makeAvailableResultTypes> | undefined }

vi.mock('../../src/hooks/useExports', () => ({
  useStartExport: () => mockStartExportMutation,
  useCancelExport: () => mockCancelExportMutation,
  useExportJob: () => mockExportJobData,
}))

vi.mock('../../src/hooks/useResults', () => ({
  useResultSets: () => mockResultSetsData,
  useAvailableResultTypes: () => mockAvailableTypesData,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useExportDialogState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExportJobData.data = undefined
    mockResultSetsData.data = [makeResultSet({ id: 1 }), makeResultSet({ id: 2 })]
    mockAvailableTypesData.data = makeAvailableResultTypes()
  })

  it('starts in configure step', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )
    expect(result.current.step).toBe('configure')
  })

  it('auto-selects first result set', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.selectedResultSetId).toBe(1))
  })

  it('auto-populates all available types', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.selectedGlobalTypes.length).toBeGreaterThan(0))
    expect(result.current.selectedGlobalTypes).toContain('Drifts')
    expect(result.current.selectedGlobalTypes).toContain('Accelerations')
    expect(result.current.selectedElementTypes).toContain('WallShears')
    expect(result.current.selectedJointTypes).toContain('SoilPressures')
  })

  it('toggleDirection adds/removes direction', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )

    // Default directions are ['X', 'Y']
    expect(result.current.selectedDirections).toContain('X')

    act(() => result.current.toggleDirection('X'))
    expect(result.current.selectedDirections).not.toContain('X')

    act(() => result.current.toggleDirection('X'))
    expect(result.current.selectedDirections).toContain('X')
  })

  it('toggleGlobalType adds/removes type', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.selectedGlobalTypes).toContain('Drifts'))

    act(() => result.current.toggleGlobalType('Drifts'))
    expect(result.current.selectedGlobalTypes).not.toContain('Drifts')

    act(() => result.current.toggleGlobalType('Drifts'))
    expect(result.current.selectedGlobalTypes).toContain('Drifts')
  })

  it('clearGlobalTypes empties the selection', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.selectedGlobalTypes.length).toBeGreaterThan(0))

    act(() => result.current.clearGlobalTypes())
    expect(result.current.selectedGlobalTypes).toHaveLength(0)
  })

  it('selectAllGlobalTypes restores all types', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.selectedGlobalTypes.length).toBeGreaterThan(0))

    act(() => result.current.clearGlobalTypes())
    expect(result.current.selectedGlobalTypes).toHaveLength(0)

    act(() => result.current.selectAllGlobalTypes())
    expect(result.current.selectedGlobalTypes).toHaveLength(4)
  })

  it('canStartExport is false without result set', () => {
    mockResultSetsData.data = undefined

    const wrapper = createWrapper()
    const { result } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )

    // No result set selected → can't start
    expect(result.current.canStartExport).toBe(false)
  })

  it('canStartExport is true when result set and types are selected', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.canStartExport).toBe(true))
  })

  it('setFormat switches between excel and csv', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )

    expect(result.current.format).toBe('excel')

    act(() => result.current.setFormat('csv'))
    expect(result.current.format).toBe('csv')
  })

  it('setIncludeSummary toggles summary flag', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )

    expect(result.current.includeSummary).toBe(true)

    act(() => result.current.setIncludeSummary(false))
    expect(result.current.includeSummary).toBe(false)
  })

  it('handleDialogClose calls onClose when not exporting', () => {
    const onClose = vi.fn()
    const wrapper = createWrapper()
    const { result } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose }),
      { wrapper }
    )

    act(() => result.current.handleDialogClose())
    expect(onClose).toHaveBeenCalled()
  })

  it('export job completion sets step to complete', async () => {
    const wrapper = createWrapper()
    const { result, rerender } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )

    mockExportJobData.data = makeExportJob({ id: 1, status: 'completed', progress: 100 })
    rerender()

    await waitFor(() => expect(result.current.step).toBe('complete'))
  })

  it('failed export job sets step to complete (shows failure state)', async () => {
    const wrapper = createWrapper()
    const { result, rerender } = renderHook(
      () => useExportDialogState({ projectSlug: 'test-project', onClose: vi.fn() }),
      { wrapper }
    )

    mockExportJobData.data = makeExportJob({ id: 1, status: 'failed', error_message: 'Disk full' })
    rerender()

    await waitFor(() => expect(result.current.step).toBe('complete'))
  })
})
