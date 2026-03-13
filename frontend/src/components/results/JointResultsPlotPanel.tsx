import clsx from 'clsx'
import { useMemo, useState } from 'react'

import type { ResultDataset } from '../../types'
import { LazyPlot } from '../charts/LazyPlot'
import { withPlotlyDefaults } from '../../utils/plotlyDefaults'

interface JointResultsPlotPanelProps {
  dataset: ResultDataset
}

interface JointPoint {
  loadCase: string
  loadCaseIndex: number
  value: number
  shellObject: string
  uniqueName: string
}

interface HistogramBin {
  center: number
  width: number
  count: number
}

type TabId = 'scatter' | 'histogram'

function seededJitter(index: number, seed: number) {
  const raw = ((index + 1) * 9301 + seed * 49297) % 233280
  return (raw / 233280 - 0.5) * 0.6
}

function getYLabel(resultType: string | undefined, unit: string | undefined): string {
  const suffix = unit ? ` (${unit})` : ''
  if (resultType === 'SoilPressures') {
    return `Soil Pressure${suffix}`
  }
  if (resultType === 'VerticalDisplacements') {
    return `Vertical Displacement${suffix}`
  }
  return `Value${suffix}`
}

function buildHistogramBins(values: number[], binCount = 50): HistogramBin[] {
  if (!values.length) {
    return []
  }

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)

  if (minValue === maxValue) {
    return [
      {
        center: minValue,
        width: 1,
        count: values.length,
      },
    ]
  }

  const width = (maxValue - minValue) / binCount
  const counts = new Array(binCount).fill(0)

  values.forEach((value) => {
    let index = Math.floor((value - minValue) / width)
    if (index < 0) index = 0
    if (index >= binCount) index = binCount - 1
    counts[index] += 1
  })

  return counts.map((count, index) => ({
    center: minValue + width * (index + 0.5),
    width,
    count,
  }))
}

export function JointResultsPlotPanel({ dataset }: JointResultsPlotPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('scatter')

  const loadCases = dataset.load_case_columns
  const useAbsoluteValue =
    dataset.meta?.result_type === 'SoilPressures' ||
    dataset.meta?.result_type === 'VerticalDisplacements'

  const points = useMemo<JointPoint[]>(() => {
    if (!loadCases.length || !dataset.rows.length) {
      return []
    }

    const storyColumn = dataset.story_column || 'Shell Object'
    const result: JointPoint[] = []

    dataset.rows.forEach((row, rowIndex) => {
      const shellObject = String(row[storyColumn] ?? '')
      const uniqueName = String(row['Unique Name'] ?? '')
      loadCases.forEach((loadCase, loadCaseIndex) => {
        const raw = row[loadCase]
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
          return
        }
        result.push({
          loadCase,
          loadCaseIndex: loadCaseIndex + seededJitter(rowIndex * 100 + loadCaseIndex, 77),
          value: useAbsoluteValue ? Math.abs(raw) : raw,
          shellObject,
          uniqueName,
        })
      })
    })

    return result
  }, [dataset.rows, dataset.story_column, loadCases, useAbsoluteValue])

  const yLabel = getYLabel(dataset.meta?.result_type, dataset.meta?.unit)
  const histogramBins = useMemo(
    () => buildHistogramBins(points.map((point) => point.value)),
    [points]
  )
  const xRange = Math.max(loadCases.length - 0.5, 0.5)

  if (!points.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted">No joint plot data available</div>
      </div>
    )
  }

  return (
    <div className="joint-results-plot flex-1 flex flex-col overflow-hidden">
      <div className="joint-results-tabs flex gap-0">
        {(['scatter', 'histogram'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'joint-results-tab px-4 py-1.5 text-base capitalize transition-colors',
              activeTab === tab
                ? 'text-accent-primary border-b-2 border-accent-primary font-medium'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 mt-2">
        {activeTab === 'scatter' ? (
          <LazyPlot
            data={[
              {
                type: 'scatter',
                mode: 'markers',
                x: points.map((point) => point.loadCaseIndex),
                y: points.map((point) => point.value),
                customdata: points.map((point) => [
                  point.loadCase,
                  point.shellObject,
                  point.uniqueName,
                ]),
                marker: {
                  color: '#f59a3e',
                  size: 5,
                  opacity: 0.75,
                },
                hovertemplate:
                  '%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]}: %{y:.3f}<extra></extra>',
              },
            ]}
            layout={withPlotlyDefaults({
              xaxis: {
                title: { text: 'Load Case', font: { size: 13 } },
                tickmode: 'array',
                tickvals: loadCases.map((_, index) => index),
                ticktext: loadCases,
                range: [-0.5, xRange],
              },
              yaxis: {
                title: { text: yLabel, font: { size: 13 } },
                zeroline: true,
                zerolinecolor: '#4a7d89',
                zerolinewidth: 1,
              },
              margin: { l: 72, r: 16, t: 6, b: 44 },
              showlegend: false,
              autosize: true,
            })}
            config={{
              displayModeBar: false,
              responsive: true,
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        ) : (
          <LazyPlot
            data={[
              {
                type: 'bar',
                x: histogramBins.map((bin) => bin.center),
                y: histogramBins.map((bin) => bin.count),
                width: histogramBins.map((bin) => bin.width),
                marker: {
                  color: 'rgba(245, 154, 62, 0.78)',
                  line: {
                    color: '#f59a3e',
                    width: 1,
                  },
                },
                hovertemplate: '%{x:.3f}<br>Count: %{y}<extra></extra>',
              },
            ]}
            layout={withPlotlyDefaults({
              xaxis: {
                title: { text: yLabel, font: { size: 13 } },
                zeroline: true,
                zerolinecolor: '#4a7d89',
                zerolinewidth: 1,
              },
              yaxis: {
                title: { text: 'Count', font: { size: 13 } },
                rangemode: 'tozero',
              },
              margin: { l: 72, r: 16, t: 6, b: 44 },
              showlegend: false,
              autosize: true,
            })}
            config={{
              displayModeBar: false,
              responsive: true,
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        )}
      </div>
    </div>
  )
}
