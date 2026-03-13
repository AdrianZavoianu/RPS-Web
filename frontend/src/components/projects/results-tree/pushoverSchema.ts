import type { ResultSet, ResultTreeMetadata } from '../../../types'
import { ICONS, naturalCompare } from './constants'
import type { TreeSelection } from './types'
import { branchNode, leafNode, textNode, type TreeSchemaNode } from './treeSchema'

interface BuildPushoverResultSetSchemaParams {
  currentSelection: TreeSelection | null
  onSelect: (selection: TreeSelection) => void
  resultSet: ResultSet
  treeMetadata?: ResultTreeMetadata
}

const PUSHOVER_GLOBAL_TYPES = ['Drifts', 'Forces', 'Displacements']

function branchPrefix(index: number, totalCount: number): string {
  return index === totalCount - 1 ? ICONS.branchLast : ICONS.branch
}

export function buildPushoverResultSetSchema({
  currentSelection,
  onSelect,
  resultSet,
  treeMetadata,
}: BuildPushoverResultSetSchemaParams): TreeSchemaNode[] {
  const treeElementsByType = treeMetadata?.elements_by_type
  const pushoverCases = treeMetadata?.pushover_cases ?? []

  const directionGroups = new Map<string, typeof pushoverCases>()
  for (const pushoverCase of pushoverCases) {
    const direction = pushoverCase.direction || 'Unknown'
    if (!directionGroups.has(direction)) {
      directionGroups.set(direction, [])
    }
    directionGroups.get(direction)?.push(pushoverCase)
  }

  const curvesKey = `push-${resultSet.id}-curves`
  const globalKey = `push-${resultSet.id}-global`
  const elementsKey = `push-${resultSet.id}-elements`
  const wallsKey = `push-${resultSet.id}-elements-walls`
  const wallShearsKey = `push-${resultSet.id}-elements-walls-shears`
  const wallRotationsKey = `push-${resultSet.id}-elements-walls-rotations`
  const columnsKey = `push-${resultSet.id}-elements-columns`
  const columnShearsKey = `push-${resultSet.id}-elements-columns-shears`
  const columnAxialsKey = `push-${resultSet.id}-elements-columns-axials`
  const columnRotationsKey = `push-${resultSet.id}-elements-columns-rotations`
  const beamsKey = `push-${resultSet.id}-elements-beams`
  const beamRotationsKey = `push-${resultSet.id}-elements-beams-r3`
  const jointsKey = `push-${resultSet.id}-joints`
  const soilPressuresKey = `push-${resultSet.id}-joints-soil`
  const verticalDisplacementsKey = `push-${resultSet.id}-joints-vertical`

  const wallShearElements = [...(treeElementsByType?.WallShears ?? [])].sort((a, b) =>
    naturalCompare(a.name, b.name)
  )

  const quadRotationElements = [...(treeElementsByType?.QuadRotations ?? [])].sort((a, b) =>
    naturalCompare(a.name, b.name)
  )

  const columnShearElements = [...(treeElementsByType?.ColumnShears ?? [])].sort((a, b) =>
    naturalCompare(a.name, b.name)
  )

  const columnAxialElements = [...(treeElementsByType?.ColumnAxials ?? [])].sort((a, b) =>
    naturalCompare(a.name, b.name)
  )

  const columnRotationElements = [...(treeElementsByType?.ColumnRotations ?? [])].sort((a, b) =>
    naturalCompare(a.name, b.name)
  )

  const hasWallShears = wallShearElements.length > 0
  const hasQuadRotations = quadRotationElements.length > 0
  const hasColumnShears = columnShearElements.length > 0
  const hasColumnAxials = columnAxialElements.length > 0
  const hasColumnRotations = columnRotationElements.length > 0
  const hasBeamRotations = (treeElementsByType?.BeamRotations?.length ?? 0) > 0
  const hasSoilPressures = Boolean(treeMetadata?.joint_availability?.SoilPressures)
  const hasVerticalDisplacements = Boolean(treeMetadata?.joint_availability?.VerticalDisplacements)

  const hasElements =
    hasWallShears ||
    hasQuadRotations ||
    hasColumnShears ||
    hasColumnAxials ||
    hasColumnRotations ||
    hasBeamRotations
  const hasJoints = hasSoilPressures || hasVerticalDisplacements

  const nodes: TreeSchemaNode[] = [
    branchNode({
      key: curvesKey,
      label: 'Curves',
      icon: ICONS.category,
      expansionGroup: 'categories',
      variant: 'category',
      children:
        pushoverCases.length === 0
          ? [textNode({ key: `${curvesKey}-empty`, label: 'No curves imported' })]
          : Array.from(directionGroups.entries()).map(([direction, cases]) => {
              const directionKey = `push-${resultSet.id}-curves-${direction}`

              return branchNode({
                key: directionKey,
                label: `${direction} Direction`,
                icon: ICONS.categoryType,
                expansionGroup: 'categoryTypes',
                variant: 'categoryType',
                children: [
                  ...cases.map((pushoverCase) =>
                    leafNode({
                      key: `${directionKey}-${pushoverCase.id}`,
                      label: pushoverCase.name,
                      icon: ICONS.resultType,
                      onSelect: () =>
                        onSelect({
                          type: 'pushover_curve',
                          resultSetId: resultSet.id,
                          category: 'Envelopes',
                          resultType: 'PushoverCurve',
                          direction: String(pushoverCase.id),
                        }),
                      selected:
                        currentSelection?.type === 'pushover_curve' &&
                        currentSelection.resultSetId === resultSet.id &&
                        currentSelection.direction === String(pushoverCase.id),
                    })
                  ),
                  leafNode({
                    key: `${directionKey}-all-curves`,
                    label: `All ${direction} Curves`,
                    icon: ICONS.resultType,
                    onSelect: () =>
                      onSelect({
                        type: 'pushover_all_curves',
                        resultSetId: resultSet.id,
                        category: 'Envelopes',
                        resultType: 'PushoverCurve',
                        direction,
                      }),
                    selected:
                      currentSelection?.type === 'pushover_all_curves' &&
                      currentSelection.resultSetId === resultSet.id &&
                      currentSelection.direction === direction,
                  }),
                ],
              })
            }),
    }),
    branchNode({
      key: globalKey,
      label: 'Global Results',
      icon: ICONS.category,
      expansionGroup: 'categories',
      variant: 'category',
      children: PUSHOVER_GLOBAL_TYPES.map((resultType) => {
        const resultTypeKey = `push-${resultSet.id}-${resultType}`

        return branchNode({
          key: resultTypeKey,
          label: resultType,
          icon: ICONS.resultType,
          expansionGroup: 'resultTypes',
          variant: 'categoryType',
          children: ['X', 'Y'].map((direction, index) =>
            leafNode({
              key: `${resultTypeKey}-${direction}`,
              label: `${index < 1 ? ICONS.branch : ICONS.branchLast} ${direction}`,
              icon: ICONS.resultType,
              onSelect: () =>
                onSelect({
                  type: 'pushover_global',
                  resultSetId: resultSet.id,
                  category: 'Envelopes',
                  resultType,
                  direction,
                }),
              selected:
                currentSelection?.type === 'pushover_global' &&
                currentSelection.resultSetId === resultSet.id &&
                currentSelection.resultType === resultType &&
                currentSelection.direction === direction,
            })
          ),
        })
      }),
    }),
  ]

  if (hasElements) {
    const elementChildren: TreeSchemaNode[] = []

    if (hasWallShears || hasQuadRotations) {
      const wallChildren: TreeSchemaNode[] = []

      if (hasWallShears) {
        wallChildren.push(
          branchNode({
            key: wallShearsKey,
            label: 'Shears',
            icon: ICONS.resultType,
            expansionGroup: 'categoryTypes',
            variant: 'categoryType',
            children: wallShearElements.map((element, elementIndex) => {
              const wallElementKey = `${wallShearsKey}-${element.id}`
              return branchNode({
                key: wallElementKey,
                label: `${branchPrefix(elementIndex, wallShearElements.length)} ${element.name}`,
                icon: ICONS.resultType,
                expansionGroup: 'categoryTypes',
                variant: 'categoryType',
                children: [
                  leafNode({
                    key: `${wallElementKey}-V2`,
                    label: `${ICONS.branch} V2`,
                    onSelect: () =>
                      onSelect({
                        type: 'element',
                        resultSetId: resultSet.id,
                        category: 'Envelopes',
                        categoryType: 'Elements',
                        resultType: 'WallShears',
                        direction: 'V2',
                        elementType: 'Wall',
                        elementId: element.id,
                      }),
                    selected:
                      currentSelection?.type === 'element' &&
                      currentSelection.resultSetId === resultSet.id &&
                      currentSelection.resultType === 'WallShears' &&
                      currentSelection.direction === 'V2' &&
                      currentSelection.elementId === element.id,
                  }),
                  leafNode({
                    key: `${wallElementKey}-V3`,
                    label: `${ICONS.branchLast} V3`,
                    onSelect: () =>
                      onSelect({
                        type: 'element',
                        resultSetId: resultSet.id,
                        category: 'Envelopes',
                        categoryType: 'Elements',
                        resultType: 'WallShears',
                        direction: 'V3',
                        elementType: 'Wall',
                        elementId: element.id,
                      }),
                    selected:
                      currentSelection?.type === 'element' &&
                      currentSelection.resultSetId === resultSet.id &&
                      currentSelection.resultType === 'WallShears' &&
                      currentSelection.direction === 'V3' &&
                      currentSelection.elementId === element.id,
                  }),
                ],
              })
            }),
          })
        )
      }

      if (hasQuadRotations) {
        wallChildren.push(
          branchNode({
            key: wallRotationsKey,
            label: 'Quad Rotations',
            icon: ICONS.resultType,
            expansionGroup: 'categoryTypes',
            variant: 'categoryType',
            children: quadRotationElements.map((element, elementIndex) =>
              leafNode({
                key: `${wallRotationsKey}-${element.id}`,
                label: `${branchPrefix(elementIndex, quadRotationElements.length)} ${element.name}`,
                onSelect: () =>
                  onSelect({
                    type: 'element',
                    resultSetId: resultSet.id,
                    category: 'Envelopes',
                    categoryType: 'Elements',
                    resultType: 'QuadRotations',
                    direction: '',
                    elementType: 'Quad',
                    elementId: element.id,
                  }),
                selected:
                  currentSelection?.type === 'element' &&
                  currentSelection.resultSetId === resultSet.id &&
                  currentSelection.resultType === 'QuadRotations' &&
                  currentSelection.elementId === element.id,
              })
            ),
          })
        )
      }

      elementChildren.push(
        branchNode({
          key: wallsKey,
          label: 'Walls',
          icon: ICONS.categoryType,
          expansionGroup: 'categoryTypes',
          variant: 'categoryType',
          children: wallChildren,
        })
      )
    }

    if (hasColumnShears || hasColumnAxials || hasColumnRotations) {
      const columnChildren: TreeSchemaNode[] = []

      if (hasColumnShears) {
        columnChildren.push(
          branchNode({
            key: columnShearsKey,
            label: 'Shears',
            icon: ICONS.resultType,
            expansionGroup: 'categoryTypes',
            variant: 'categoryType',
            children: columnShearElements.map((element, elementIndex) => {
              const columnElementKey = `${columnShearsKey}-${element.id}`

              return branchNode({
                key: columnElementKey,
                label: `${branchPrefix(elementIndex, columnShearElements.length)} ${element.name}`,
                icon: ICONS.resultType,
                expansionGroup: 'categoryTypes',
                variant: 'categoryType',
                children: [
                  leafNode({
                    key: `${columnElementKey}-V2`,
                    label: `${ICONS.branch} V2`,
                    onSelect: () =>
                      onSelect({
                        type: 'element',
                        resultSetId: resultSet.id,
                        category: 'Envelopes',
                        categoryType: 'Elements',
                        resultType: 'ColumnShears',
                        direction: 'V2',
                        elementType: 'Column',
                        elementId: element.id,
                      }),
                    selected:
                      currentSelection?.type === 'element' &&
                      currentSelection.resultSetId === resultSet.id &&
                      currentSelection.resultType === 'ColumnShears' &&
                      currentSelection.direction === 'V2' &&
                      currentSelection.elementId === element.id,
                  }),
                  leafNode({
                    key: `${columnElementKey}-V3`,
                    label: `${ICONS.branchLast} V3`,
                    onSelect: () =>
                      onSelect({
                        type: 'element',
                        resultSetId: resultSet.id,
                        category: 'Envelopes',
                        categoryType: 'Elements',
                        resultType: 'ColumnShears',
                        direction: 'V3',
                        elementType: 'Column',
                        elementId: element.id,
                      }),
                    selected:
                      currentSelection?.type === 'element' &&
                      currentSelection.resultSetId === resultSet.id &&
                      currentSelection.resultType === 'ColumnShears' &&
                      currentSelection.direction === 'V3' &&
                      currentSelection.elementId === element.id,
                  }),
                ],
              })
            }),
          })
        )
      }

      if (hasColumnAxials) {
        columnChildren.push(
          branchNode({
            key: columnAxialsKey,
            label: 'Axials',
            icon: ICONS.resultType,
            expansionGroup: 'categoryTypes',
            variant: 'categoryType',
            children: columnAxialElements.map((element, elementIndex) => {
              const columnAxialElementKey = `${columnAxialsKey}-${element.id}`

              return branchNode({
                key: columnAxialElementKey,
                label: `${branchPrefix(elementIndex, columnAxialElements.length)} ${element.name}`,
                icon: ICONS.resultType,
                expansionGroup: 'categoryTypes',
                variant: 'categoryType',
                children: [
                  leafNode({
                    key: `${columnAxialElementKey}-Min`,
                    label: `${ICONS.branch} Min`,
                    onSelect: () =>
                      onSelect({
                        type: 'element',
                        resultSetId: resultSet.id,
                        category: 'Envelopes',
                        categoryType: 'Elements',
                        resultType: 'ColumnAxials',
                        direction: 'Min',
                        elementType: 'Column',
                        elementId: element.id,
                      }),
                    selected:
                      currentSelection?.type === 'element' &&
                      currentSelection.resultSetId === resultSet.id &&
                      currentSelection.resultType === 'ColumnAxials' &&
                      currentSelection.direction === 'Min' &&
                      currentSelection.elementId === element.id,
                  }),
                  leafNode({
                    key: `${columnAxialElementKey}-Max`,
                    label: `${ICONS.branchLast} Max`,
                    onSelect: () =>
                      onSelect({
                        type: 'element',
                        resultSetId: resultSet.id,
                        category: 'Envelopes',
                        categoryType: 'Elements',
                        resultType: 'ColumnAxials',
                        direction: 'Max',
                        elementType: 'Column',
                        elementId: element.id,
                      }),
                    selected:
                      currentSelection?.type === 'element' &&
                      currentSelection.resultSetId === resultSet.id &&
                      currentSelection.resultType === 'ColumnAxials' &&
                      currentSelection.direction === 'Max' &&
                      currentSelection.elementId === element.id,
                  }),
                ],
              })
            }),
          })
        )
      }

      if (hasColumnRotations) {
        const columnRotationChildren: TreeSchemaNode[] = [
          leafNode({
            key: `${columnRotationsKey}-all`,
            label: `${columnRotationElements.length ? ICONS.branch : ICONS.branchLast} All Rotations`,
            onSelect: () =>
              onSelect({
                type: 'column_rotations_plot',
                resultSetId: resultSet.id,
                category: 'Envelopes',
                categoryType: 'Elements',
                resultType: 'AllColumnRotations',
                direction: '',
                elementType: 'Column',
              }),
            selected:
              currentSelection?.type === 'column_rotations_plot' &&
              currentSelection.resultSetId === resultSet.id,
          }),
        ]

        columnRotationChildren.push(
          ...columnRotationElements.map((element, elementIndex) => {
            const columnRotationElementKey = `${columnRotationsKey}-${element.id}`

            return branchNode({
              key: columnRotationElementKey,
              label: `${branchPrefix(elementIndex, columnRotationElements.length)} ${element.name}`,
              icon: ICONS.resultType,
              expansionGroup: 'categoryTypes',
              variant: 'categoryType',
              children: [
                leafNode({
                  key: `${columnRotationElementKey}-R2`,
                  label: `${ICONS.branch} R2`,
                  onSelect: () =>
                    onSelect({
                      type: 'element',
                      resultSetId: resultSet.id,
                      category: 'Envelopes',
                      categoryType: 'Elements',
                      resultType: 'ColumnRotations',
                      direction: 'R2',
                      elementType: 'Column',
                      elementId: element.id,
                    }),
                  selected:
                    currentSelection?.type === 'element' &&
                    currentSelection.resultSetId === resultSet.id &&
                    currentSelection.resultType === 'ColumnRotations' &&
                    currentSelection.direction === 'R2' &&
                    currentSelection.elementId === element.id,
                }),
                leafNode({
                  key: `${columnRotationElementKey}-R3`,
                  label: `${ICONS.branchLast} R3`,
                  onSelect: () =>
                    onSelect({
                      type: 'element',
                      resultSetId: resultSet.id,
                      category: 'Envelopes',
                      categoryType: 'Elements',
                      resultType: 'ColumnRotations',
                      direction: 'R3',
                      elementType: 'Column',
                      elementId: element.id,
                    }),
                  selected:
                    currentSelection?.type === 'element' &&
                    currentSelection.resultSetId === resultSet.id &&
                    currentSelection.resultType === 'ColumnRotations' &&
                    currentSelection.direction === 'R3' &&
                    currentSelection.elementId === element.id,
                }),
              ],
            })
          })
        )

        columnChildren.push(
          branchNode({
            key: columnRotationsKey,
            label: 'Rotations',
            icon: ICONS.resultType,
            expansionGroup: 'categoryTypes',
            variant: 'categoryType',
            children: columnRotationChildren,
          })
        )
      }

      elementChildren.push(
        branchNode({
          key: columnsKey,
          label: 'Columns',
          icon: ICONS.categoryType,
          expansionGroup: 'categoryTypes',
          variant: 'categoryType',
          children: columnChildren,
        })
      )
    }

    if (hasBeamRotations) {
      elementChildren.push(
        branchNode({
          key: beamsKey,
          label: 'Beams',
          icon: ICONS.categoryType,
          expansionGroup: 'categoryTypes',
          variant: 'categoryType',
          children: [
            branchNode({
              key: beamRotationsKey,
              label: 'R3 Plastic Rotations',
              icon: ICONS.resultType,
              expansionGroup: 'categoryTypes',
              variant: 'categoryType',
              children: [
                leafNode({
                  key: `${beamRotationsKey}-plot`,
                  label: `${ICONS.branch} Plot`,
                  onSelect: () =>
                    onSelect({
                      type: 'beam_rotations_plot',
                      resultSetId: resultSet.id,
                      category: 'Envelopes',
                      categoryType: 'Elements',
                      resultType: 'AllBeamRotations',
                      direction: '',
                      elementType: 'Beam',
                    }),
                  selected:
                    currentSelection?.type === 'beam_rotations_plot' &&
                    currentSelection.resultSetId === resultSet.id,
                }),
                leafNode({
                  key: `${beamRotationsKey}-table`,
                  label: `${ICONS.branchLast} Table`,
                  onSelect: () =>
                    onSelect({
                      type: 'beam_rotations_table',
                      resultSetId: resultSet.id,
                      category: 'Envelopes',
                      categoryType: 'Elements',
                      resultType: 'BeamRotationsTable',
                      direction: '',
                      elementType: 'Beam',
                    }),
                  selected:
                    currentSelection?.type === 'beam_rotations_table' &&
                    currentSelection.resultSetId === resultSet.id,
                }),
              ],
            }),
          ],
        })
      )
    }

    nodes.push(
      branchNode({
        key: elementsKey,
        label: 'Elements',
        icon: ICONS.category,
        expansionGroup: 'categories',
        variant: 'category',
        children: elementChildren,
      })
    )
  }

  if (hasJoints) {
    const jointChildren: TreeSchemaNode[] = []

    if (hasSoilPressures) {
      jointChildren.push(
        branchNode({
          key: soilPressuresKey,
          label: 'Soil Pressures (Min)',
          icon: ICONS.resultType,
          expansionGroup: 'categoryTypes',
          variant: 'categoryType',
          children: [
            leafNode({
              key: `${soilPressuresKey}-plot`,
              label: `${ICONS.branch} Plot`,
              onSelect: () =>
                onSelect({
                  type: 'joint_plot',
                  resultSetId: resultSet.id,
                  category: 'Envelopes',
                  categoryType: 'Joints',
                  resultType: 'SoilPressures',
                  direction: 'Min',
                }),
              selected:
                currentSelection?.type === 'joint_plot' &&
                currentSelection.resultSetId === resultSet.id &&
                currentSelection.resultType === 'SoilPressures',
            }),
            leafNode({
              key: `${soilPressuresKey}-table`,
              label: `${ICONS.branchLast} Table`,
              onSelect: () =>
                onSelect({
                  type: 'joint_table',
                  resultSetId: resultSet.id,
                  category: 'Envelopes',
                  categoryType: 'Joints',
                  resultType: 'SoilPressures',
                  direction: 'Min',
                }),
              selected:
                currentSelection?.type === 'joint_table' &&
                currentSelection.resultSetId === resultSet.id &&
                currentSelection.resultType === 'SoilPressures',
            }),
          ],
        })
      )
    }

    if (hasVerticalDisplacements) {
      jointChildren.push(
        branchNode({
          key: verticalDisplacementsKey,
          label: 'Vertical Displacements (Min)',
          icon: ICONS.resultType,
          expansionGroup: 'categoryTypes',
          variant: 'categoryType',
          children: [
            leafNode({
              key: `${verticalDisplacementsKey}-plot`,
              label: `${ICONS.branch} Plot`,
              onSelect: () =>
                onSelect({
                  type: 'joint_plot',
                  resultSetId: resultSet.id,
                  category: 'Envelopes',
                  categoryType: 'Joints',
                  resultType: 'VerticalDisplacements',
                  direction: 'Min',
                }),
              selected:
                currentSelection?.type === 'joint_plot' &&
                currentSelection.resultSetId === resultSet.id &&
                currentSelection.resultType === 'VerticalDisplacements',
            }),
            leafNode({
              key: `${verticalDisplacementsKey}-table`,
              label: `${ICONS.branchLast} Table`,
              onSelect: () =>
                onSelect({
                  type: 'joint_table',
                  resultSetId: resultSet.id,
                  category: 'Envelopes',
                  categoryType: 'Joints',
                  resultType: 'VerticalDisplacements',
                  direction: 'Min',
                }),
              selected:
                currentSelection?.type === 'joint_table' &&
                currentSelection.resultSetId === resultSet.id &&
                currentSelection.resultType === 'VerticalDisplacements',
            }),
          ],
        })
      )
    }

    nodes.push(
      branchNode({
        key: jointsKey,
        label: 'Joints',
        icon: ICONS.category,
        expansionGroup: 'categories',
        variant: 'category',
        children: jointChildren,
      })
    )
  }

  return nodes
}
