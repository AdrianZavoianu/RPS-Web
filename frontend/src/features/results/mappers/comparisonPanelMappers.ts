import type {
  BeamRotationsPlotData,
  ColumnRotationsPlotData,
  ComparisonDataset,
  ResultDataset,
  ResultSet,
} from '../../../types'
import { ROTATION_COMPARISON_PALETTE as ROTATION_COMPARISON_COLORS } from '../../../utils/colors'
import { seededJitter } from '../../../components/results/comparisonUtils'

export interface NamedDataset<T> {
  data: T
  name: string
  rsId: number
}

export function mapResultSetNames(resultSets: ResultSet[] | undefined): Record<number, string> {
  const names: Record<number, string> = {}
  for (const resultSet of resultSets || []) {
    names[resultSet.id] = resultSet.name
  }
  return names
}

export function mapNamedDatasets<T>(
  resultSetIds: number[],
  datasetByIndex: Array<T | undefined>,
  resultSetNames: Record<number, string>
): Array<NamedDataset<T>> {
  const datasets: Array<NamedDataset<T>> = []

  for (let index = 0; index < resultSetIds.length; index++) {
    const data = datasetByIndex[index]
    const resultSetId = resultSetIds[index]
    if (!data || !resultSetId) continue

    datasets.push({
      rsId: resultSetId,
      name: resultSetNames[resultSetId] || `RS ${resultSetId}`,
      data,
    })
  }

  return datasets
}

export function buildComparisonTableDataset(comparisonData: ComparisonDataset | null) {
  if (!comparisonData) return null

  return {
    rows: comparisonData.rows,
    series: comparisonData.series,
    ratio_column: comparisonData.ratio_column,
    metric: comparisonData.metric,
    result_type: comparisonData.result_type,
    decimals: comparisonData.decimals,
  }
}

export function getLongestStories(
  datasets: Array<NamedDataset<BeamRotationsPlotData | ColumnRotationsPlotData>>
): string[] {
  let longestStories: string[] = []

  for (const dataset of datasets) {
    if (dataset.data.stories.length > longestStories.length) {
      longestStories = dataset.data.stories
    }
  }

  return longestStories
}

export function buildStoryIndexMap(stories: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  stories.forEach((story, storyIndex) => {
    map[story] = storyIndex
  })
  return map
}

export function buildBeamComparisonScatterTraces(
  datasets: Array<NamedDataset<BeamRotationsPlotData>>,
  storyIndexMap: Record<string, number>
) {
  return datasets.map((dataset, datasetIndex) => {
    const points = [
      ...dataset.data.max_points.map((point, index) => ({
        ...point,
        jitter: seededJitter(index, 42 + datasetIndex),
      })),
      ...dataset.data.min_points.map((point, index) => ({
        ...point,
        jitter: seededJitter(index, 43 + datasetIndex),
      })),
    ]

    const color = ROTATION_COMPARISON_COLORS[datasetIndex % ROTATION_COMPARISON_COLORS.length]

    return {
      type: 'scatter' as const,
      mode: 'markers' as const,
      name: dataset.name,
      x: points.map((point) => point.rotation),
      y: points.map((point) => (storyIndexMap[point.story] ?? point.story_index) + point.jitter),
      customdata: points.map((point) => [point.element, point.load_case, point.story]),
      marker: { color, size: 4, opacity: 0.7 },
      hovertemplate: `<b>${dataset.name}</b><br>%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]}: %{x:.3f}<extra></extra>`,
      showlegend: true,
    }
  })
}

export function buildSymmetricXRange(maxAbsoluteValue: number): [number, number] | undefined {
  if (maxAbsoluteValue === 0) return undefined
  return [-(maxAbsoluteValue * 1.1), maxAbsoluteValue * 1.1]
}

export function resolveBeamComparisonXRange(
  datasets: Array<NamedDataset<BeamRotationsPlotData>>
): [number, number] | undefined {
  let maxAbsoluteValue = 0

  for (const dataset of datasets) {
    for (const point of [...dataset.data.max_points, ...dataset.data.min_points]) {
      const absoluteValue = Math.abs(point.rotation)
      if (absoluteValue > maxAbsoluteValue) {
        maxAbsoluteValue = absoluteValue
      }
    }
  }

  return buildSymmetricXRange(maxAbsoluteValue)
}

export function collectColumnDirections(
  datasets: Array<NamedDataset<ColumnRotationsPlotData>>
): string[] {
  const directionSet = new Set<string>()

  datasets.forEach((dataset) => {
    dataset.data.directions.forEach((direction) => {
      const value = direction.trim()
      if (value) directionSet.add(value)
    })

    dataset.data.max_points.forEach((point) => {
      if (point.direction) directionSet.add(point.direction)
    })

    dataset.data.min_points.forEach((point) => {
      if (point.direction) directionSet.add(point.direction)
    })
  })

  return Array.from(directionSet).sort((left, right) => left.localeCompare(right))
}

