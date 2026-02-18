import { describe, expect, it } from 'vitest'

import {
  PLOTLY_CONFIG_NO_MODE_BAR,
  createAxisLayout,
  withPlotlyDefaults,
} from '../src/utils/plotlyDefaults'

describe('plotly defaults', () => {
  it('keeps mode bar disabled and responsive enabled', () => {
    expect(PLOTLY_CONFIG_NO_MODE_BAR).toEqual({
      displayModeBar: false,
      responsive: true,
    })
  })

  it('applies base axis defaults and override fields', () => {
    const axis = createAxisLayout({
      title: 'Drift',
      zeroline: true,
      linewidth: 4,
    })

    expect(axis.gridcolor).toBe('rgba(60, 65, 75, 0.3)')
    expect(axis.linecolor).toBe('#3a3f4a')
    expect(axis.linewidth).toBe(4)
    expect(axis.title).toBe('Drift')
    expect(axis.zeroline).toBe(true)
  })

  it('injects plotly defaults while preserving explicit layout fields', () => {
    const layout = withPlotlyDefaults({
      title: 'Test Plot',
      showlegend: true,
      font: { family: 'Menlo' },
      xaxis: { title: 'X Axis' },
    })

    expect(layout.paper_bgcolor).toBe('#0a0c10')
    expect(layout.plot_bgcolor).toBe('rgba(22, 27, 34, 0.5)')
    expect(layout.autosize).toBe(true)
    expect(layout.showlegend).toBe(true)
    expect(layout.title).toBe('Test Plot')
    expect(layout.font).toEqual({
      color: '#d1d5db',
      size: 11,
      family: 'Menlo',
    })
    expect(layout.xaxis).toMatchObject({
      title: 'X Axis',
      linecolor: '#3a3f4a',
      mirror: true,
    })
  })

  it('does not inject axes when not provided', () => {
    const layout = withPlotlyDefaults({ title: 'No axes' })
    expect(layout.xaxis).toBeUndefined()
    expect(layout.yaxis).toBeUndefined()
  })
})

