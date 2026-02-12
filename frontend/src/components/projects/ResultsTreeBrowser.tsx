/**
 * Results Tree Browser - Hierarchical navigation for project results
 * Replicates the desktop RPS tree browser structure exactly
 */

import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import {
  useResultSets,
  useAvailableResultTypes,
  useElementsForType,
  useTimeSeriesLoadCases,
} from '../../hooks/useResults'
import type { ResultSet } from '../../types'

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
    | 'pushover_global'
  resultSetId: number
  category: 'Envelopes' | 'Time-Series'
  categoryType?: 'Global' | 'Elements' | 'Joints'
  resultType: string
  direction: string
  elementType?: string
  elementId?: number
  loadCaseName?: string
}

interface ResultsTreeBrowserProps {
  projectSlug: string
  onSelect: (selection: TreeSelection) => void
  currentSelection: TreeSelection | null
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

export function ResultsTreeBrowser({
  projectSlug,
  onSelect,
  currentSelection,
}: ResultsTreeBrowserProps) {
  const { data: resultSets, isLoading } = useResultSets(projectSlug)
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)

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
      nlthaResultSets: resultSets.filter((rs) => rs.analysis_type !== 'Pushover'),
      pushoverResultSets: resultSets.filter((rs) => rs.analysis_type === 'Pushover'),
    }
  }, [resultSets])

  // Auto-expand first result set
  useEffect(() => {
    if (nlthaResultSets.length && expandedResultSets.size === 0) {
      const firstId = nlthaResultSets[0].id
      setExpandedResultSets(new Set([firstId]))
      setExpandedCategories(new Set([`${firstId}-Envelopes`]))
      setExpandedCategoryTypes(new Set([`${firstId}-Envelopes-Global`]))
      setExpandedResultTypes(new Set([`${firstId}-Drifts`]))

      // Auto-select first result
      onSelect({
        type: 'global_result',
        resultSetId: firstId,
        category: 'Envelopes',
        categoryType: 'Global',
        resultType: 'Drifts',
        direction: 'X',
      })
    }
  }, [expandedResultSets.size, nlthaResultSets, onSelect])

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const toggleResultSet = (id: number) => {
    setExpandedResultSets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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

  const isSelected = (rsId: number, rt: string, dir: string) => {
    return (
      currentSelection?.resultSetId === rsId &&
      currentSelection?.resultType === rt &&
      currentSelection?.direction === dir
    )
  }

  const globalResults = availableTypes?.global_results || [
    { type: 'Drifts', directions: ['X', 'Y'] },
    { type: 'Accelerations', directions: ['X', 'Y'] },
    { type: 'Forces', directions: ['X', 'Y'] },
    { type: 'Displacements', directions: ['X', 'Y'] },
  ]

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
                onToggleResultSet={() => toggleResultSet(rs.id)}
                onToggleCategory={toggleCategory}
                onToggleCategoryType={toggleCategoryType}
                onToggleResultType={toggleResultType}
                onSelect={onSelect}
                isSelected={isSelected}
              />
            ))}
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
                resultSet={rs}
                isExpanded={expandedResultSets.has(rs.id)}
                onToggle={() => toggleResultSet(rs.id)}
                onSelect={onSelect}
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
  const hasTimeSeries = (timeSeriesData?.load_cases?.length || 0) > 0
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
              <TreeCategoryTypeNode
                label="Global"
                icon={ICONS.categoryType}
                isExpanded={true}
                onToggle={() => {}}
              >
                <TreeLeafNode
                  label={`${ICONS.branch} X Direction`}
                  onClick={() =>
                    onSelect({
                      type: 'time_series',
                      resultSetId: resultSet.id,
                      category: 'Time-Series',
                      categoryType: 'Global',
                      resultType: 'Drifts',
                      direction: 'X',
                    })
                  }
                />
                <TreeLeafNode
                  label={`${ICONS.branchLast} Y Direction`}
                  onClick={() =>
                    onSelect({
                      type: 'time_series',
                      resultSetId: resultSet.id,
                      category: 'Time-Series',
                      categoryType: 'Global',
                      resultType: 'Drifts',
                      direction: 'Y',
                    })
                  }
                />
              </TreeCategoryTypeNode>
            </TreeCategoryNode>
          )}
        </div>
      )}
    </div>
  )
}

// Pushover Result Set Node (simplified)
interface PushoverResultSetNodeProps {
  resultSet: ResultSet
  isExpanded: boolean
  onToggle: () => void
  onSelect: (selection: TreeSelection) => void
}

function PushoverResultSetNode({
  resultSet,
  isExpanded,
  onToggle,
  onSelect,
}: PushoverResultSetNodeProps) {
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
          <TreeLeafNode
            label="Curves"
            icon={ICONS.resultType}
            onClick={() =>
              onSelect({
                type: 'pushover_curve',
                resultSetId: resultSet.id,
                category: 'Envelopes',
                resultType: 'PushoverCurve',
                direction: 'X',
              })
            }
          />
          <TreeLeafNode
            label="Global Results"
            icon={ICONS.resultType}
            onClick={() =>
              onSelect({
                type: 'pushover_global',
                resultSetId: resultSet.id,
                category: 'Envelopes',
                resultType: 'Drifts',
                direction: 'X',
              })
            }
          />
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
