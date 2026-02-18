import { useCallback, useEffect, useMemo, useState } from 'react'
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
} from '../../../hooks/useResults'
import type {
  BeamRotationsPlotData,
  BeamRotationsTableData,
  ColumnRotationsPlotData,
  Element,
  GlobalResultType,
  MaxMinDataset,
  ResultDataset,
  ResultSet,
} from '../../../types'
import { getResultTypeUnit } from '../../../utils/resultConfig'
import { isPushoverResultSet } from '../../../utils/resultSets'
import { buildComparisonProfileChartData, type ComparisonMetric } from '../comparisonUtils'
import {
  isComparisonSelection,
  isJointSelectionType,
  type TreeSelection,
} from '../../projects/results-tree/types'
import { mapPushoverCurveToDataset } from '../../../features/results/mappers/pushoverMappers'

const ELEMENT_DIRECTIONS: Record<string, string[]> = {
  WallShears: ['V2', 'V3'],
  ColumnShears: ['V2', 'V3'],
  ColumnAxials: ['Min', 'Max'],
  ColumnRotations: ['R2', 'R3'],
}

interface TableInteractionState {
  selectedLoadCases: Set<string>
  hoveredLoadCase: string | null
  selectedRows: Set<number>
  hoveredRow: number | null
  setSelectedLoadCases: (value: Set<string>) => void
  setHoveredLoadCase: (value: string | null) => void
  setSelectedRows: (value: Set<number>) => void
  setHoveredRow: (value: number | null) => void
}

export interface ResultsViewController {
  projectSlug: string
  selection: TreeSelection | null
  hasRenderableSelection: boolean
  title: string
  handleTreeSelect: (selection: TreeSelection) => void

  isComparisonDataSelection: boolean
  isBeamRotationsComparison: boolean
  isColumnRotationsComparison: boolean
  isJointComparison: boolean

  selectedElementId: number | null
  setSelectedElementId: (value: number | null) => void
  elementDirectionOptions: string[]
  selectedElementDirection: string | null
  setSelectedElementDirection: (value: string | null) => void
  elements: Element[]

  comparisonMetric: ComparisonMetric
  setComparisonMetric: (value: ComparisonMetric) => void

  tableState: TableInteractionState

  resultsData: ResultDataset | undefined
  resultsLoading: boolean

  maxMinData: MaxMinDataset | undefined
  maxMinLoading: boolean

  elementResultsData: ResultDataset | undefined
  elementResultsLoading: boolean
  elementsLoading: boolean

  jointResultsData: ResultDataset | undefined
  jointResultsLoading: boolean

  beamRotationsPlotData: BeamRotationsPlotData | undefined
  beamRotationsPlotLoading: boolean
  beamRotationsTableData: BeamRotationsTableData | undefined
  beamRotationsTableLoading: boolean
  columnRotationsPlotData: ColumnRotationsPlotData | undefined
  columnRotationsPlotLoading: boolean

  pushoverCurveData: ReturnType<typeof usePushoverCurve>['data']
  pushoverCurveLoading: boolean
  pushoverCurveTableDataset: ResultDataset | null
  pushoverAllCurves: ReturnType<typeof useAllPushoverCurves>['curves']
  pushoverAllCurvesLoading: boolean

  comparisonData: ReturnType<typeof useComparisonData>['data']
  comparisonLoading: boolean
  comparisonChartData: ReturnType<typeof buildComparisonProfileChartData>
}

function resetTableState(
  setSelectedLoadCases: (value: Set<string>) => void,
  setHoveredLoadCase: (value: string | null) => void,
  setSelectedRows: (value: Set<number>) => void,
  setHoveredRow: (value: number | null) => void
) {
  setSelectedLoadCases(new Set())
  setHoveredLoadCase(null)
  setSelectedRows(new Set())
  setHoveredRow(null)
}

