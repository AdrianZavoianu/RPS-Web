import { getResultTypeDecimals } from '../../utils/resultConfig'

export function collectNumericValues(
  rows: Record<string, unknown>[],
  columnKeys: string[]
): number[] {
  const values: number[] = []

  for (const row of rows) {
    for (const columnKey of columnKeys) {
      const value = row[columnKey]
      if (typeof value === 'number' && Number.isFinite(value)) {
        values.push(value)
      }
    }
  }

  return values
}

export function formatResultValue(value: number, resultType?: string): string {
  const decimals = getResultTypeDecimals(resultType)
  return value.toFixed(decimals)
}
