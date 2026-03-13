import { memo, useMemo } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import clsx from 'clsx'
import type { ComparisonDataset } from '../../types'
import { getGradientColor, getMinMax } from '../../utils/gradients'
import { collectNumericValues, formatResultValue } from './tableUtils'

interface ComparisonTableProps {
  dataset: Pick<ComparisonDataset, 'rows' | 'series' | 'ratio_column' | 'metric' | 'result_type' | 'decimals'>
  className?: string
}

function ComparisonTableComponent({ dataset, className }: ComparisonTableProps) {
  const columnHelper = createColumnHelper<Record<string, unknown>>()

  const globalMinMax = useMemo(() => {
    const columnKeys = dataset.series.map((series) => `${series.result_set_name}_${dataset.metric}`)
    const allValues = collectNumericValues(dataset.rows, columnKeys)
    return getMinMax(allValues)
  }, [dataset.metric, dataset.rows, dataset.series])

  const columns = useMemo(() => {
    const cols = []

    cols.push(
      columnHelper.accessor('Story', {
        header: 'Story',
        cell: (info) => (
          <span className="results-table-story">{String(info.getValue())}</span>
        ),
      })
    )

    for (const series of dataset.series) {
      const colKey = `${series.result_set_name}_${dataset.metric}`
      cols.push(
        columnHelper.accessor(colKey, {
          header: series.result_set_name,
          cell: (info) => {
            const value = info.getValue() as number | null
            if (value === null || value === undefined) return '-'

            const textColor = getGradientColor(value, globalMinMax.min, globalMinMax.max, '')
            return (
              <span
                className="results-table-value"
                style={{ color: textColor }}
              >
                {formatResultValue(value, dataset.decimals)}
              </span>
            )
          },
        })
      )
    }

    if (dataset.ratio_column) {
      cols.push(
        columnHelper.accessor(dataset.ratio_column, {
          header: 'Ratio',
          cell: (info) => {
            const value = info.getValue() as number | null
            if (value === null || value === undefined) return '-'
            return (
              <span
                className={clsx('results-table-ratio', {
                  'results-table-ratio-good': value <= 1,
                  'results-table-ratio-warn': value > 1 && value <= 1.2,
                  'results-table-ratio-bad': value > 1.2,
                })}
              >
                {value.toFixed(2)}
              </span>
            )
          },
        })
      )
    }

    return cols
  }, [dataset, columnHelper, globalMinMax])

  const table = useReactTable({
    data: dataset.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (!dataset.rows.length) {
    return (
      <div className="results-table-empty flex items-center justify-center h-32 text-text-secondary text-sm">
        No comparison data available
      </div>
    )
  }

  return (
    <div className={clsx('results-table-container', className)}>
      <table className="results-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header, idx) => (
                <th
                  key={header.id}
                  className={clsx(
                    'results-table-header',
                    idx === 0 && 'results-table-header-story'
                  )}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="results-table-row">
              {row.getVisibleCells().map((cell, idx) => (
                <td
                  key={cell.id}
                  className={clsx(
                    'results-table-cell',
                    idx === 0 && 'results-table-cell-story'
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const ComparisonTable = memo(ComparisonTableComponent)
