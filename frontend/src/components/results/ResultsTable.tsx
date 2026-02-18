/**
 * Results table component for displaying wide-format result data
 * Matches RPS desktop design: minimal, compact with gradient coloring
 * Supports column selection and hover for plot synchronization
 */

import { memo, useMemo, useState, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table'
import clsx from 'clsx'
import type { ResultDataset } from '../../types'
import { getGradientColor, getMinMax } from '../../utils/gradients'
import { collectNumericValues, formatResultValue } from './tableUtils'

interface ResultsTableProps {
  dataset: ResultDataset
  className?: string
  showGradient?: boolean
  selectedLoadCases?: Set<string>
  hoveredLoadCase?: string | null
  hoveredRow?: number | null
  selectedRows?: Set<number>
  onSelectionChange?: (selected: Set<string>) => void
  onHoverChange?: (loadCase: string | null) => void
  onRowHoverChange?: (row: number | null) => void
  onRowSelectionChange?: (selected: Set<number>) => void
}

function ResultsTableComponent({
  dataset,
  className,
  showGradient = true,
  selectedLoadCases = new Set(),
  hoveredLoadCase = null,
  hoveredRow = null,
  selectedRows = new Set(),
  onSelectionChange,
  onHoverChange,
  onRowHoverChange,
  onRowSelectionChange,
}: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)

  // Toggle load case selection
  const handleColumnClick = useCallback((columnName: string, isLoadCase: boolean) => {
    if (!isLoadCase || !onSelectionChange) return
    const newSelection = new Set(selectedLoadCases)
    if (newSelection.has(columnName)) {
      newSelection.delete(columnName)
    } else {
      newSelection.add(columnName)
    }
    onSelectionChange(newSelection)
  }, [selectedLoadCases, onSelectionChange])

  // Toggle row selection
  const handleRowClick = useCallback((rowIndex: number) => {
    if (!onRowSelectionChange) return
    const newSelection = new Set(selectedRows)
    if (newSelection.has(rowIndex)) {
      newSelection.delete(rowIndex)
    } else {
      newSelection.add(rowIndex)
    }
    onRowSelectionChange(newSelection)
  }, [selectedRows, onRowSelectionChange])

  const columnHelper = createColumnHelper<Record<string, unknown>>()
  const loadCaseColumns = useMemo(
    () => (Array.isArray(dataset.load_case_columns) ? dataset.load_case_columns : []),
    [dataset.load_case_columns]
  )
  const summaryColumns = useMemo(
    () => (Array.isArray(dataset.summary_columns) ? dataset.summary_columns : []),
    [dataset.summary_columns]
  )
  const storyColumn = useMemo(
    () =>
      typeof dataset.story_column === 'string' && dataset.story_column.length
        ? dataset.story_column
        : 'Story',
    [dataset.story_column]
  )

  // Calculate min/max for gradient coloring across all load case columns
  const { globalMinMax } = useMemo(() => {
    const allValues = collectNumericValues(dataset.rows, loadCaseColumns)

    return {
      globalMinMax: getMinMax(allValues),
    }
  }, [dataset.rows, loadCaseColumns])

  const columns = useMemo(() => {
    const cols = []

    // Story column (sticky, center aligned)
    cols.push(
      columnHelper.accessor(storyColumn, {
        header: storyColumn,
        cell: (info) => (
          <span className="results-table-story">{String(info.getValue())}</span>
        ),
        enableSorting: true,
      })
    )

    // Get result type for formatting
    const resultType = dataset.meta?.result_type

    // Load case columns with gradient coloring
    for (const lc of loadCaseColumns) {
      cols.push(
        columnHelper.accessor(lc, {
          header: lc,
          cell: (info) => {
            const value = info.getValue() as number | null
            if (value === null || value === undefined) return '-'

            const formatted = formatResultValue(value, resultType)

            if (showGradient) {
              const textColor = getGradientColor(
                value,
                globalMinMax.min,
                globalMinMax.max,
                resultType || ''
              )
              return (
                <span
                  className="results-table-value"
                  style={{ color: textColor }}
                >
                  {formatted}
                </span>
              )
            }

            return <span className="results-table-value">{formatted}</span>
          },
        })
      )
    }

    // Summary columns (Avg, Max, Min) - no gradient
    for (const col of summaryColumns) {
      cols.push(
        columnHelper.accessor(col, {
          header: col,
          cell: (info) => {
            const value = info.getValue() as number | null
            if (value === null || value === undefined) return '-'
            return (
              <span className="results-table-summary">
                {formatResultValue(value, resultType)}
              </span>
            )
          },
        })
      )
    }

    return cols
  }, [dataset, columnHelper, showGradient, globalMinMax, loadCaseColumns, summaryColumns, storyColumn])

  const table = useReactTable({
    data: dataset.rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Determine if a column is a load case column
  const isLoadCaseColumn = useCallback((columnId: string) => {
    return loadCaseColumns.includes(columnId)
  }, [loadCaseColumns])

  if (!dataset.rows.length) {
    return (
      <div className="results-table-empty flex items-center justify-center h-32 text-text-secondary text-sm">
        No data available
      </div>
    )
  }

  return (
    <div className={clsx('results-table-container', className)}>
      <table className="results-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header, idx) => {
                const columnId = header.column.id
                const isLoadCase = isLoadCaseColumn(columnId)
                const isSelected = selectedLoadCases.has(columnId)
                const isHovered = hoveredLoadCase === columnId

                return (
                  <th
                    key={header.id}
                    className={clsx(
                      'results-table-header',
                      idx === 0 && 'results-table-header-story',
                      idx === 0 && header.column.getCanSort() && 'results-table-header-sortable',
                      isLoadCase && 'results-table-header-selectable',
                      isSelected && 'results-table-header-selected',
                      isHovered && 'results-table-header-hovered'
                    )}
                    onClick={() => {
                      if (idx === 0) {
                        header.column.getToggleSortingHandler()?.(new MouseEvent('click'))
                      } else if (isLoadCase) {
                        handleColumnClick(columnId, true)
                      }
                    }}
                    onMouseEnter={() => isLoadCase && onHoverChange?.(columnId)}
                    onMouseLeave={() => isLoadCase && onHoverChange?.(null)}
                  >
                    <span className="results-table-header-text">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        <span className="results-table-sort-indicator">
                          {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, rowIndex) => {
            const isRowSelected = selectedRows.has(rowIndex)
            const isRowHovered = hoveredRow === rowIndex

            return (
              <tr
                key={row.id}
                className={clsx(
                  'results-table-row',
                  isRowSelected && 'results-table-row-selected',
                  isRowHovered && 'results-table-row-hovered'
                )}
              >
                {row.getVisibleCells().map((cell, idx) => {
                  const columnId = cell.column.id
                  const isColSelected = selectedLoadCases.has(columnId)
                  const isColHovered = hoveredLoadCase === columnId
                  const isCellHovered = hoveredCell?.row === rowIndex && hoveredCell?.col === idx
                  const isStoryCell = idx === 0
                  const isSummaryColumn = summaryColumns.includes(columnId)

                  return (
                    <td
                      key={cell.id}
                      className={clsx(
                        'results-table-cell',
                        isStoryCell && 'results-table-cell-story',
                        isStoryCell && 'results-table-cell-story-clickable',
                        isRowSelected && 'results-table-cell-row-selected',
                        isRowHovered && 'results-table-cell-row-hovered',
                        isColSelected && 'results-table-cell-selected',
                        isColHovered && 'results-table-cell-col-hovered',
                        isCellHovered &&
                          !isStoryCell &&
                          !isSummaryColumn &&
                          'results-table-cell-value-hovered'
                      )}
                      onClick={() => isStoryCell && handleRowClick(rowIndex)}
                      onMouseEnter={() => {
                        if (isStoryCell) {
                          onRowHoverChange?.(rowIndex)
                        } else {
                          setHoveredCell({ row: rowIndex, col: idx })
                        }
                      }}
                      onMouseLeave={() => {
                        if (isStoryCell) {
                          onRowHoverChange?.(null)
                        } else {
                          setHoveredCell(null)
                        }
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export const ResultsTable = memo(ResultsTableComponent)
