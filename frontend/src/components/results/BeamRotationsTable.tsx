import { useMemo } from 'react'

import type { BeamRotationsTableData } from '../../types'
import { getGradientColor, getMinMax } from '../../utils/gradients'

interface BeamRotationsTableProps {
  data: BeamRotationsTableData
}

export function BeamRotationsTable({ data }: BeamRotationsTableProps) {
  const columns = data.columns
  const rows = data.rows
  const loadCaseColumns = data.load_case_columns
  const summaryColumns = data.summary_columns

  const numericRange = useMemo(() => {
    const values: number[] = []
    for (const row of rows) {
      for (const column of [...loadCaseColumns, ...summaryColumns]) {
        const value = row[column]
        if (typeof value === 'number' && Number.isFinite(value)) {
          values.push(value)
        }
      }
    }
    return getMinMax(values)
  }, [loadCaseColumns, rows, summaryColumns])

  if (!columns.length || !rows.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted">No beam rotation table data available</div>
      </div>
    )
  }

  return (
    <div className="results-table-container flex-1 overflow-auto">
      <table className="results-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="results-table-header">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${String(row.Story)}-${String(row['Frame/Wall'])}`} className="results-table-row">
              {columns.map((column) => {
                const value = row[column]
                const isNumericColumn =
                  loadCaseColumns.includes(column) || summaryColumns.includes(column)
                const displayValue =
                  typeof value === 'number'
                    ? column === 'Rel Dist'
                      ? value.toFixed(2)
                      : value.toFixed(2)
                    : value ?? ''

                const color =
                  isNumericColumn && typeof value === 'number'
                    ? getGradientColor(value, numericRange.min, numericRange.max, 'BeamRotations')
                    : undefined

                return (
                  <td
                    key={`${rowIndex}-${column}`}
                    className="results-table-cell"
                  >
                    <span style={color ? { color } : undefined}>{String(displayValue)}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
