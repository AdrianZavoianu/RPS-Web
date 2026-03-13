import { useMemo } from 'react'
import type { ResultsDataControllerState } from './controller.data'
import type { ResultsSelectionControllerState } from './controller.selection'

export interface ResultsTitleInput {
  comparisonData: ResultsDataControllerState['comparisonData']
  dataState: Pick<
    ResultsDataControllerState,
    | 'beamRotationsPlotData'
    | 'beamRotationsTableData'
    | 'columnRotationsPlotData'
    | 'quadRotationsPlotData'
    | 'elementResultsData'
    | 'elements'
    | 'jointResultsData'
    | 'maxMinData'
    | 'pushoverCurveData'
    | 'resultsData'
  >
  selectionState: Pick<
    ResultsSelectionControllerState,
    'selectedElementDirection' | 'selectedElementId' | 'selection'
  >
}

export function useResultsViewTitle({
  comparisonData,
  dataState,
  selectionState,
}: ResultsTitleInput): string {
  const {
    beamRotationsPlotData,
    beamRotationsTableData,
    columnRotationsPlotData,
    quadRotationsPlotData,
    elementResultsData,
    elements,
    jointResultsData,
    maxMinData,
    pushoverCurveData,
    resultsData,
  } = dataState

  const { selectedElementDirection, selectedElementId, selection } = selectionState

  return useMemo(() => {
    if (!selection) return ''

    if (selection.type === 'comparison_beam_rotations') {
      return `▸ ${selection.comparisonSetName} - All Beam Rotations`
    }

    if (selection.type === 'comparison_column_rotations') {
      return `▸ ${selection.comparisonSetName} - All Column Rotations`
    }

    if (selection.type === 'comparison_joint') {
      const unit = comparisonData?.unit || ''
      return `▸ ${selection.comparisonSetName} - ${selection.resultType}${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'comparison_global' || selection.type === 'comparison_element') {
      const unit = comparisonData?.unit || ''
      const directionSuffix = selection.direction ? ` ${selection.direction}` : ''
      return `▸ ${selection.comparisonSetName} - ${selection.resultType}${directionSuffix}${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'element') {
      const selectedElement = elements.find((element) => element.id === selectedElementId)
      const elementName = selectedElement?.name || 'Element'
      const unit = elementResultsData?.meta?.unit || ''
      const directionSuffix = selectedElementDirection ? ` (${selectedElementDirection})` : ''
      return `▸ ${elementName} - ${selection.resultType}${directionSuffix}${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'beam_rotations_plot') {
      const unit = beamRotationsPlotData?.meta?.unit || ''
      return `▸ All Beam Rotations - R3 Plastic${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'column_rotations_plot') {
      const unit = columnRotationsPlotData?.meta?.unit || ''
      return `▸ All Column Rotations${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'quad_rotations_plot') {
      const unit = quadRotationsPlotData?.meta?.unit || ''
      return `▸ All Quad Rotations${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'beam_rotations_table') {
      const unit = beamRotationsTableData?.meta?.unit || ''
      return `▸ Beam Rotations Table - R3 Plastic${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'joint_plot') {
      const unit = jointResultsData?.meta?.unit || ''
      return `▸ ${selection.resultType} (${selection.direction}) - Plot${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'joint_table') {
      const unit = jointResultsData?.meta?.unit || ''
      return `▸ ${selection.resultType} (${selection.direction}) - Table${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'joint') {
      const unit = jointResultsData?.meta?.unit || ''
      return `▸ ${selection.resultType}${unit ? ` (${unit})` : ''}`
    }

    if (selection.type === 'pushover_curve') {
      return `▸ ${pushoverCurveData?.case.name || 'Pushover Curve'}`
    }

    if (selection.type === 'pushover_all_curves') {
      return `▸ All ${selection.direction} Curves`
    }

    const unit =
      (selection.type === 'maxmin' ? maxMinData?.meta?.unit : resultsData?.meta?.unit) || ''

    if (selection.direction === 'MaxMin') {
      return `▸ Story ${selection.resultType}${unit ? ` (${unit})` : ''} - Max/Min`
    }

    return `▸ Story ${selection.resultType}${unit ? ` (${unit})` : ''} - ${selection.direction} Direction`
  }, [
    beamRotationsPlotData,
    beamRotationsTableData,
    columnRotationsPlotData,
    quadRotationsPlotData,
    comparisonData?.unit,
    elementResultsData?.meta?.unit,
    elements,
    jointResultsData?.meta?.unit,
    maxMinData?.meta?.unit,
    pushoverCurveData?.case.name,
    resultsData?.meta?.unit,
    selectedElementDirection,
    selectedElementId,
    selection,
  ])
}
