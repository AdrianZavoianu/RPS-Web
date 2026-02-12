import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useBeamRotationsPlotData,
  useBeamRotationsTableData,
  useColumnRotationsPlotData,
  useElementResults,
  useElementsForType,
  useGlobalResults,
  useJointResults,
  useMaxMinData,
} from '../../hooks/useResults'
import { MultiSeriesProfileChart } from '../charts/ProfileChart'
import { ResultsTreeBrowser, type TreeSelection } from '../projects/ResultsTreeBrowser'
import type { GlobalResultType } from '../../types'
import { ResultsTable } from './ResultsTable'
import { MaxMinResultsDisplay } from './MaxMinResultsDisplay'
import { BeamRotationsPlotPanel } from './BeamRotationsPlotPanel'
import { BeamRotationsTable } from './BeamRotationsTable'
import { ColumnRotationsPlotPanel } from './ColumnRotationsPlotPanel'
import { JointResultsPlotPanel } from './JointResultsPlotPanel'
import { getResultTypeUnit } from '../../utils/resultConfig'

interface ResultsViewProps {
  projectSlug: string
}

const ELEMENT_DIRECTIONS: Record<string, string[]> = {
  WallShears: ['V2', 'V3'],
  ColumnShears: ['V2', 'V3'],
  ColumnAxials: ['Min', 'Max'],
  ColumnRotations: ['R2', 'R3'],
}

