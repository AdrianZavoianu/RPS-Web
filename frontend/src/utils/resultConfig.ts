const normalizeResultType = (resultType?: string): string | undefined => {
  if (!resultType) {
    return undefined
  }
  return resultType.split('_')[0]
}

export const RESULT_TYPE_DECIMALS: Record<string, number> = {
  Drifts: 2,
  Accelerations: 2,
  Forces: 0,
  Displacements: 0,
  WallShears: 0,
  QuadRotations: 2,
  ColumnShears: 0,
  ColumnAxials: 0,
  ColumnRotations: 2,
  BeamRotations: 2,
  SoilPressures: 2,
  VerticalDisplacements: 0,
}

export const RESULT_TYPE_UNITS: Record<string, string> = {
  Drifts: '%',
  Accelerations: 'g',
  Forces: 'kN',
  Displacements: 'mm',
  WallShears: 'kN',
  QuadRotations: '%',
  ColumnShears: 'kN',
  ColumnAxials: 'kN',
  ColumnRotations: '%',
  BeamRotations: '%',
  SoilPressures: 'kN/m²',
  VerticalDisplacements: 'mm',
}

export function getResultTypeDecimals(resultType?: string, fallback = 2): number {
  const normalizedType = normalizeResultType(resultType)
  if (!normalizedType) {
    return fallback
  }
  return RESULT_TYPE_DECIMALS[normalizedType] ?? fallback
}

export function getResultTypeUnit(resultType?: string): string {
  const normalizedType = normalizeResultType(resultType)
  if (!normalizedType) {
    return ''
  }
  return RESULT_TYPE_UNITS[normalizedType] ?? ''
}
