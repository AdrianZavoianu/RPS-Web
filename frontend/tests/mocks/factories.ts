import type {
  Project,
  ResultSet,
  ImportJob,
  ResultDataset,
  ResultDatasetMeta,
  PrescanResult,
  LoadCaseInfo,
  ImportConflict,
  User,
  AvailableResultTypes,
} from '../../src/types'
import type { ExportJob } from '../../src/api/exports'

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    ...overrides,
  }
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    slug: 'test-project',
    name: 'Test Project',
    description: 'A test project',
    analysis_type: 'NLTHA',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    has_data: true,
    story_count: 10,
    load_case_count: 5,
    element_count: 20,
    result_set_count: 2,
    ...overrides,
  }
}

export function makeResultSet(overrides: Partial<ResultSet> = {}): ResultSet {
  return {
    id: 1,
    name: 'NLTHA Run 1',
    analysis_type: 'NLTHA',
    description: '',
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

export function makeImportJob(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    id: 1,
    project: 1,
    project_name: 'Test Project',
    result_set: null,
    result_set_name: null,
    status: 'pending',
    current_phase: 'Waiting',
    progress_current: 0,
    progress_total: 0,
    progress_percent: 0,
    error_message: null,
    import_summary: null,
    created_at: '2025-01-01T00:00:00Z',
    started_at: null,
    completed_at: null,
    ...overrides,
  }
}

export function makeExportJob(overrides: Partial<ExportJob> = {}): ExportJob {
  return {
    id: 1,
    status: 'pending',
    progress: 0,
    file_name: 'export.xlsx',
    download_url: null,
    error_message: null,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

export function makeResultDatasetMeta(
  overrides: Partial<ResultDatasetMeta> = {}
): ResultDatasetMeta {
  return {
    result_type: 'Drifts',
    direction: 'X',
    result_set_id: 1,
    display_name: 'Drifts X',
    unit: '%',
    ...overrides,
  }
}

export function makeResultDataset(overrides: Partial<ResultDataset> = {}): ResultDataset {
  return {
    meta: makeResultDatasetMeta(),
    rows: [
      { Story: 'L3', 'TH 01': 0.15, 'TH 02': 0.22, Avg: 0.185 },
      { Story: 'L2', 'TH 01': 0.31, 'TH 02': 0.28, Avg: 0.295 },
      { Story: 'L1', 'TH 01': 0.12, 'TH 02': 0.18, Avg: 0.15 },
    ],
    load_case_columns: ['TH 01', 'TH 02'],
    summary_columns: ['Avg'],
    story_column: 'Story',
    ...overrides,
  }
}

export function makePrescanResult(overrides: Partial<PrescanResult> = {}): PrescanResult {
  return {
    job_id: 1,
    status: 'completed',
    files_scanned: 3,
    load_cases: [
      makeLoadCaseInfo({ name: 'TH 01' }),
      makeLoadCaseInfo({ name: 'TH 02' }),
    ],
    conflicts: [],
    foundation_joints: [],
    errors: [],
    ...overrides,
  }
}

export function makeLoadCaseInfo(overrides: Partial<LoadCaseInfo> = {}): LoadCaseInfo {
  return {
    name: 'TH 01',
    files: ['file1.xlsx'],
    sheets: ['Sheet1'],
    has_conflict: false,
    ...overrides,
  }
}

export function makeImportConflict(overrides: Partial<ImportConflict> = {}): ImportConflict {
  return {
    load_case: 'TH 01',
    sheet: 'Drifts',
    files: ['file1.xlsx', 'file2.xlsx'],
    ...overrides,
  }
}

export function makeAvailableResultTypes(
  overrides: Partial<AvailableResultTypes> = {}
): AvailableResultTypes {
  return {
    global_results: [
      { type: 'Drifts', directions: ['X', 'Y'], unit: '%' },
      { type: 'Accelerations', directions: ['X', 'Y'], unit: 'g' },
      { type: 'Forces', directions: ['X', 'Y'], unit: 'kN' },
      { type: 'Displacements', directions: ['X', 'Y'], unit: 'mm' },
    ],
    element_results: [
      { type: 'WallShears', directions: ['V2', 'V3'], unit: 'kN' },
    ],
    joint_results: [
      { type: 'SoilPressures', directions: null, unit: 'kPa' },
    ],
    has_pushover: false,
    config: {
      Drifts: { unit: '%', multiplier: 100, directions: ['X', 'Y'] },
      Accelerations: { unit: 'g', multiplier: 1, directions: ['X', 'Y'] },
      Forces: { unit: 'kN', multiplier: 1, directions: ['X', 'Y'] },
      Displacements: { unit: 'mm', multiplier: 1000, directions: ['X', 'Y'] },
    },
    ...overrides,
  }
}
