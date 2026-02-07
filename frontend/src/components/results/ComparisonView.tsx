/**
 * Comparison view component for comparing results across multiple result sets
 */

import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { useResultSets, useComparisonData, useAvailableResultTypes } from '../../hooks/useResults'
import { ComparisonTable } from './ComparisonTable'
import { ProfileChart } from '../charts/ProfileChart'
import { ProjectBrowserNav } from '../projects/ProjectBrowserNav'
import type { GlobalResultType, ProfileChartData } from '../../types'
import { COMPARISON_SERIES_COLORS } from '../../utils/chartColors'

interface ComparisonViewProps {
  projectSlug: string
}

export function ComparisonView({ projectSlug }: ComparisonViewProps) {
  const [selectedResultSetIds, setSelectedResultSetIds] = useState<number[]>([])
  const [selectedResultType, setSelectedResultType] = useState<GlobalResultType>('Drifts')
  const [selectedDirection, setSelectedDirection] = useState<string>('X')
  const [selectedMetric, setSelectedMetric] = useState<'Avg' | 'Max' | 'Min'>('Avg')
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')

  const { data: resultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)

  // Get comparison data when at least 2 result sets selected
  const { data: comparisonData, isLoading: comparisonLoading } = useComparisonData(
    projectSlug,
    selectedResultSetIds.length >= 2
      ? {
          result_set_ids: selectedResultSetIds,
          result_type: selectedResultType,
          direction: selectedDirection,
          metric: selectedMetric,
        }
      : null
  )

  // Get directions for selected result type
  const directions = availableTypes?.global_results.find(
    (r) => r.type === selectedResultType
  )?.directions || ['X', 'Y']

  // Toggle result set selection
  const toggleResultSet = (id: number) => {
    setSelectedResultSetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // Convert comparison data to chart format
  const chartData: ProfileChartData | null = useMemo(() => {
    if (!comparisonData || !comparisonData.rows.length) return null

    const stories = comparisonData.rows.map((r) => String(r['Story'] || ''))
    const series = comparisonData.series
      .filter((s) => s.has_data)
      .map((s, idx) => {
        const colKey = `${s.result_set_name}_${comparisonData.metric}`
        return {
          name: s.result_set_name,
          values: comparisonData.rows.map((r) => (r[colKey] as number) || 0),
          color: COMPARISON_SERIES_COLORS[idx % COMPARISON_SERIES_COLORS.length],
        }
      })

    return {
      stories,
      series,
      unit: availableTypes?.global_results.find((r) => r.type === selectedResultType)?.unit || '',
      title: `${selectedResultType} ${selectedDirection} - ${selectedMetric} Comparison`,
    }
  }, [comparisonData, availableTypes, selectedResultType, selectedDirection, selectedMetric])

  return (
    <div className="comparison-view h-full flex">
      {/* Left Panel - Configuration */}
      <div className="comparison-sidebar w-[200px] bg-bg-secondary border-r border-border-default flex flex-col overflow-auto">
        <ProjectBrowserNav projectSlug={projectSlug} />
        {/* Result Set Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Select Result Sets</h3>
          <p className="text-xs text-text-muted mb-3">Select at least 2 result sets</p>
          {resultSetsLoading ? (
            <div className="text-sm text-text-muted">Loading...</div>
          ) : resultSets?.length ? (
            <div className="space-y-1">
              {resultSets.map((rs) => (
                <label
                  key={rs.id}
                  className={clsx(
                    'browser-item flex items-center gap-2 cursor-pointer',
                    selectedResultSetIds.includes(rs.id) && 'browser-item-active'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedResultSetIds.includes(rs.id)}
                    onChange={() => toggleResultSet(rs.id)}
                    className="w-4 h-4 rounded border-border-default bg-bg-primary checked:bg-accent-primary"
                  />
                  <span className="text-sm text-text-primary">{rs.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-sm text-text-muted">No result sets available</div>
          )}
        </div>

        {/* Result Type Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Result Type</h3>
          <select
            value={selectedResultType}
            onChange={(e) => setSelectedResultType(e.target.value as GlobalResultType)}
            className="w-full px-2 py-1.5 bg-bg-primary border border-border-default rounded text-sm text-text-primary"
          >
            {availableTypes?.global_results.map((rt) => (
              <option key={rt.type} value={rt.type}>
                {rt.type}
              </option>
            ))}
          </select>
        </div>

        {/* Direction Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Direction</h3>
          <div className="flex gap-2">
            {directions.map((dir) => (
              <button
                key={dir}
                onClick={() => setSelectedDirection(dir)}
                className={clsx(
                  'flex-1 px-3 py-1.5 rounded text-sm transition-colors',
                  selectedDirection === dir
                    ? 'bg-accent-primary text-white'
                    : 'bg-bg-primary text-text-secondary hover:bg-bg-hover'
                )}
              >
                {dir}
              </button>
            ))}
          </div>
        </div>

        {/* Metric Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Comparison Metric</h3>
          <div className="flex gap-2">
            {(['Avg', 'Max', 'Min'] as const).map((metric) => (
              <button
                key={metric}
                onClick={() => setSelectedMetric(metric)}
                className={clsx(
                  'flex-1 px-3 py-1.5 rounded text-sm transition-colors',
                  selectedMetric === metric
                    ? 'bg-accent-primary text-white'
                    : 'bg-bg-primary text-text-secondary hover:bg-bg-hover'
                )}
              >
                {metric}
              </button>
            ))}
          </div>
        </div>

        {/* Warnings */}
        {comparisonData?.warnings && comparisonData.warnings.length > 0 && (
          <div className="browser-section">
            <h3 className="text-sm font-medium text-warning mb-2">Warnings</h3>
            <ul className="text-xs text-text-muted space-y-1">
              {comparisonData.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="comparison-content flex-1 flex flex-col overflow-hidden">
        {selectedResultSetIds.length >= 2 ? (
          <>
            {/* Toolbar */}
            <div className="comparison-toolbar flex items-center justify-between px-3 py-2 border-b border-border-default bg-bg-secondary">
              <div className="text-sm text-text-primary">
                {selectedResultType} {selectedDirection} - {selectedMetric}
                <span className="text-text-muted ml-2">
                  ({selectedResultSetIds.length} result sets)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('table')}
                  className={clsx(
                    'px-3 py-1.5 rounded text-sm transition-colors',
                    viewMode === 'table'
                      ? 'bg-accent-primary text-white'
                      : 'bg-bg-primary text-text-secondary hover:bg-bg-hover'
                  )}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('chart')}
                  className={clsx(
                    'px-3 py-1.5 rounded text-sm transition-colors',
                    viewMode === 'chart'
                      ? 'bg-accent-primary text-white'
                      : 'bg-bg-primary text-text-secondary hover:bg-bg-hover'
                  )}
                >
                  Chart
                </button>
              </div>
            </div>

            {/* Data Display */}
            <div className="comparison-data flex-1 overflow-auto p-2">
              {comparisonLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">Loading comparison data...</div>
                </div>
              ) : viewMode === 'table' && comparisonData ? (
                <ComparisonTable
                  dataset={{
                    rows: comparisonData.rows,
                    series: comparisonData.series,
                    ratio_column: comparisonData.ratio_column,
                    metric: comparisonData.metric,
                  }}
                  className="h-full"
                />
              ) : viewMode === 'chart' && chartData ? (
                <div className="h-full">
                  <ProfileChart data={chartData} />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">No comparison data available</div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-text-secondary mb-2">Select at least 2 result sets to compare</p>
              <p className="text-text-muted text-sm">
                Use the checkboxes on the left to select result sets
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
