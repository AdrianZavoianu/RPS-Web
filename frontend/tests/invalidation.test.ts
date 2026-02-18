import { describe, expect, it, vi } from 'vitest'

import { queryKeys } from '../src/hooks/queryKeys'
import { invalidateByPrefix, invalidateProjectResults } from '../src/hooks/invalidation'

type QueryClientLike = {
  invalidateQueries: (params: { queryKey: readonly unknown[]; exact: boolean }) => void
}

describe('query invalidation helpers', () => {
  it('invalidates by prefix with non-exact matching', () => {
    const invalidateQueries = vi.fn()
    const queryClient: QueryClientLike = { invalidateQueries }
    const key = queryKeys.globalResults('proj-1')

    invalidateByPrefix(queryClient as never, key)

    expect(invalidateQueries).toHaveBeenCalledTimes(1)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: key, exact: false })
  })

  it('invalidates all project result-related query prefixes', () => {
    const invalidateQueries = vi.fn()
    const queryClient: QueryClientLike = { invalidateQueries }

    invalidateProjectResults(queryClient as never, 'proj-1')

    const calledKeys = invalidateQueries.mock.calls.map(([arg]) => arg.queryKey)
    expect(calledKeys).toContainEqual(queryKeys.resultSets('proj-1'))
    expect(calledKeys).toContainEqual(queryKeys.comparisonSets('proj-1'))
    expect(calledKeys).toContainEqual(queryKeys.timeSeriesData('proj-1'))
    expect(calledKeys).toContainEqual(queryKeys.pushoverCurvesBatch('proj-1'))
    expect(calledKeys).toHaveLength(19)
  })
})

