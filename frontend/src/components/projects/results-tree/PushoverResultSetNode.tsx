import { useMemo } from 'react'
import { useResultTreeMetadata } from '../../../hooks/useResults'
import type { PushoverCase, ResultSet } from '../../../types'
import { ICONS, naturalCompare } from './constants'
import { TreeCategoryTypeNode, TreeLeafNode } from './TreePrimitives'
import type { TreeSelection } from './types'

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

export function PushoverResultSetNode({
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
  const { data: treeMetadata } = useResultTreeMetadata(
    projectSlug,
    isExpanded ? resultSet.id : undefined
  )
  const treeElementsByType = treeMetadata?.elements_by_type
  const pushoverCases = useMemo(
    () => treeMetadata?.pushover_cases ?? [],
    [treeMetadata?.pushover_cases]
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

  const wallShearElements = useMemo(
    () => [...(treeElementsByType?.WallShears ?? [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [treeElementsByType?.WallShears]
  )

  const quadRotationElements = useMemo(
    () => [...(treeElementsByType?.QuadRotations ?? [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [treeElementsByType?.QuadRotations]
  )

  const columnShearElements = useMemo(
    () => [...(treeElementsByType?.ColumnShears ?? [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [treeElementsByType?.ColumnShears]
  )

  const columnRotationElements = useMemo(
    () => [...(treeElementsByType?.ColumnRotations ?? [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [treeElementsByType?.ColumnRotations]
  )

  const hasWallShears = wallShearElements.length > 0
  const hasQuadRotations = quadRotationElements.length > 0
  const hasColumnShears = columnShearElements.length > 0
  const hasColumnRotations = columnRotationElements.length > 0
  const hasBeamRotations = (treeElementsByType?.BeamRotations?.length ?? 0) > 0
  const hasSoilPressures = Boolean(treeMetadata?.joint_availability?.SoilPressures)
  const hasVerticalDisplacements = Boolean(treeMetadata?.joint_availability?.VerticalDisplacements)
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
