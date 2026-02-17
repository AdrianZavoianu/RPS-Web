/**
 * Results Tree Browser - Hierarchical navigation for project results
 * Replicates the desktop RPS tree browser structure exactly
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import clsx from 'clsx'
import {
  useResultSets,
  useAvailableResultTypes,
  useElementsForType,
  useJointResults,
  useTimeSeriesLoadCases,
  useComparisonSets,
  useDeleteComparisonSet,
  usePushoverCases,
} from '../../hooks/useResults'
import type { ResultSet, ComparisonSet, PushoverCase } from '../../types'
import { isNlthaResultSet, isPushoverResultSet } from '../../utils/resultSets'

// Tree node selection data
export interface TreeSelection {
  type:
    | 'global_result'
    | 'maxmin'
    | 'time_series'
    | 'element'
    | 'joint'
    | 'joint_plot'
    | 'joint_table'
    | 'column_rotations_plot'
    | 'beam_rotations_plot'
    | 'beam_rotations_table'
    | 'pushover_curve'
    | 'pushover_all_curves'
    | 'pushover_global'
    | 'comparison_global'
    | 'comparison_element'
    | 'comparison_joint'
    | 'comparison_column_rotations'
    | 'comparison_beam_rotations'
  resultSetId: number
  category: 'Envelopes' | 'Time-Series'
  categoryType?: 'Global' | 'Elements' | 'Joints'
  resultType: string
  direction: string
  elementType?: string
  elementId?: number
  loadCaseName?: string
  // Comparison-specific fields
  comparisonSetId?: number
  comparisonSetName?: string
  resultSetIds?: number[]
}

interface ResultsTreeBrowserProps {
  projectSlug: string
  onSelect: (selection: TreeSelection) => void
  currentSelection: TreeSelection | null
  disableInitialAutoSelect?: boolean
  resultSetRootSelectsDefault?: boolean
}

const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

// Icons matching desktop exactly
const ICONS = {
  section: '◆',      // Top-level sections (NLTHA, Pushover)
  resultSet: '▸',    // Result sets
  category: '◆',     // Categories (Envelopes, Time-Series)
  categoryType: '◇', // Category types (Global, Elements, Joints)
  resultType: '›',   // Result types (Drifts, Forces, etc.)
  branch: '├',       // Branch prefix
  branchLast: '└',   // Last branch prefix
}

const isResultSetBranchKey = (key: string, resultSetId: number) =>
  key.startsWith(`${resultSetId}-`) || key.startsWith(`push-${resultSetId}-`)

const getComparisonRootKey = (comparisonSetId: number) => `comp-${comparisonSetId}`

const isComparisonBranchKey = (key: string, comparisonSetId: number) => {
  const rootKey = getComparisonRootKey(comparisonSetId)
  return key === rootKey || key.startsWith(`${rootKey}-`)
}

export function ResultsTreeBrowser({
  projectSlug,
  onSelect,
  currentSelection,
  disableInitialAutoSelect = false,
  resultSetRootSelectsDefault = true,
}: ResultsTreeBrowserProps) {
  const { data: resultSets, isLoading } = useResultSets(projectSlug)
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)
  const [hasAutoSelectedInitial, setHasAutoSelectedInitial] = useState(false)

  // Expanded state tracking
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['NLTHA']))
  const [expandedResultSets, setExpandedResultSets] = useState<Set<number>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedCategoryTypes, setExpandedCategoryTypes] = useState<Set<string>>(new Set())
  const [expandedResultTypes, setExpandedResultTypes] = useState<Set<string>>(new Set())

  // Separate result sets by analysis type
  const { nlthaResultSets, pushoverResultSets } = useMemo(() => {
    if (!resultSets) return { nlthaResultSets: [], pushoverResultSets: [] }
    return {
      nlthaResultSets: resultSets.filter(isNlthaResultSet),
      pushoverResultSets: resultSets.filter(isPushoverResultSet),
    }
  }, [resultSets])

  const collapseToActiveSet = useCallback((activeResultSetId: number | null, activeComparisonSetId: number | null) => {
    setExpandedResultSets(
      activeResultSetId !== null
        ? new Set<number>([activeResultSetId])
        : new Set<number>()
    )

    setExpandedCategories((prev) => {
      if (activeResultSetId === null) return new Set<string>()

      const next = new Set<string>()
      for (const key of prev) {
        if (isResultSetBranchKey(key, activeResultSetId)) next.add(key)
      }
      return next
    })

    setExpandedCategoryTypes((prev) => {
      const next = new Set<string>()

      if (activeResultSetId !== null) {
        for (const key of prev) {
          if (isResultSetBranchKey(key, activeResultSetId)) next.add(key)
        }
      }

      if (activeComparisonSetId !== null) {
        for (const key of prev) {
          if (isComparisonBranchKey(key, activeComparisonSetId)) next.add(key)
        }
        next.add(getComparisonRootKey(activeComparisonSetId))
      }

      return next
    })

    setExpandedResultTypes((prev) => {
      const next = new Set<string>()

      if (activeResultSetId !== null) {
        for (const key of prev) {
          if (isResultSetBranchKey(key, activeResultSetId)) next.add(key)
        }
      }

      if (activeComparisonSetId !== null) {
        for (const key of prev) {
          if (isComparisonBranchKey(key, activeComparisonSetId)) next.add(key)
        }
      }

      return next
    })
  }, [])

  const handleSelect = useCallback((selection: TreeSelection) => {
    const hasComparisonSetId =
      typeof selection.comparisonSetId === 'number' && selection.comparisonSetId > 0
    const activeComparisonSetId = hasComparisonSetId ? selection.comparisonSetId! : null
    const activeResultSetId =
      !hasComparisonSetId && selection.resultSetId > 0 ? selection.resultSetId : null

    collapseToActiveSet(activeResultSetId, activeComparisonSetId)
    onSelect(selection)
  }, [collapseToActiveSet, onSelect])

  // Auto-expand first result set
  useEffect(() => {
    if (disableInitialAutoSelect) return
    if (!nlthaResultSets.length || hasAutoSelectedInitial) return

    const firstId = nlthaResultSets[0].id
    setExpandedResultSets(new Set([firstId]))
    setExpandedCategories(new Set([`${firstId}-Envelopes`]))
    setExpandedCategoryTypes(new Set([`${firstId}-Envelopes-Global`]))
    setExpandedResultTypes(new Set([`${firstId}-Drifts`]))

    // Auto-select first result
    handleSelect({
      type: 'global_result',
      resultSetId: firstId,
      category: 'Envelopes',
      categoryType: 'Global',
      resultType: 'Drifts',
      direction: 'X',
    })
    setHasAutoSelectedInitial(true)
  }, [disableInitialAutoSelect, hasAutoSelectedInitial, handleSelect, nlthaResultSets])

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const toggleResultSet = (id: number) => {
    if (expandedResultSets.has(id)) {
      setExpandedResultSets((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      return
    }

    collapseToActiveSet(id, null)
  }

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleCategoryType = (key: string) => {
    setExpandedCategoryTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleResultType = (key: string) => {
    setExpandedResultTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const globalResults = availableTypes?.global_results || [
    { type: 'Drifts', directions: ['X', 'Y'] },
    { type: 'Accelerations', directions: ['X', 'Y'] },
    { type: 'Forces', directions: ['X', 'Y'] },
    { type: 'Displacements', directions: ['X', 'Y'] },
  ]

  const handleResultSetRootClick = useCallback((resultSetId: number) => {
    const firstGlobal = globalResults.find((rt) => rt.directions && rt.directions.length > 0)
    const resultType = firstGlobal?.type || 'Drifts'
    const direction = firstGlobal?.directions?.[0] || 'X'

    handleSelect({
      type: 'global_result',
      resultSetId,
      category: 'Envelopes',
      categoryType: 'Global',
      resultType,
      direction,
    })

    setExpandedCategories(new Set([`${resultSetId}-Envelopes`]))
    setExpandedCategoryTypes(new Set([`${resultSetId}-Envelopes-Global`]))
    setExpandedResultTypes(new Set([`${resultSetId}-${resultType}`]))
  }, [globalResults, handleSelect])

  const isSelected = (rsId: number, rt: string, dir: string) => {
    return (
      currentSelection?.resultSetId === rsId &&
      currentSelection?.resultType === rt &&
      currentSelection?.direction === dir
    )
  }

  if (isLoading) {
    return (
      <div className="tree-browser p-3">
        <div className="text-[15px] text-text-muted">Loading...</div>
      </div>
    )
  }

  if (!resultSets?.length) {
    return (
      <div className="tree-browser p-3">
        <div className="text-[15px] text-text-muted">No result sets imported</div>
      </div>
    )
  }

  return (
    <div className="tree-browser overflow-y-auto">
      {/* Header */}
      <div className="tree-header px-3 py-2">
        <span className="text-lg font-semibold text-text-primary">Results</span>
      </div>

      <div className="tree-content p-1">
        {/* NLTHA Section */}
        {nlthaResultSets.length > 0 && (
          <TreeSection
            label="NLTHA"
            icon={ICONS.section}
            isExpanded={expandedSections.has('NLTHA')}
            onToggle={() => toggleSection('NLTHA')}
          >
            {nlthaResultSets.map((rs) => (
              <NLTHAResultSetNode
                key={rs.id}
                resultSet={rs}
                projectSlug={projectSlug}
                globalResults={globalResults}
                elementResults={availableTypes?.element_results || []}
                jointResults={availableTypes?.joint_results || []}
                currentSelection={currentSelection}
                isExpanded={expandedResultSets.has(rs.id)}
                expandedCategories={expandedCategories}
                expandedCategoryTypes={expandedCategoryTypes}
                expandedResultTypes={expandedResultTypes}
                onToggleResultSet={() =>
                  resultSetRootSelectsDefault ? handleResultSetRootClick(rs.id) : toggleResultSet(rs.id)
                }
                onToggleCategory={toggleCategory}
                onToggleCategoryType={toggleCategoryType}
                onToggleResultType={toggleResultType}
                onSelect={handleSelect}
                isSelected={isSelected}
              />
            ))}

            {/* Comparisons Section - always rendered at the end of NLTHA subtree */}
            <ComparisonsSectionNode
              projectSlug={projectSlug}
              availableTypes={availableTypes}
              currentSelection={currentSelection}
              isExpanded={expandedSections.has('Comparisons')}
              onToggleSection={() => toggleSection('Comparisons')}
              expandedCategoryTypes={expandedCategoryTypes}
              expandedResultTypes={expandedResultTypes}
              onToggleCategoryType={toggleCategoryType}
              onToggleResultType={toggleResultType}
              onSelect={handleSelect}
              onToggleComparisonSet={(csKey: string, defaultSelection: TreeSelection | null) => {
                const comparisonSetId = Number(csKey.replace('comp-', ''))
                if (!Number.isFinite(comparisonSetId) || comparisonSetId <= 0) return

                collapseToActiveSet(null, comparisonSetId)

                if (!defaultSelection) {
                  setExpandedCategoryTypes(new Set([getComparisonRootKey(comparisonSetId)]))
                  setExpandedResultTypes(new Set())
                  return
                }

                handleSelect(defaultSelection)

                const rootKey = getComparisonRootKey(comparisonSetId)
                if (defaultSelection.type === 'comparison_global') {
                  setExpandedCategoryTypes(new Set([rootKey, `${rootKey}-Global`]))
                  setExpandedResultTypes(new Set([`${rootKey}-${defaultSelection.resultType}`]))
                  return
                }

                if (defaultSelection.type === 'comparison_joint') {
                  setExpandedCategoryTypes(new Set([rootKey, `${rootKey}-Joints`]))
                  setExpandedResultTypes(new Set())
                  return
                }

                if (defaultSelection.type === 'comparison_beam_rotations') {
                  setExpandedCategoryTypes(
                    new Set([
                      rootKey,
                      `${rootKey}-Elements`,
                      `${rootKey}-Elements-Beams`,
                    ])
                  )
                  setExpandedResultTypes(new Set())
                  return
                }

                if (defaultSelection.type === 'comparison_column_rotations') {
                  setExpandedCategoryTypes(
                    new Set([
                      rootKey,
                      `${rootKey}-Elements`,
                      `${rootKey}-Elements-Columns`,
                      `${rootKey}-Elements-Columns-ColumnRotations`,
                    ])
                  )
                  setExpandedResultTypes(new Set())
                  return
                }

                setExpandedCategoryTypes(new Set([rootKey]))
                setExpandedResultTypes(new Set())
              }}
            />
          </TreeSection>
        )}

        {/* Pushover Section */}
        {pushoverResultSets.length > 0 && (
          <TreeSection
            label="Pushover"
            icon={ICONS.section}
            isExpanded={expandedSections.has('Pushover')}
            onToggle={() => toggleSection('Pushover')}
          >
            {pushoverResultSets.map((rs) => (
              <PushoverResultSetNode
                key={rs.id}
                projectSlug={projectSlug}
                resultSet={rs}
                currentSelection={currentSelection}
                isExpanded={expandedResultSets.has(rs.id)}
                onToggle={() => toggleResultSet(rs.id)}
                expandedCategories={expandedCategories}
                expandedCategoryTypes={expandedCategoryTypes}
                expandedResultTypes={expandedResultTypes}
                onToggleCategory={toggleCategory}
                onToggleCategoryType={toggleCategoryType}
                onToggleResultType={toggleResultType}
                onSelect={handleSelect}
              />
            ))}
          </TreeSection>
        )}

      </div>
    </div>
  )
}

