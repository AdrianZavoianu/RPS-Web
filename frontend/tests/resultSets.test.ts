import { describe, expect, it } from 'vitest'

import type { ResultSet } from '../src/types'
import { isNlthaResultSet, isPushoverResultSet } from '../src/utils/resultSets'

function makeResultSet(overrides: Partial<ResultSet>): ResultSet {
  return {
    id: 1,
    name: 'RS-1',
    analysis_type: 'NLTHA',
    description: '',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('result set type guards', () => {
  it('detects pushover by analysis type', () => {
    const resultSet = makeResultSet({ analysis_type: 'Pushover', name: 'Baseline' })
    expect(isPushoverResultSet(resultSet)).toBe(true)
    expect(isNlthaResultSet(resultSet)).toBe(false)
  })

  it('detects pushover when explicit flag is present', () => {
    const resultSet = makeResultSet({ analysis_type: 'NLTHA', has_pushover_cases: true })
    expect(isPushoverResultSet(resultSet)).toBe(true)
  })

  it('detects pushover by result set name heuristics', () => {
    const resultSet = makeResultSet({ analysis_type: 'NLTHA', name: 'Tower Push X+' })
    expect(isPushoverResultSet(resultSet)).toBe(true)
  })

  it('treats non-pushover sets as nltha', () => {
    const resultSet = makeResultSet({ analysis_type: 'NLTHA', name: 'TH-SET' })
    expect(isPushoverResultSet(resultSet)).toBe(false)
    expect(isNlthaResultSet(resultSet)).toBe(true)
  })
})

