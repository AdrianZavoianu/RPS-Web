import type { ResultSet } from '../types'

export function isPushoverResultSet(resultSet: ResultSet): boolean {
  const analysisType = String(resultSet.analysis_type || '').trim().toLowerCase()
  const name = String(resultSet.name || '').trim().toLowerCase()
  const hasPushoverInName = name.includes('pushover') || name.includes('push')

  return (
    analysisType === 'pushover' ||
    resultSet.has_pushover_cases === true ||
    hasPushoverInName
  )
}

export function isNlthaResultSet(resultSet: ResultSet): boolean {
  return !isPushoverResultSet(resultSet)
}