// Tree Section Component (top-level: NLTHA, Pushover)
interface TreeSectionProps {
  label: string
  icon: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function TreeSection({ label, icon, isExpanded, onToggle, children }: TreeSectionProps) {
  return (
    <div className="tree-section">
      <button
        onClick={onToggle}
        className="tree-item tree-item-section w-full text-left flex items-center gap-1 py-1.5 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-accent-primary">{icon}</span>
        <span className="font-medium text-text-primary">{label}</span>
      </button>
      {isExpanded && <div className="tree-children ml-2">{children}</div>}
    </div>
  )
}

// NLTHA Result Set Node
interface NLTHAResultSetNodeProps {
  resultSet: ResultSet
  projectSlug: string
  globalResults: Array<{ type: string; directions: string[] | null }>
  elementResults: Array<{ type: string; directions: string[] | null }>
  jointResults: Array<{ type: string; directions?: string[] | null }>
  currentSelection: TreeSelection | null
  isExpanded: boolean
  expandedCategories: Set<string>
  expandedCategoryTypes: Set<string>
  expandedResultTypes: Set<string>
  onToggleResultSet: () => void
  onToggleCategory: (key: string) => void
  onToggleCategoryType: (key: string) => void
  onToggleResultType: (key: string) => void
  onSelect: (selection: TreeSelection) => void
  isSelected: (rsId: number, rt: string, dir: string) => boolean
}

function NLTHAResultSetNode({
  resultSet,
  projectSlug,
  globalResults,
  elementResults,
  jointResults,
  currentSelection,
  isExpanded,
  expandedCategories,
  expandedCategoryTypes,
  expandedResultTypes,
  onToggleResultSet,
  onToggleCategory,
  onToggleCategoryType,
  onToggleResultType,
  onSelect,
  isSelected,
}: NLTHAResultSetNodeProps) {
  const envelopesKey = `${resultSet.id}-Envelopes`
  const timeSeriesKey = `${resultSet.id}-Time-Series`
  const globalKey = `${resultSet.id}-Envelopes-Global`
  const elementsKey = `${resultSet.id}-Envelopes-Elements`
  const wallsKey = `${resultSet.id}-Envelopes-Elements-Walls`
  const wallShearsKey = `${resultSet.id}-Envelopes-Elements-Walls-Shears`
  const columnsKey = `${resultSet.id}-Envelopes-Elements-Columns`
  const columnShearsKey = `${resultSet.id}-Envelopes-Elements-Columns-Shears`
  const columnAxialsKey = `${resultSet.id}-Envelopes-Elements-Columns-Axials`
  const columnRotationsKey = `${resultSet.id}-Envelopes-Elements-Columns-Rotations`
  const beamsKey = `${resultSet.id}-Envelopes-Elements-Beams`
  const beamRotationsKey = `${resultSet.id}-Envelopes-Elements-Beams-R3PlasticRotations`
  const jointsKey = `${resultSet.id}-Envelopes-Joints`
  const soilPressuresKey = `${resultSet.id}-Envelopes-Joints-SoilPressures`
  const verticalDisplacementsKey = `${resultSet.id}-Envelopes-Joints-VerticalDisplacements`

  // Check for time-series data
  const { data: timeSeriesData } = useTimeSeriesLoadCases(projectSlug, resultSet.id)
  const timeSeriesLoadCases = useMemo(
    () => [...(timeSeriesData?.load_cases ?? [])].sort(naturalCompare),
    [timeSeriesData?.load_cases]
  )
  const hasTimeSeries = timeSeriesLoadCases.length > 0
  const hasWallShears = elementResults.some((resultType) => resultType.type === 'WallShears')
  const hasQuadRotations = elementResults.some((resultType) => resultType.type === 'QuadRotations')
  const hasColumnShears = elementResults.some((resultType) => resultType.type === 'ColumnShears')
  const hasColumnAxials = elementResults.some((resultType) => resultType.type === 'ColumnAxials')
  const hasColumnRotations = elementResults.some((resultType) => resultType.type === 'ColumnRotations')
  const hasBeamRotations = elementResults.some((resultType) => resultType.type === 'BeamRotations')
  const hasSoilPressures = jointResults.some((resultType) => resultType.type === 'SoilPressures')
  const hasVerticalDisplacements = jointResults.some(
    (resultType) => resultType.type === 'VerticalDisplacements'
  )
  const { data: columnShearElementsData } = useElementsForType(
    projectSlug,
    hasColumnShears ? { result_set_id: resultSet.id, result_type: 'ColumnShears' } : null
  )
  const columnShearElements = [...(columnShearElementsData?.elements || [])].sort((a, b) => naturalCompare(a.name, b.name))

  const { data: columnAxialElementsData } = useElementsForType(
    projectSlug,
    hasColumnAxials ? { result_set_id: resultSet.id, result_type: 'ColumnAxials' } : null
  )
  const columnAxialElements = [...(columnAxialElementsData?.elements || [])].sort((a, b) => naturalCompare(a.name, b.name))

  const { data: columnRotationElementsData } = useElementsForType(
    projectSlug,
    hasColumnRotations
      ? {
          result_set_id: resultSet.id,
          result_type: 'ColumnRotations',
        }
      : null
  )
  const columnRotationElements = [...(columnRotationElementsData?.elements || [])].sort((a, b) => naturalCompare(a.name, b.name))

  return (
    <div className="tree-result-set">
      {/* Result Set Name */}
      <button
        onClick={onToggleResultSet}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-[13px]">{ICONS.resultSet}</span>
        <span className="text-text-secondary">{resultSet.name}</span>
      </button>

      {isExpanded && (
        <div className="tree-children ml-3">
          {/* Envelopes Category */}
          <TreeCategoryNode
            label="Envelopes"
            icon={ICONS.category}
            isExpanded={expandedCategories.has(envelopesKey)}
            onToggle={() => onToggleCategory(envelopesKey)}
          >
            {/* Global Category Type */}
            <TreeCategoryTypeNode
              label="Global"
              icon={ICONS.categoryType}
              isExpanded={expandedCategoryTypes.has(globalKey)}
              onToggle={() => onToggleCategoryType(globalKey)}
            >
              {globalResults.filter((rt) => rt.directions && rt.directions.length > 0).map((rt) => {
                const rtKey = `${resultSet.id}-${rt.type}`
                return (
                  <TreeResultTypeNode
                    key={rt.type}
                    label={rt.type}
                    directions={rt.directions!}
                    isExpanded={expandedResultTypes.has(rtKey)}
                    onToggle={() => onToggleResultType(rtKey)}
                    onSelectDirection={(dir) =>
                      onSelect({
                        type: 'global_result',
                        resultSetId: resultSet.id,
                        category: 'Envelopes',
                        categoryType: 'Global',
                        resultType: rt.type,
                        direction: dir,
                      })
                    }
                    onSelectMaxMin={() =>
                      onSelect({
                        type: 'maxmin',
                        resultSetId: resultSet.id,
                        category: 'Envelopes',
                        categoryType: 'Global',
                        resultType: rt.type,
                        direction: 'MaxMin',
                      })
                    }
                    isSelected={(dir) => isSelected(resultSet.id, rt.type, dir)}
                  />
                )
              })}
            </TreeCategoryTypeNode>

            {/* Elements Category Type */}
            <TreeCategoryTypeNode
              label="Elements"
              icon={ICONS.categoryType}
              isExpanded={expandedCategoryTypes.has(elementsKey)}
              onToggle={() => onToggleCategoryType(elementsKey)}
            >
              {(hasWallShears || hasQuadRotations) && (
                <TreeCategoryTypeNode
                  label="Walls"
                  icon={ICONS.resultType}
                  isExpanded={expandedCategoryTypes.has(wallsKey)}
                  onToggle={() => onToggleCategoryType(wallsKey)}
                >
                  {hasWallShears && (
                    <TreeDirectionNode
                      label="Shears"
                      directions={['V2', 'V3']}
                      isExpanded={expandedCategoryTypes.has(wallShearsKey)}
                      onToggle={() => onToggleCategoryType(wallShearsKey)}
                      onSelectDirection={(direction) =>
                        onSelect({
                          type: 'element',
                          resultSetId: resultSet.id,
                          category: 'Envelopes',
                          categoryType: 'Elements',
                          resultType: 'WallShears',
                          direction,
                          elementType: 'Wall',
                        })
                      }
                      isSelected={(direction) =>
                        currentSelection?.type === 'element' &&
                        currentSelection.resultSetId === resultSet.id &&
                        currentSelection.resultType === 'WallShears' &&
                        currentSelection.direction === direction
                      }
                    />
                  )}
                  {hasQuadRotations && (
                    <TreeLeafNode
                      label={`${hasWallShears ? ICONS.branchLast : ICONS.branch} Quad Rotations`}
                      onClick={() =>
                        onSelect({
                          type: 'element',
                          resultSetId: resultSet.id,
                          category: 'Envelopes',
                          categoryType: 'Elements',
                          resultType: 'QuadRotations',
                          direction: '',
                          elementType: 'Quad',
                        })
                      }
                      isSelected={
                        currentSelection?.type === 'element' &&
                        currentSelection.resultSetId === resultSet.id &&
                        currentSelection.resultType === 'QuadRotations'
                      }
                    />
                  )}
                </TreeCategoryTypeNode>
              )}

              {(hasColumnShears || hasColumnAxials || hasColumnRotations) && (
                <TreeCategoryTypeNode
                  label="Columns"
                  icon={ICONS.resultType}
                  isExpanded={expandedCategoryTypes.has(columnsKey)}
                  onToggle={() => onToggleCategoryType(columnsKey)}
                >
                  {hasColumnShears && (
                    <TreeCategoryTypeNode
                      label="Shears"
                      icon={ICONS.resultType}
                      isExpanded={expandedCategoryTypes.has(columnShearsKey)}
                      onToggle={() => onToggleCategoryType(columnShearsKey)}
                    >
                      {columnShearElements.map((element, elementIndex) => {
                        const elementKey = `${columnShearsKey}-${element.id}`
                        const isLastElement = elementIndex === columnShearElements.length - 1
                        return (
                          <TreeCategoryTypeNode
                            key={element.id}
                            label={`${isLastElement ? ICONS.branchLast : ICONS.branch} ${element.name}`}
                            icon={ICONS.resultType}
                            isExpanded={expandedCategoryTypes.has(elementKey)}
                            onToggle={() => onToggleCategoryType(elementKey)}
                          >
                            <TreeLeafNode
                              label={`${ICONS.branch} V2`}
                              onClick={() =>
                                onSelect({
                                  type: 'element',
                                  resultSetId: resultSet.id,
                                  category: 'Envelopes',
                                  categoryType: 'Elements',
                                  resultType: 'ColumnShears',
                                  direction: 'V2',
                                  elementType: 'Column',
                                  elementId: element.id,
                                })
                              }
                              isSelected={
                                currentSelection?.type === 'element' &&
                                currentSelection.resultSetId === resultSet.id &&
                                currentSelection.resultType === 'ColumnShears' &&
                                currentSelection.direction === 'V2' &&
                                currentSelection.elementId === element.id
                              }
                            />
                            <TreeLeafNode
                              label={`${ICONS.branch} V3`}
                              onClick={() =>
                                onSelect({
                                  type: 'element',
                                  resultSetId: resultSet.id,
                                  category: 'Envelopes',
                                  categoryType: 'Elements',
                                  resultType: 'ColumnShears',
                                  direction: 'V3',
                                  elementType: 'Column',
                                  elementId: element.id,
                                })
                              }
                              isSelected={
                                currentSelection?.type === 'element' &&
                                currentSelection.resultSetId === resultSet.id &&
                                currentSelection.resultType === 'ColumnShears' &&
                                currentSelection.direction === 'V3' &&
                                currentSelection.elementId === element.id
                              }
                            />
                            <TreeLeafNode
                              label={`${ICONS.branchLast} Max/Min`}
                              onClick={() =>
                                onSelect({
                                  type: 'maxmin',
                                  resultSetId: resultSet.id,
                                  category: 'Envelopes',
                                  categoryType: 'Elements',
                                  resultType: 'ColumnShears',
                                  direction: 'MaxMin',
                                  elementType: 'Column',
                                  elementId: element.id,
                                })
                              }
                              isSelected={
                                currentSelection?.type === 'maxmin' &&
                                currentSelection.resultSetId === resultSet.id &&
                                currentSelection.resultType === 'ColumnShears' &&
                                currentSelection.elementId === element.id
                              }
                            />
                          </TreeCategoryTypeNode>
                        )
                      })}
                    </TreeCategoryTypeNode>
                  )}
                  {hasColumnAxials && (
                    <TreeCategoryTypeNode
                      label="Axials"
                      icon={ICONS.resultType}
                      isExpanded={expandedCategoryTypes.has(columnAxialsKey)}
                      onToggle={() => onToggleCategoryType(columnAxialsKey)}
                    >
                      {columnAxialElements.map((element, elementIndex) => {
                        const elementKey = `${columnAxialsKey}-${element.id}`
                        const isLastElement = elementIndex === columnAxialElements.length - 1
                        return (
                          <TreeCategoryTypeNode
                            key={element.id}
                            label={`${isLastElement ? ICONS.branchLast : ICONS.branch} ${element.name}`}
                            icon={ICONS.resultType}
                            isExpanded={expandedCategoryTypes.has(elementKey)}
                            onToggle={() => onToggleCategoryType(elementKey)}
                          >
                            <TreeLeafNode
                              label={`${ICONS.branch} Min`}
                              onClick={() =>
                                onSelect({
                                  type: 'element',
                                  resultSetId: resultSet.id,
                                  category: 'Envelopes',
                                  categoryType: 'Elements',
                                  resultType: 'ColumnAxials',
                                  direction: 'Min',
                                  elementType: 'Column',
                                  elementId: element.id,
                                })
                              }
                              isSelected={
                                currentSelection?.type === 'element' &&
                                currentSelection.resultSetId === resultSet.id &&
                                currentSelection.resultType === 'ColumnAxials' &&
                                currentSelection.direction === 'Min' &&
                                currentSelection.elementId === element.id
                              }
                            />
                            <TreeLeafNode
                              label={`${ICONS.branch} Max`}
                              onClick={() =>
                                onSelect({
                                  type: 'element',
                                  resultSetId: resultSet.id,
                                  category: 'Envelopes',
                                  categoryType: 'Elements',
                                  resultType: 'ColumnAxials',
                                  direction: 'Max',
                                  elementType: 'Column',
                                  elementId: element.id,
                                })
                              }
                              isSelected={
                                currentSelection?.type === 'element' &&
                                currentSelection.resultSetId === resultSet.id &&
                                currentSelection.resultType === 'ColumnAxials' &&
                                currentSelection.direction === 'Max' &&
                                currentSelection.elementId === element.id
                              }
                            />
                            <TreeLeafNode
                              label={`${ICONS.branchLast} Max/Min`}
                              onClick={() =>
                                onSelect({
                                  type: 'maxmin',
                                  resultSetId: resultSet.id,
                                  category: 'Envelopes',
                                  categoryType: 'Elements',
                                  resultType: 'ColumnAxials',
                                  direction: 'MaxMin',
                                  elementType: 'Column',
                                  elementId: element.id,
                                })
                              }
                              isSelected={
                                currentSelection?.type === 'maxmin' &&
                                currentSelection.resultSetId === resultSet.id &&
                                currentSelection.resultType === 'ColumnAxials' &&
                                currentSelection.elementId === element.id
                              }
                            />
                          </TreeCategoryTypeNode>
                        )
                      })}
                    </TreeCategoryTypeNode>
                  )}
                  {hasColumnRotations && (
                    <TreeCategoryTypeNode
                      label="Rotations"
                      icon={ICONS.resultType}
                      isExpanded={expandedCategoryTypes.has(columnRotationsKey)}
                      onToggle={() => onToggleCategoryType(columnRotationsKey)}
                    >
                      <TreeLeafNode
                        label={`${columnRotationElements.length ? ICONS.branch : ICONS.branchLast} All Rotations`}
                        onClick={() =>
                          onSelect({
                            type: 'column_rotations_plot',
                            resultSetId: resultSet.id,
                            category: 'Envelopes',
                            categoryType: 'Elements',
                            resultType: 'AllColumnRotations',
                            direction: '',
                            elementType: 'Column',
                          })
                        }
                        isSelected={
                          currentSelection?.type === 'column_rotations_plot' &&
                          currentSelection.resultSetId === resultSet.id
                        }
                      />
                      {columnRotationElements.map((element, elementIndex) => {
                        const elementKey = `${columnRotationsKey}-${element.id}`
                        const isLastElement = elementIndex === columnRotationElements.length - 1
                        return (
                          <TreeCategoryTypeNode
                            key={element.id}
                            label={`${isLastElement ? ICONS.branchLast : ICONS.branch} ${element.name}`}
                            icon={ICONS.resultType}
                            isExpanded={expandedCategoryTypes.has(elementKey)}
                            onToggle={() => onToggleCategoryType(elementKey)}
                          >
                            <TreeLeafNode
                              label={`${ICONS.branch} R2`}
                              onClick={() =>
                                onSelect({
                                  type: 'element',
                                  resultSetId: resultSet.id,
                                  category: 'Envelopes',
                                  categoryType: 'Elements',
                                  resultType: 'ColumnRotations',
                                  direction: 'R2',
                                  elementType: 'Column',
                                  elementId: element.id,
                                })
                              }
                              isSelected={
                                currentSelection?.type === 'element' &&
                                currentSelection.resultSetId === resultSet.id &&
                                currentSelection.resultType === 'ColumnRotations' &&
                                currentSelection.direction === 'R2' &&
                                currentSelection.elementId === element.id
                              }
                            />
                            <TreeLeafNode
                              label={`${ICONS.branch} R3`}
                              onClick={() =>
                                onSelect({
                                  type: 'element',
                                  resultSetId: resultSet.id,
                                  category: 'Envelopes',
                                  categoryType: 'Elements',
                                  resultType: 'ColumnRotations',
                                  direction: 'R3',
                                  elementType: 'Column',
                                  elementId: element.id,
                                })
                              }
                              isSelected={
                                currentSelection?.type === 'element' &&
                                currentSelection.resultSetId === resultSet.id &&
                                currentSelection.resultType === 'ColumnRotations' &&
                                currentSelection.direction === 'R3' &&
                                currentSelection.elementId === element.id
                              }
                            />
                            <TreeLeafNode
                              label={`${ICONS.branchLast} Max/Min`}
                              onClick={() =>
                                onSelect({
                                  type: 'maxmin',
                                  resultSetId: resultSet.id,
                                  category: 'Envelopes',
                                  categoryType: 'Elements',
                                  resultType: 'ColumnRotations',
                                  direction: 'MaxMin',
                                  elementType: 'Column',
                                  elementId: element.id,
                                })
                              }
                              isSelected={
                                currentSelection?.type === 'maxmin' &&
                                currentSelection.resultSetId === resultSet.id &&
                                currentSelection.resultType === 'ColumnRotations' &&
                                currentSelection.elementId === element.id
                              }
                            />
                          </TreeCategoryTypeNode>
                        )
                      })}
                    </TreeCategoryTypeNode>
                  )}
                </TreeCategoryTypeNode>
              )}

              {hasBeamRotations && (
                <TreeCategoryTypeNode
                  label="Beams"
                  icon={ICONS.resultType}
                  isExpanded={expandedCategoryTypes.has(beamsKey)}
                  onToggle={() => onToggleCategoryType(beamsKey)}
                >
                  <TreeCategoryTypeNode
                    label="R3 Plastic Rotations"
                    icon={ICONS.resultType}
                    isExpanded={expandedCategoryTypes.has(beamRotationsKey)}
                    onToggle={() => onToggleCategoryType(beamRotationsKey)}
                  >
                    <TreeLeafNode
                      label={`${ICONS.branch} Plot`}
                      onClick={() =>
                        onSelect({
                          type: 'beam_rotations_plot',
                          resultSetId: resultSet.id,
                          category: 'Envelopes',
                          categoryType: 'Elements',
                          resultType: 'AllBeamRotations',
                          direction: '',
                          elementType: 'Beam',
                        })
                      }
                      isSelected={
                        currentSelection?.type === 'beam_rotations_plot' &&
                        currentSelection.resultSetId === resultSet.id
                      }
                    />
                    <TreeLeafNode
                      label={`${ICONS.branchLast} Table`}
                      onClick={() =>
                        onSelect({
                          type: 'beam_rotations_table',
                          resultSetId: resultSet.id,
                          category: 'Envelopes',
                          categoryType: 'Elements',
                          resultType: 'BeamRotationsTable',
                          direction: '',
                          elementType: 'Beam',
                        })
                      }
                      isSelected={
                        currentSelection?.type === 'beam_rotations_table' &&
                        currentSelection.resultSetId === resultSet.id
                      }
                    />
                  </TreeCategoryTypeNode>
                </TreeCategoryTypeNode>
              )}
            </TreeCategoryTypeNode>

            {(hasSoilPressures || hasVerticalDisplacements) && (
              <TreeCategoryTypeNode
                label="Joints"
                icon={ICONS.categoryType}
                isExpanded={expandedCategoryTypes.has(jointsKey)}
                onToggle={() => onToggleCategoryType(jointsKey)}
              >
                {hasSoilPressures && (
                  <TreeCategoryTypeNode
                    label="Soil Pressures (Min)"
                    icon={ICONS.resultType}
                    isExpanded={expandedCategoryTypes.has(soilPressuresKey)}
                    onToggle={() => onToggleCategoryType(soilPressuresKey)}
                  >
                    <TreeLeafNode
                      label={`${ICONS.branch} Plot`}
                      onClick={() =>
                        onSelect({
                          type: 'joint_plot',
                          resultSetId: resultSet.id,
                          category: 'Envelopes',
                          categoryType: 'Joints',
                          resultType: 'SoilPressures',
                          direction: 'Min',
                        })
                      }
                      isSelected={
                        currentSelection?.type === 'joint_plot' &&
                        currentSelection.resultSetId === resultSet.id &&
                        currentSelection.resultType === 'SoilPressures'
                      }
                    />
                    <TreeLeafNode
                      label={`${ICONS.branchLast} Table`}
                      onClick={() =>
                        onSelect({
                          type: 'joint_table',
                          resultSetId: resultSet.id,
                          category: 'Envelopes',
                          categoryType: 'Joints',
                          resultType: 'SoilPressures',
                          direction: 'Min',
                        })
                      }
                      isSelected={
                        currentSelection?.type === 'joint_table' &&
                        currentSelection.resultSetId === resultSet.id &&
                        currentSelection.resultType === 'SoilPressures'
                      }
                    />
                  </TreeCategoryTypeNode>
                )}
                {hasVerticalDisplacements && (
                  <TreeCategoryTypeNode
                    label="Vertical Displacements (Min)"
                    icon={ICONS.resultType}
                    isExpanded={expandedCategoryTypes.has(verticalDisplacementsKey)}
                    onToggle={() => onToggleCategoryType(verticalDisplacementsKey)}
                  >
                    <TreeLeafNode
                      label={`${ICONS.branch} Plot`}
                      onClick={() =>
                        onSelect({
                          type: 'joint_plot',
                          resultSetId: resultSet.id,
                          category: 'Envelopes',
                          categoryType: 'Joints',
                          resultType: 'VerticalDisplacements',
                          direction: 'Min',
                        })
                      }
                      isSelected={
                        currentSelection?.type === 'joint_plot' &&
                        currentSelection.resultSetId === resultSet.id &&
                        currentSelection.resultType === 'VerticalDisplacements'
                      }
                    />
                    <TreeLeafNode
                      label={`${ICONS.branchLast} Table`}
                      onClick={() =>
                        onSelect({
                          type: 'joint_table',
                          resultSetId: resultSet.id,
                          category: 'Envelopes',
                          categoryType: 'Joints',
                          resultType: 'VerticalDisplacements',
                          direction: 'Min',
                        })
                      }
                      isSelected={
                        currentSelection?.type === 'joint_table' &&
                        currentSelection.resultSetId === resultSet.id &&
                        currentSelection.resultType === 'VerticalDisplacements'
                      }
                    />
                  </TreeCategoryTypeNode>
                )}
              </TreeCategoryTypeNode>
            )}
          </TreeCategoryNode>

          {/* Time-Series Category (only show if data exists) */}
          {hasTimeSeries && (
            <TreeCategoryNode
              label="Time-Series"
              icon={ICONS.category}
              isExpanded={expandedCategories.has(timeSeriesKey)}
              onToggle={() => onToggleCategory(timeSeriesKey)}
            >
              {timeSeriesLoadCases.map((loadCaseName, index) => {
                const loadCaseKey = `${timeSeriesKey}-${loadCaseName}`
                const isLastLoadCase = index === timeSeriesLoadCases.length - 1
                return (
                  <TreeCategoryTypeNode
                    key={loadCaseName}
                    label={`${isLastLoadCase ? ICONS.branchLast : ICONS.branch} ${loadCaseName}`}
                    icon={ICONS.categoryType}
                    isExpanded={expandedCategoryTypes.has(loadCaseKey)}
                    onToggle={() => onToggleCategoryType(loadCaseKey)}
                  >
                    {(['X', 'Y'] as const).map((direction, directionIndex) => (
                      <TreeLeafNode
                        key={`${loadCaseName}-${direction}`}
                        label={`${directionIndex < 1 ? ICONS.branch : ICONS.branchLast} ${direction} Direction`}
                        onClick={() =>
                          onSelect({
                            type: 'time_series',
                            resultSetId: resultSet.id,
                            category: 'Time-Series',
                            categoryType: 'Global',
                            resultType: 'Drifts',
                            direction,
                            loadCaseName,
                          })
                        }
                        isSelected={
                          currentSelection?.type === 'time_series' &&
                          currentSelection.resultSetId === resultSet.id &&
                          currentSelection.direction === direction &&
                          currentSelection.loadCaseName === loadCaseName
                        }
                      />
                    ))}
                  </TreeCategoryTypeNode>
                )
              })}
            </TreeCategoryNode>
          )}
        </div>
      )}
    </div>
  )
}

// Pushover Result Set Node (enhanced with direction groups)
interface PushoverResultSetNodeProps {
  projectSlug: string
  resultSet: ResultSet
  currentSelection: TreeSelection | null
  isExpanded: boolean
  onToggle: () => void
  expandedCategories: Set<string>
  expandedCategoryTypes: Set<string>
  expandedResultTypes: Set<string>
  onToggleCategory: (key: string) => void
  onToggleCategoryType: (key: string) => void
  onToggleResultType: (key: string) => void
  onSelect: (selection: TreeSelection) => void
}

function PushoverResultSetNode({
  projectSlug,
  resultSet,
  currentSelection,
  isExpanded,
  onToggle,
  expandedCategories,
  expandedCategoryTypes,
  expandedResultTypes,
  onToggleCategory,
  onToggleCategoryType,
  onToggleResultType,
  onSelect,
}: PushoverResultSetNodeProps) {
  const { data: casesData } = usePushoverCases(projectSlug, isExpanded ? resultSet.id : undefined)
  const pushoverCases = useMemo(
    () => casesData?.pushover_cases ?? [],
    [casesData?.pushover_cases]
  )

  // Group cases by direction
  const directionGroups = useMemo(() => {
    const groups = new Map<string, PushoverCase[]>()
    for (const pc of pushoverCases) {
      const dir = pc.direction || 'Unknown'
      if (!groups.has(dir)) groups.set(dir, [])
      groups.get(dir)!.push(pc)
    }
    return groups
  }, [pushoverCases])

  const curvesKey = `push-${resultSet.id}-curves`
  const globalKey = `push-${resultSet.id}-global`
  const elementsKey = `push-${resultSet.id}-elements`
  const wallsKey = `push-${resultSet.id}-elements-walls`
  const wallShearsKey = `push-${resultSet.id}-elements-walls-shears`
  const wallRotationsKey = `push-${resultSet.id}-elements-walls-rotations`
  const columnsKey = `push-${resultSet.id}-elements-columns`
  const columnShearsKey = `push-${resultSet.id}-elements-columns-shears`
  const columnRotationsKey = `push-${resultSet.id}-elements-columns-rotations`
  const beamsKey = `push-${resultSet.id}-elements-beams`
  const beamRotationsKey = `push-${resultSet.id}-elements-beams-r3`
  const jointsKey = `push-${resultSet.id}-joints`
  const soilPressuresKey = `push-${resultSet.id}-joints-soil`
  const verticalDisplacementsKey = `push-${resultSet.id}-joints-vertical`
  const PUSHOVER_GLOBAL_TYPES = ['Drifts', 'Forces', 'Displacements']

  const { data: wallShearElementsData } = useElementsForType(
    projectSlug,
    isExpanded ? { result_set_id: resultSet.id, result_type: 'WallShears' } : null
  )
  const wallShearElements = useMemo(
    () => [...(wallShearElementsData?.elements || [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [wallShearElementsData]
  )

  const { data: quadRotationElementsData } = useElementsForType(
    projectSlug,
    isExpanded ? { result_set_id: resultSet.id, result_type: 'QuadRotations' } : null
  )
  const quadRotationElements = useMemo(
    () => [...(quadRotationElementsData?.elements || [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [quadRotationElementsData]
  )

  const { data: columnShearElementsData } = useElementsForType(
    projectSlug,
    isExpanded ? { result_set_id: resultSet.id, result_type: 'ColumnShears' } : null
  )
  const columnShearElements = useMemo(
    () => [...(columnShearElementsData?.elements || [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [columnShearElementsData]
  )

  const { data: columnRotationElementsData } = useElementsForType(
    projectSlug,
    isExpanded ? { result_set_id: resultSet.id, result_type: 'ColumnRotations' } : null
  )
  const columnRotationElements = useMemo(
    () => [...(columnRotationElementsData?.elements || [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [columnRotationElementsData]
  )

  const { data: beamRotationElementsData } = useElementsForType(
    projectSlug,
    isExpanded ? { result_set_id: resultSet.id, result_type: 'BeamRotations' } : null
  )

  const { data: soilPressuresData } = useJointResults(
    projectSlug,
    isExpanded
      ? {
          result_set_id: resultSet.id,
          result_type: 'SoilPressures_Min',
          is_pushover: true,
        }
      : null
  )

  const { data: verticalDisplacementsData } = useJointResults(
    projectSlug,
    isExpanded
      ? {
          result_set_id: resultSet.id,
          result_type: 'VerticalDisplacements_Min',
          is_pushover: true,
        }
      : null
  )

  const hasWallShears = wallShearElements.length > 0
  const hasQuadRotations = quadRotationElements.length > 0
  const hasColumnShears = columnShearElements.length > 0
  const hasColumnRotations = columnRotationElements.length > 0
  const hasBeamRotations = (beamRotationElementsData?.elements?.length || 0) > 0
  const hasSoilPressures = (soilPressuresData?.rows?.length || 0) > 0
  const hasVerticalDisplacements = (verticalDisplacementsData?.rows?.length || 0) > 0
  const hasElements =
    hasWallShears ||
    hasQuadRotations ||
    hasColumnShears ||
    hasColumnRotations ||
    hasBeamRotations
  const hasJoints = hasSoilPressures || hasVerticalDisplacements

  return (
    <div className="tree-result-set">
      <button
        onClick={onToggle}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-[13px]">{ICONS.resultSet}</span>
        <span className="text-text-secondary">{resultSet.name}</span>
      </button>

      {isExpanded && (
        <div className="tree-children ml-3">
          {/* Curves Section */}
          <button
            onClick={() => onToggleCategory(curvesKey)}
            className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
          >
            <span className="text-text-muted text-[13px]">{ICONS.category}</span>
            <span className="text-text-secondary">Curves</span>
          </button>
          {expandedCategories.has(curvesKey) && (
            <div className="tree-children ml-3">
              {Array.from(directionGroups.entries()).map(([dir, cases]) => {
                const dirKey = `push-${resultSet.id}-curves-${dir}`
                return (
                  <div key={dir}>
                    <button
                      onClick={() => onToggleCategoryType(dirKey)}
                      className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
                    >
                      <span className="text-text-muted text-[13px]">{ICONS.categoryType}</span>
                      <span className="text-text-secondary">{dir} Direction</span>
                    </button>
                    {expandedCategoryTypes.has(dirKey) && (
                      <div className="tree-children ml-3">
                        {cases.map((pc) => (
                          <TreeLeafNode
                            key={pc.id}
                            label={pc.name}
                            icon={ICONS.resultType}
                            isSelected={
                              currentSelection?.type === 'pushover_curve' &&
                              currentSelection?.resultSetId === resultSet.id &&
                              currentSelection?.direction === String(pc.id)
                            }
                            onClick={() =>
                              onSelect({
                                type: 'pushover_curve',
                                resultSetId: resultSet.id,
                                category: 'Envelopes',
                                resultType: 'PushoverCurve',
                                direction: String(pc.id),
                              })
                            }
                          />
                        ))}
                        <TreeLeafNode
                          label={`All ${dir} Curves`}
                          icon={ICONS.resultType}
                          isSelected={
                            currentSelection?.type === 'pushover_all_curves' &&
                            currentSelection?.resultSetId === resultSet.id &&
                            currentSelection?.direction === dir
                          }
                          onClick={() =>
                            onSelect({
                              type: 'pushover_all_curves',
                              resultSetId: resultSet.id,
                              category: 'Envelopes',
                              resultType: 'PushoverCurve',
                              direction: dir,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                )
              })}
              {pushoverCases.length === 0 && (
                <div className="text-text-muted text-[13px] px-2 py-1">No curves imported</div>
              )}
            </div>
          )}

          {/* Global Results Section */}
          <button
            onClick={() => onToggleCategory(globalKey)}
            className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
          >
            <span className="text-text-muted text-[13px]">{ICONS.category}</span>
            <span className="text-text-secondary">Global Results</span>
          </button>
          {expandedCategories.has(globalKey) && (
            <div className="tree-children ml-3">
              {PUSHOVER_GLOBAL_TYPES.map((rt) => {
                const rtKey = `push-${resultSet.id}-${rt}`
                return (
                  <div key={rt}>
                    <button
                      onClick={() => onToggleResultType(rtKey)}
                      className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
                    >
                      <span className="text-text-muted text-[13px]">{ICONS.resultType}</span>
                      <span className="text-text-secondary">{rt}</span>
                    </button>
                    {expandedResultTypes.has(rtKey) && (
                      <div className="tree-children ml-3">
                        {['X', 'Y'].map((dir) => (
                          <TreeLeafNode
                            key={dir}
                            label={dir}
                            icon={ICONS.resultType}
                            isSelected={
                              currentSelection?.type === 'pushover_global' &&
                              currentSelection?.resultSetId === resultSet.id &&
                              currentSelection?.resultType === rt &&
                              currentSelection?.direction === dir
                            }
                            onClick={() =>
                              onSelect({
                                type: 'pushover_global',
                                resultSetId: resultSet.id,
                                category: 'Envelopes',
                                resultType: rt,
                                direction: dir,
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Elements Section */}
          {hasElements && (
            <>
              <button
                onClick={() => onToggleCategory(elementsKey)}
                className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
              >
                <span className="text-text-muted text-[13px]">{ICONS.category}</span>
                <span className="text-text-secondary">Elements</span>
              </button>
              {expandedCategories.has(elementsKey) && (
                <div className="tree-children ml-3">
                  {(hasWallShears || hasQuadRotations) && (
                    <TreeCategoryTypeNode
                      label="Walls"
                      icon={ICONS.categoryType}
                      isExpanded={expandedCategoryTypes.has(wallsKey)}
                      onToggle={() => onToggleCategoryType(wallsKey)}
                    >
                      {hasWallShears && (
                        <TreeCategoryTypeNode
                          label="Shears"
                          icon={ICONS.resultType}
                          isExpanded={expandedCategoryTypes.has(wallShearsKey)}
                          onToggle={() => onToggleCategoryType(wallShearsKey)}
                        >
                          {wallShearElements.map((element, idx) => {
                            const wallElementKey = `${wallShearsKey}-${element.id}`
                            return (
                              <TreeCategoryTypeNode
                                key={element.id}
                                label={`${idx < wallShearElements.length - 1 ? ICONS.branch : ICONS.branchLast} ${element.name}`}
                                icon={ICONS.resultType}
                                isExpanded={expandedCategoryTypes.has(wallElementKey)}
                                onToggle={() => onToggleCategoryType(wallElementKey)}
                              >
                                <TreeLeafNode
                                  label={`${ICONS.branch} V2`}
                                  onClick={() =>
                                    onSelect({
                                      type: 'element',
                                      resultSetId: resultSet.id,
                                      category: 'Envelopes',
                                      categoryType: 'Elements',
                                      resultType: 'WallShears',
                                      direction: 'V2',
                                      elementType: 'Wall',
                                      elementId: element.id,
                                    })
                                  }
                                  isSelected={
                                    currentSelection?.type === 'element' &&
                                    currentSelection.resultSetId === resultSet.id &&
                                    currentSelection.resultType === 'WallShears' &&
                                    currentSelection.direction === 'V2' &&
                                    currentSelection.elementId === element.id
                                  }
                                />
                                <TreeLeafNode
                                  label={`${ICONS.branchLast} V3`}
                                  onClick={() =>
                                    onSelect({
                                      type: 'element',
                                      resultSetId: resultSet.id,
                                      category: 'Envelopes',
                                      categoryType: 'Elements',
                                      resultType: 'WallShears',
                                      direction: 'V3',
                                      elementType: 'Wall',
                                      elementId: element.id,
                                    })
                                  }
                                  isSelected={
                                    currentSelection?.type === 'element' &&
                                    currentSelection.resultSetId === resultSet.id &&
                                    currentSelection.resultType === 'WallShears' &&
                                    currentSelection.direction === 'V3' &&
                                    currentSelection.elementId === element.id
                                  }
                                />
                              </TreeCategoryTypeNode>
                            )
                          })}
                        </TreeCategoryTypeNode>
                      )}

                      {hasQuadRotations && (
                        <TreeCategoryTypeNode
                          label="Quad Rotations"
                          icon={ICONS.resultType}
                          isExpanded={expandedCategoryTypes.has(wallRotationsKey)}
                          onToggle={() => onToggleCategoryType(wallRotationsKey)}
                        >
                          {quadRotationElements.map((element, idx) => (
                            <TreeLeafNode
                              key={element.id}
                              label={`${idx < quadRotationElements.length - 1 ? ICONS.branch : ICONS.branchLast} ${element.name}`}
                              onClick={() =>
                                onSelect({
                                  type: 'element',
                                  resultSetId: resultSet.id,
                                  category: 'Envelopes',
                                  categoryType: 'Elements',
                                  resultType: 'QuadRotations',
                                  direction: '',
                                  elementType: 'Quad',
                                  elementId: element.id,
                                })
                              }
                              isSelected={
                                currentSelection?.type === 'element' &&
                                currentSelection.resultSetId === resultSet.id &&
                                currentSelection.resultType === 'QuadRotations' &&
                                currentSelection.elementId === element.id
                              }
                            />
                          ))}
                        </TreeCategoryTypeNode>
                      )}
                    </TreeCategoryTypeNode>
                  )}

                  {(hasColumnShears || hasColumnRotations) && (
                    <TreeCategoryTypeNode
                      label="Columns"
                      icon={ICONS.categoryType}
                      isExpanded={expandedCategoryTypes.has(columnsKey)}
                      onToggle={() => onToggleCategoryType(columnsKey)}
                    >
                      {hasColumnShears && (
                        <TreeCategoryTypeNode
                          label="Shears"
                          icon={ICONS.resultType}
                          isExpanded={expandedCategoryTypes.has(columnShearsKey)}
                          onToggle={() => onToggleCategoryType(columnShearsKey)}
                        >
                          {columnShearElements.map((element, idx) => {
                            const columnElementKey = `${columnShearsKey}-${element.id}`
                            return (
                              <TreeCategoryTypeNode
                                key={element.id}
                                label={`${idx < columnShearElements.length - 1 ? ICONS.branch : ICONS.branchLast} ${element.name}`}
                                icon={ICONS.resultType}
                                isExpanded={expandedCategoryTypes.has(columnElementKey)}
                                onToggle={() => onToggleCategoryType(columnElementKey)}
                              >
                                <TreeLeafNode
                                  label={`${ICONS.branch} V2`}
                                  onClick={() =>
                                    onSelect({
                                      type: 'element',
                                      resultSetId: resultSet.id,
                                      category: 'Envelopes',
                                      categoryType: 'Elements',
                                      resultType: 'ColumnShears',
                                      direction: 'V2',
                                      elementType: 'Column',
                                      elementId: element.id,
                                    })
                                  }
                                  isSelected={
                                    currentSelection?.type === 'element' &&
                                    currentSelection.resultSetId === resultSet.id &&
                                    currentSelection.resultType === 'ColumnShears' &&
                                    currentSelection.direction === 'V2' &&
                                    currentSelection.elementId === element.id
                                  }
                                />
                                <TreeLeafNode
                                  label={`${ICONS.branchLast} V3`}
                                  onClick={() =>
                                    onSelect({
                                      type: 'element',
                                      resultSetId: resultSet.id,
                                      category: 'Envelopes',
                                      categoryType: 'Elements',
                                      resultType: 'ColumnShears',
                                      direction: 'V3',
                                      elementType: 'Column',
                                      elementId: element.id,
                                    })
                                  }
                                  isSelected={
                                    currentSelection?.type === 'element' &&
                                    currentSelection.resultSetId === resultSet.id &&
                                    currentSelection.resultType === 'ColumnShears' &&
                                    currentSelection.direction === 'V3' &&
                                    currentSelection.elementId === element.id
                                  }
                                />
                              </TreeCategoryTypeNode>
                            )
                          })}
                        </TreeCategoryTypeNode>
                      )}

                      {hasColumnRotations && (
                        <TreeCategoryTypeNode
                          label="Rotations"
                          icon={ICONS.resultType}
                          isExpanded={expandedCategoryTypes.has(columnRotationsKey)}
                          onToggle={() => onToggleCategoryType(columnRotationsKey)}
                        >
                          <TreeLeafNode
                            label={`${columnRotationElements.length ? ICONS.branch : ICONS.branchLast} All Rotations`}
                            onClick={() =>
                              onSelect({
                                type: 'column_rotations_plot',
                                resultSetId: resultSet.id,
                                category: 'Envelopes',
                                categoryType: 'Elements',
                                resultType: 'AllColumnRotations',
                                direction: '',
                                elementType: 'Column',
                              })
                            }
                            isSelected={
                              currentSelection?.type === 'column_rotations_plot' &&
                              currentSelection.resultSetId === resultSet.id
                            }
                          />
                          {columnRotationElements.map((element, idx) => {
                            const columnRotationElementKey = `${columnRotationsKey}-${element.id}`
                            return (
                              <TreeCategoryTypeNode
                                key={element.id}
                                label={`${idx < columnRotationElements.length - 1 ? ICONS.branch : ICONS.branchLast} ${element.name}`}
                                icon={ICONS.resultType}
                                isExpanded={expandedCategoryTypes.has(columnRotationElementKey)}
                                onToggle={() => onToggleCategoryType(columnRotationElementKey)}
                              >
                                <TreeLeafNode
                                  label={`${ICONS.branch} R2`}
                                  onClick={() =>
                                    onSelect({
                                      type: 'element',
                                      resultSetId: resultSet.id,
                                      category: 'Envelopes',
                                      categoryType: 'Elements',
                                      resultType: 'ColumnRotations',
                                      direction: 'R2',
                                      elementType: 'Column',
                                      elementId: element.id,
                                    })
                                  }
                                  isSelected={
                                    currentSelection?.type === 'element' &&
                                    currentSelection.resultSetId === resultSet.id &&
                                    currentSelection.resultType === 'ColumnRotations' &&
                                    currentSelection.direction === 'R2' &&
                                    currentSelection.elementId === element.id
                                  }
                                />
                                <TreeLeafNode
                                  label={`${ICONS.branchLast} R3`}
                                  onClick={() =>
                                    onSelect({
                                      type: 'element',
                                      resultSetId: resultSet.id,
                                      category: 'Envelopes',
                                      categoryType: 'Elements',
                                      resultType: 'ColumnRotations',
                                      direction: 'R3',
                                      elementType: 'Column',
                                      elementId: element.id,
                                    })
                                  }
                                  isSelected={
                                    currentSelection?.type === 'element' &&
                                    currentSelection.resultSetId === resultSet.id &&
                                    currentSelection.resultType === 'ColumnRotations' &&
                                    currentSelection.direction === 'R3' &&
                                    currentSelection.elementId === element.id
                                  }
                                />
                              </TreeCategoryTypeNode>
                            )
                          })}
                        </TreeCategoryTypeNode>
                      )}
                    </TreeCategoryTypeNode>
                  )}

                  {hasBeamRotations && (
                    <TreeCategoryTypeNode
                      label="Beams"
                      icon={ICONS.categoryType}
                      isExpanded={expandedCategoryTypes.has(beamsKey)}
                      onToggle={() => onToggleCategoryType(beamsKey)}
                    >
                      <TreeCategoryTypeNode
                        label="R3 Plastic Rotations"
                        icon={ICONS.resultType}
                        isExpanded={expandedCategoryTypes.has(beamRotationsKey)}
                        onToggle={() => onToggleCategoryType(beamRotationsKey)}
                      >
                        <TreeLeafNode
                          label={`${ICONS.branch} Plot`}
                          onClick={() =>
                            onSelect({
                              type: 'beam_rotations_plot',
                              resultSetId: resultSet.id,
                              category: 'Envelopes',
                              categoryType: 'Elements',
                              resultType: 'AllBeamRotations',
                              direction: '',
                              elementType: 'Beam',
                            })
                          }
                          isSelected={
                            currentSelection?.type === 'beam_rotations_plot' &&
                            currentSelection.resultSetId === resultSet.id
                          }
                        />
                        <TreeLeafNode
                          label={`${ICONS.branchLast} Table`}
                          onClick={() =>
                            onSelect({
                              type: 'beam_rotations_table',
                              resultSetId: resultSet.id,
                              category: 'Envelopes',
                              categoryType: 'Elements',
                              resultType: 'BeamRotationsTable',
                              direction: '',
                              elementType: 'Beam',
                            })
                          }
                          isSelected={
                            currentSelection?.type === 'beam_rotations_table' &&
                            currentSelection.resultSetId === resultSet.id
                          }
                        />
                      </TreeCategoryTypeNode>
                    </TreeCategoryTypeNode>
                  )}
                </div>
              )}
            </>
          )}

          {/* Joints Section */}
          {hasJoints && (
            <>
              <button
                onClick={() => onToggleCategory(jointsKey)}
                className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
              >
                <span className="text-text-muted text-[13px]">{ICONS.category}</span>
                <span className="text-text-secondary">Joints</span>
              </button>
              {expandedCategories.has(jointsKey) && (
                <div className="tree-children ml-3">
                  {hasSoilPressures && (
                    <TreeCategoryTypeNode
                      label="Soil Pressures (Min)"
                      icon={ICONS.resultType}
                      isExpanded={expandedCategoryTypes.has(soilPressuresKey)}
                      onToggle={() => onToggleCategoryType(soilPressuresKey)}
                    >
                      <TreeLeafNode
                        label={`${ICONS.branch} Plot`}
                        onClick={() =>
                          onSelect({
                            type: 'joint_plot',
                            resultSetId: resultSet.id,
                            category: 'Envelopes',
                            categoryType: 'Joints',
                            resultType: 'SoilPressures',
                            direction: 'Min',
                          })
                        }
                        isSelected={
                          currentSelection?.type === 'joint_plot' &&
                          currentSelection.resultSetId === resultSet.id &&
                          currentSelection.resultType === 'SoilPressures'
                        }
                      />
                      <TreeLeafNode
                        label={`${ICONS.branchLast} Table`}
                        onClick={() =>
                          onSelect({
                            type: 'joint_table',
                            resultSetId: resultSet.id,
                            category: 'Envelopes',
                            categoryType: 'Joints',
                            resultType: 'SoilPressures',
                            direction: 'Min',
                          })
                        }
                        isSelected={
                          currentSelection?.type === 'joint_table' &&
                          currentSelection.resultSetId === resultSet.id &&
                          currentSelection.resultType === 'SoilPressures'
                        }
                      />
                    </TreeCategoryTypeNode>
                  )}

                  {hasVerticalDisplacements && (
                    <TreeCategoryTypeNode
                      label="Vertical Displacements (Min)"
                      icon={ICONS.resultType}
                      isExpanded={expandedCategoryTypes.has(verticalDisplacementsKey)}
                      onToggle={() => onToggleCategoryType(verticalDisplacementsKey)}
                    >
                      <TreeLeafNode
                        label={`${ICONS.branch} Plot`}
                        onClick={() =>
                          onSelect({
                            type: 'joint_plot',
                            resultSetId: resultSet.id,
                            category: 'Envelopes',
                            categoryType: 'Joints',
                            resultType: 'VerticalDisplacements',
                            direction: 'Min',
                          })
                        }
                        isSelected={
                          currentSelection?.type === 'joint_plot' &&
                          currentSelection.resultSetId === resultSet.id &&
                          currentSelection.resultType === 'VerticalDisplacements'
                        }
                      />
                      <TreeLeafNode
                        label={`${ICONS.branchLast} Table`}
                        onClick={() =>
                          onSelect({
                            type: 'joint_table',
                            resultSetId: resultSet.id,
                            category: 'Envelopes',
                            categoryType: 'Joints',
                            resultType: 'VerticalDisplacements',
                            direction: 'Min',
                          })
                        }
                        isSelected={
                          currentSelection?.type === 'joint_table' &&
                          currentSelection.resultSetId === resultSet.id &&
                          currentSelection.resultType === 'VerticalDisplacements'
                        }
                      />
                    </TreeCategoryTypeNode>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Comparisons Section
const COMP_GLOBAL_TYPES = ['Drifts', 'Accelerations', 'Forces', 'Displacements']
const COMP_ELEMENT_TYPE_MAP: Record<string, { group: string; label: string; directions: string[] }> = {
  WallShears: { group: 'Walls', label: 'Shears', directions: ['V2', 'V3'] },
  ColumnShears: { group: 'Columns', label: 'Shears', directions: ['V2', 'V3'] },
  ColumnAxials: { group: 'Columns', label: 'Axials', directions: ['Min', 'Max'] },
  ColumnRotations: { group: 'Columns', label: 'Rotations', directions: ['R2', 'R3'] },
}
// BeamRotations handled separately as aggregate overlay (not per-element)
const COMP_BEAM_ROTATIONS = 'BeamRotations'
const COMP_JOINT_TYPES = ['SoilPressures', 'VerticalDisplacements']
const COMP_JOINT_LABELS: Record<string, string> = {
  SoilPressures: 'Soil Pressures',
  VerticalDisplacements: 'Vertical Displacements',
}

interface ComparisonsSectionNodeProps {
  projectSlug: string
  availableTypes: {
    global_results: Array<{ type: string; directions: string[] | null }>
    element_results: Array<{ type: string; directions: string[] | null }>
    joint_results: Array<{ type: string; directions?: string[] | null }>
  } | undefined
  currentSelection: TreeSelection | null
  isExpanded: boolean
  onToggleSection: () => void
  expandedCategoryTypes: Set<string>
  expandedResultTypes: Set<string>
  onToggleCategoryType: (key: string) => void
  onToggleResultType: (key: string) => void
  onSelect: (selection: TreeSelection) => void
  onToggleComparisonSet: (csKey: string, defaultSelection: TreeSelection | null) => void
}

function ComparisonsSectionNode({
  projectSlug,
  availableTypes,
  currentSelection,
  isExpanded,
  onToggleSection,
  expandedCategoryTypes,
  expandedResultTypes,
  onToggleCategoryType,
  onToggleResultType,
  onSelect,
  onToggleComparisonSet,
}: ComparisonsSectionNodeProps) {
  const { data: comparisonSets } = useComparisonSets(projectSlug)
  const deleteMutation = useDeleteComparisonSet(projectSlug)

  if (!comparisonSets?.length) return null

  return (
    <TreeSection
      label="Comparisons"
      icon={ICONS.section}
      isExpanded={isExpanded}
      onToggle={onToggleSection}
    >
      {comparisonSets.map((cs) => (
        <ComparisonSetNode
          key={cs.id}
          comparisonSet={cs}
          projectSlug={projectSlug}
          availableTypes={availableTypes}
          currentSelection={currentSelection}
          expandedCategoryTypes={expandedCategoryTypes}
          expandedResultTypes={expandedResultTypes}
          onToggleCategoryType={onToggleCategoryType}
          onToggleResultType={onToggleResultType}
          onSelect={onSelect}
          onDelete={() => deleteMutation.mutate(cs.id)}
          onToggleComparisonSet={onToggleComparisonSet}
        />
      ))}
    </TreeSection>
  )
}

interface ComparisonSetNodeProps {
  comparisonSet: ComparisonSet
  projectSlug: string
  availableTypes: ComparisonsSectionNodeProps['availableTypes']
  currentSelection: TreeSelection | null
  expandedCategoryTypes: Set<string>
  expandedResultTypes: Set<string>
  onToggleCategoryType: (key: string) => void
  onToggleComparisonSet: (csKey: string, defaultSelection: TreeSelection | null) => void
  onToggleResultType: (key: string) => void
  onSelect: (selection: TreeSelection) => void
  onDelete: () => void
}

function ComparisonSetNode({
  comparisonSet: cs,
  projectSlug,
  availableTypes,
  currentSelection,
  expandedCategoryTypes,
  expandedResultTypes,
  onToggleCategoryType,
  onToggleComparisonSet,
  onToggleResultType,
  onSelect,
  onDelete,
}: ComparisonSetNodeProps) {
  const csKey = `comp-${cs.id}`
  const isExpanded = expandedCategoryTypes.has(csKey)

  const globalTypes = cs.result_types.filter((t) => COMP_GLOBAL_TYPES.includes(t))
  const elementTypes = cs.result_types.filter((t) => t in COMP_ELEMENT_TYPE_MAP)
  const jointTypes = cs.result_types.filter((t) => COMP_JOINT_TYPES.includes(t))
  const hasBeamRotations = cs.result_types.includes(COMP_BEAM_ROTATIONS)
  const hasColumnRotations = cs.result_types.includes('ColumnRotations')

  const hasGlobal = globalTypes.length > 0
  const hasElements = elementTypes.length > 0 || hasBeamRotations
  const hasJoints = jointTypes.length > 0

  // Build element groups
  const elementGroups = useMemo(() => {
    const groups: Record<string, Array<{ type: string; label: string; directions: string[] }>> = {}
    for (const t of elementTypes) {
      const info = COMP_ELEMENT_TYPE_MAP[t]
      if (!info) continue
      if (!groups[info.group]) groups[info.group] = []
      groups[info.group].push({ type: t, label: info.label, directions: info.directions })
    }
    return groups
  }, [elementTypes])

  const makeSelection = (
    type: TreeSelection['type'],
    resultType: string,
    direction: string,
    elementId?: number,
    elementType?: string,
  ): TreeSelection => ({
    type,
    resultSetId: -1,
    category: 'Envelopes',
    resultType,
    direction,
    comparisonSetId: cs.id,
    comparisonSetName: cs.name,
    resultSetIds: cs.result_set_ids,
    elementId,
    elementType,
  })

  const isCompSelected = (type: string, resultType: string, direction: string, elementId?: number) =>
    currentSelection?.comparisonSetId === cs.id &&
    currentSelection?.type === type &&
    currentSelection?.resultType === resultType &&
    currentSelection?.direction === direction &&
    (elementId === undefined || currentSelection?.elementId === elementId)

  const getDefaultSelection = (): TreeSelection | null => {
    const firstGlobalType = globalTypes[0]
    if (firstGlobalType) {
      const dirs = availableTypes?.global_results.find((r) => r.type === firstGlobalType)?.directions || ['X', 'Y']
      return makeSelection('comparison_global', firstGlobalType, dirs[0] || 'X')
    }

    if (hasBeamRotations) {
      return {
        type: 'comparison_beam_rotations',
        resultSetId: -1,
        category: 'Envelopes',
        resultType: 'BeamRotations',
        direction: '',
        comparisonSetId: cs.id,
        comparisonSetName: cs.name,
        resultSetIds: cs.result_set_ids,
      }
    }

    if (hasColumnRotations) {
      return {
        type: 'comparison_column_rotations',
        resultSetId: -1,
        category: 'Envelopes',
        resultType: 'ColumnRotations',
        direction: '',
        comparisonSetId: cs.id,
        comparisonSetName: cs.name,
        resultSetIds: cs.result_set_ids,
      }
    }

    if (jointTypes.length > 0) {
      return makeSelection('comparison_joint', jointTypes[0], '')
    }

    return null
  }

  return (
    <div className="tree-comparison-set">
      <div className="flex items-center group">
        <button
          onClick={() => onToggleComparisonSet(csKey, getDefaultSelection())}
          className="tree-item flex-1 text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
        >
          <span className="text-accent-primary text-[13px]">{ICONS.category}</span>
          <span className="text-text-secondary font-medium">{cs.name}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="text-text-muted hover:text-red-400 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete comparison set"
        >
          &times;
        </button>
      </div>

      {isExpanded && (
        <div className="tree-children ml-3">
          {/* Global */}
          {hasGlobal && (
            <TreeCategoryTypeNode
              label="Global"
              icon={ICONS.categoryType}
              isExpanded={expandedCategoryTypes.has(`${csKey}-Global`)}
              onToggle={() => onToggleCategoryType(`${csKey}-Global`)}
            >
              {globalTypes.map((rt) => {
                const dirs = availableTypes?.global_results.find((r) => r.type === rt)?.directions || ['X', 'Y']
                const rtKey = `${csKey}-${rt}`
                return (
                  <ComparisonResultTypeNode
                    key={rt}
                    label={rt}
                    directions={dirs}
                    isExpanded={expandedResultTypes.has(rtKey)}
                    onToggle={() => onToggleResultType(rtKey)}
                    onSelectDirection={(dir) => onSelect(makeSelection('comparison_global', rt, dir))}
                    isSelected={(dir) => isCompSelected('comparison_global', rt, dir)}
                  />
                )
              })}
            </TreeCategoryTypeNode>
          )}

          {/* Elements */}
          {hasElements && (
            <TreeCategoryTypeNode
              label="Elements"
              icon={ICONS.categoryType}
              isExpanded={expandedCategoryTypes.has(`${csKey}-Elements`)}
              onToggle={() => onToggleCategoryType(`${csKey}-Elements`)}
            >
              {Object.entries(elementGroups).map(([groupName, types]) => (
                <ComparisonElementGroupNode
                  key={groupName}
                  groupName={groupName}
                  types={types}
                  csKey={csKey}
                  projectSlug={projectSlug}
                  resultSetIds={cs.result_set_ids}
                  csId={cs.id}
                  csName={cs.name}
                  currentSelection={currentSelection}
                  expandedCategoryTypes={expandedCategoryTypes}
                  expandedResultTypes={expandedResultTypes}
                  onToggleCategoryType={onToggleCategoryType}
                  onToggleResultType={onToggleResultType}
                  onSelect={onSelect}
                />
              ))}
              {hasBeamRotations && (
                <TreeCategoryTypeNode
                  label="Beams"
                  icon={ICONS.resultType}
                  isExpanded={expandedCategoryTypes.has(`${csKey}-Elements-Beams`)}
                  onToggle={() => onToggleCategoryType(`${csKey}-Elements-Beams`)}
                >
                  <TreeLeafNode
                    label={`${ICONS.branchLast} R3 Plastic Rotations`}
                    onClick={() =>
                      onSelect({
                        type: 'comparison_beam_rotations',
                        resultSetId: -1,
                        category: 'Envelopes',
                        resultType: 'BeamRotations',
                        direction: '',
                        comparisonSetId: cs.id,
                        comparisonSetName: cs.name,
                        resultSetIds: cs.result_set_ids,
                      })
                    }
                    isSelected={
                      currentSelection?.comparisonSetId === cs.id &&
                      currentSelection?.type === 'comparison_beam_rotations'
                    }
                  />
                </TreeCategoryTypeNode>
              )}
            </TreeCategoryTypeNode>
          )}

          {/* Joints */}
          {hasJoints && (
            <TreeCategoryTypeNode
              label="Joints"
              icon={ICONS.categoryType}
              isExpanded={expandedCategoryTypes.has(`${csKey}-Joints`)}
              onToggle={() => onToggleCategoryType(`${csKey}-Joints`)}
            >
              {jointTypes.map((jt) => (
                <TreeLeafNode
                  key={jt}
                  label={COMP_JOINT_LABELS[jt] || jt}
                  icon={ICONS.resultType}
                  onClick={() => onSelect(makeSelection('comparison_joint', jt, ''))}
                  isSelected={isCompSelected('comparison_joint', jt, '')}
                />
              ))}
            </TreeCategoryTypeNode>
          )}
        </div>
      )}
    </div>
  )
}

// Element group node within a comparison set tree
interface ComparisonElementGroupNodeProps {
  groupName: string
  types: Array<{ type: string; label: string; directions: string[] }>
  csKey: string
  projectSlug: string
  resultSetIds: number[]
  csId: number
  csName: string
  currentSelection: TreeSelection | null
  expandedCategoryTypes: Set<string>
  expandedResultTypes: Set<string>
  onToggleCategoryType: (key: string) => void
  onToggleResultType: (key: string) => void
  onSelect: (selection: TreeSelection) => void
}

function ComparisonElementGroupNode({
  groupName,
  types,
  csKey,
  projectSlug,
  resultSetIds,
  csId,
  csName,
  currentSelection,
  expandedCategoryTypes,
  expandedResultTypes,
  onToggleCategoryType,
  onToggleResultType,
  onSelect,
}: ComparisonElementGroupNodeProps) {
  const groupKey = `${csKey}-Elements-${groupName}`

  // Fetch elements using first result set
  const firstRsId = resultSetIds[0]
  const firstType = types[0]?.type
  const { data: elementsData } = useElementsForType(
    projectSlug,
    firstRsId && firstType ? { result_set_id: firstRsId, result_type: firstType } : null
  )
  const elements = useMemo(
    () => [...(elementsData?.elements || [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [elementsData]
  )

  return (
    <TreeCategoryTypeNode
      label={groupName}
      icon={ICONS.resultType}
      isExpanded={expandedCategoryTypes.has(groupKey)}
      onToggle={() => onToggleCategoryType(groupKey)}
    >
      {types.map((typeInfo) => {
        const typeKey = `${groupKey}-${typeInfo.type}`

        // Types with no directions (e.g. BeamRotations) — per-element leaves directly
        if (typeInfo.directions.length === 0) {
          return (
            <TreeCategoryTypeNode
              key={typeInfo.type}
              label={typeInfo.label}
              icon={ICONS.resultType}
              isExpanded={expandedCategoryTypes.has(typeKey)}
              onToggle={() => onToggleCategoryType(typeKey)}
            >
              {elements.map((element, idx) => {
                const isLast = idx === elements.length - 1
                return (
                  <TreeLeafNode
                    key={element.id}
                    label={`${isLast ? ICONS.branchLast : ICONS.branch} ${element.name}`}
                    onClick={() =>
                      onSelect({
                        type: 'comparison_element',
                        resultSetId: -1,
                        category: 'Envelopes',
                        resultType: typeInfo.type,
                        direction: '',
                        elementId: element.id,
                        elementType: groupName.slice(0, -1),
                        comparisonSetId: csId,
                        comparisonSetName: csName,
                        resultSetIds,
                      })
                    }
                    isSelected={
                      currentSelection?.comparisonSetId === csId &&
                      currentSelection?.type === 'comparison_element' &&
                      currentSelection?.resultType === typeInfo.type &&
                      currentSelection?.elementId === element.id
                    }
                  />
                )
              })}
            </TreeCategoryTypeNode>
          )
        }

        // Types with directions - show per-element with direction leaves
        return (
          <TreeCategoryTypeNode
            key={typeInfo.type}
            label={typeInfo.label}
            icon={ICONS.resultType}
            isExpanded={expandedCategoryTypes.has(typeKey)}
            onToggle={() => onToggleCategoryType(typeKey)}
          >
            {groupName === 'Columns' && typeInfo.type === 'ColumnRotations' && (
              <TreeLeafNode
                label={`${elements.length ? ICONS.branch : ICONS.branchLast} All Rotations`}
                onClick={() =>
                  onSelect({
                    type: 'comparison_column_rotations',
                    resultSetId: -1,
                    category: 'Envelopes',
                    resultType: 'ColumnRotations',
                    direction: '',
                    comparisonSetId: csId,
                    comparisonSetName: csName,
                    resultSetIds,
                  })
                }
                isSelected={
                  currentSelection?.comparisonSetId === csId &&
                  currentSelection?.type === 'comparison_column_rotations'
                }
              />
            )}
            {elements.map((element, idx) => {
              const elKey = `${typeKey}-${element.id}`
              const isLast = idx === elements.length - 1
              return (
                <TreeCategoryTypeNode
                  key={element.id}
                  label={`${isLast ? ICONS.branchLast : ICONS.branch} ${element.name}`}
                  icon={ICONS.resultType}
                  isExpanded={expandedResultTypes.has(elKey)}
                  onToggle={() => onToggleResultType(elKey)}
                >
                  {typeInfo.directions.map((dir, dirIdx) => (
                    <TreeLeafNode
                      key={dir}
                      label={`${dirIdx < typeInfo.directions.length - 1 ? ICONS.branch : ICONS.branchLast} ${dir}`}
                      onClick={() =>
                        onSelect({
                          type: 'comparison_element',
                          resultSetId: -1,
                          category: 'Envelopes',
                          resultType: typeInfo.type,
                          direction: dir,
                          elementId: element.id,
                          elementType: groupName.slice(0, -1),
                          comparisonSetId: csId,
                          comparisonSetName: csName,
                          resultSetIds,
                        })
                      }
                      isSelected={
                        currentSelection?.comparisonSetId === csId &&
                        currentSelection?.type === 'comparison_element' &&
                        currentSelection?.resultType === typeInfo.type &&
                        currentSelection?.direction === dir &&
                        currentSelection?.elementId === element.id
                      }
                    />
                  ))}
                </TreeCategoryTypeNode>
              )
            })}
          </TreeCategoryTypeNode>
        )
      })}
    </TreeCategoryTypeNode>
  )
}

// Comparison result type node with direction leaves (no MaxMin)
interface ComparisonResultTypeNodeProps {
  label: string
  directions: string[]
  isExpanded: boolean
  onToggle: () => void
  onSelectDirection: (direction: string) => void
  isSelected: (direction: string) => boolean
}

function ComparisonResultTypeNode({
  label,
  directions,
  isExpanded,
  onToggle,
  onSelectDirection,
  isSelected,
}: ComparisonResultTypeNodeProps) {
  return (
    <div className="tree-result-type">
      <button
        onClick={onToggle}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-[13px]">{ICONS.resultType}</span>
        <span className="text-text-secondary text-[15px]">{label}</span>
      </button>
      {isExpanded && (
        <div className="tree-children ml-4">
          {directions.map((dir, idx) => (
            <button
              key={dir}
              onClick={() => onSelectDirection(dir)}
              className={clsx(
                'tree-item tree-leaf w-full text-left py-1 px-2 rounded text-[15px] transition-colors',
                isSelected(dir)
                  ? 'bg-accent-primary/15 text-accent-secondary'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
              )}
            >
              {idx < directions.length - 1 ? ICONS.branch : ICONS.branchLast} {dir} Direction
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Tree Category Node (Envelopes, Time-Series)
interface TreeCategoryNodeProps {
  label: string
  icon: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function TreeCategoryNode({ label, icon, isExpanded, onToggle, children }: TreeCategoryNodeProps) {
  return (
    <div className="tree-category">
      <button
        onClick={onToggle}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-accent-primary text-[13px]">{icon}</span>
        <span className="text-text-secondary text-[15px]">{label}</span>
      </button>
      {isExpanded && <div className="tree-children ml-3">{children}</div>}
    </div>
  )
}

// Tree Category Type Node (Global, Elements, Joints)
interface TreeCategoryTypeNodeProps {
  label: string
  icon: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function TreeCategoryTypeNode({ label, icon, isExpanded, onToggle, children }: TreeCategoryTypeNodeProps) {
  return (
    <div className="tree-category-type">
      <button
        onClick={onToggle}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-[13px]">{icon}</span>
        <span className="text-text-secondary text-[15px]">{label}</span>
      </button>
      {isExpanded && <div className="tree-children ml-3">{children}</div>}
    </div>
  )
}

// Tree Result Type Node (Drifts, Forces, etc. with directions)
interface TreeResultTypeNodeProps {
  label: string
  directions: string[]
  isExpanded: boolean
  onToggle: () => void
  onSelectDirection: (direction: string) => void
  onSelectMaxMin: () => void
  isSelected: (direction: string) => boolean
}

function TreeResultTypeNode({
  label,
  directions,
  isExpanded,
  onToggle,
  onSelectDirection,
  onSelectMaxMin,
  isSelected,
}: TreeResultTypeNodeProps) {
  return (
    <div className="tree-result-type">
      <button
        onClick={onToggle}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-[13px]">{ICONS.resultType}</span>
        <span className="text-text-secondary text-[15px]">{label}</span>
      </button>
      {isExpanded && (
        <div className="tree-children ml-4">
          {directions.map((dir, idx) => (
            <button
              key={dir}
              onClick={() => onSelectDirection(dir)}
              className={clsx(
                'tree-item tree-leaf w-full text-left py-1 px-2 rounded text-[15px] transition-colors',
                isSelected(dir)
                  ? 'bg-accent-primary/15 text-accent-secondary'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
              )}
            >
              {idx < directions.length - 1 ? ICONS.branch : ICONS.branchLast} {dir} Direction
            </button>
          ))}
          <button
            onClick={onSelectMaxMin}
            className={clsx(
              'tree-item tree-leaf w-full text-left py-1 px-2 rounded text-[15px] transition-colors',
              isSelected('MaxMin')
                ? 'bg-accent-primary/15 text-accent-secondary'
                : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
            )}
          >
            {ICONS.branchLast} Max/Min
          </button>
        </div>
      )}
    </div>
  )
}

interface TreeDirectionNodeProps {
  label: string
  directions: string[]
  isExpanded: boolean
  onToggle: () => void
  onSelectDirection: (direction: string) => void
  isSelected: (direction: string) => boolean
}

function TreeDirectionNode({
  label,
  directions,
  isExpanded,
  onToggle,
  onSelectDirection,
  isSelected,
}: TreeDirectionNodeProps) {
  return (
    <div className="tree-result-type">
      <button
        onClick={onToggle}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-[13px]">{ICONS.resultType}</span>
        <span className="text-text-secondary text-[15px]">{label}</span>
      </button>
      {isExpanded && (
        <div className="tree-children ml-4">
          {directions.map((dir, idx) => (
            <button
              key={dir}
              onClick={() => onSelectDirection(dir)}
              className={clsx(
                'tree-item tree-leaf w-full text-left py-1 px-2 rounded text-[15px] transition-colors',
                isSelected(dir)
                  ? 'bg-accent-primary/15 text-accent-secondary'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
              )}
            >
              {idx < directions.length - 1 ? ICONS.branch : ICONS.branchLast} {dir}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Tree Leaf Node (non-expandable item)
interface TreeLeafNodeProps {
  label: string
  icon?: string
  onClick: () => void
  isSelected?: boolean
}

function TreeLeafNode({ label, icon, onClick, isSelected }: TreeLeafNodeProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'tree-item tree-leaf w-full text-left flex items-center gap-1 py-1 px-2 rounded text-[15px] transition-colors',
        isSelected
          ? 'bg-accent-primary/15 text-accent-secondary'
          : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
      )}
    >
      {icon && <span className="text-text-muted text-[13px]">{icon}</span>}
      <span>{label}</span>
    </button>
  )
}