export function ResultsView({ projectSlug }: ResultsViewProps) {
  const [selection, setSelection] = useState<TreeSelection | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<number | null>(null)
  const [selectedElementDirection, setSelectedElementDirection] = useState<string | null>(null)
  const [selectedLoadCases, setSelectedLoadCases] = useState<Set<string>>(new Set())
  const [hoveredLoadCase, setHoveredLoadCase] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  const handleTreeSelect = useCallback((newSelection: TreeSelection) => {
    setSelection(newSelection)
    setSelectedLoadCases(new Set())
    setHoveredLoadCase(null)
    setSelectedRows(new Set())
    setHoveredRow(null)
  }, [])

  useEffect(() => {
    if (selection?.type !== 'element') {
      setSelectedElementId(null)
      setSelectedElementDirection(null)
      return
    }

    const directionOptions = ELEMENT_DIRECTIONS[selection.resultType] || []
    const nextDirection =
      selection.direction && directionOptions.includes(selection.direction)
        ? selection.direction
        : directionOptions[0] || null

    const nextElementId =
      typeof selection.elementId === 'number' && selection.elementId > 0
        ? selection.elementId
        : null
    setSelectedElementId(nextElementId)
    setSelectedElementDirection(nextDirection)
  }, [
    selection?.type,
    selection?.resultSetId,
    selection?.resultType,
    selection?.direction,
    selection?.elementId,
  ])

  const { data: resultsData, isLoading: resultsLoading } = useGlobalResults(
    projectSlug,
    selection?.resultSetId && selection.type === 'global_result'
      ? {
          result_set_id: selection.resultSetId,
          result_type: selection.resultType as GlobalResultType,
          direction: selection.direction,
        }
      : null
  )

  const { data: maxMinData, isLoading: maxMinLoading } = useMaxMinData(
    projectSlug,
    selection?.resultSetId && selection.type === 'maxmin'
      ? {
          result_set_id: selection.resultSetId,
          result_type: selection.resultType,
          element_id: selection.elementId || undefined,
        }
      : null
  )

  const { data: beamRotationsPlotData, isLoading: beamRotationsPlotLoading } =
    useBeamRotationsPlotData(
      projectSlug,
      selection?.resultSetId && selection.type === 'beam_rotations_plot'
        ? { result_set_id: selection.resultSetId }
        : null
    )

  const { data: beamRotationsTableData, isLoading: beamRotationsTableLoading } =
    useBeamRotationsTableData(
      projectSlug,
      selection?.resultSetId && selection.type === 'beam_rotations_table'
        ? { result_set_id: selection.resultSetId }
        : null
    )

  const { data: columnRotationsPlotData, isLoading: columnRotationsPlotLoading } =
    useColumnRotationsPlotData(
      projectSlug,
      selection?.resultSetId && selection.type === 'column_rotations_plot'
        ? { result_set_id: selection.resultSetId }
        : null
    )

  const isJointSelection =
    selection?.type === 'joint' ||
    selection?.type === 'joint_plot' ||
    selection?.type === 'joint_table'

  const jointResultTypeParam =
    selection && isJointSelection
      ? selection.resultType.includes('_') || !selection.direction
        ? selection.resultType
        : `${selection.resultType}_${selection.direction}`
      : null

  const { data: jointResultsData, isLoading: jointResultsLoading } = useJointResults(
    projectSlug,
    selection?.resultSetId && isJointSelection && jointResultTypeParam
      ? {
          result_set_id: selection.resultSetId,
          result_type: jointResultTypeParam,
        }
      : null
  )

  const elementDirectionOptions = useMemo(
    () => (selection?.type === 'element' ? ELEMENT_DIRECTIONS[selection.resultType] || [] : []),
    [selection]
  )

  useEffect(() => {
    if (selection?.type !== 'element') {
      return
    }

    if (!elementDirectionOptions.length) {
      if (selectedElementDirection !== null) {
        setSelectedElementDirection(null)
      }
      return
    }

    if (
      !selectedElementDirection ||
      !elementDirectionOptions.includes(selectedElementDirection)
    ) {
      setSelectedElementDirection(elementDirectionOptions[0])
    }
  }, [elementDirectionOptions, selectedElementDirection, selection?.type])

  const { data: elementsData, isLoading: elementsLoading } = useElementsForType(
    projectSlug,
    selection?.resultSetId && selection.type === 'element'
      ? {
          result_set_id: selection.resultSetId,
          result_type: selection.resultType,
        }
      : null
  )
  const elements = useMemo(() => elementsData?.elements || [], [elementsData])

  useEffect(() => {
    if (selection?.type !== 'element') {
      return
    }
    if (!elements.length) {
      setSelectedElementId(null)
      return
    }
    if (!selectedElementId || !elements.some((element) => element.id === selectedElementId)) {
      setSelectedElementId(elements[0].id)
    }
  }, [elements, selectedElementId, selection?.type])

  useEffect(() => {
    if (selection?.type !== 'element') {
      return
    }
    setSelectedLoadCases(new Set())
    setHoveredLoadCase(null)
    setSelectedRows(new Set())
    setHoveredRow(null)
  }, [selection?.resultSetId, selection?.resultType, selectedElementId, selectedElementDirection])

  const elementDirection =
    elementDirectionOptions.length > 0
      ? selectedElementDirection || elementDirectionOptions[0]
      : null

  const { data: elementResultsData, isLoading: elementResultsLoading } = useElementResults(
    projectSlug,
    selection?.resultSetId && selection.type === 'element' && selectedElementId
      ? {
          result_set_id: selection.resultSetId,
          element_id: selectedElementId,
          result_type: selection.resultType,
          direction: elementDirection || undefined,
        }
      : null
  )

  const getDisplayTitle = () => {
    if (!selection) return ''

    if (selection.type === 'element') {
      const selectedElement = elements.find((element) => element.id === selectedElementId)
      const elementName = selectedElement?.name || 'Element'
      const unit = elementResultsData?.meta?.unit || getResultTypeUnit(selection.resultType)
      const directionSuffix = elementDirection ? ` (${elementDirection})` : ''
      return `▸ ${elementName} - ${selection.resultType}${directionSuffix}${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'beam_rotations_plot') {
      const unit = beamRotationsPlotData?.meta?.unit || getResultTypeUnit('BeamRotations')
      return `▸ All Beam Rotations - R3 Plastic${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'column_rotations_plot') {
      const unit = columnRotationsPlotData?.meta?.unit || getResultTypeUnit('ColumnRotations')
      return `▸ All Column Rotations${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'beam_rotations_table') {
      const unit = beamRotationsTableData?.meta?.unit || getResultTypeUnit('BeamRotations')
      return `▸ Beam Rotations Table - R3 Plastic${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'joint_plot') {
      const unit = jointResultsData?.meta?.unit || getResultTypeUnit(selection.resultType)
      return `▸ ${selection.resultType} (${selection.direction}) - Plot${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'joint_table') {
      const unit = jointResultsData?.meta?.unit || getResultTypeUnit(selection.resultType)
      return `▸ ${selection.resultType} (${selection.direction}) - Table${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'joint') {
      const unit = jointResultsData?.meta?.unit || getResultTypeUnit(selection.resultType)
      return `▸ ${selection.resultType}${unit ? ` (${unit})` : ''}`
    }

    const { resultType, direction } = selection
    const unit =
      (selection.type === 'maxmin' ? maxMinData?.meta?.unit : resultsData?.meta?.unit) ||
      getResultTypeUnit(resultType)
    if (direction === 'MaxMin') {
      return `▸ Story ${resultType}${unit ? ` (${unit})` : ''} - Max/Min`
    }
    return `▸ Story ${resultType}${unit ? ` (${unit})` : ''} - ${direction} Direction`
  }

  return (
    <div className="results-view h-full flex bg-bg-primary">
      <div className="w-[200px] min-w-[200px] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <ResultsTreeBrowser
            projectSlug={projectSlug}
            onSelect={handleTreeSelect}
            currentSelection={selection}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden pl-4">
        {selection?.resultSetId ? (
          <>
            <div className="flex items-center justify-between py-2 gap-3">
              <span className="text-lg font-medium text-text-primary">{getDisplayTitle()}</span>
              {selection.type === 'element' && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedElementId || ''}
                    onChange={(event) => setSelectedElementId(Number(event.target.value))}
                    disabled={!elements.length}
                    className="px-2 py-1.5 bg-bg-secondary border border-border-default rounded text-sm text-text-primary min-w-[180px]"
                  >
                    {!elements.length && <option value="">No elements</option>}
                    {elements.map((element) => (
                      <option key={element.id} value={element.id}>
                        {element.name}
                      </option>
                    ))}
                  </select>
                  {elementDirectionOptions.map((direction) => (
                    <button
                      key={direction}
                      type="button"
                      onClick={() => setSelectedElementDirection(direction)}
                      className={
                        selectedElementDirection === direction
                          ? 'px-3 py-1 rounded text-sm bg-accent-primary text-white'
                          : 'px-3 py-1 rounded text-sm bg-bg-secondary text-text-secondary hover:bg-bg-hover'
                      }
                    >
                      {direction}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 flex items-start overflow-hidden">
              {selection.type === 'maxmin' ? (
                maxMinLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-secondary">Loading max/min data...</div>
                  </div>
                ) : maxMinData && maxMinData.rows?.length > 0 ? (
                  <MaxMinResultsDisplay
                    data={maxMinData}
                    resultType={selection.resultType}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-text-muted mb-2">No max/min data available</p>
                      <p className="text-text-muted text-xs">Import results to see data here</p>
                    </div>
                  </div>
                )
              ) : selection.type === 'global_result' ? (
                resultsLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-secondary">Loading results...</div>
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
                    <div className="text-center">
                      <p className="text-text-muted mb-2">No data available</p>
                      <p className="text-text-muted text-xs">
                        Import results to see data here
                      </p>
                    </div>
                  </div>
                )
              ) : selection.type === 'joint_plot' ? (
                jointResultsLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-secondary">Loading joint results...</div>
                  </div>
                ) : jointResultsData && jointResultsData.rows?.length > 0 ? (
                  <JointResultsPlotPanel dataset={jointResultsData} />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-muted">No joint data available</div>
                  </div>
                )
              ) : selection.type === 'joint' || selection.type === 'joint_table' ? (
                jointResultsLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-secondary">Loading joint results...</div>
                  </div>
                ) : jointResultsData && jointResultsData.rows?.length > 0 ? (
                  <div className="overflow-auto">
                    <ResultsTable
                      dataset={jointResultsData}
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
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-muted">No joint data available</div>
                  </div>
                )
              ) : selection.type === 'beam_rotations_plot' ? (
                beamRotationsPlotLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-secondary">Loading beam rotation plot data...</div>
                  </div>
                ) : beamRotationsPlotData ? (
                  <BeamRotationsPlotPanel data={beamRotationsPlotData} />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-muted">No beam rotation data available</div>
                  </div>
                )
              ) : selection.type === 'beam_rotations_table' ? (
                beamRotationsTableLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-secondary">Loading beam rotation table...</div>
                  </div>
                ) : beamRotationsTableData ? (
                  <BeamRotationsTable data={beamRotationsTableData} />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-muted">No beam rotation data available</div>
                  </div>
                )
              ) : selection.type === 'column_rotations_plot' ? (
                columnRotationsPlotLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-secondary">Loading column rotation plot data...</div>
                  </div>
                ) : columnRotationsPlotData ? (
                  <ColumnRotationsPlotPanel data={columnRotationsPlotData} />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-muted">No column rotation data available</div>
                  </div>
                )
              ) : selection.type === 'element' ? (
                elementsLoading || (selectedElementId !== null && elementResultsLoading) ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-secondary">Loading element results...</div>
                  </div>
                ) : !elements.length ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-text-muted mb-2">No elements found for this result type</p>
                      <p className="text-text-muted text-xs">Import results to see element data here</p>
                    </div>
                  </div>
                ) : elementResultsData && elementResultsData.rows?.length > 0 ? (
                  <>
                    <div className="overflow-auto">
                      <ResultsTable
                        dataset={elementResultsData}
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
                        dataset={elementResultsData}
                        selectedLoadCases={selectedLoadCases}
                        hoveredLoadCase={hoveredLoadCase}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-text-muted mb-2">No data available for this element</p>
                      <p className="text-text-muted text-xs">Try another element or result set</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-text-muted mb-2">This tree selection is not available in this panel yet</p>
                    <p className="text-text-muted text-xs">Use the matching section from the project navigation</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-text-secondary mb-4">Select a result from the tree browser</p>
              <p className="text-text-muted text-sm">Or import data to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