export function getColumnRotationPoints(
  data: ColumnRotationsPlotData,
  direction: string
) {
  const points = [...data.max_points, ...data.min_points]
  if (direction === 'All') return points
  return points.filter((point) => point.direction === direction)
}

export function buildColumnComparisonScatterTraces(
  datasets: Array<NamedDataset<ColumnRotationsPlotData>>,
  direction: string,
  storyIndexMap: Record<string, number>
) {
  return datasets.map((dataset, datasetIndex) => {
    const maxPoints =
      direction === 'All'
        ? dataset.data.max_points
        : dataset.data.max_points.filter((point) => point.direction === direction)

    const minPoints =
      direction === 'All'
        ? dataset.data.min_points
        : dataset.data.min_points.filter((point) => point.direction === direction)

    const points = [
      ...maxPoints.map((point, index) => ({
        ...point,
        jitter: seededJitter(index, 74 + datasetIndex),
      })),
      ...minPoints.map((point, index) => ({
        ...point,
        jitter: seededJitter(index, 75 + datasetIndex),
      })),
    ]

    const color = ROTATION_COMPARISON_COLORS[datasetIndex % ROTATION_COMPARISON_COLORS.length]

    return {
      type: 'scatter' as const,
      mode: 'markers' as const,
      name: dataset.name,
      x: points.map((point) => point.rotation),
      y: points.map((point) => (storyIndexMap[point.story] ?? point.story_index) + point.jitter),
      customdata: points.map((point) => [
        point.element,
        point.load_case,
        point.story,
        point.direction,
      ]),
      marker: { color, size: 4, opacity: 0.7 },
      hovertemplate: `<b>${dataset.name}</b><br>%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]} (%{customdata[3]}): %{x:.3f}<extra></extra>`,
      showlegend: true,
    }
  })
}

export function resolveColumnComparisonXRange(
  datasets: Array<NamedDataset<ColumnRotationsPlotData>>,
  direction: string
): [number, number] | undefined {
  const points = datasets.flatMap((dataset) => getColumnRotationPoints(dataset.data, direction))
  if (!points.length) return undefined

  const maxAbsoluteValue = points.reduce(
    (maxValue, point) => Math.max(maxValue, Math.abs(point.rotation)),
    0
  )

  if (maxAbsoluteValue === 0) return undefined

  const padding = maxAbsoluteValue * 0.1
  return [-(maxAbsoluteValue + padding), maxAbsoluteValue + padding]
}

export function collectJointLoadCases(
  datasets: Array<NamedDataset<ResultDataset>>
): string[] {
  const loadCaseSet = new Set<string>()

  for (const dataset of datasets) {
    for (const loadCase of dataset.data.load_case_columns) {
      loadCaseSet.add(loadCase)
    }
  }

  return [...loadCaseSet].sort()
}

export function buildLoadCaseIndexMap(loadCases: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  loadCases.forEach((loadCase, loadCaseIndex) => {
    map[loadCase] = loadCaseIndex
  })
  return map
}

export function buildJointComparisonScatterTraces(
  datasets: Array<NamedDataset<ResultDataset>>,
  loadCaseIndexMap: Record<string, number>,
  useAbsoluteValue: boolean
) {
  return datasets.map((dataset, datasetIndex) => {
    const storyColumn = dataset.data.story_column || 'Shell Object'
    const xValues: number[] = []
    const yValues: number[] = []
    const customData: string[][] = []

    dataset.data.rows.forEach((row, rowIndex) => {
      const shellObject = String(row[storyColumn] ?? '')
      const uniqueName = String(row['Unique Name'] ?? '')

      dataset.data.load_case_columns.forEach((loadCase, loadCaseIndex) => {
        const rawValue = row[loadCase]
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return

        const value = useAbsoluteValue ? Math.abs(rawValue) : rawValue
        xValues.push(
          (loadCaseIndexMap[loadCase] ?? loadCaseIndex) +
            seededJitter(rowIndex * 100 + loadCaseIndex, 42 + datasetIndex)
        )
        yValues.push(value)
        customData.push([loadCase, shellObject, uniqueName])
      })
    })

    const color = ROTATION_COMPARISON_COLORS[datasetIndex % ROTATION_COMPARISON_COLORS.length]

    return {
      type: 'scatter' as const,
      mode: 'markers' as const,
      name: dataset.name,
      x: xValues,
      y: yValues,
      customdata: customData,
      marker: { color, size: 4, opacity: 0.7 },
      hovertemplate: `<b>${dataset.name}</b><br>%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]}: %{y:.3f}<extra></extra>`,
      showlegend: true,
    }
  })
}
