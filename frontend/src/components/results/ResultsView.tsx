import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import {
  useAllPushoverCurves,
  useBeamRotationsPlotData,
  useBeamRotationsTableData,
  useColumnRotationsPlotData,
  useComparisonData,
  useElementResults,
  useElementsForType,
  useGlobalResults,
  useJointResults,
  useMaxMinData,
  usePushoverCurve,
  useResultSets,
} from '../../hooks/useResults'
import { MultiSeriesProfileChart, ProfileChart, PushoverCurveChart, PushoverMultiCurveChart } from '../charts/ProfileChart'
import { ResultsTreeBrowser, type TreeSelection } from '../projects/ResultsTreeBrowser'
import type {
  GlobalResultType,
  ProfileChartData,
  BeamRotationsPlotData,
  ColumnRotationsPlotData,
  ResultDataset,
  ResultSet,
} from '../../types'
import { ResultsTable } from './ResultsTable'
import { ComparisonTable } from './ComparisonTable'
import { MaxMinResultsDisplay } from './MaxMinResultsDisplay'
import { BeamRotationsPlotPanel } from './BeamRotationsPlotPanel'
import { BeamRotationsTable } from './BeamRotationsTable'
import { ColumnRotationsPlotPanel } from './ColumnRotationsPlotPanel'
import { JointResultsPlotPanel } from './JointResultsPlotPanel'
import { LazyPlot } from '../charts/LazyPlot'
import { getResultTypeUnit } from '../../utils/resultConfig'
import { COMPARISON_SERIES_COLORS, ROTATION_COMPARISON_COLORS } from '../../utils/chartColors'
import { isPushoverResultSet } from '../../utils/resultSets'

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
  const navigate = useNavigate()
  const [selection, setSelection] = useState<TreeSelection | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<number | null>(null)
  const [selectedElementDirection, setSelectedElementDirection] = useState<string | null>(null)
  const [selectedLoadCases, setSelectedLoadCases] = useState<Set<string>>(new Set())
  const [hoveredLoadCase, setHoveredLoadCase] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [comparisonMetric, setComparisonMetric] = useState<'Avg' | 'Max' | 'Min'>('Avg')

  const isComparisonSelection = selection?.type === 'comparison_global' ||
    selection?.type === 'comparison_element'
  const isBeamRotationsComparison = selection?.type === 'comparison_beam_rotations'
  const isColumnRotationsComparison = selection?.type === 'comparison_column_rotations'
  const isJointComparison = selection?.type === 'comparison_joint'
  const { data: allResultSets } = useResultSets(projectSlug)
  const resultSetById = useMemo(() => {
    const map = new Map<number, ResultSet>()
    for (const resultSet of allResultSets || []) {
      map.set(resultSet.id, resultSet)
    }
    return map
  }, [allResultSets])

  const selectedResultSetIsPushover = useMemo(() => {
    if (!selection?.resultSetId) return false
    const resultSet = resultSetById.get(selection.resultSetId)
    return resultSet ? isPushoverResultSet(resultSet) : false
  }, [selection?.resultSetId, resultSetById])

  const isPushoverGlobalSelection =
    selection?.type === 'pushover_global' ||
    (selection?.type === 'global_result' && selectedResultSetIsPushover)

  const handleTreeSelect = useCallback((newSelection: TreeSelection) => {
    if (newSelection.type === 'time_series') {
      const query = new URLSearchParams({
        result_set_id: String(newSelection.resultSetId),
        direction: newSelection.direction || 'X',
      })
      if (newSelection.loadCaseName) {
        query.set('load_case', newSelection.loadCaseName)
      }
      navigate(`/projects/${projectSlug}/time-series?${query.toString()}`)
      return
    }

    setSelection(newSelection)
    setSelectedLoadCases(new Set())
    setHoveredLoadCase(null)
    setSelectedRows(new Set())
    setHoveredRow(null)
  }, [navigate, projectSlug])

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
    selection?.resultSetId && (selection.type === 'global_result' || selection.type === 'pushover_global')
      ? {
          result_set_id: selection.resultSetId,
          result_type: selection.resultType as GlobalResultType,
          direction: selection.direction,
          is_pushover: isPushoverGlobalSelection,
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

  const selectedPushoverCaseId = useMemo(() => {
    if (selection?.type !== 'pushover_curve') return null
    const parsed = Number(selection.direction)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return parsed
  }, [selection?.type, selection?.direction])

  const { data: pushoverCurveData, isLoading: pushoverCurveLoading } = usePushoverCurve(
    projectSlug,
    selectedPushoverCaseId
  )

  const { curves: pushoverAllCurves, isLoading: pushoverAllCurvesLoading } = useAllPushoverCurves(
    projectSlug,
    selection?.type === 'pushover_all_curves' ? selection.resultSetId : undefined,
    selection?.type === 'pushover_all_curves' ? selection.direction : null
  )

  const pushoverCurveTableDataset = useMemo<ResultDataset | null>(() => {
    if (!pushoverCurveData || selection?.type !== 'pushover_curve') return null

    return {
      meta: {
        result_type: 'PushoverCurve',
        direction: pushoverCurveData.case.direction,
        result_set_id: selection.resultSetId,
        display_name: pushoverCurveData.case.name,
        unit: '',
      },
      rows: pushoverCurveData.points.map((point) => ({
        Step: point.step,
        'Base Shear (kN)': point.base_shear,
        'Displacement (mm)': point.displacement,
      })),
      load_case_columns: ['Base Shear (kN)', 'Displacement (mm)'],
      summary_columns: [],
      story_column: 'Step',
    }
  }, [pushoverCurveData, selection])

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
          is_pushover: selectedResultSetIsPushover,
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
  }, [selection?.type, selection?.resultSetId, selection?.resultType, selectedElementId, selectedElementDirection])

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
          is_pushover: selectedResultSetIsPushover,
        }
      : null
  )

  // --- Comparison data ---
  const comparisonParams = useMemo(() => {
    if (!isComparisonSelection || !selection?.resultSetIds?.length) return null
    return {
      result_set_ids: selection.resultSetIds,
      result_type: selection.resultType,
      direction: selection.direction || undefined,
      metric: comparisonMetric,
      element_id: selection.elementId || undefined,
    }
  }, [isComparisonSelection, selection?.resultSetIds, selection?.resultType, selection?.direction, selection?.elementId, comparisonMetric])

  const { data: comparisonData, isLoading: comparisonLoading } = useComparisonData(
    projectSlug,
    comparisonParams,
  )

  const comparisonChartData: ProfileChartData | null = useMemo(() => {
    if (!comparisonData?.rows.length) return null
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
      result_type: comparisonData.result_type,
      unit: getResultTypeUnit(comparisonData.result_type),
      title: `${comparisonData.result_type}${selection?.direction ? ` ${selection.direction}` : ''} - ${comparisonData.metric} Comparison`,
    }
  }, [comparisonData, selection?.direction])

  const getDisplayTitle = () => {
    if (!selection) return ''

    if (isBeamRotationsComparison) {
      const unit = getResultTypeUnit('BeamRotations')
      return `▸ ${selection.comparisonSetName} - All Beam Rotations${unit ? ` (${unit})` : ''}`
    }

    if (isColumnRotationsComparison) {
      const unit = getResultTypeUnit('ColumnRotations')
      return `▸ ${selection.comparisonSetName} - All Column Rotations${unit ? ` (${unit})` : ''}`
    }

    if (isJointComparison) {
      const unit = getResultTypeUnit(selection.resultType)
      return `▸ ${selection.comparisonSetName} - ${selection.resultType}${unit ? ` (${unit})` : ''}`
    }

    if (isComparisonSelection) {
      const unit = getResultTypeUnit(selection.resultType)
      const dirSuffix = selection.direction ? ` ${selection.direction}` : ''
      return `▸ ${selection.comparisonSetName} - ${selection.resultType}${dirSuffix}${unit ? ` (${unit})` : ''}`
    }

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

    if (selection.type === 'pushover_curve') {
      return `▸ ${pushoverCurveData?.case.name || 'Pushover Curve'}`
    }

    if (selection.type === 'pushover_all_curves') {
      return `▸ All ${selection.direction} Curves`
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
      <div className="w-[240px] min-w-[240px] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <ResultsTreeBrowser
            projectSlug={projectSlug}
            onSelect={handleTreeSelect}
            currentSelection={selection}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden pl-4">
        {(selection?.resultSetId || isComparisonSelection || isBeamRotationsComparison || isColumnRotationsComparison || isJointComparison) ? (
          <>
            <div className="flex items-center justify-between py-2 gap-3">
              <span className="text-lg font-medium text-text-primary">{getDisplayTitle()}</span>
              {isComparisonSelection && (
                <div className="comparison-metric-toggle flex items-center gap-1">
                  {(['Avg', 'Max', 'Min'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setComparisonMetric(m)}
                      className={clsx(
                        'px-3 py-1 rounded text-sm transition-colors',
                        comparisonMetric === m
                          ? 'bg-accent-primary text-white'
                          : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
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
              {isBeamRotationsComparison ? (
                <ComparisonBeamRotationsPanel
                  projectSlug={projectSlug}
                  resultSetIds={selection.resultSetIds || []}
                />
              ) : isColumnRotationsComparison ? (
                <ComparisonColumnRotationsPanel
                  projectSlug={projectSlug}
                  resultSetIds={selection.resultSetIds || []}
                />
              ) : isJointComparison ? (
                <ComparisonJointOverlayPanel
                  projectSlug={projectSlug}
                  resultSetIds={selection.resultSetIds || []}
                  resultType={selection.resultType}
                />
              ) : isComparisonSelection ? (
                <ComparisonDataPanel
                  comparisonData={comparisonData ?? null}
                  comparisonChartData={comparisonChartData}
                  comparisonLoading={comparisonLoading}
                />
              ) : selection.type === 'maxmin' ? (
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
              ) : selection.type === 'global_result' || selection.type === 'pushover_global' ? (
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
              ) : selection.type === 'pushover_curve' ? (
                pushoverCurveLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-secondary">Loading curve data...</div>
                  </div>
                ) : pushoverCurveData && pushoverCurveTableDataset ? (
                  <>
                    <div className="overflow-auto">
                      <ResultsTable
                        dataset={pushoverCurveTableDataset}
                        showGradient={false}
                      />
                    </div>
                    <div className="flex-1 h-[90vh]">
                      <PushoverCurveChart
                        points={pushoverCurveData.points}
                        caseName={pushoverCurveData.case.name}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-muted">No curve data available</div>
                  </div>
                )
              ) : selection.type === 'pushover_all_curves' ? (
                pushoverAllCurvesLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-secondary">Loading all curves...</div>
                  </div>
                ) : pushoverAllCurves.length > 0 ? (
                  <div className="flex-1 h-[90vh] w-full">
                    <PushoverMultiCurveChart curves={pushoverAllCurves} />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-muted">No curve data available</div>
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

// Extracted comparison rendering to keep the main component readable
function ComparisonDataPanel({
  comparisonData,
  comparisonChartData,
  comparisonLoading,
}: {
  comparisonData: import('../../types').ComparisonDataset | null
  comparisonChartData: ProfileChartData | null
  comparisonLoading: boolean
}) {
  if (comparisonLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-secondary">Loading comparison data...</div>
      </div>
    )
  }

  if (!comparisonData || !comparisonData.rows.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted mb-2">No comparison data available</p>
          <p className="text-text-muted text-xs">Check that the selected result sets contain this data</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="comparison-table-panel overflow-auto">
        <ComparisonTable
          dataset={{
            rows: comparisonData.rows,
            series: comparisonData.series,
            ratio_column: comparisonData.ratio_column,
            metric: comparisonData.metric,
            result_type: comparisonData.result_type,
          }}
        />
      </div>
      {comparisonChartData && (
        <div className="comparison-chart-panel flex-1 h-[90vh]">
          <ProfileChart data={comparisonChartData} />
        </div>
      )}
    </>
  )
}

// Beam rotations overlay comparison — fetches plot data per result set, overlays scatter traces
function ComparisonBeamRotationsPanel({
  projectSlug,
  resultSetIds,
}: {
  projectSlug: string
  resultSetIds: number[]
}) {
  const { data: resultSets } = useResultSets(projectSlug)
  const rsNameMap = useMemo(() => {
    const m: Record<number, string> = {}
    for (const rs of resultSets || []) m[rs.id] = rs.name
    return m
  }, [resultSets])

  // Fetch beam rotation plot data for each result set
  const queries = resultSetIds.map((rsId) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useBeamRotationsPlotData(projectSlug, { result_set_id: rsId })
  )

  const isLoading = queries.some((q) => q.isLoading)
  const datasets: Array<{ rsId: number; name: string; data: BeamRotationsPlotData }> = []
  for (let i = 0; i < resultSetIds.length; i++) {
    const d = queries[i].data
    if (d) datasets.push({ rsId: resultSetIds[i], name: rsNameMap[resultSetIds[i]] || `RS ${resultSetIds[i]}`, data: d })
  }

  // Merge stories from all datasets (use longest set for y-axis)
  const stories = useMemo(() => {
    let best: string[] = []
    for (const ds of datasets) {
      if (ds.data.stories.length > best.length) best = ds.data.stories
    }
    return best
  }, [datasets])

  // Build story index map from the merged stories
  const storyIndexMap = useMemo(() => {
    const m: Record<string, number> = {}
    stories.forEach((s, i) => { m[s] = i })
    return m
  }, [stories])

  const seededJitter = (index: number, seed: number) => {
    const raw = ((index + 1) * 9301 + seed * 49297) % 233280
    return (raw / 233280 - 0.5) * 0.6
  }

  // Build one scatter trace per result set
  const scatterTraces = useMemo(() => {
    return datasets.map((ds, dsIdx) => {
      const allPoints = [
        ...ds.data.max_points.map((p, i) => ({ ...p, jitter: seededJitter(i, 42 + dsIdx) })),
        ...ds.data.min_points.map((p, i) => ({ ...p, jitter: seededJitter(i, 43 + dsIdx) })),
      ]
      const color = ROTATION_COMPARISON_COLORS[dsIdx % ROTATION_COMPARISON_COLORS.length]
      return {
        type: 'scatter' as const,
        mode: 'markers' as const,
        name: ds.name,
        x: allPoints.map((p) => p.rotation),
        y: allPoints.map((p) => (storyIndexMap[p.story] ?? p.story_index) + p.jitter),
        customdata: allPoints.map((p) => [p.element, p.load_case, p.story]),
        marker: { color, size: 4, opacity: 0.7 },
        hovertemplate: `<b>${ds.name}</b><br>%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]}: %{x:.3f}<extra></extra>`,
        showlegend: true,
      }
    })
  }, [datasets, storyIndexMap])

  const xLabel = datasets[0]?.data.meta.x_label || 'Rotation (%)'

  // Symmetric x range
  const xRange = useMemo(() => {
    let maxAbs = 0
    for (const ds of datasets) {
      for (const p of [...ds.data.max_points, ...ds.data.min_points]) {
        const a = Math.abs(p.rotation)
        if (a > maxAbs) maxAbs = a
      }
    }
    if (maxAbs === 0) return undefined
    const pad = maxAbs * 0.1
    return [-(maxAbs + pad), maxAbs + pad]
  }, [datasets])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-secondary">Loading beam rotation data...</div>
      </div>
    )
  }

  if (!datasets.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted">No beam rotation data available</div>
      </div>
    )
  }

  const plotLayout = {
    paper_bgcolor: '#0a0c10',
    plot_bgcolor: 'rgba(22, 27, 34, 0.5)',
    font: { color: '#d1d5db', size: 11 },
    margin: { l: 72, r: 16, t: 6, b: 44 },
    autosize: true,
    legend: { font: { size: 11, color: '#d1d5db' }, bgcolor: 'rgba(0,0,0,0)' },
  }

  return (
    <div className="beam-rotations-plot flex-1 flex flex-col overflow-hidden">
      <div className="h-[90vh] min-h-0">
        <LazyPlot
          data={scatterTraces}
          layout={{
            ...plotLayout,
            xaxis: {
              title: { text: xLabel, font: { size: 13, color: '#d1d5db' } },
              gridcolor: 'rgba(60, 65, 75, 0.3)',
              zeroline: false,
              tickfont: { size: 10 },
              range: xRange,
              dtick: 0.5,
              linecolor: '#3a3f4a', linewidth: 1, mirror: true,
            },
            yaxis: {
              title: { text: 'Story', font: { size: 13, color: '#d1d5db' } },
              tickmode: 'array' as const,
              tickvals: stories.map((_, i) => i),
              ticktext: stories,
              range: [-0.5, Math.max(stories.length - 0.5, 0.5)],
              gridcolor: 'rgba(60, 65, 75, 0.25)',
              tickfont: { size: 10 },
              linecolor: '#3a3f4a', linewidth: 1, mirror: true,
            },
            shapes: [{
              type: 'line' as const,
              x0: 0, x1: 0,
              y0: -0.5, y1: Math.max(stories.length - 0.5, 0.5),
              line: { color: '#4a7d89', width: 1, dash: 'dash' as const },
            }],
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  )
}

// Column rotations overlay comparison — fetches plot data per result set, overlays scatter traces
function ComparisonColumnRotationsPanel({
  projectSlug,
  resultSetIds,
}: {
  projectSlug: string
  resultSetIds: number[]
}) {
  const [directionFilter, setDirectionFilter] = useState<string>('All')
  const { data: resultSets } = useResultSets(projectSlug)
  const rsNameMap = useMemo(() => {
    const m: Record<number, string> = {}
    for (const rs of resultSets || []) m[rs.id] = rs.name
    return m
  }, [resultSets])

  const queries = resultSetIds.map((rsId) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useColumnRotationsPlotData(projectSlug, { result_set_id: rsId })
  )

  const isLoading = queries.some((q) => q.isLoading)
  const datasets = useMemo(() => {
    const result: Array<{ rsId: number; name: string; data: ColumnRotationsPlotData }> = []
    for (let i = 0; i < resultSetIds.length; i++) {
      const data = queries[i].data
      if (data) {
        result.push({
          rsId: resultSetIds[i],
          name: rsNameMap[resultSetIds[i]] || `RS ${resultSetIds[i]}`,
          data,
        })
      }
    }
    return result
  }, [queries, resultSetIds, rsNameMap])

  const availableDirections = useMemo(() => {
    const directionSet = new Set<string>()
    datasets.forEach((dataset) => {
      dataset.data.directions.forEach((direction) => {
        const value = direction.trim()
        if (value) directionSet.add(value)
      })
      dataset.data.max_points.forEach((point) => {
        if (point.direction) directionSet.add(point.direction)
      })
      dataset.data.min_points.forEach((point) => {
        if (point.direction) directionSet.add(point.direction)
      })
    })
    return Array.from(directionSet).sort((a, b) => a.localeCompare(b))
  }, [datasets])

  const effectiveDirection = useMemo(() => {
    if (directionFilter === 'All') return 'All'
    return availableDirections.includes(directionFilter) ? directionFilter : 'All'
  }, [availableDirections, directionFilter])

  const stories = useMemo(() => {
    let best: string[] = []
    for (const ds of datasets) {
      if (ds.data.stories.length > best.length) best = ds.data.stories
    }
    return best
  }, [datasets])

  const storyIndexMap = useMemo(() => {
    const m: Record<string, number> = {}
    stories.forEach((story, index) => {
      m[story] = index
    })
    return m
  }, [stories])

  const seededJitter = (index: number, seed: number) => {
    const raw = ((index + 1) * 9301 + seed * 49297) % 233280
    return (raw / 233280 - 0.5) * 0.6
  }

  const getFilteredPoints = useCallback(
    (data: ColumnRotationsPlotData) => {
      if (effectiveDirection === 'All') {
        return [...data.max_points, ...data.min_points]
      }
      return [...data.max_points, ...data.min_points].filter(
        (point) => point.direction === effectiveDirection
      )
    },
    [effectiveDirection]
  )

  const scatterTraces = useMemo(() => {
    return datasets.map((dataset, datasetIndex) => {
      const maxPoints =
        effectiveDirection === 'All'
          ? dataset.data.max_points
          : dataset.data.max_points.filter((point) => point.direction === effectiveDirection)
      const minPoints =
        effectiveDirection === 'All'
          ? dataset.data.min_points
          : dataset.data.min_points.filter((point) => point.direction === effectiveDirection)

      const points = [
        ...maxPoints.map((point, index) => ({ ...point, jitter: seededJitter(index, 74 + datasetIndex) })),
        ...minPoints.map((point, index) => ({ ...point, jitter: seededJitter(index, 75 + datasetIndex) })),
      ]

      const color = ROTATION_COMPARISON_COLORS[datasetIndex % ROTATION_COMPARISON_COLORS.length]
      return {
        type: 'scatter' as const,
        mode: 'markers' as const,
        name: dataset.name,
        x: points.map((point) => point.rotation),
        y: points.map((point) => (storyIndexMap[point.story] ?? point.story_index) + point.jitter),
        customdata: points.map((point) => [
          point.element,
          point.load_case,
          point.story,
          point.direction,
        ]),
        marker: { color, size: 4, opacity: 0.7 },
        hovertemplate: `<b>${dataset.name}</b><br>%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]} (%{customdata[3]}): %{x:.3f}<extra></extra>`,
        showlegend: true,
      }
    })
  }, [datasets, effectiveDirection, storyIndexMap])

  const xRange = useMemo(() => {
    const points = datasets.flatMap((dataset) => getFilteredPoints(dataset.data))
    if (!points.length) return undefined

    const maxAbs = points.reduce((maxValue, point) => Math.max(maxValue, Math.abs(point.rotation)), 0)
    if (maxAbs === 0) return undefined

    const pad = maxAbs * 0.1
    return [-(maxAbs + pad), maxAbs + pad]
  }, [datasets, getFilteredPoints])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-secondary">Loading column rotation data...</div>
      </div>
    )
  }

  if (!datasets.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted">No column rotation data available</div>
      </div>
    )
  }

  const xLabel = datasets[0]?.data.meta.x_label || 'Rotation (%)'

  const plotLayout = {
    paper_bgcolor: '#0a0c10',
    plot_bgcolor: 'rgba(22, 27, 34, 0.5)',
    font: { color: '#d1d5db', size: 11 },
    margin: { l: 72, r: 16, t: 6, b: 44 },
    autosize: true,
    legend: { font: { size: 11, color: '#d1d5db' }, bgcolor: 'rgba(0,0,0,0)' },
  }

  const directionButtons = ['All', ...availableDirections]

  return (
    <div className="column-rotations-plot flex-1 flex flex-col overflow-hidden">
      <div className="column-rotations-toolbar flex items-center justify-between gap-3">
        <div className="column-rotations-directions flex items-center gap-2">
          {directionButtons.map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => setDirectionFilter(direction)}
              className={clsx(
                'px-3 py-1 rounded text-sm transition-colors',
                effectiveDirection === direction
                  ? 'bg-accent-primary text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
              )}
            >
              {direction}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[calc(90vh-3rem)] min-h-0 mt-2">
        {effectiveDirection !== 'All' && !scatterTraces.some((trace) => trace.x.length > 0) ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-text-muted">No {effectiveDirection} direction data available</div>
          </div>
        ) : (
          <LazyPlot
            data={scatterTraces}
            layout={{
              ...plotLayout,
              xaxis: {
                title: { text: xLabel, font: { size: 13, color: '#d1d5db' } },
                gridcolor: 'rgba(60, 65, 75, 0.3)',
                zeroline: false,
                tickfont: { size: 10 },
                range: xRange,
                dtick: 0.5,
                linecolor: '#3a3f4a', linewidth: 1, mirror: true,
              },
              yaxis: {
                title: { text: 'Story', font: { size: 13, color: '#d1d5db' } },
                tickmode: 'array' as const,
                tickvals: stories.map((_, i) => i),
                ticktext: stories,
                range: [-0.5, Math.max(stories.length - 0.5, 0.5)],
                gridcolor: 'rgba(60, 65, 75, 0.25)',
                tickfont: { size: 10 },
                linecolor: '#3a3f4a', linewidth: 1, mirror: true,
              },
              shapes: [{
                type: 'line' as const,
                x0: 0, x1: 0,
                y0: -0.5, y1: Math.max(stories.length - 0.5, 0.5),
                line: { color: '#4a7d89', width: 1, dash: 'dash' as const },
              }],
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        )}
      </div>
    </div>
  )
}

// Joint overlay comparison — fetches joint data per result set, overlays scatter traces
function ComparisonJointOverlayPanel({
  projectSlug,
  resultSetIds,
  resultType,
}: {
  projectSlug: string
  resultSetIds: number[]
  resultType: string
}) {
  const { data: resultSets } = useResultSets(projectSlug)
  const rsNameMap = useMemo(() => {
    const m: Record<number, string> = {}
    for (const rs of resultSets || []) m[rs.id] = rs.name
    return m
  }, [resultSets])

  // Fetch joint data for each result set
  const queries = resultSetIds.map((rsId) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useJointResults(projectSlug, { result_set_id: rsId, result_type: resultType })
  )

  const isLoading = queries.some((q) => q.isLoading)
  const datasets = useMemo(() => {
    const result: Array<{ rsId: number; name: string; data: import('../../types').ResultDataset }> = []
    for (let i = 0; i < resultSetIds.length; i++) {
      const d = queries[i].data
      if (d) result.push({ rsId: resultSetIds[i], name: rsNameMap[resultSetIds[i]] || `RS ${resultSetIds[i]}`, data: d })
    }
    return result
  }, [resultSetIds, queries, rsNameMap])

  const useAbsoluteValue = resultType === 'SoilPressures' || resultType === 'VerticalDisplacements'

  // Merge all load cases across datasets
  const allLoadCases = useMemo(() => {
    const set = new Set<string>()
    for (const ds of datasets) {
      for (const lc of ds.data.load_case_columns) set.add(lc)
    }
    return [...set].sort()
  }, [datasets])

  const lcIndexMap = useMemo(() => {
    const m: Record<string, number> = {}
    allLoadCases.forEach((lc, i) => { m[lc] = i })
    return m
  }, [allLoadCases])

  const seededJitter = (index: number, seed: number) => {
    const raw = ((index + 1) * 9301 + seed * 49297) % 233280
    return (raw / 233280 - 0.5) * 0.6
  }

  // Build one scatter trace per result set
  const scatterTraces = useMemo(() => {
    return datasets.map((ds, dsIdx) => {
      const storyColumn = ds.data.story_column || 'Shell Object'
      const xVals: number[] = []
      const yVals: number[] = []
      const customdata: string[][] = []

      ds.data.rows.forEach((row, rowIdx) => {
        const shellObject = String(row[storyColumn] ?? '')
        const uniqueName = String(row['Unique Name'] ?? '')
        ds.data.load_case_columns.forEach((lc, lcIdx) => {
          const raw = row[lc]
          if (typeof raw !== 'number' || !Number.isFinite(raw)) return
          const val = useAbsoluteValue ? Math.abs(raw) : raw
          xVals.push((lcIndexMap[lc] ?? lcIdx) + seededJitter(rowIdx * 100 + lcIdx, 42 + dsIdx))
          yVals.push(val)
          customdata.push([lc, shellObject, uniqueName])
        })
      })

      const color = ROTATION_COMPARISON_COLORS[dsIdx % ROTATION_COMPARISON_COLORS.length]
      return {
        type: 'scatter' as const,
        mode: 'markers' as const,
        name: ds.name,
        x: xVals,
        y: yVals,
        customdata,
        marker: { color, size: 4, opacity: 0.7 },
        hovertemplate: `<b>${ds.name}</b><br>%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]}: %{y:.3f}<extra></extra>`,
        showlegend: true,
      }
    })
  }, [datasets, lcIndexMap, useAbsoluteValue])

  const yLabel = resultType === 'SoilPressures'
    ? `Soil Pressure (${datasets[0]?.data.meta?.unit || ''})`
    : resultType === 'VerticalDisplacements'
      ? `Vertical Displacement (${datasets[0]?.data.meta?.unit || ''})`
      : `Value`

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-secondary">Loading joint data...</div>
      </div>
    )
  }

  if (!datasets.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted">No joint data available</div>
      </div>
    )
  }

  const plotLayout = {
    paper_bgcolor: '#0a0c10',
    plot_bgcolor: 'rgba(22, 27, 34, 0.5)',
    font: { color: '#d1d5db', size: 11 },
    margin: { l: 72, r: 16, t: 6, b: 44 },
    autosize: true,
    legend: { font: { size: 11, color: '#d1d5db' }, bgcolor: 'rgba(0,0,0,0)' },
  }

  const xRange = Math.max(allLoadCases.length - 0.5, 0.5)

  return (
    <div className="joint-results-plot flex-1 flex flex-col overflow-hidden">
      <div className="h-[90vh] min-h-0">
        <LazyPlot
          data={scatterTraces}
          layout={{
            ...plotLayout,
            xaxis: {
              title: { text: 'Load Case', font: { size: 13, color: '#d1d5db' } },
              tickmode: 'array' as const,
              tickvals: allLoadCases.map((_, i) => i),
              ticktext: allLoadCases,
              range: [-0.5, xRange],
              gridcolor: 'rgba(60, 65, 75, 0.25)',
              tickfont: { size: 10 },
              linecolor: '#3a3f4a', linewidth: 1, mirror: true,
            },
            yaxis: {
              title: { text: yLabel, font: { size: 13, color: '#d1d5db' } },
              gridcolor: 'rgba(60, 65, 75, 0.3)',
              zeroline: true,
              zerolinecolor: '#4a7d89',
              zerolinewidth: 1,
              tickfont: { size: 10 },
              linecolor: '#3a3f4a', linewidth: 1, mirror: true,
            },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  )
}
