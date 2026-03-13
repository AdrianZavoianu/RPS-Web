import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResultsTable } from '../../src/components/results/ResultsTable'
import { makeResultDataset, makeResultDatasetMeta } from '../mocks/factories'
import type { ResultDataset } from '../../src/types'

function makeEmptyDataset(): ResultDataset {
  return {
    meta: makeResultDatasetMeta(),
    rows: [],
    load_case_columns: [],
    summary_columns: [],
    story_column: 'Story',
  }
}

describe('ResultsTable', () => {
  it('renders "No data available" for empty dataset', () => {
    render(<ResultsTable dataset={makeEmptyDataset()} />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders story column and load case columns', () => {
    const dataset = makeResultDataset()
    render(<ResultsTable dataset={dataset} />)

    // Story column header
    expect(screen.getByText('Story')).toBeInTheDocument()
    // Load case headers
    expect(screen.getByText('TH 01')).toBeInTheDocument()
    expect(screen.getByText('TH 02')).toBeInTheDocument()
    // Summary header
    expect(screen.getByText('Avg')).toBeInTheDocument()
    // Story values
    expect(screen.getByText('L3')).toBeInTheDocument()
    expect(screen.getByText('L2')).toBeInTheDocument()
    expect(screen.getByText('L1')).toBeInTheDocument()
  })

  it('formats values according to result type', () => {
    const dataset = makeResultDataset({
      meta: makeResultDatasetMeta({ result_type: 'Drifts' }),
    })
    render(<ResultsTable dataset={dataset} />)

    // Drifts uses 2 decimal places
    // 0.15 appears as both a load case value and a summary value
    expect(screen.getAllByText('0.15').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('0.22')).toBeInTheDocument()
  })

  it('renders gradient-colored values when showGradient is true', () => {
    const dataset = makeResultDataset()
    const { container } = render(<ResultsTable dataset={dataset} showGradient={true} />)

    // Values should have color style
    const valueSpans = container.querySelectorAll('.results-table-value')
    expect(valueSpans.length).toBeGreaterThan(0)

    // At least one value should have a color style
    const hasColoredValue = Array.from(valueSpans).some(
      (span) => (span as HTMLElement).style.color !== ''
    )
    expect(hasColoredValue).toBe(true)
  })

  it('does not render gradient when showGradient is false', () => {
    const dataset = makeResultDataset()
    const { container } = render(<ResultsTable dataset={dataset} showGradient={false} />)

    const valueSpans = container.querySelectorAll('.results-table-value')
    const hasColoredValue = Array.from(valueSpans).some(
      (span) => (span as HTMLElement).style.color !== ''
    )
    expect(hasColoredValue).toBe(false)
  })

  it('calls onSelectionChange when load case header is clicked', () => {
    const onSelectionChange = vi.fn()
    const dataset = makeResultDataset()

    render(
      <ResultsTable
        dataset={dataset}
        onSelectionChange={onSelectionChange}
      />
    )

    // Click on TH 01 header
    fireEvent.click(screen.getByText('TH 01'))
    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    const selectedSet = onSelectionChange.mock.calls[0][0] as Set<string>
    expect(selectedSet.has('TH 01')).toBe(true)
  })

  it('toggles selection off when already selected', () => {
    const onSelectionChange = vi.fn()
    const dataset = makeResultDataset()

    render(
      <ResultsTable
        dataset={dataset}
        selectedLoadCases={new Set(['TH 01'])}
        onSelectionChange={onSelectionChange}
      />
    )

    // Click on already-selected TH 01 header
    fireEvent.click(screen.getByText('TH 01'))
    const selectedSet = onSelectionChange.mock.calls[0][0] as Set<string>
    expect(selectedSet.has('TH 01')).toBe(false)
  })

  it('applies selected class to selected column headers', () => {
    const dataset = makeResultDataset()
    const { container } = render(
      <ResultsTable
        dataset={dataset}
        selectedLoadCases={new Set(['TH 01'])}
      />
    )

    const selectedHeaders = container.querySelectorAll('.results-table-header-selected')
    expect(selectedHeaders.length).toBeGreaterThanOrEqual(1)
  })

  it('applies hovered class to hovered column header', () => {
    const dataset = makeResultDataset()
    const { container } = render(
      <ResultsTable
        dataset={dataset}
        hoveredLoadCase="TH 02"
      />
    )

    const hoveredHeaders = container.querySelectorAll('.results-table-header-hovered')
    expect(hoveredHeaders.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onHoverChange on header mouse enter/leave', () => {
    const onHoverChange = vi.fn()
    const dataset = makeResultDataset()

    render(
      <ResultsTable
        dataset={dataset}
        onHoverChange={onHoverChange}
      />
    )

    const th01Header = screen.getByText('TH 01').closest('th')!
    fireEvent.mouseEnter(th01Header)
    expect(onHoverChange).toHaveBeenCalledWith('TH 01')

    fireEvent.mouseLeave(th01Header)
    expect(onHoverChange).toHaveBeenCalledWith(null)
  })

  it('applies hovered row class', () => {
    const dataset = makeResultDataset()
    const { container } = render(
      <ResultsTable
        dataset={dataset}
        hoveredRow={1}
      />
    )

    const hoveredRows = container.querySelectorAll('.results-table-row-hovered')
    expect(hoveredRows).toHaveLength(1)
  })

  it('calls onRowHoverChange on story cell hover', () => {
    const onRowHoverChange = vi.fn()
    const dataset = makeResultDataset()

    render(
      <ResultsTable
        dataset={dataset}
        onRowHoverChange={onRowHoverChange}
      />
    )

    // Get a story cell (first column cells)
    const storyCells = screen.getAllByText(/^L\d$/)
    fireEvent.mouseEnter(storyCells[0].closest('td')!)
    expect(onRowHoverChange).toHaveBeenCalledWith(0)

    fireEvent.mouseLeave(storyCells[0].closest('td')!)
    expect(onRowHoverChange).toHaveBeenCalledWith(null)
  })

  it('calls onRowSelectionChange on story cell click', () => {
    const onRowSelectionChange = vi.fn()
    const dataset = makeResultDataset()

    render(
      <ResultsTable
        dataset={dataset}
        onRowSelectionChange={onRowSelectionChange}
      />
    )

    const storyCells = screen.getAllByText(/^L\d$/)
    fireEvent.click(storyCells[0].closest('td')!)
    expect(onRowSelectionChange).toHaveBeenCalledTimes(1)
    const selectedSet = onRowSelectionChange.mock.calls[0][0] as Set<number>
    expect(selectedSet.has(0)).toBe(true)
  })

  it('renders with custom story column name', () => {
    const dataset = makeResultDataset({
      story_column: 'Level',
      rows: [
        { Level: 'Floor 3', 'TH 01': 0.1, 'TH 02': 0.2, Avg: 0.15 },
      ],
    })

    render(<ResultsTable dataset={dataset} />)
    expect(screen.getByText('Level')).toBeInTheDocument()
    expect(screen.getByText('Floor 3')).toBeInTheDocument()
  })

  it('renders null/undefined values as dash', () => {
    const dataset = makeResultDataset({
      rows: [
        { Story: 'L1', 'TH 01': null, 'TH 02': 0.5, Avg: 0.5 },
      ],
    })

    render(<ResultsTable dataset={dataset} />)
    expect(screen.getByText('-')).toBeInTheDocument()
  })
})
