export type TreeCategory = 'Envelopes' | 'Time-Series'
export type TreeCategoryType = 'Global' | 'Elements' | 'Joints'

interface TreeSelectionBase {
  resultSetId: number
  category: TreeCategory
  categoryType?: TreeCategoryType
  resultType: string
  direction: string
  elementType?: string
  elementId?: number
  loadCaseName?: string
}

export interface GlobalResultSelection extends TreeSelectionBase {
  type: 'global_result'
  category: 'Envelopes'
  categoryType: 'Global'
}

export interface MaxMinSelection extends TreeSelectionBase {
  type: 'maxmin'
  category: 'Envelopes'
  direction: 'MaxMin'
}

export interface TimeSeriesSelection extends TreeSelectionBase {
  type: 'time_series'
  category: 'Time-Series'
  categoryType: 'Global'
  resultType: 'Drifts'
  direction: 'X' | 'Y'
}

export interface ElementSelection extends TreeSelectionBase {
  type: 'element'
  category: 'Envelopes'
  categoryType: 'Elements'
}

export interface JointSelection extends TreeSelectionBase {
  type: 'joint'
  category: 'Envelopes'
  categoryType: 'Joints'
}

export interface JointPlotSelection extends TreeSelectionBase {
  type: 'joint_plot'
  category: 'Envelopes'
  categoryType: 'Joints'
}

export interface JointTableSelection extends TreeSelectionBase {
  type: 'joint_table'
  category: 'Envelopes'
  categoryType: 'Joints'
}

export interface ColumnRotationsPlotSelection extends TreeSelectionBase {
  type: 'column_rotations_plot'
  category: 'Envelopes'
  categoryType: 'Elements'
  resultType: string
}

export interface BeamRotationsPlotSelection extends TreeSelectionBase {
  type: 'beam_rotations_plot'
  category: 'Envelopes'
  categoryType: 'Elements'
  resultType: string
}

export interface BeamRotationsTableSelection extends TreeSelectionBase {
  type: 'beam_rotations_table'
  category: 'Envelopes'
  categoryType: 'Elements'
  resultType: string
}

export interface PushoverCurveSelection extends TreeSelectionBase {
  type: 'pushover_curve'
  category: 'Envelopes'
  resultType: 'PushoverCurve'
}

export interface PushoverAllCurvesSelection extends TreeSelectionBase {
  type: 'pushover_all_curves'
  category: 'Envelopes'
  resultType: 'PushoverCurve'
}

export interface PushoverGlobalSelection extends TreeSelectionBase {
  type: 'pushover_global'
  category: 'Envelopes'
  categoryType?: 'Global'
}

interface ComparisonSelectionBase extends TreeSelectionBase {
  category: 'Envelopes'
  comparisonSetId: number
  comparisonSetName: string
  resultSetIds: number[]
}

export interface ComparisonGlobalSelection extends ComparisonSelectionBase {
  type: 'comparison_global'
}

export interface ComparisonElementSelection extends ComparisonSelectionBase {
  type: 'comparison_element'
}

export interface ComparisonJointSelection extends ComparisonSelectionBase {
  type: 'comparison_joint'
}

export interface ComparisonColumnRotationsSelection extends ComparisonSelectionBase {
  type: 'comparison_column_rotations'
  resultType: 'ColumnRotations'
}

export interface ComparisonBeamRotationsSelection extends ComparisonSelectionBase {
  type: 'comparison_beam_rotations'
  resultType: 'BeamRotations'
}

export type TreeSelection =
  | GlobalResultSelection
  | MaxMinSelection
  | TimeSeriesSelection
  | ElementSelection
  | JointSelection
  | JointPlotSelection
  | JointTableSelection
  | ColumnRotationsPlotSelection
  | BeamRotationsPlotSelection
  | BeamRotationsTableSelection
  | PushoverCurveSelection
  | PushoverAllCurvesSelection
  | PushoverGlobalSelection
  | ComparisonGlobalSelection
  | ComparisonElementSelection
  | ComparisonJointSelection
  | ComparisonColumnRotationsSelection
  | ComparisonBeamRotationsSelection

export type ComparisonTreeSelection = Extract<TreeSelection, { comparisonSetId: number }>
export type TreeSelectionType = TreeSelection['type']

const COMPARISON_SELECTION_TYPES: ReadonlySet<TreeSelectionType> = new Set([
  'comparison_global',
  'comparison_element',
  'comparison_joint',
  'comparison_column_rotations',
  'comparison_beam_rotations',
])

const JOINT_SELECTION_TYPES: ReadonlySet<TreeSelectionType> = new Set([
  'joint',
  'joint_plot',
  'joint_table',
])

export function isComparisonSelection(
  selection: TreeSelection | null | undefined
): selection is ComparisonTreeSelection {
  if (!selection) return false
  return COMPARISON_SELECTION_TYPES.has(selection.type)
}

export function isJointSelectionType(type: TreeSelectionType): boolean {
  return JOINT_SELECTION_TYPES.has(type)
}

export interface TreeResultTypeInfo {
  type: string
  directions: string[] | null
  unit?: string
}

export interface TreeJointResultTypeInfo {
  type: string
  directions?: string[] | null
  unit?: string
}

export interface TreeAvailableTypes {
  global_results: TreeResultTypeInfo[]
  element_results: TreeResultTypeInfo[]
  joint_results: TreeJointResultTypeInfo[]
}
