// Light-mode fallbacks (used when CSS vars are not available)
export const PAPER_BG = '#e8ecf1'
export const PLOT_BG = '#ffffff'
export const PLOT_BG_SOLID = '#f8fafc'
export const TEXT_COLOR = '#374151'
export const GRID_COLOR = 'rgba(148, 163, 184, 0.35)'
export const AXIS_LINE_COLOR = '#cbd5e1'
export const ZERO_LINE_COLOR = '#4a7d89'
export const ACCENT_ZERO_LINE_COLOR = '#4a90d9'

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** Theme-reactive chart colors - call at render time */
export function getChartColors() {
  return {
    paperBg: cssVar('--chart-paper-bg', PAPER_BG),
    plotBg: cssVar('--chart-plot-bg', PLOT_BG),
    plotBgSolid: cssVar('--chart-plot-bg-solid', PLOT_BG_SOLID),
    textColor: cssVar('--chart-text-color', TEXT_COLOR),
    gridColor: cssVar('--chart-grid-color', GRID_COLOR),
    axisLineColor: cssVar('--chart-axis-line-color', AXIS_LINE_COLOR),
  }
}

export const AVERAGE_LINE_COLOR = '#ffa500'
export const PROFILE_COLOR = '#4a7d89'
export const MAX_ENVELOPE_COLOR = '#e74c3c'
export const MIN_ENVELOPE_COLOR = '#3498db'
export const ACCEL_LINE_COLOR = '#6b7280'
export const MARKER_COLOR = '#e74c3c'

export const PROFILE_SERIES_PALETTE = [
  '#ff4757',
  '#1e90ff',
  '#2ed573',
  '#ff6348',
  '#a29bfe',
  '#00d2d3',
  '#ffa502',
  '#ff6b81',
  '#5f27cd',
  '#01a3a4',
  '#48dbfb',
  '#c44569',
  '#f8b500',
] as const

export const COMPARISON_SERIES_PALETTE = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
] as const

export const ROTATION_COMPARISON_PALETTE = [
  '#3b82f6',
  '#f97316',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#ef4444',
] as const

export const PUSHOVER_MULTI_PALETTE = [
  '#4a7d89',
  '#e07a5f',
  '#81b29a',
  '#f2cc8f',
  '#3d405b',
  '#7209b7',
  '#f72585',
  '#4cc9f0',
  '#f4a261',
  '#2a9d8f',
] as const

export const GRADIENT_BLUE_RGB = [59, 130, 246] as const
export const GRADIENT_ORANGE_RGB = [251, 146, 60] as const
export const GRADIENT_AMBER_RGB = [245, 158, 11] as const
export const CYAN_HIGHLIGHT_RGB = [103, 232, 249] as const
