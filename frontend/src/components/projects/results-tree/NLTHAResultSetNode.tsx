import { useMemo } from 'react'
import { useResultTreeMetadata } from '../../../hooks/useResults'
import type { ResultSet } from '../../../types'
import { ICONS, naturalCompare } from './constants'
import {
  TreeCategoryNode,
  TreeCategoryTypeNode,
  TreeDirectionNode,
  TreeLeafNode,
  TreeResultTypeNode,
} from './TreePrimitives'
import type { TreeSelection } from './types'

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

export function NLTHAResultSetNode({
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

  const { data: treeMetadata } = useResultTreeMetadata(
    projectSlug,
    isExpanded ? resultSet.id : undefined
  )
  const treeElementsByType = treeMetadata?.elements_by_type
  const timeSeriesLoadCases = useMemo(
    () => [...(treeMetadata?.time_series_load_cases ?? [])].sort(naturalCompare),
    [treeMetadata?.time_series_load_cases]
  )
  const hasTimeSeries = timeSeriesLoadCases.length > 0
  const wallShearElementsCount = treeElementsByType?.WallShears?.length ?? 0
  const quadRotationElementsCount = treeElementsByType?.QuadRotations?.length ?? 0
  const beamRotationElementsCount = treeElementsByType?.BeamRotations?.length ?? 0

  const columnShearElements = useMemo(
    () => [...(treeElementsByType?.ColumnShears ?? [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [treeElementsByType?.ColumnShears]
  )
  const columnAxialElements = useMemo(
    () => [...(treeElementsByType?.ColumnAxials ?? [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [treeElementsByType?.ColumnAxials]
  )
  const columnRotationElements = useMemo(
    () => [...(treeElementsByType?.ColumnRotations ?? [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [treeElementsByType?.ColumnRotations]
  )

  const hasWallShears =
    wallShearElementsCount > 0 ||
    elementResults.some((resultType) => resultType.type === 'WallShears')
  const hasQuadRotations =
    quadRotationElementsCount > 0 ||
    elementResults.some((resultType) => resultType.type === 'QuadRotations')
  const hasColumnShears =
    columnShearElements.length > 0 ||
    elementResults.some((resultType) => resultType.type === 'ColumnShears')
  const hasColumnAxials =
    columnAxialElements.length > 0 ||
    elementResults.some((resultType) => resultType.type === 'ColumnAxials')
  const hasColumnRotations =
    columnRotationElements.length > 0 ||
    elementResults.some((resultType) => resultType.type === 'ColumnRotations')
  const hasBeamRotations =
    beamRotationElementsCount > 0 ||
    elementResults.some((resultType) => resultType.type === 'BeamRotations')
  const hasSoilPressures = jointResults.some((resultType) => resultType.type === 'SoilPressures')
  const hasVerticalDisplacements = jointResults.some(
    (resultType) => resultType.type === 'VerticalDisplacements'
  )

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
