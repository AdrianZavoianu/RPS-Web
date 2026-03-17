import type { ResultSet, ResultTreeMetadata } from '../../../types'
import { ICONS } from './constants'
import {
  buildBeamRotationsSubtree,
  buildColumnRotationsChildren,
  buildJointResultBranch,
  buildPerElementBranches,
  sortedElements,
  type TreeBuilderContext,
} from './treeBuilders'
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

  const ctx: TreeBuilderContext = { resultSetId: resultSet.id, currentSelection, onSelect }

  const wallShearElements = sortedElements(treeElementsByType, 'WallShears')
  const quadRotationElements = sortedElements(treeElementsByType, 'QuadRotations')
  const columnShearElements = sortedElements(treeElementsByType, 'ColumnShears')
  const columnAxialElements = sortedElements(treeElementsByType, 'ColumnAxials')
  const columnRotationElements = sortedElements(treeElementsByType, 'ColumnRotations')

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
            children: buildPerElementBranches(
              ctx,
              wallShearsKey,
              wallShearElements,
              'WallShears',
              'Wall',
              ['V2', 'V3'],
              false,
            ),
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
            children: buildPerElementBranches(
              ctx,
              columnShearsKey,
              columnShearElements,
              'ColumnShears',
              'Column',
              ['V2', 'V3'],
              false,
            ),
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
            children: buildPerElementBranches(
              ctx,
              columnAxialsKey,
              columnAxialElements,
              'ColumnAxials',
              'Column',
              ['Min', 'Max'],
              false,
            ),
          })
        )
      }

      if (hasColumnRotations) {
        columnChildren.push(
          branchNode({
            key: columnRotationsKey,
            label: 'Rotations',
            icon: ICONS.resultType,
            expansionGroup: 'categoryTypes',
            variant: 'categoryType',
            children: buildColumnRotationsChildren(ctx, columnRotationsKey, columnRotationElements, false),
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
      elementChildren.push(buildBeamRotationsSubtree(ctx, beamsKey, beamRotationsKey))
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
      jointChildren.push(buildJointResultBranch(ctx, soilPressuresKey, 'Soil Pressures (Min)', 'SoilPressures'))
    }

    if (hasVerticalDisplacements) {
      jointChildren.push(
        buildJointResultBranch(ctx, verticalDisplacementsKey, 'Vertical Displacements (Min)', 'VerticalDisplacements')
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