export function useResultsViewController(projectSlug: string): ResultsViewController {
  const navigate = useNavigate()
  const [selection, setSelection] = useState<TreeSelection | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<number | null>(null)
  const [selectedElementDirection, setSelectedElementDirection] = useState<string | null>(null)
  const [selectedLoadCases, setSelectedLoadCases] = useState<Set<string>>(new Set())
  const [hoveredLoadCase, setHoveredLoadCase] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [comparisonMetric, setComparisonMetric] = useState<ComparisonMetric>('Avg')

  const isComparisonDataSelection =
    selection?.type === 'comparison_global' || selection?.type === 'comparison_element'
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
    if (!selection || isComparisonSelection(selection) || !selection.resultSetId) return false
    const resultSet = resultSetById.get(selection.resultSetId)
    return resultSet ? isPushoverResultSet(resultSet) : false
  }, [selection, resultSetById])

  const isPushoverGlobalSelection =
    selection?.type === 'pushover_global' ||
    (selection?.type === 'global_result' && selectedResultSetIsPushover)

  const handleTreeSelect = useCallback(
    (nextSelection: TreeSelection) => {
      if (nextSelection.type === 'time_series') {
        const query = new URLSearchParams({
          result_set_id: String(nextSelection.resultSetId),
          direction: nextSelection.direction || 'X',
        })
        if (nextSelection.loadCaseName) {
          query.set('load_case', nextSelection.loadCaseName)
        }
        navigate(`/projects/${projectSlug}/time-series?${query.toString()}`)
        return
      }

      setSelection(nextSelection)
      resetTableState(
        setSelectedLoadCases,
        setHoveredLoadCase,
        setSelectedRows,
        setHoveredRow
      )
    },
    [navigate, projectSlug]
  )

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

  const globalParams =
    selection?.resultSetId &&
    (selection.type === 'global_result' || selection.type === 'pushover_global')
      ? {
          result_set_id: selection.resultSetId,
          result_type: selection.resultType as GlobalResultType,
          direction: selection.direction,
          is_pushover: isPushoverGlobalSelection,
        }
      : null

  const { data: resultsData, isLoading: resultsLoading } = useGlobalResults(projectSlug, globalParams)

  const maxMinParams =
    selection?.resultSetId && selection.type === 'maxmin'
      ? {
          result_set_id: selection.resultSetId,
          result_type: selection.resultType,
          element_id: selection.elementId || undefined,
        }
      : null

  const { data: maxMinData, isLoading: maxMinLoading } = useMaxMinData(projectSlug, maxMinParams)

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
    if (!selection || selection.type !== 'pushover_curve' || !pushoverCurveData) return null
    return mapPushoverCurveToDataset(pushoverCurveData, selection.resultSetId)
  }, [pushoverCurveData, selection])

  const isJointSelection = !!selection && isJointSelectionType(selection.type)

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
    if (selection?.type !== 'element') return

    if (!elementDirectionOptions.length) {
      if (selectedElementDirection !== null) {
        setSelectedElementDirection(null)
      }
      return
    }

    if (!selectedElementDirection || !elementDirectionOptions.includes(selectedElementDirection)) {
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
    if (selection?.type !== 'element') return

    if (!elements.length) {
      setSelectedElementId(null)
      return
    }

    if (!selectedElementId || !elements.some((element) => element.id === selectedElementId)) {
      setSelectedElementId(elements[0].id)
    }
  }, [elements, selectedElementId, selection?.type])

  useEffect(() => {
    if (selection?.type !== 'element') return
    resetTableState(
      setSelectedLoadCases,
      setHoveredLoadCase,
      setSelectedRows,
      setHoveredRow
    )
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

  const comparisonParams = useMemo(() => {
    if (!selection || !isComparisonDataSelection) return null
    return {
      result_set_ids: selection.resultSetIds,
      result_type: selection.resultType,
      direction: selection.direction || undefined,
      metric: comparisonMetric,
      element_id: selection.elementId || undefined,
    }
  }, [selection, isComparisonDataSelection, comparisonMetric])

  const { data: comparisonData, isLoading: comparisonLoading } = useComparisonData(
    projectSlug,
    comparisonParams
  )

  const comparisonChartData = useMemo(
    () => buildComparisonProfileChartData(comparisonData, selection?.direction),
    [comparisonData, selection?.direction]
  )

  const title = useMemo(() => {
    if (!selection) return ''

    if (selection.type === 'comparison_beam_rotations') {
      const unit = getResultTypeUnit('BeamRotations')
      return `▸ ${selection.comparisonSetName} - All Beam Rotations${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'comparison_column_rotations') {
      const unit = getResultTypeUnit('ColumnRotations')
      return `▸ ${selection.comparisonSetName} - All Column Rotations${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'comparison_joint') {
      const unit = getResultTypeUnit(selection.resultType)
      return `▸ ${selection.comparisonSetName} - ${selection.resultType}${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'comparison_global' || selection.type === 'comparison_element') {
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

    const unit =
      (selection.type === 'maxmin' ? maxMinData?.meta?.unit : resultsData?.meta?.unit) ||
      getResultTypeUnit(selection.resultType)

    if (selection.direction === 'MaxMin') {
      return `▸ Story ${selection.resultType}${unit ? ` (${unit})` : ''} - Max/Min`
    }

    return `▸ Story ${selection.resultType}${unit ? ` (${unit})` : ''} - ${selection.direction} Direction`
  }, [
    selection,
    beamRotationsPlotData,
    beamRotationsTableData,
    columnRotationsPlotData,
    elementDirection,
    elementResultsData?.meta?.unit,
    elements,
    jointResultsData?.meta?.unit,
    maxMinData?.meta?.unit,
    pushoverCurveData?.case.name,
    resultsData?.meta?.unit,
    selectedElementId,
  ])

  const hasRenderableSelection = useMemo(() => {
    if (!selection) return false
    if (isComparisonSelection(selection)) return true
    return selection.resultSetId > 0
  }, [selection])

  return {
    projectSlug,
    selection,
    hasRenderableSelection,
    title,
    handleTreeSelect,

    isComparisonDataSelection,
    isBeamRotationsComparison,
    isColumnRotationsComparison,
    isJointComparison,

    selectedElementId,
    setSelectedElementId,
    elementDirectionOptions,
    selectedElementDirection,
    setSelectedElementDirection,
    elements,

    comparisonMetric,
    setComparisonMetric,

    tableState: {
      selectedLoadCases,
      hoveredLoadCase,
      selectedRows,
      hoveredRow,
      setSelectedLoadCases,
      setHoveredLoadCase,
      setSelectedRows,
      setHoveredRow,
    },

    resultsData,
    resultsLoading,

    maxMinData,
    maxMinLoading,

    elementResultsData,
    elementResultsLoading,
    elementsLoading,

    jointResultsData,
    jointResultsLoading,

    beamRotationsPlotData,
    beamRotationsPlotLoading,
    beamRotationsTableData,
    beamRotationsTableLoading,
    columnRotationsPlotData,
    columnRotationsPlotLoading,

    pushoverCurveData,
    pushoverCurveLoading,
    pushoverCurveTableDataset,
    pushoverAllCurves,
    pushoverAllCurvesLoading,

    comparisonData,
    comparisonLoading,
    comparisonChartData,
  }
}
