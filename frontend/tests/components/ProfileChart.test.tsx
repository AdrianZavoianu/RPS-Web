import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { PlotParams } from 'react-plotly.js'
import { makeResultDataset, makeResultDatasetMeta } from '../mocks/factories'

// Capture props passed to LazyPlot
let capturedProps: PlotParams | null = null

vi.mock('../../src/components/charts/LazyPlot', () => ({
  LazyPlot: (props: PlotParams) => {
    capturedProps = props
    return <div data-testid="mock-plot" />
  },
}))

import {
  MultiSeriesProfileChart,
  ProfileChart,
  PushoverCurveChart,
} from '../../src/components/charts/ProfileChart'

describe('MultiSeriesProfileChart', () => {
  it('generates traces for each load case plus average', () => {
    const dataset = makeResultDataset()

    render(<MultiSeriesProfileChart dataset={dataset} />)

    expect(capturedProps).not.toBeNull()
    const data = capturedProps!.data
    // 2 load cases (TH 01, TH 02) + 1 Avg = 3 traces
    expect(data).toHaveLength(3)
    expect((data[0] as { name: string }).name).toBe('TH 01')
    expect((data[1] as { name: string }).name).toBe('TH 02')
    expect((data[2] as { name: string }).name).toBe('Avg')
  })

  it('sets dashed line for average trace', () => {
    const dataset = makeResultDataset()

    render(<MultiSeriesProfileChart dataset={dataset} />)

    const avgTrace = capturedProps!.data[2] as { line: { dash: string } }
    expect(avgTrace.line.dash).toBe('dash')
  })

  it('dims non-selected traces when selection exists', () => {
    const dataset = makeResultDataset()
    const selected = new Set(['TH 01'])

    render(<MultiSeriesProfileChart dataset={dataset} selectedLoadCases={selected} />)

    const th01 = capturedProps!.data[0] as { opacity: number; line: { width: number } }
    const th02 = capturedProps!.data[1] as { opacity: number; line: { width: number } }

    // Selected: full opacity, width 3
    expect(th01.opacity).toBe(1)
    expect(th01.line.width).toBe(3)

    // Not selected: dimmed
    expect(th02.opacity).toBe(0.25)
    expect(th02.line.width).toBe(1.5)
  })

  it('highlights hovered trace with thicker line and dims others', () => {
    const dataset = makeResultDataset()

    render(<MultiSeriesProfileChart dataset={dataset} hoveredLoadCase="TH 02" />)

    const th01 = capturedProps!.data[0] as { opacity: number; line: { width: number } }
    const th02 = capturedProps!.data[1] as { opacity: number; line: { width: number } }

    // Hovered: width 4
    expect(th02.opacity).toBe(1)
    expect(th02.line.width).toBe(4)

    // Not hovered: dimmed
    expect(th01.opacity).toBe(0.35)
    expect(th01.line.width).toBe(1.5)
  })

  it('sets story axis range with padding', () => {
    const dataset = makeResultDataset() // 3 stories: L3, L2, L1

    render(<MultiSeriesProfileChart dataset={dataset} />)

    const layout = capturedProps!.layout as { yaxis: { range: [number, number] } }
    // range = [0, storyCount - 1 + 0.2] = [0, 2.2]
    expect(layout.yaxis.range[0]).toBe(0)
    expect(layout.yaxis.range[1]).toBeCloseTo(2.2)
  })

  it('uses decimals from meta for hover format', () => {
    const dataset = makeResultDataset({
      meta: makeResultDatasetMeta({ decimals: 3 }),
    })

    render(<MultiSeriesProfileChart dataset={dataset} />)

    const trace = capturedProps!.data[0] as { hovertemplate: string }
    expect(trace.hovertemplate).toContain('.3f')
  })

  it('renders without crashing on empty dataset', () => {
    const dataset = makeResultDataset({
      rows: [],
      load_case_columns: [],
      summary_columns: [],
    })

    render(<MultiSeriesProfileChart dataset={dataset} />)

    expect(capturedProps).not.toBeNull()
    expect(capturedProps!.data).toHaveLength(0)
  })

  it('renders legend items for load cases and average', () => {
    const dataset = makeResultDataset()

    render(<MultiSeriesProfileChart dataset={dataset} />)

    expect(screen.getByText('TH 01')).toBeInTheDocument()
    expect(screen.getByText('TH 02')).toBeInTheDocument()
    expect(screen.getByText('Avg')).toBeInTheDocument()
  })
})

describe('ProfileChart', () => {
  it('renders single-series ChartData format', () => {
    render(
      <ProfileChart
        data={{
          stories: ['L3', 'L2', 'L1'],
          values: [0.15, 0.31, 0.12],
          result_type: 'Drifts',
          direction: 'X',
          column: 'TH 01',
          unit: '%',
          decimals: 2,
        }}
      />
    )

    expect(capturedProps).not.toBeNull()
    expect(capturedProps!.data).toHaveLength(1)
    const trace = capturedProps!.data[0] as { y: string[]; x: number[] }
    expect(trace.y).toEqual(['L3', 'L2', 'L1'])
    expect(trace.x).toEqual([0.15, 0.31, 0.12])
  })

  it('renders multi-series ProfileChartData format', () => {
    render(
      <ProfileChart
        data={{
          stories: ['L3', 'L2', 'L1'],
          series: [
            { name: 'Max', values: [0.2, 0.4, 0.15] },
            { name: 'Min', values: [0.05, 0.1, 0.03] },
          ],
          unit: '%',
          title: 'Drifts X',
        }}
      />
    )

    expect(capturedProps).not.toBeNull()
    expect(capturedProps!.data).toHaveLength(2)
    const maxTrace = capturedProps!.data[0] as { name: string; line: { dash: string } }
    const minTrace = capturedProps!.data[1] as { name: string; line: { dash: string } }
    expect(maxTrace.name).toBe('Max')
    expect(maxTrace.line.dash).toBe('solid')
    expect(minTrace.name).toBe('Min')
    expect(minTrace.line.dash).toBe('dash')
  })
})

describe('PushoverCurveChart', () => {
  it('renders pushover curve with displacement and shear', () => {
    const points = [
      { displacement: 0, base_shear: 0 },
      { displacement: 10, base_shear: 500 },
      { displacement: 20, base_shear: 800 },
    ]

    render(<PushoverCurveChart points={points} caseName="Push X+" />)

    expect(capturedProps).not.toBeNull()
    expect(capturedProps!.data).toHaveLength(1)
    const trace = capturedProps!.data[0] as { x: number[]; y: number[]; name: string }
    expect(trace.x).toEqual([0, 10, 20])
    expect(trace.y).toEqual([0, 500, 800])
    expect(trace.name).toBe('Push X+')
  })
})
