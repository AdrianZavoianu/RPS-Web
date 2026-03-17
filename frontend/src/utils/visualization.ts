import type { HistogramBin } from '../types'

export function seededJitter(index: number, seed: number): number {
  const raw = ((index + 1) * 9301 + seed * 49297) % 233280
  return (raw / 233280 - 0.5) * 0.6
}

export function buildHistogramBins(values: number[], binsCount = 50): HistogramBin[] {
  if (!values.length) return []
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  if (maxValue === minValue) {
    return [{ start: minValue - 0.5, end: maxValue + 0.5, center: minValue, count: values.length }]
  }
  const width = (maxValue - minValue) / binsCount
  const counts = new Array<number>(binsCount).fill(0)
  values.forEach((value) => {
    let index = Math.floor((value - minValue) / width)
    if (index >= binsCount) index = binsCount - 1
    counts[index] += 1
  })
  return counts.map((count, idx) => {
    const start = minValue + idx * width
    const end = start + width
    return { start, end, center: (start + end) / 2, count }
  })
}
