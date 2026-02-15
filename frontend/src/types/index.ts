// User types
export interface User {
  id: number
  username: string
  email: string
}

// Project types
export type AnalysisType = 'NLTHA' | 'Pushover' | 'Mixed'

export interface Project {
  id: number
  slug: string
  name: string
  description: string
  analysis_type?: AnalysisType
  created_at: string
  updated_at: string
  last_opened?: string | null
  has_data?: boolean
  story_count?: number
  load_case_count?: number
  element_count?: number
  result_set_count?: number
  building_name?: string
  location?: string
  engineer?: string
  company?: string
}

export interface ProjectCreate {
  name: string
  description?: string
  analysis_type?: AnalysisType
}

// Story types
export interface Story {
  id: number
  project_id: number
  name: string
  sort_order: number | null
}

// Load Case types
export interface LoadCase {
  id: number
  project_id: number
  name: string
  case_type: string
  description: string
}

// Element types
export interface Element {
  id: number
  name: string
  element_type: 'Wall' | 'Column' | 'Beam' | 'Pier' | 'Link'
}

// Result Set types
export interface ResultSet {
  id: number
  name: string
  analysis_type: 'NLTHA' | 'Pushover'
  description: string
  categories?: ResultCategory[]
  created_at: string
}

export interface ResultCategory {
  id: number
  result_set_id: number
  category_name: string
  category_type: string
}

// Comparison Set types
export interface ComparisonSet {
  id: number
  name: string
  description: string
  result_set_ids: number[]
  result_types: string[]
  created_at: string
}

export interface ComparisonSetCreate {
  name: string
  description?: string
  result_set_ids: number[]
  result_types: string[]
}

// --- Result Data Types (from API) ---

export type Direction = 'X' | 'Y' | 'UX' | 'UY' | 'VX' | 'VY' | 'V2' | 'V3' | 'R2' | 'R3'
export type GlobalResultType = 'Drifts' | 'Accelerations' | 'Forces' | 'Displacements'
export type ElementResultType = 'WallShears' | 'QuadRotations' | 'ColumnShears' | 'ColumnAxials' | 'ColumnRotations' | 'BeamRotations'
export type JointResultType = 'SoilPressures' | 'VerticalDisplacements'

export interface ResultDatasetMeta {
  result_type: string
  direction: string | null
  result_set_id: number
  display_name: string
  unit?: string
}

export interface ResultDataset {
  meta: ResultDatasetMeta | null
  rows: Record<string, unknown>[]
  load_case_columns: string[]
  summary_columns: string[]
  story_column: string
}

export interface MaxMinDataset {
  meta: ResultDatasetMeta | null
  rows: Record<string, unknown>[]
  directions: string[]
  source_type: string
}

export interface ComparisonSeries {
  result_set_id: number
  result_set_name: string
  has_data: boolean
  warning: string | null
}

export interface ComparisonDataset {
  result_type: string
  direction: string | null
  metric: string
  series: ComparisonSeries[]
  rows: Record<string, unknown>[]
  ratio_column: string | null
  warnings: string[]
}

export interface ChartData {
  stories: string[]
  values: number[]
  result_type: string
  direction: string
  column: string
  unit: string
}

export interface BeamRotationPoint {
  element: string
  story: string
  story_index: number
  load_case: string
  rotation: number
}

export interface ColumnRotationPoint extends BeamRotationPoint {
  direction: string
}

export interface HistogramBin {
  start: number
  end: number
  center: number
  count: number
}

export interface BeamRotationsPlotData {
  meta: {
    result_type: string
    result_set_id: number
    unit: string
    x_label: string
  }
  stories: string[]
  max_points: BeamRotationPoint[]
  min_points: BeamRotationPoint[]
  histogram_bins: HistogramBin[]
}

export interface BeamRotationsTableData {
  meta: {
    result_type: string
    result_set_id: number
    unit: string
  }
  columns: string[]
  rows: Record<string, unknown>[]
  fixed_columns: string[]
  load_case_columns: string[]
  summary_columns: string[]
}

export interface ColumnRotationsPlotData {
  meta: {
    result_type: string
    result_set_id: number
    unit: string
    x_label: string
  }
  stories: string[]
  directions: string[]
  max_points: ColumnRotationPoint[]
  min_points: ColumnRotationPoint[]
  histogram_bins: HistogramBin[]
}

export interface ResultTypeInfo {
  type: string
  directions: string[] | null
  unit: string
}

export interface AvailableResultTypes {
  global_results: ResultTypeInfo[]
  element_results: ResultTypeInfo[]
  joint_results: ResultTypeInfo[]
  has_pushover: boolean
  config: Record<string, { unit: string; multiplier: number; directions: string[] | null }>
}

// --- Pushover Types ---

export interface PushoverCase {
  id: number
  name: string
  direction: string
  result_set_id: number | null
}

export interface PushoverCurvePoint {
  step: number
  displacement: number
  base_shear: number
}

export interface PushoverCurve {
  case: {
    id: number
    name: string
    direction: string
  }
  points: PushoverCurvePoint[]
}

// --- Import Types ---

export interface ImportJob {
  id: number
  project: number
  project_name: string
  result_set: number | null
  result_set_name: string | null
  status: 'pending' | 'scanning' | 'processing' | 'building_cache' | 'completed' | 'failed' | 'cancelled'
  current_phase: string
  progress_current: number
  progress_total: number
  progress_percent: number
  error_message: string | null
  import_summary: Record<string, unknown> | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface LoadCaseInfo {
  name: string
  files: string[]
  sheets: string[]
  has_conflict: boolean
}

export interface ImportConflict {
  load_case: string
  sheet: string
  files: string[]
}

export interface PrescanResult {
  job_id: number
  status: string
  files_scanned: number
  load_cases: LoadCaseInfo[]
  conflicts: ImportConflict[]
  foundation_joints: string[]
  errors: string[]
}

export interface ConflictResolution {
  sheet: string
  load_case: string
  chosen_file: string | null
}

export interface ImportStartRequest {
  selected_load_cases?: string[]
  conflict_resolutions?: ConflictResolution[]
  result_set_name?: string
  result_set_id?: number
}

// --- Chart Types ---

export interface ProfileChartData {
  stories: string[]
  series: {
    name: string
    values: number[]
    color?: string
  }[]
  result_type?: string
  unit: string
  title: string
}

// --- Time-Series Types ---

export interface TimeSeriesData {
  stories: string[]
  time_steps: number[]
  data: Record<string, number[]>  // story -> values per time step
  result_type: string
  direction: string
  load_case: string
}

export interface TimeSeriesAllTypesData {
  stories: string[]
  time_steps: number[]
  types: Record<string, Record<string, number[]>>  // result_type -> story -> values
  load_case: string
  direction: string
}
