import type { ResultSet, ResultTreeMetadata } from '../../../types'
import { ICONS, naturalCompare } from './constants'
import type { TreeSelection } from './types'
import { branchNode, leafNode, type TreeSchemaNode } from './treeSchema'

interface BuildNlthaResultSetSchemaParams {
  currentSelection: TreeSelection | null
  elementResults: Array<{ type: string; directions: string[] | null }>
  globalResults: Array<{ type: string; directions: string[] | null }>
  isSelected: (resultSetId: number, resultType: string, direction: string) => boolean
  jointResults: Array<{ type: string; directions?: string[] | null }>
  onSelect: (selection: TreeSelection) => void
  resultSet: ResultSet
  treeMetadata?: ResultTreeMetadata
}

function branchPrefix(index: number, totalCount: number): string {
  return index === totalCount - 1 ? ICONS.branchLast : ICONS.branch
}

export function buildNlthaResultSetSchema({
  currentSelection,
  elementResults,
  globalResults,
  isSelected,
  jointResults,
  onSelect,
  resultSet,
  treeMetadata,
}: BuildNlthaResultSetSchemaParams): TreeSchemaNode[] {
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

  const treeElementsByType = treeMetadata?.elements_by_type
  const timeSeriesLoadCases = [...(treeMetadata?.time_series_load_cases ?? [])].sort(naturalCompare)
  const hasTimeSeries = timeSeriesLoadCases.length > 0
  const wallShearElementsCount = treeElementsByType?.WallShears?.length ?? 0
  const quadRotationElementsCount = treeElementsByType?.QuadRotations?.length ?? 0
  const beamRotationElementsCount = treeElementsByType?.BeamRotations?.length ?? 0

  const columnShearElements = [...(treeElementsByType?.ColumnShears ?? [])].sort((a, b) =>
    naturalCompare(a.name, b.name)
  )
  const columnAxialElements = [...(treeElementsByType?.ColumnAxials ?? [])].sort((a, b) =>
    naturalCompare(a.name, b.name)
  )
  const columnRotationElements = [...(treeElementsByType?.ColumnRotations ?? [])].sort((a, b) =>
    naturalCompare(a.name, b.name)
  )

  const hasWallShears =
    wallShearElementsCount > 0 || elementResults.some((resultType) => resultType.type === 'WallShears')
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

  const globalNodes = globalResults
    .filter((resultType) => resultType.directions && resultType.directions.length > 0)
    .map((resultType) => {
      const directions = resultType.directions ?? []
      const directionLeaves = directions.map((direction, index) =>
        leafNode({
          key: `${resultSet.id}-${resultType.type}-${direction}`,
          label: `${index < directions.length - 1 ? ICONS.branch : ICONS.branchLast} ${direction} Direction`,
          onSelect: () =>
            onSelect({
              type: 'global_result',
              resultSetId: resultSet.id,
              category: 'Envelopes',
              categoryType: 'Global',
              resultType: resultType.type,
              direction,
            }),
          selected: isSelected(resultSet.id, resultType.type, direction),
        })
      )

      directionLeaves.push(
        leafNode({
          key: `${resultSet.id}-${resultType.type}-MaxMin`,
          label: `${ICONS.branchLast} Max/Min`,
          onSelect: () =>
            onSelect({
              type: 'maxmin',
              resultSetId: resultSet.id,
              category: 'Envelopes',
              categoryType: 'Global',
              resultType: resultType.type,
              direction: 'MaxMin',
            }),
          selected: isSelected(resultSet.id, resultType.type, 'MaxMin'),
        })
      )

      return branchNode({
        key: `${resultSet.id}-${resultType.type}`,
        label: resultType.type,
        icon: ICONS.resultType,
        expansionGroup: 'resultTypes',
        variant: 'categoryType',
        children: directionLeaves,
      })
    })

  const envelopeChildren: TreeSchemaNode[] = [
    branchNode({
      key: globalKey,
      label: 'Global',
      icon: ICONS.categoryType,
      expansionGroup: 'categoryTypes',
      variant: 'categoryType',
      children: globalNodes,
    }),
  ]

  const elementsChildren: TreeSchemaNode[] = []

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
          children: ['V2', 'V3'].map((direction, index) =>
            leafNode({
              key: `${wallShearsKey}-${direction}`,
              label: `${index < 1 ? ICONS.branch : ICONS.branchLast} ${direction}`,
              onSelect: () =>
                onSelect({
                  type: 'element',
                  resultSetId: resultSet.id,
                  category: 'Envelopes',
                  categoryType: 'Elements',
                  resultType: 'WallShears',
                  direction,
                  elementType: 'Wall',
                }),
              selected:
                currentSelection?.type === 'element' &&
                currentSelection.resultSetId === resultSet.id &&
                currentSelection.resultType === 'WallShears' &&
                currentSelection.direction === direction,
            })
          ),
        })
      )
    }

    if (hasQuadRotations) {
      const quadRotationsKey = `${wallsKey}-QuadRotations`

      const quadChildren: TreeSchemaNode[] = [
        leafNode({
          key: `${quadRotationsKey}-all`,
          label: `${ICONS.branch} All Rotations`,
          onSelect: () =>
            onSelect({
              type: 'quad_rotations_plot',
              resultSetId: resultSet.id,
              category: 'Envelopes',
              categoryType: 'Elements',
              resultType: 'AllQuadRotations',
              direction: '',
              elementType: 'Quad',
            }),
          selected:
            currentSelection?.type === 'quad_rotations_plot' &&
            currentSelection.resultSetId === resultSet.id,
        }),
        leafNode({
          key: `${quadRotationsKey}-individual`,
          label: `${ICONS.branchLast} Quads Rotations`,
          onSelect: () =>
            onSelect({
              type: 'element',
              resultSetId: resultSet.id,
              category: 'Envelopes',
              categoryType: 'Elements',
              resultType: 'QuadRotations',
              direction: '',
              elementType: 'Quad',
            }),
          selected:
            currentSelection?.type === 'element' &&
            currentSelection.resultSetId === resultSet.id &&
            currentSelection.resultType === 'QuadRotations',
        }),
      ]

      wallChildren.push(
        branchNode({
          key: quadRotationsKey,
          label: `${hasWallShears ? ICONS.branchLast : ICONS.branch} Quad Rotations`,
          icon: ICONS.resultType,
          expansionGroup: 'categoryTypes',
          variant: 'categoryType',
          children: quadChildren,
        })
      )
    }

    elementsChildren.push(
      branchNode({
        key: wallsKey,
        label: 'Walls',
        icon: ICONS.resultType,
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
            const elementKey = `${columnShearsKey}-${element.id}`
            const elementChildren: TreeSchemaNode[] = [
              leafNode({
                key: `${elementKey}-V2`,
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
                key: `${elementKey}-V3`,
                label: `${ICONS.branch} V3`,
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
              leafNode({
                key: `${elementKey}-MaxMin`,
                label: `${ICONS.branchLast} Max/Min`,
                onSelect: () =>
                  onSelect({
                    type: 'maxmin',
                    resultSetId: resultSet.id,
                    category: 'Envelopes',
                    categoryType: 'Elements',
                    resultType: 'ColumnShears',
                    direction: 'MaxMin',
                    elementType: 'Column',
                    elementId: element.id,
                  }),
                selected:
                  currentSelection?.type === 'maxmin' &&
                  currentSelection.resultSetId === resultSet.id &&
                  currentSelection.resultType === 'ColumnShears' &&
                  currentSelection.elementId === element.id,
              }),
            ]

            return branchNode({
              key: elementKey,
              label: `${branchPrefix(elementIndex, columnShearElements.length)} ${element.name}`,
              icon: ICONS.resultType,
              expansionGroup: 'categoryTypes',
              variant: 'categoryType',
              children: elementChildren,
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
            const elementKey = `${columnAxialsKey}-${element.id}`
            const elementChildren: TreeSchemaNode[] = [
              leafNode({
                key: `${elementKey}-Min`,
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
                key: `${elementKey}-Max`,
                label: `${ICONS.branch} Max`,
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
              leafNode({
                key: `${elementKey}-MaxMin`,
                label: `${ICONS.branchLast} Max/Min`,
                onSelect: () =>
                  onSelect({
                    type: 'maxmin',
                    resultSetId: resultSet.id,
                    category: 'Envelopes',
                    categoryType: 'Elements',
                    resultType: 'ColumnAxials',
                    direction: 'MaxMin',
                    elementType: 'Column',
                    elementId: element.id,
                  }),
                selected:
                  currentSelection?.type === 'maxmin' &&
                  currentSelection.resultSetId === resultSet.id &&
                  currentSelection.resultType === 'ColumnAxials' &&
                  currentSelection.elementId === element.id,
              }),
            ]

            return branchNode({
              key: elementKey,
              label: `${branchPrefix(elementIndex, columnAxialElements.length)} ${element.name}`,
              icon: ICONS.resultType,
              expansionGroup: 'categoryTypes',
              variant: 'categoryType',
              children: elementChildren,
            })
          }),
        })
      )
    }

    if (hasColumnRotations) {
      const rotationChildren: TreeSchemaNode[] = [
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

      rotationChildren.push(
        ...columnRotationElements.map((element, elementIndex) => {
          const elementKey = `${columnRotationsKey}-${element.id}`
          const elementChildren: TreeSchemaNode[] = [
            leafNode({
              key: `${elementKey}-R2`,
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
              key: `${elementKey}-R3`,
              label: `${ICONS.branch} R3`,
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
            leafNode({
              key: `${elementKey}-MaxMin`,
              label: `${ICONS.branchLast} Max/Min`,
              onSelect: () =>
                onSelect({
                  type: 'maxmin',
                  resultSetId: resultSet.id,
                  category: 'Envelopes',
                  categoryType: 'Elements',
                  resultType: 'ColumnRotations',
                  direction: 'MaxMin',
                  elementType: 'Column',
                  elementId: element.id,
                }),
              selected:
                currentSelection?.type === 'maxmin' &&
                currentSelection.resultSetId === resultSet.id &&
                currentSelection.resultType === 'ColumnRotations' &&
                currentSelection.elementId === element.id,
            }),
          ]

          return branchNode({
            key: elementKey,
            label: `${branchPrefix(elementIndex, columnRotationElements.length)} ${element.name}`,
            icon: ICONS.resultType,
            expansionGroup: 'categoryTypes',
            variant: 'categoryType',
            children: elementChildren,
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
          children: rotationChildren,
        })
      )
    }

    elementsChildren.push(
      branchNode({
        key: columnsKey,
        label: 'Columns',
        icon: ICONS.resultType,
        expansionGroup: 'categoryTypes',
        variant: 'categoryType',
        children: columnChildren,
      })
    )
  }

  if (hasBeamRotations) {
    elementsChildren.push(
      branchNode({
        key: beamsKey,
        label: 'Beams',
        icon: ICONS.resultType,
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

  if (elementsChildren.length > 0) {
    envelopeChildren.push(
      branchNode({
        key: elementsKey,
        label: 'Elements',
        icon: ICONS.categoryType,
        expansionGroup: 'categoryTypes',
        variant: 'categoryType',
        children: elementsChildren,
      })
    )
  }

  if (hasSoilPressures || hasVerticalDisplacements) {
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

    envelopeChildren.push(
      branchNode({
        key: jointsKey,
        label: 'Joints',
        icon: ICONS.categoryType,
        expansionGroup: 'categoryTypes',
        variant: 'categoryType',
        children: jointChildren,
      })
    )
  }

  const nodes: TreeSchemaNode[] = [
    branchNode({
      key: envelopesKey,
      label: 'Envelopes',
      icon: ICONS.category,
      expansionGroup: 'categories',
      variant: 'category',
      children: envelopeChildren,
    }),
  ]

  if (hasTimeSeries) {
    nodes.push(
      branchNode({
        key: timeSeriesKey,
        label: 'Time-Series',
        icon: ICONS.category,
        expansionGroup: 'categories',
        variant: 'category',
        children: timeSeriesLoadCases.map((loadCaseName, loadCaseIndex) => {
          const loadCaseKey = `${timeSeriesKey}-${loadCaseName}`
          const directionLeaves: TreeSchemaNode[] = (['X', 'Y'] as const).map(
            (direction, directionIndex) =>
              leafNode({
                key: `${loadCaseKey}-${direction}`,
                label: `${directionIndex < 1 ? ICONS.branch : ICONS.branchLast} ${direction} Direction`,
                onSelect: () =>
                  onSelect({
                    type: 'time_series',
                    resultSetId: resultSet.id,
                    category: 'Time-Series',
                    categoryType: 'Global',
                    resultType: 'Drifts',
                    direction,
                    loadCaseName,
                  }),
                selected:
                  currentSelection?.type === 'time_series' &&
                  currentSelection.resultSetId === resultSet.id &&
                  currentSelection.direction === direction &&
                  currentSelection.loadCaseName === loadCaseName,
              })
          )

          return branchNode({
            key: loadCaseKey,
            label: `${branchPrefix(loadCaseIndex, timeSeriesLoadCases.length)} ${loadCaseName}`,
            icon: ICONS.categoryType,
            expansionGroup: 'categoryTypes',
            variant: 'categoryType',
            children: directionLeaves,
          })
        }),
      })
    )
  }

  return nodes
}
