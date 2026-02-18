import type { TreeResultTypeInfo } from './types'

export const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

export const ICONS = {
  section: '◆',
  resultSet: '▸',
  category: '◆',
  categoryType: '◇',
  resultType: '›',
  branch: '├',
  branchLast: '└',
} as const

export const DEFAULT_GLOBAL_RESULTS: TreeResultTypeInfo[] = [
  { type: 'Drifts', directions: ['X', 'Y'], unit: '' },
  { type: 'Accelerations', directions: ['X', 'Y'], unit: '' },
  { type: 'Forces', directions: ['X', 'Y'], unit: '' },
  { type: 'Displacements', directions: ['X', 'Y'], unit: '' },
]

export const COMP_GLOBAL_TYPES = ['Drifts', 'Accelerations', 'Forces', 'Displacements']

export const COMP_ELEMENT_TYPE_MAP: Record<string, { group: string; label: string; directions: string[] }> = {
  WallShears: { group: 'Walls', label: 'Shears', directions: ['V2', 'V3'] },
  ColumnShears: { group: 'Columns', label: 'Shears', directions: ['V2', 'V3'] },
  ColumnAxials: { group: 'Columns', label: 'Axials', directions: ['Min', 'Max'] },
  ColumnRotations: { group: 'Columns', label: 'Rotations', directions: ['R2', 'R3'] },
}

export const COMP_BEAM_ROTATIONS = 'BeamRotations'

export const COMP_JOINT_TYPES = ['SoilPressures', 'VerticalDisplacements']

export const COMP_JOINT_LABELS: Record<string, string> = {
  SoilPressures: 'Soil Pressures',
  VerticalDisplacements: 'Vertical Displacements',
}
