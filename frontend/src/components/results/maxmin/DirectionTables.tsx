import { memo, useMemo } from 'react'
import type { MaxMinDataset } from '../../../types'
import { getMinMax } from '../../../utils/gradients'
import { CompactTable } from './CompactTable'

export interface DirectionTablesProps {
  direction: string
  data: MaxMinDataset
  loadCases: string[]
  resultType: string
  unit: string
  fmt: (v: number | null | undefined) => string
}

export const DirectionTables = memo(function DirectionTables({
  direction,
  data,
  loadCases,
  resultType,
  unit,
  fmt,
}: DirectionTablesProps) {
  // Build max/min table data
  const { maxRows, minRows, maxRange, minRange } = useMemo(() => {
    const maxR: Array<Record<string, number | string | null>> = []
    const minR: Array<Record<string, number | string | null>> = []
    const allMaxVals: number[] = []
    const allMinVals: number[] = []

    for (const row of data.rows) {
      const mxRow: Record<string, number | string | null> = { Story: String(row['Story']) }
      const mnRow: Record<string, number | string | null> = { Story: String(row['Story']) }

      const lcMaxVals: number[] = []
      const lcMinVals: number[] = []

      for (const lc of loadCases) {
        const maxVal = row[`OrigMax_${lc}_${direction}`] as number | undefined
        const minVal = row[`OrigMin_${lc}_${direction}`] as number | undefined
        mxRow[lc] = maxVal ?? null
        mnRow[lc] = minVal ?? null
        if (maxVal != null) { allMaxVals.push(maxVal); lcMaxVals.push(maxVal) }
        if (minVal != null) { allMinVals.push(minVal); lcMinVals.push(minVal) }
      }

      // Avg column
      mxRow['Avg'] = lcMaxVals.length ? lcMaxVals.reduce((a, b) => a + b, 0) / lcMaxVals.length : null
      mnRow['Avg'] = lcMinVals.length ? lcMinVals.reduce((a, b) => a + b, 0) / lcMinVals.length : null
      if (mxRow['Avg'] != null) allMaxVals.push(mxRow['Avg'] as number)
      if (mnRow['Avg'] != null) allMinVals.push(mnRow['Avg'] as number)

      maxR.push(mxRow)
      minR.push(mnRow)
    }

    return {
      maxRows: maxR,
      minRows: minR,
      maxRange: getMinMax(allMaxVals),
      minRange: getMinMax(allMinVals),
    }
  }, [data.rows, loadCases, direction])

  const columns = [...loadCases, 'Avg']

  return (
    <div className="maxmin-direction-tables">
      <h3 className="text-sm font-medium text-text-primary mb-2">{direction} Direction</h3>
      <div className="flex gap-4">
        {/* Max table */}
        <div className="flex-1 overflow-auto max-h-[45vh]">
          <div className="text-xs font-medium text-text-secondary mb-1">Max ({unit})</div>
          <CompactTable
            rows={maxRows}
            columns={columns}
            range={maxRange}
            resultType={resultType}
            fmt={fmt}
          />
        </div>
        {/* Min table */}
        <div className="flex-1 overflow-auto max-h-[45vh]">
          <div className="text-xs font-medium text-text-secondary mb-1">Min ({unit})</div>
          <CompactTable
            rows={minRows}
            columns={columns}
            range={minRange}
            resultType={resultType}
            fmt={fmt}
          />
        </div>
      </div>
    </div>
  )
})

DirectionTables.displayName = 'DirectionTables'
