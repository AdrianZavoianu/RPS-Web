/**
 * Element Results View component
 * Displays results for structural elements (Walls, Columns, Beams)
 */

import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import {
  useResultSets,
  useAvailableResultTypes,
  useElementsForType,
  useElementResults,
} from '../../hooks/useResults'
import { ResultsTable } from './ResultsTable'
import { ProfileChart } from '../charts/ProfileChart'
import { ProjectBrowserNav } from '../projects/ProjectBrowserNav'
import type { ElementResultType } from '../../types'

interface ElementResultsViewProps {
  projectSlug: string
}

// Map element result types to element categories
const ELEMENT_TYPE_MAP: Record<string, string> = {
  WallShears: 'Wall',
  QuadRotations: 'Wall',
  ColumnShears: 'Column',
  ColumnAxials: 'Column',
  ColumnRotations: 'Column',
  BeamRotations: 'Beam',
}

export function ElementResultsView({ projectSlug }: ElementResultsViewProps) {
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedResultType, setSelectedResultType] = useState<ElementResultType>('WallShears')
  const [selectedElementId, setSelectedElementId] = useState<number | null>(null)
  const [selectedDirection, setSelectedDirection] = useState<string>('V2')
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')

  const { data: resultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)

  // Auto-select first result set
  useEffect(() => {
    if (resultSets?.length && !selectedResultSetId) {
      setSelectedResultSetId(resultSets[0].id)
    }
  }, [resultSets, selectedResultSetId])

  // Get elements for selected result type
  const { data: elementsData } = useElementsForType(
    projectSlug,
    selectedResultSetId
      ? {
          result_set_id: selectedResultSetId,
          result_type: selectedResultType,
        }
      : null
  )
  const elements = useMemo(() => elementsData?.elements ?? [], [elementsData])

  // Auto-select first element
  useEffect(() => {
    if (elements.length && !selectedElementId) {
      setSelectedElementId(elements[0].id)
    }
  }, [elements, selectedElementId])

  // Reset element selection when result type changes
  useEffect(() => {
    setSelectedElementId(null)
  }, [selectedResultType])

  // Get element results
  const { data: resultsData, isLoading: resultsLoading } = useElementResults(
    projectSlug,
    selectedResultSetId && selectedElementId
      ? {
          result_set_id: selectedResultSetId,
          element_id: selectedElementId,
          result_type: selectedResultType,
          direction: selectedDirection,
        }
      : null
  )

  // Get available element result types
  const elementResultTypes = availableTypes?.element_results || []

  // Get directions for selected result type
  const directions = availableTypes?.element_results.find(
    (r) => r.type === selectedResultType
  )?.directions || ['V2', 'V3']

  return (
    <div className="element-results-view h-full flex">
      {/* Left Panel - Configuration */}
      <div className="element-sidebar w-[200px] bg-bg-secondary border-r border-border-default flex flex-col overflow-auto">
        <ProjectBrowserNav projectSlug={projectSlug} />
        {/* Result Set Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Result Set</h3>
          {resultSetsLoading ? (
            <div className="text-sm text-text-muted">Loading...</div>
          ) : resultSets?.length ? (
            <select
              value={selectedResultSetId || ''}
              onChange={(e) => setSelectedResultSetId(Number(e.target.value))}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border-default rounded text-sm text-text-primary"
            >
              {resultSets.map((rs) => (
                <option key={rs.id} value={rs.id}>
                  {rs.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-text-muted">No result sets available</div>
          )}
        </div>

        {/* Result Type Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Element Result Type</h3>
          <select
            value={selectedResultType}
            onChange={(e) => setSelectedResultType(e.target.value as ElementResultType)}
            className="w-full px-2 py-1.5 bg-bg-primary border border-border-default rounded text-sm text-text-primary"
          >
            {elementResultTypes.map((rt) => (
              <option key={rt.type} value={rt.type}>
                {rt.type}
              </option>
            ))}
          </select>
        </div>

        {/* Element Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">
            Select {ELEMENT_TYPE_MAP[selectedResultType] || 'Element'}
          </h3>
          {elements.length ? (
            <div className="space-y-1 max-h-48 overflow-auto">
              {elements.map((el) => (
                <button
                  key={el.id}
                  onClick={() => setSelectedElementId(el.id)}
                  className={clsx(
                    'browser-item',
                    selectedElementId === el.id
                      ? 'browser-item-active'
                      : null
                  )}
                >
                  {el.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-text-muted">
              No elements found for this result type
            </div>
          )}
        </div>

        {/* Direction Selection */}
        {directions && directions.length > 0 && (
          <div className="browser-section">
            <h3 className="browser-section-title">Direction</h3>
            <div className="flex flex-wrap gap-2">
              {directions.map((dir) => (
                <button
                  key={dir}
                  onClick={() => setSelectedDirection(dir)}
                  className={clsx(
                    'px-3 py-1.5 rounded text-sm transition-colors',
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
        )}
      </div>

      {/* Main Content */}
      <div className="element-content flex-1 flex flex-col overflow-hidden">
        {selectedElementId ? (
          <>
            {/* Toolbar */}
            <div className="element-toolbar flex items-center justify-between px-3 py-2 border-b border-border-default bg-bg-secondary">
              <div className="text-sm text-text-primary">
                {selectedResultType} - {elements.find((e) => e.id === selectedElementId)?.name}
                {selectedDirection && <span className="text-text-muted ml-2">({selectedDirection})</span>}
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
            <div className="element-data flex-1 overflow-auto p-2">
              {resultsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">Loading element results...</div>
                </div>
              ) : viewMode === 'table' && resultsData ? (
                <ResultsTable dataset={resultsData} className="h-full" />
              ) : viewMode === 'chart' && resultsData ? (
                <div className="h-full">
                  <ProfileChart
                    data={{
                      stories: resultsData.rows.map((r) => String(r[resultsData.story_column])),
                      values: resultsData.rows.map((r) => (r['Avg'] as number) || 0),
                      result_type: selectedResultType,
                      direction: selectedDirection,
                      column: 'Avg',
                      unit: availableTypes?.element_results.find((r) => r.type === selectedResultType)?.unit || '',
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">No data available</div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-text-secondary mb-2">Select an element to view results</p>
              <p className="text-text-muted text-sm">
                Choose a result type and element from the left panel
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
