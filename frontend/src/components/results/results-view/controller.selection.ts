import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useResultSets } from '../../../hooks/useResults'
import { isPushoverResultSet } from '../../../utils/resultSets'
import type { ResultSet } from '../../../types'
import type { ComparisonMetric } from '../comparisonUtils'
import { type TreeSelection, isComparisonSelection } from '../../projects/results-tree/types'
import { ELEMENT_DIRECTIONS } from './controller.constants'

export interface ResultsTableInteractionState {
  hoveredLoadCase: string | null
  hoveredRow: number | null
  selectedLoadCases: Set<string>
  selectedRows: Set<number>
  setHoveredLoadCase: (value: string | null) => void
  setHoveredRow: (value: number | null) => void
  setSelectedLoadCases: (value: Set<string>) => void
  setSelectedRows: (value: Set<number>) => void
}

export interface ResultsSelectionControllerState {
  comparisonMetric: ComparisonMetric
  handleTreeSelect: (selection: TreeSelection) => void
  isBeamRotationsComparison: boolean
  isColumnRotationsComparison: boolean
  isComparisonDataSelection: boolean
  isJointComparison: boolean
  resetTableState: () => void
  selectedElementDirection: string | null
  selectedElementId: number | null
  selectedResultSetIsPushover: boolean
  selection: TreeSelection | null
  setComparisonMetric: (value: ComparisonMetric) => void
  setSelectedElementDirection: (value: string | null) => void
  setSelectedElementId: (value: number | null) => void
  tableState: ResultsTableInteractionState
}

export function useResultsSelectionState(projectSlug: string): ResultsSelectionControllerState {
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

  const resetTableState = useCallback(() => {
    setSelectedLoadCases(new Set())
    setHoveredLoadCase(null)
    setSelectedRows(new Set())
    setHoveredRow(null)
  }, [])

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
      resetTableState()
    },
    [navigate, projectSlug, resetTableState]
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

  return {
    comparisonMetric,
    handleTreeSelect,
    isBeamRotationsComparison,
    isColumnRotationsComparison,
    isComparisonDataSelection,
    isJointComparison,
    resetTableState,
    selectedElementDirection,
    selectedElementId,
    selectedResultSetIsPushover,
    selection,
    setComparisonMetric,
    setSelectedElementDirection,
    setSelectedElementId,
    tableState: {
      hoveredLoadCase,
      hoveredRow,
      selectedLoadCases,
      selectedRows,
      setHoveredLoadCase,
      setHoveredRow,
      setSelectedLoadCases,
      setSelectedRows,
    },
  }
}
