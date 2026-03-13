import { useMemo } from 'react'
import type {
  BeamRotationsPlotData,
  BeamRotationsTableData,
  ColumnRotationsPlotData,
  Element,
  MaxMinDataset,
  ResultDataset,
} from '../../../types'
import type { ComparisonMetric } from '../comparisonUtils'
import { isComparisonSelection, type TreeSelection } from '../../projects/results-tree/types'
import { useResultsDataState } from './controller.data'
import {
  type ResultsTableInteractionState,
  useResultsSelectionState,
} from './controller.selection'
import { useResultsViewTitle } from './controller.title'

export type TableInteractionState = ResultsTableInteractionState

export interface ResultsViewController {
  beamRotationsPlotData: BeamRotationsPlotData | undefined
  beamRotationsPlotLoading: boolean
  beamRotationsTableData: BeamRotationsTableData | undefined
  beamRotationsTableLoading: boolean
  columnRotationsPlotData: ColumnRotationsPlotData | undefined
  columnRotationsPlotLoading: boolean
  quadRotationsPlotData: ColumnRotationsPlotData | undefined
  quadRotationsPlotLoading: boolean
  comparisonChartData: ReturnType<typeof useResultsDataState>['comparisonChartData']
  comparisonData: ReturnType<typeof useResultsDataState>['comparisonData']
  comparisonLoading: boolean
  comparisonMetric: ComparisonMetric
  elementDirectionOptions: string[]
  elementResultsData: ResultDataset | undefined
  elementResultsLoading: boolean
  elements: Element[]
  elementsLoading: boolean
  handleTreeSelect: (selection: TreeSelection) => void
  hasRenderableSelection: boolean
  isBeamRotationsComparison: boolean
  isColumnRotationsComparison: boolean
  isComparisonDataSelection: boolean
  isJointComparison: boolean
  jointResultsData: ResultDataset | undefined
  jointResultsLoading: boolean
  maxMinData: MaxMinDataset | undefined
  maxMinLoading: boolean
  projectSlug: string
  pushoverAllCurves: ReturnType<typeof useResultsDataState>['pushoverAllCurves']
  pushoverAllCurvesLoading: boolean
  pushoverCurveData: ReturnType<typeof useResultsDataState>['pushoverCurveData']
  pushoverCurveLoading: boolean
  pushoverCurveTableDataset: ResultDataset | null
  resultsData: ResultDataset | undefined
  resultsLoading: boolean
  selectedElementDirection: string | null
  selectedElementId: number | null
  selection: TreeSelection | null
  setComparisonMetric: (value: ComparisonMetric) => void
  setSelectedElementDirection: (value: string | null) => void
  setSelectedElementId: (value: number | null) => void
  tableState: TableInteractionState
  title: string
}

export function useResultsViewController(projectSlug: string): ResultsViewController {
  const selectionState = useResultsSelectionState(projectSlug)
  const dataState = useResultsDataState(projectSlug, selectionState)

  const title = useResultsViewTitle({
    comparisonData: dataState.comparisonData,
    dataState,
    selectionState,
  })

  const hasRenderableSelection = useMemo(() => {
    const { selection } = selectionState
    if (!selection) return false
    if (isComparisonSelection(selection)) return true
    return selection.resultSetId > 0
  }, [selectionState])

  return {
    beamRotationsPlotData: dataState.beamRotationsPlotData,
    beamRotationsPlotLoading: dataState.beamRotationsPlotLoading,
    beamRotationsTableData: dataState.beamRotationsTableData,
    beamRotationsTableLoading: dataState.beamRotationsTableLoading,
    columnRotationsPlotData: dataState.columnRotationsPlotData,
    columnRotationsPlotLoading: dataState.columnRotationsPlotLoading,
    quadRotationsPlotData: dataState.quadRotationsPlotData,
    quadRotationsPlotLoading: dataState.quadRotationsPlotLoading,
    comparisonChartData: dataState.comparisonChartData,
    comparisonData: dataState.comparisonData,
    comparisonLoading: dataState.comparisonLoading,
    comparisonMetric: selectionState.comparisonMetric,
    elementDirectionOptions: dataState.elementDirectionOptions,
    elementResultsData: dataState.elementResultsData,
    elementResultsLoading: dataState.elementResultsLoading,
    elements: dataState.elements,
    elementsLoading: dataState.elementsLoading,
    handleTreeSelect: selectionState.handleTreeSelect,
    hasRenderableSelection,
    isBeamRotationsComparison: selectionState.isBeamRotationsComparison,
    isColumnRotationsComparison: selectionState.isColumnRotationsComparison,
    isComparisonDataSelection: selectionState.isComparisonDataSelection,
    isJointComparison: selectionState.isJointComparison,
    jointResultsData: dataState.jointResultsData,
    jointResultsLoading: dataState.jointResultsLoading,
    maxMinData: dataState.maxMinData,
    maxMinLoading: dataState.maxMinLoading,
    projectSlug,
    pushoverAllCurves: dataState.pushoverAllCurves,
    pushoverAllCurvesLoading: dataState.pushoverAllCurvesLoading,
    pushoverCurveData: dataState.pushoverCurveData,
    pushoverCurveLoading: dataState.pushoverCurveLoading,
    pushoverCurveTableDataset: dataState.pushoverCurveTableDataset,
    resultsData: dataState.resultsData,
    resultsLoading: dataState.resultsLoading,
    selectedElementDirection: selectionState.selectedElementDirection,
    selectedElementId: selectionState.selectedElementId,
    selection: selectionState.selection,
    setComparisonMetric: selectionState.setComparisonMetric,
    setSelectedElementDirection: selectionState.setSelectedElementDirection,
    setSelectedElementId: selectionState.setSelectedElementId,
    tableState: selectionState.tableState,
    title,
  }
}
