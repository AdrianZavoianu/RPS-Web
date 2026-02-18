function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function normalizeQueryKeyPart(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => normalizeQueryKeyPart(item))
      .filter((item) => item !== undefined)
    return normalized.length > 0 ? normalized : undefined
  }

  if (isPlainObject(value)) {
    const normalizedEntries = Object.entries(value)
      .map(([key, item]) => [key, normalizeQueryKeyPart(item)] as const)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))

    if (normalizedEntries.length === 0) {
      return undefined
    }

    return Object.fromEntries(normalizedEntries)
  }

  return value
}

function rootScopedKey(scope: string, arg?: unknown) {
  const normalizedArg = normalizeQueryKeyPart(arg)
  if (normalizedArg === undefined) {
    return [scope] as const
  }
  return [scope, normalizedArg] as const
}

function projectScopedKey(scope: string, projectSlug: string, arg?: unknown) {
  const normalizedArg = normalizeQueryKeyPart(arg)
  if (normalizedArg === undefined) {
    return [scope, projectSlug] as const
  }
  return [scope, projectSlug, normalizedArg] as const
}

export const queryKeys = {
  projects: () => rootScopedKey('projects'),
  project: (slug: string | undefined) => rootScopedKey('project', slug),

  importJobs: (projectSlug: string) => projectScopedKey('importJobs', projectSlug),
  importJob: (projectSlug: string, jobId: number | null) =>
    projectScopedKey('importJob', projectSlug, jobId),
  prescanResult: (projectSlug: string, jobId: number | null) =>
    projectScopedKey('prescanResult', projectSlug, jobId),

  exportJobs: (projectSlug: string) => projectScopedKey('exportJobs', projectSlug),
  exportJob: (projectSlug: string, jobId?: number | null) =>
    projectScopedKey('exportJob', projectSlug, jobId),

  reportPreview: (projectSlug: string, resultSetId: number | null) =>
    projectScopedKey('reportPreview', projectSlug, resultSetId),

  resultSets: (projectSlug: string) => projectScopedKey('resultSets', projectSlug),
  resultSet: (projectSlug: string, id: number) => projectScopedKey('resultSet', projectSlug, id),
  availableResultTypes: (projectSlug: string) =>
    projectScopedKey('availableResultTypes', projectSlug),
  resultTreeMetadata: (projectSlug: string, resultSetId?: number | null) =>
    projectScopedKey('resultTreeMetadata', projectSlug, resultSetId),
  globalResults: (projectSlug: string, params?: unknown) =>
    projectScopedKey('globalResults', projectSlug, params),
  elementResults: (projectSlug: string, params?: unknown) =>
    projectScopedKey('elementResults', projectSlug, params),
  elementsForType: (projectSlug: string, params?: unknown) =>
    projectScopedKey('elementsForType', projectSlug, params),
  jointResults: (projectSlug: string, params?: unknown) =>
    projectScopedKey('jointResults', projectSlug, params),
  maxMinData: (projectSlug: string, params?: unknown) =>
    projectScopedKey('maxMinData', projectSlug, params),
  comparisonData: (projectSlug: string, params?: unknown) =>
    projectScopedKey('comparisonData', projectSlug, params),
  comparisonSets: (projectSlug: string) => projectScopedKey('comparisonSets', projectSlug),
  chartData: (projectSlug: string, params?: unknown) =>
    projectScopedKey('chartData', projectSlug, params),
  beamRotationsPlot: (projectSlug: string, params?: unknown) =>
    projectScopedKey('beamRotationsPlot', projectSlug, params),
  beamRotationsTable: (projectSlug: string, params?: unknown) =>
    projectScopedKey('beamRotationsTable', projectSlug, params),
  columnRotationsPlot: (projectSlug: string, params?: unknown) =>
    projectScopedKey('columnRotationsPlot', projectSlug, params),
  pushoverCases: (projectSlug: string, resultSetId?: number | null) =>
    projectScopedKey('pushoverCases', projectSlug, resultSetId),
  pushoverCurve: (projectSlug: string, caseId?: number | null) =>
    projectScopedKey('pushoverCurve', projectSlug, caseId),
  pushoverCurvesBatch: (projectSlug: string, params?: unknown) =>
    projectScopedKey('pushoverCurvesBatch', projectSlug, params),
  timeSeriesAllTypes: (projectSlug: string, params?: unknown) =>
    projectScopedKey('timeSeriesAllTypes', projectSlug, params),
  timeSeriesLoadCases: (projectSlug: string, resultSetId?: number | null) =>
    projectScopedKey('timeSeriesLoadCases', projectSlug, resultSetId),
  timeSeriesData: (projectSlug: string, params?: unknown) =>
    projectScopedKey('timeSeriesData', projectSlug, params),
} as const
