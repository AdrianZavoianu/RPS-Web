/**
 * Element Results View component
 * Displays results for structural elements (Walls, Columns, Beams)
 * Layout matches desktop: sidebar tree + table + chart side-by-side with hover/selection sync
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import clsx from 'clsx'
import { useLocation } from 'react-router-dom'
import {
  useResultSets,
  useAvailableResultTypes,
  useElementsForType,
  useElementResults,
} from '../../hooks/useResults'
import { ResultsTable } from './ResultsTable'
import { MultiSeriesProfileChart } from '../charts/ProfileChart'
import { ProjectBrowserNav } from '../projects/ProjectBrowserNav'
import type { ElementResultType } from '../../types'

interface ElementResultsViewProps {
  projectSlug: string
}

const ELEMENT_TYPE_MAP: Record<string, string> = {
  WallShears: 'Wall',
  QuadRotations: 'Quad',
  ColumnShears: 'Column',
  ColumnAxials: 'Column',
  ColumnRotations: 'Column',
  BeamRotations: 'Beam',
}

export function ElementResultsView({ projectSlug }: ElementResultsViewProps) {
  const location = useLocation()
  const preselectionAppliedFor = useRef<string | null>(null)
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedResultType, setSelectedResultType] = useState<ElementResultType | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<number | null>(null)
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null)

  // Table-chart sync state
  const [selectedLoadCases, setSelectedLoadCases] = useState<Set<string>>(new Set())
  const [hoveredLoadCase, setHoveredLoadCase] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  const { data: resultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)

  const preselectedParams = useMemo(() => {
    const search = new URLSearchParams(location.search)
    const resultSetIdRaw = search.get('result_set_id')
    const resultTypeRaw = search.get('result_type')
    const directionRaw = search.get('direction')

    const parsedResultSetId = resultSetIdRaw ? Number(resultSetIdRaw) : null
    return {
      resultSetId: Number.isFinite(parsedResultSetId) ? parsedResultSetId : null,
      resultType: resultTypeRaw as ElementResultType | null,
      direction: directionRaw,
    }
  }, [location.search])

  // Auto-select first result set
  useEffect(() => {
    if (resultSets?.length && !selectedResultSetId) {
      setSelectedResultSetId(resultSets[0].id)
    }
  }, [resultSets, selectedResultSetId])

  // Apply preselection from tree navigation query params when available.
  useEffect(() => {
    if (!location.search || preselectionAppliedFor.current === location.search) {
      return
    }

    const availableElementTypes = availableTypes?.element_results || []
    if (!availableElementTypes.length) {
      return
    }

    if (
      preselectedParams.resultSetId &&
      resultSets?.some((rs) => rs.id === preselectedParams.resultSetId)
    ) {
      setSelectedResultSetId(preselectedParams.resultSetId)
    }

    if (
      preselectedParams.resultType &&
      availableElementTypes.some((rt) => rt.type === preselectedParams.resultType)
    ) {
      setSelectedResultType(preselectedParams.resultType)
    }

    if (!preselectedParams.resultType || !preselectedParams.direction) {
      preselectionAppliedFor.current = location.search
      return
    }

    const selectedTypeConfig = availableElementTypes.find(
      (rt) => rt.type === preselectedParams.resultType
    )
    if (selectedTypeConfig?.directions?.includes(preselectedParams.direction)) {
      setSelectedDirection(preselectedParams.direction)
    }

    preselectionAppliedFor.current = location.search
  }, [availableTypes, location.search, preselectedParams, resultSets])

  // Get elements for selected result type
  const { data: elementsData } = useElementsForType(
    projectSlug,
    selectedResultSetId && selectedResultType
      ? {
          result_set_id: selectedResultSetId,
          result_type: selectedResultType,
        }
      : null
  )
  const elements = useMemo(() => elementsData?.elements ?? [], [elementsData])
  const elementResultTypes = useMemo(() => availableTypes?.element_results ?? [], [availableTypes])
  const directions = useMemo(() => {
    if (!selectedResultType) {
      return null
    }
    return (
      elementResultTypes.find((resultTypeInfo) => resultTypeInfo.type === selectedResultType)?.directions ?? null
    )
  }, [elementResultTypes, selectedResultType])

  // Reset sync state on selection changes that alter visible rows/series.
  const resetSyncState = useCallback(() => {
    setSelectedLoadCases(new Set())
    setHoveredLoadCase(null)
    setSelectedRows(new Set())
    setHoveredRow(null)
  }, [])

  // Auto-select first available element result type
  useEffect(() => {
    if (elementResultTypes.length && !selectedResultType) {
      setSelectedResultType(elementResultTypes[0].type as ElementResultType)
    }
  }, [elementResultTypes, selectedResultType])

  // Auto-select first element
  useEffect(() => {
    if (elements.length && !selectedElementId) {
      setSelectedElementId(elements[0].id)
    }
  }, [elements, selectedElementId])

  // Keep selected direction valid for the currently selected result type.
  useEffect(() => {
    if (!directions?.length) {
      if (selectedDirection !== null) {
        setSelectedDirection(null)
      }
      return
    }

    if (!selectedDirection || !directions.includes(selectedDirection)) {
      setSelectedDirection(directions[0])
    }
  }, [directions, selectedDirection])

  // Reset element + sync state when result type changes
  useEffect(() => {
    setSelectedElementId(null)
    resetSyncState()
  }, [selectedResultType, resetSyncState])

  useEffect(() => {
    resetSyncState()
  }, [selectedElementId, selectedDirection, resetSyncState])

  // Get element results — only fetch when direction is resolved (or type has no directions)
  const directionReady = !directions?.length || selectedDirection != null
  const { data: resultsData, isLoading: resultsLoading } = useElementResults(
    projectSlug,
    selectedResultSetId && selectedElementId && selectedResultType && directionReady
      ? {
          result_set_id: selectedResultSetId,
          element_id: selectedElementId,
          result_type: selectedResultType,
          direction: selectedDirection ?? undefined,
        }
      : null
  )

  // Build display title matching desktop: "> Wall P1 - Shears (V2) (kN)"
  const displayTitle = useMemo(() => {
    if (!selectedElementId || !selectedResultType) return ''
    const el = elements.find((e) => e.id === selectedElementId)
    const unit = resultsData?.meta?.unit || ''
    const name = el?.name || ''
    const dirStr = selectedDirection ? ` (${selectedDirection})` : ''
    const unitStr = unit ? ` (${unit})` : ''
    return `${name} - ${selectedResultType}${dirStr}${unitStr}`
  }, [selectedElementId, elements, selectedResultType, selectedDirection, resultsData?.meta?.unit])

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
          <h3 className="browser-section-title">Result Type</h3>
          <select
            value={selectedResultType || ''}
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

        {/* Direction Selection */}
        {directions && directions.length > 0 && selectedDirection && (
          <div className="browser-section">
            <h3 className="browser-section-title">Direction</h3>
            <div className="flex flex-wrap gap-2">
              {directions.map((dir) => (
                <button
                  key={dir}
                  onClick={() => setSelectedDirection(dir)}
                  className={clsx(
                    'px-3 py-1 rounded text-sm transition-colors',
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

        {/* Element Selection */}
        <div className="browser-section flex-1 min-h-0 flex flex-col">
          <h3 className="browser-section-title">
            {(selectedResultType && ELEMENT_TYPE_MAP[selectedResultType]) || 'Element'}s
          </h3>
          {elements.length ? (
            <div className="space-y-1 flex-1 overflow-auto">
              {elements.map((el) => (
                <button
                  key={el.id}
                  onClick={() => setSelectedElementId(el.id)}
                  className={clsx(
                    'browser-item',
                    selectedElementId === el.id ? 'browser-item-active' : null
                  )}
                >
                  {el.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-text-muted">
              No elements found
            </div>
          )}
        </div>
      </div>

      {/* Main Content - table + chart side by side */}
      <div className="element-content flex-1 flex flex-col overflow-hidden pl-4">
        {selectedElementId && selectedResultSetId ? (
          <>
            {/* Title */}
            <div className="flex items-center py-2">
              <span className="text-lg font-medium text-text-primary">
                {displayTitle}
              </span>
            </div>

            {/* Table + Chart */}
            <div className="element-data flex-1 flex items-start overflow-hidden">
              {resultsLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-text-secondary">Loading element results...</div>
                </div>
              ) : resultsData && resultsData.rows?.length > 0 ? (
                <>
                  <div className="overflow-auto">
                    <ResultsTable
                      dataset={resultsData}
                      selectedLoadCases={selectedLoadCases}
                      hoveredLoadCase={hoveredLoadCase}
                      hoveredRow={hoveredRow}
                      selectedRows={selectedRows}
                      onSelectionChange={setSelectedLoadCases}
                      onHoverChange={setHoveredLoadCase}
                      onRowHoverChange={setHoveredRow}
                      onRowSelectionChange={setSelectedRows}
                    />
                  </div>

                  <div className="flex-1 h-[90vh]">
                    <MultiSeriesProfileChart
                      dataset={resultsData}
                      selectedLoadCases={selectedLoadCases}
                      hoveredLoadCase={hoveredLoadCase}
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-text-muted">No data available for this element</div>
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
