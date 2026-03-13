import { useEffect, useMemo } from 'react'
import {
  useAllPushoverCurves,
  useBeamRotationsPlotData,
  useBeamRotationsTableData,
  useColumnRotationsPlotData,
  useQuadRotationsPlotData,
  useComparisonData,
  useElementResults,
  useElementsForType,
  useGlobalResults,
  useJointResults,
  useMaxMinData,
  usePushoverCurve,
} from '../../../hooks/useResults'
import type {
  BeamRotationsPlotData,
  BeamRotationsTableData,
  ColumnRotationsPlotData,
  Element,
  MaxMinDataset,
  ResultDataset,
} from '../../../types'
import { mapPushoverCurveToDataset } from '../../../features/results/mappers/pushoverMappers'
import { buildComparisonProfileChartData } from '../comparisonUtils'
import { isJointSelectionType } from '../../projects/results-tree/types'
import { ELEMENT_DIRECTIONS } from './controller.constants'
import type { ResultsSelectionControllerState } from './controller.selection'

export interface ResultsDataControllerState {
  beamRotationsPlotData: BeamRotationsPlotData | undefined
  beamRotationsPlotLoading: boolean
  beamRotationsTableData: BeamRotationsTableData | undefined
  beamRotationsTableLoading: boolean
  columnRotationsPlotData: ColumnRotationsPlotData | undefined
  columnRotationsPlotLoading: boolean
  quadRotationsPlotData: ColumnRotationsPlotData | undefined
  quadRotationsPlotLoading: boolean
  comparisonChartData: ReturnType<typeof buildComparisonProfileChartData>
  comparisonData: ReturnType<typeof useComparisonData>['data']
  comparisonLoading: boolean
  elementDirectionOptions: string[]
  elementResultsData: ResultDataset | undefined
  elementResultsLoading: boolean
  elements: Element[]
  elementsLoading: boolean
  jointResultsData: ResultDataset | undefined
  jointResultsLoading: boolean
  maxMinData: MaxMinDataset | undefined
  maxMinLoading: boolean
  pushoverAllCurves: ReturnType<typeof useAllPushoverCurves>['curves']
  pushoverAllCurvesLoading: boolean
  pushoverCurveData: ReturnType<typeof usePushoverCurve>['data']
  pushoverCurveLoading: boolean
  pushoverCurveTableDataset: ResultDataset | null
  resultsData: ResultDataset | undefined
  resultsLoading: boolean
}

export function useResultsDataState(
  projectSlug: string,
  selectionState: ResultsSelectionControllerState
): ResultsDataControllerState {
  const {
    comparisonMetric,
    resetTableState,
    selectedElementDirection,
    selectedElementId,
    selectedResultSetIsPushover,
    selection,
    setSelectedElementDirection,
    setSelectedElementId,
  } = selectionState

  const isPushoverGlobalSelection =
    selection?.type === 'pushover_global' ||
    (selection?.type === 'global_result' && selectedResultSetIsPushover)

  const globalParams =
    selection?.resultSetId &&
    (selection.type === 'global_result' || selection.type === 'pushover_global')
      ? {
          result_set_id: selection.resultSetId,
          result_type: selection.resultType,
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

  const { data: quadRotationsPlotData, isLoading: quadRotationsPlotLoading } =
    useQuadRotationsPlotData(
      projectSlug,
      selection?.resultSetId && selection.type === 'quad_rotations_plot'
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
  }, [
    elementDirectionOptions,
    selectedElementDirection,
    selection?.type,
    setSelectedElementDirection,
  ])

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
  }, [elements, selectedElementId, selection?.type, setSelectedElementId])

  useEffect(() => {
    if (selection?.type !== 'element') return
    resetTableState()
  }, [
    resetTableState,
    selection?.type,
    selection?.resultSetId,
    selection?.resultType,
    selectedElementId,
    selectedElementDirection,
  ])

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
    if (
      !selection ||
      (selection.type !== 'comparison_global' && selection.type !== 'comparison_element')
    ) {
      return null
    }
    return {
      result_set_ids: selection.resultSetIds,
      result_type: selection.resultType,
      direction: selection.direction || undefined,
      metric: comparisonMetric,
      element_id: selection.elementId || undefined,
    }
  }, [selection, comparisonMetric])

  const { data: comparisonData, isLoading: comparisonLoading } = useComparisonData(
    projectSlug,
    comparisonParams
  )

  const comparisonChartData = useMemo(
    () => buildComparisonProfileChartData(comparisonData, selection?.direction),
    [comparisonData, selection?.direction]
  )

  return {
    beamRotationsPlotData,
    beamRotationsPlotLoading,
    beamRotationsTableData,
    beamRotationsTableLoading,
    columnRotationsPlotData,
    columnRotationsPlotLoading,
    quadRotationsPlotData,
    quadRotationsPlotLoading,
    comparisonChartData,
    comparisonData,
    comparisonLoading,
    elementDirectionOptions,
    elementResultsData,
    elementResultsLoading,
    elements,
    elementsLoading,
    jointResultsData,
    jointResultsLoading,
    maxMinData,
    maxMinLoading,
    pushoverAllCurves,
    pushoverAllCurvesLoading,
    pushoverCurveData,
    pushoverCurveLoading,
    pushoverCurveTableDataset,
    resultsData,
    resultsLoading,
  }
}
