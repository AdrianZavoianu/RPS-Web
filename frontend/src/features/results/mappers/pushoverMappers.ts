import type {
  PushoverCurve,
  ResultDataset,
} from '../../../types'

export interface PushoverChartCurve {
  name: string
  points: PushoverCurve['points']
}

export function mapPushoverCurveToDataset(
  curve: PushoverCurve,
  resultSetId: number
): ResultDataset {
  return {
    meta: {
      result_type: 'PushoverCurve',
      direction: curve.case.direction,
      result_set_id: resultSetId,
      display_name: curve.case.name,
      unit: '',
      decimals: 0,
    },
    rows: curve.points.map((point) => ({
      Step: point.step,
      'Base Shear (kN)': point.base_shear,
      'Displacement (mm)': point.displacement,
    })),
    load_case_columns: ['Base Shear (kN)', 'Displacement (mm)'],
    summary_columns: [],
    story_column: 'Step',
  }
}

export function mapPushoverCurvesToChartCurves(curves: PushoverCurve[]): PushoverChartCurve[] {
  return curves.map((curve) => ({
    name: curve.case.name,
    points: curve.points,
  }))
}
