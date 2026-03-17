import { memo } from 'react'
import { getGradientColor } from '../../../utils/gradients'
import { AVERAGE_LINE_COLOR } from '../../../utils/colors'

export interface CompactTableProps {
  rows: Array<Record<string, number | string | null>>
  columns: string[]
  range: { min: number; max: number }
  resultType: string
  fmt: (v: number | null | undefined) => string
}

export const CompactTable = memo(function CompactTable({
  rows,
  columns,
  range,
  resultType,
  fmt,
}: CompactTableProps) {
  return (
    <table className="maxmin-compact-table results-table w-full">
      <thead className="sticky top-0 z-10">
        <tr>
          <th className="results-table-header results-table-header-story">Story</th>
          {columns.map((col) => (
            <th
              key={col}
              className="results-table-header"
              style={col === 'Avg' ? { color: AVERAGE_LINE_COLOR } : undefined}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className="results-table-row">
            <td className="results-table-cell results-table-cell-story">{String(row['Story'])}</td>
            {columns.map((col) => {
              const val = row[col] as number | null
              const isAvg = col === 'Avg'
              const textColor = val != null && range.min !== range.max
                ? getGradientColor(val, range.min, range.max, resultType)
                : undefined
              return (
                <td
                  key={col}
                  className="results-table-cell"
                  style={{
                    color: isAvg ? AVERAGE_LINE_COLOR : textColor,
                  }}
                >
                  <span className={isAvg ? 'results-table-summary' : 'results-table-value'}>
                    {fmt(val)}
                  </span>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
})

CompactTable.displayName = 'CompactTable'
