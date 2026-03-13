/**
 * Time-Series View component
 * 4-panel animated building profile for NLTHA results,
 * replicating the desktop application's time-series visualization.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import clsx from 'clsx'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  useResultSets,
  useTimeSeriesLoadCases,
  useTimeSeriesAllTypes,
} from '../../hooks/useResults'
import { LazyPlot } from '../charts/LazyPlot'
import { ResultsTreeBrowser, type TreeSelection } from '../projects/ResultsTreeBrowser'
import { isNlthaResultSet } from '../../utils/resultSets'
import { useThemeStore } from '../../stores/themeStore'
import {
  ACCEL_LINE_COLOR,
  getChartColors,
  MARKER_COLOR,
  MAX_ENVELOPE_COLOR,
  MIN_ENVELOPE_COLOR,
  PROFILE_COLOR,
} from '../../utils/colors'
import {
  PLOTLY_CONFIG_NO_MODE_BAR,
  createAxisLayout,
  withPlotlyDefaults,
} from '../../utils/plotlyDefaults'

// --- Constants ---

const RESULT_TYPES = ['Displacements', 'Drifts', 'Accelerations', 'Shears'] as const
const RESULT_TYPE_KEYS: Record<string, string> = {
  Displacements: 'Displacements',
  Drifts: 'Drifts',
  Accelerations: 'Accelerations',
  Shears: 'Forces',
}

const SPEED_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
const DEFAULT_SPEED_INDEX = 3 // 1.0x

// Base interval in ms at 1x speed. Each sub-frame advances 1/4 step.
// At 1x: 50ms per sub-frame = 200ms per full step
const BASE_SUBFRAME_MS = 50
const SUB_FRAMES = 4

const STORY_AXIS_TOP_PADDING = 0.2

// --- Imperative animation helpers (pure functions, no React) ---

function computeProfileAt(
  typesData: Record<string, Record<string, number[]>>,
  resultType: string,
  position: number,
  totalSteps: number,
  stories: string[]
): number[] | null {
  const typeData = typesData[resultType]
  if (!typeData) return null
  const stepIndex = Math.floor(position)
  const frac = position - stepIndex
  const nextIndex = Math.min(stepIndex + 1, totalSteps - 1)
  return stories.map((story) => {
    const vals = typeData[story]
    if (!vals) return 0
    const curr = vals[stepIndex] ?? 0
    if (frac === 0 || stepIndex === nextIndex) return curr
    const next = vals[nextIndex] ?? 0
    return curr + frac * (next - curr)
  })
}

function interpolateTimeAt(timeSteps: number[], position: number): number {
  if (timeSteps.length === 0) return 0
  const stepIndex = Math.floor(position)
  const frac = position - stepIndex
  const nextIndex = Math.min(stepIndex + 1, timeSteps.length - 1)
  const curr = timeSteps[stepIndex] ?? 0
  const next = timeSteps[nextIndex] ?? 0
  return curr + frac * (next - curr)
}

// --- Types ---

interface TimeSeriesViewProps {
  projectSlug: string
}

interface EnvelopeData {
  maxValues: number[]
  minValues: number[]
}

// --- Component ---

export function TimeSeriesView({ projectSlug }: TimeSeriesViewProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const preselectionAppliedFor = useRef<string | null>(null)
  // Selection state
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedLoadCase, setSelectedLoadCase] = useState<string | null>(null)
  const [selectedDirection, setSelectedDirection] = useState<string>('X')

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(0) // float: integer part=step, fractional=interp
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX)
  const animationRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number>(0)

  // Imperative animation refs — bypass React during playback
  const positionRef = useRef(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plotlyRef = useRef<any>(null)
  const profileGdRefs = useRef<Record<string, HTMLElement>>({})
  const baseAccelGdRef = useRef<HTMLElement | null>(null)
  const sliderRef = useRef<HTMLInputElement>(null)
  const timeDisplayRef = useRef<HTMLSpanElement>(null)

  // Data fetching
  const { data: resultSets } = useResultSets(projectSlug)
  const { data: loadCasesData } = useTimeSeriesLoadCases(
    projectSlug,
    selectedResultSetId || undefined
  )
  const nlthaResultSets = useMemo(
    () => (resultSets || []).filter(isNlthaResultSet),
    [resultSets]
  )
  const preselectedParams = useMemo(() => {
    const search = new URLSearchParams(location.search)
    const resultSetIdRaw = search.get('result_set_id')
    const directionRaw = search.get('direction')
    const loadCaseRaw = search.get('load_case')

    const parsedResultSetId = resultSetIdRaw ? Number(resultSetIdRaw) : null
    const direction =
      directionRaw && ['X', 'Y'].includes(directionRaw.toUpperCase())
        ? directionRaw.toUpperCase()
        : null

    return {
      resultSetId: Number.isFinite(parsedResultSetId) ? parsedResultSetId : null,
      direction,
      loadCase: loadCaseRaw || null,
    }
  }, [location.search])

  const { data: allTypesData, isLoading: dataLoading } = useTimeSeriesAllTypes(
    projectSlug,
    selectedResultSetId && selectedLoadCase
      ? {
          result_set_id: selectedResultSetId,
          load_case: selectedLoadCase,
          direction: selectedDirection,
        }
      : null
  )

  // Auto-select first result set
  useEffect(() => {
    if (nlthaResultSets.length && !selectedResultSetId) {
      setSelectedResultSetId(nlthaResultSets[0].id)
    }
  }, [nlthaResultSets, selectedResultSetId])

  useEffect(() => {
    if (!location.search || preselectionAppliedFor.current === location.search) {
      return
    }

    if (
      preselectedParams.resultSetId &&
      nlthaResultSets.some((resultSet) => resultSet.id === preselectedParams.resultSetId)
    ) {
      setSelectedResultSetId(preselectedParams.resultSetId)
    }

    if (preselectedParams.direction) {
      setSelectedDirection(preselectedParams.direction)
    }

    if (preselectedParams.loadCase) {
      setSelectedLoadCase(preselectedParams.loadCase)
    }

    preselectionAppliedFor.current = location.search
  }, [location.search, nlthaResultSets, preselectedParams])

  const loadCases = useMemo(() => loadCasesData?.load_cases ?? [], [loadCasesData])

  // Keep load-case selection valid when result set / data changes.
  useEffect(() => {
    if (!loadCases.length) {
      if (selectedLoadCase !== null) {
        setSelectedLoadCase(null)
      }
      return
    }

    if (!selectedLoadCase || !loadCases.includes(selectedLoadCase)) {
      setSelectedLoadCase(loadCases[0])
    }
  }, [loadCases, selectedLoadCase])

  // Reset load case when result set changes
  useEffect(() => {
    setCurrentPosition(0)
    setIsPlaying(false)
  }, [selectedResultSetId])

  // Reset position when data changes
  useEffect(() => {
    setCurrentPosition(0)
    setIsPlaying(false)
  }, [allTypesData])

  // Load Plotly module for imperative calls (resolves from cache, effectively free)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('../charts/PlotlyComponent').then((mod: any) => {
      plotlyRef.current = mod.Plotly
    })
  }, [])

  // Resize all plots when tab becomes visible (browser may report 0-height for hidden tabs)
  useEffect(() => {
    const resizeAll = () => {
      const Plotly = plotlyRef.current
      if (!Plotly) return
      for (const rt of RESULT_TYPES) {
        const gd = profileGdRefs.current[rt]
        if (gd) Plotly.Plots.resize(gd)
      }
      const baseGd = baseAccelGdRef.current
      if (baseGd) Plotly.Plots.resize(baseGd)
    }
    const handleVisibility = () => {
      if (!document.hidden) requestAnimationFrame(resizeAll)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Keep positionRef in sync with React state (for non-animation state changes)
  useEffect(() => {
    positionRef.current = currentPosition
  }, [currentPosition])

  const stories = useMemo(() => allTypesData?.stories ?? [], [allTypesData?.stories])
  const timeSteps = useMemo(() => allTypesData?.time_steps ?? [], [allTypesData?.time_steps])
  const totalSteps = timeSteps.length

  // Envelope values are precomputed by backend to avoid heavy client-side scans.
  const envelopes = useMemo(() => {
    if (!allTypesData?.envelopes) return {} as Record<string, EnvelopeData>
    const result: Record<string, EnvelopeData> = {}
    for (const [resultType, envelope] of Object.entries(allTypesData.envelopes)) {
      result[resultType] = {
        maxValues: envelope.max_values ?? [],
        minValues: envelope.min_values ?? [],
      }
    }
    return result
  }, [allTypesData?.envelopes])

  // Animation loop — imperative Plotly updates, zero React re-renders per frame
  const speedMultiplier = SPEED_LEVELS[speedIndex]
  const maxPosition = totalSteps > 0 ? totalSteps - 1 : 0

  // Stable refs read inside animate — prevents callback recreation on speed/data changes
  const speedRef = useRef(speedMultiplier)
  speedRef.current = speedMultiplier
  const maxPosRef = useRef(maxPosition)
  maxPosRef.current = maxPosition
  const dataRef = useRef(allTypesData)
  dataRef.current = allTypesData
  const totalStepsRef = useRef(totalSteps)
  totalStepsRef.current = totalSteps
  const storiesRef = useRef(stories)
  storiesRef.current = stories
  const timeStepsRef = useRef(timeSteps)
  timeStepsRef.current = timeSteps

  const animate = useCallback(
    (timestamp: number) => {
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = timestamp
      }

      const elapsed = timestamp - lastFrameTimeRef.current
      const frameInterval = BASE_SUBFRAME_MS / speedRef.current

      if (elapsed >= frameInterval) {
        lastFrameTimeRef.current = timestamp

        const maxPos = maxPosRef.current
        let nextPos = positionRef.current + 1 / SUB_FRAMES
        if (nextPos >= maxPos) {
          nextPos = maxPos
          positionRef.current = nextPos
          setCurrentPosition(nextPos)
          setIsPlaying(false)
          return
        }
        positionRef.current = nextPos

        // Imperative Plotly updates (no React re-render)
        const Plotly = plotlyRef.current
        const data = dataRef.current
        if (Plotly && data) {
          const strs = storiesRef.current
          const total = totalStepsRef.current
          for (const rt of RESULT_TYPES) {
            const dataKey = RESULT_TYPE_KEYS[rt]
            const gd = profileGdRefs.current[rt]
            if (!gd) continue
            const profile = computeProfileAt(data.types, dataKey, nextPos, total, strs)
            if (profile) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const traceCount = (gd as any).data?.length ?? 0
              if (traceCount > 0) {
                Plotly.restyle(gd, { x: [profile] }, [traceCount - 1])
              }
            }
          }

          const baseGd = baseAccelGdRef.current
          if (baseGd) {
            const steps = timeStepsRef.current
            const time = interpolateTimeAt(steps, nextPos)
            Plotly.relayout(baseGd, {
              'shapes[0].x1': time,
              'shapes[1].x0': time,
              'shapes[1].x1': time,
            })
          }
        }

        // Update slider and time display via DOM (no React re-render)
        if (sliderRef.current) {
          sliderRef.current.value = String(nextPos)
        }
        if (timeDisplayRef.current) {
          const steps = timeStepsRef.current
          const time = interpolateTimeAt(steps, nextPos)
          timeDisplayRef.current.textContent = time.toFixed(3) + 's'
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // All values read from refs — stable callback, never recreated
  )

  useEffect(() => {
    if (isPlaying) {
      lastFrameTimeRef.current = 0
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [isPlaying, animate])

  // Handlers
  const handlePlayPause = () => {
    if (currentPosition >= maxPosition) {
      setCurrentPosition(0)
    }
    setIsPlaying(!isPlaying)
  }

  const handleReset = () => {
    setIsPlaying(false)
    setCurrentPosition(0)
  }

  const handleSliderChange = (value: number) => {
    setIsPlaying(false)
    setCurrentPosition(Math.max(0, Math.min(value, maxPosition)))
  }

  const handleSlower = () => {
    if (isPlaying) setCurrentPosition(positionRef.current)
    setSpeedIndex((prev) => Math.max(0, prev - 1))
  }

  const handleFaster = () => {
    if (isPlaying) setCurrentPosition(positionRef.current)
    setSpeedIndex((prev) => Math.min(SPEED_LEVELS.length - 1, prev + 1))
  }

  // Interpolated values for a result type at current position
  const getInterpolatedProfile = useCallback(
    (resultType: string): number[] | null => {
      if (!allTypesData) return null
      const typeData = allTypesData.types[resultType]
      if (!typeData) return null

      const stepIndex = Math.floor(currentPosition)
      const frac = currentPosition - stepIndex
      const nextIndex = Math.min(stepIndex + 1, totalSteps - 1)

      return stories.map((story) => {
        const vals = typeData[story]
        if (!vals) return 0
        const curr = vals[stepIndex] ?? 0
        if (frac === 0 || stepIndex === nextIndex) return curr
        const next = vals[nextIndex] ?? 0
        return curr + frac * (next - curr)
      })
    },
    [allTypesData, currentPosition, totalSteps, stories]
  )

  // Current time (interpolated)
  const currentTime = useMemo(() => {
    if (timeSteps.length === 0) return 0
    const stepIndex = Math.floor(currentPosition)
    const frac = currentPosition - stepIndex
    const nextIndex = Math.min(stepIndex + 1, timeSteps.length - 1)
    const curr = timeSteps[stepIndex] ?? 0
    const next = timeSteps[nextIndex] ?? 0
    return curr + frac * (next - curr)
  }, [currentPosition, timeSteps])

  // Base acceleration: lowest story's Accelerations time series
  const baseAccelData = useMemo(() => {
    if (!allTypesData) return null
    const accelData = allTypesData.types['Accelerations']
    if (!accelData) return null
    // Base story is the last in the array (lowest sort order)
    const baseStory = stories[stories.length - 1]
    if (!baseStory || !accelData[baseStory]) return null
    return accelData[baseStory]
  }, [allTypesData, stories])

  // Force Plotly resize after init — flex layout may not have settled when Plotly first reads dimensions
  const handleProfilePlotInit = useCallback((rt: string, gd: HTMLElement) => {
    profileGdRefs.current[rt] = gd
    requestAnimationFrame(() => {
      plotlyRef.current?.Plots?.resize(gd)
    })
  }, [])

  const handleBaseAccelPlotInit = useCallback((gd: HTMLElement) => {
    baseAccelGdRef.current = gd
    requestAnimationFrame(() => {
      plotlyRef.current?.Plots?.resize(gd)
    })
  }, [])

  const hasData = allTypesData && Object.keys(allTypesData.types).length > 0
  const currentTreeSelection = useMemo<TreeSelection | null>(() => {
    if (!selectedResultSetId || !selectedLoadCase) return null
    return {
      type: 'time_series',
      resultSetId: selectedResultSetId,
      category: 'Time-Series',
      categoryType: 'Global',
      resultType: 'Drifts',
      direction: selectedDirection === 'Y' ? 'Y' : 'X',
      loadCaseName: selectedLoadCase,
    }
  }, [selectedDirection, selectedLoadCase, selectedResultSetId])

  const handleTreeSelect = useCallback((selection: TreeSelection) => {
    if (selection.type !== 'time_series') {
      const query = selection.resultSetId > 0
        ? `?result_set_id=${selection.resultSetId}`
        : ''
      navigate(`/projects/${projectSlug}/results${query}`)
      return
    }

    setSelectedResultSetId(selection.resultSetId)
    if (selection.loadCaseName) {
      setSelectedLoadCase(selection.loadCaseName)
    }
    setSelectedDirection(selection.direction === 'Y' ? 'Y' : 'X')

    const query = new URLSearchParams({
      result_set_id: String(selection.resultSetId),
      direction: selection.direction === 'Y' ? 'Y' : 'X',
    })
    if (selection.loadCaseName) {
      query.set('load_case', selection.loadCaseName)
    }
    navigate(`/projects/${projectSlug}/time-series?${query.toString()}`)
  }, [navigate, projectSlug])

  const titleText = hasData
    ? `Time-Series Global Results - ${selectedDirection} Direction (${selectedLoadCase})`
    : 'Time-Series Global Results'

  return (
    <div className="time-series-view h-full flex">
      <div className="w-[200px] min-w-[200px] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <ResultsTreeBrowser
            projectSlug={projectSlug}
            currentSelection={currentTreeSelection}
            onSelect={handleTreeSelect}
            disableInitialAutoSelect
            resultSetRootSelectsDefault={false}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="time-series-content flex-1 min-w-0 min-h-0 overflow-hidden">
        {hasData ? (
          <div className="ts-data-grid h-full flex flex-col">
            {/* Compact title */}
            <div className="ts-title flex items-center px-3 py-2">
              <h2 className="text-[16px] font-medium text-text-primary tracking-wide">
                {titleText}
              </h2>
            </div>

            {/* Column labels */}
            <div className="flex items-center px-3">
              <div className="flex flex-1 min-w-0">
                {RESULT_TYPES.map((rt) => (
                  <div key={rt} className="flex-1 text-center">
                    <span className="text-[13px] font-medium text-text-secondary">{rt}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 profile plots — flex-1 fills remaining vertical space */}
            <div className="ts-plots-row flex-1 min-h-0 min-w-0 flex gap-0.5 px-3 pt-1">
              {RESULT_TYPES.map((rt) => {
                const dataKey = RESULT_TYPE_KEYS[rt]
                const profile = getInterpolatedProfile(dataKey)
                const envelope = envelopes[dataKey]
                const unit = allTypesData?.units?.[dataKey] || ''

                return (
                  <ProfilePlot
                    key={rt}
                    resultType={rt}
                    unit={unit}
                    stories={stories}
                    profile={profile}
                    envelope={envelope}
                    onPlotInit={(gd) => handleProfilePlotInit(rt, gd)}
                  />
                )
              })}
            </div>

            {/* Base acceleration plot */}
            {baseAccelData && (
              <div className="px-3 pt-1">
                <div className="text-center">
                  <span className="text-[12px] text-text-muted">Base Story Acceleration</span>
                </div>
                <div className="ts-base-plot overflow-hidden" style={{ height: 'clamp(64px, 12vh, 120px)' }}>
                  <BaseAccelerationPlot
                    timeSteps={timeSteps}
                    values={baseAccelData}
                    currentTime={currentTime}
                    onPlotInit={handleBaseAccelPlotInit}
                  />
                </div>
              </div>
            )}

            {/* Controls bar */}
            <div className="ts-controls flex items-center gap-3 mx-3 my-2 px-3 py-1.5 text-[13px]">
              {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                className={clsx(
                  'ts-play-btn px-3 py-1 rounded text-[13px] font-medium transition-colors',
                  isPlaying
                    ? 'bg-red-500/80 text-white hover:bg-red-500'
                    : 'bg-accent-primary text-white hover:opacity-90'
                )}
              >
                {isPlaying ? 'Pause' : '> Play'}
              </button>

              {/* Reset */}
              <button
                onClick={handleReset}
                className="ts-reset-btn px-2 py-1 rounded text-[13px] text-text-secondary hover:text-text-primary transition-colors"
              >
                {'< Reset'}
              </button>

              {/* Slider */}
              <div className="flex-1 flex items-center">
                <input
                  ref={sliderRef}
                  type="range"
                  min={0}
                  max={maxPosition}
                  step={0.25}
                  value={currentPosition}
                  onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-border-default rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
                />
              </div>

              {/* Time display */}
              <span className="text-text-muted min-w-[90px] text-center">
                Time: <span ref={timeDisplayRef} className="font-mono text-text-primary">{currentTime.toFixed(3)}s</span>
              </span>

              {/* Speed controls */}
              <button
                onClick={handleSlower}
                disabled={speedIndex === 0}
                className="text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
              >
                {'<< Slower'}
              </button>

              <span className="font-mono text-text-primary min-w-[40px] text-center">
                {speedMultiplier}x
              </span>

              <button
                onClick={handleFaster}
                disabled={speedIndex === SPEED_LEVELS.length - 1}
                className="text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
              >
                {'Faster >>'}
              </button>
            </div>
          </div>
        ) : dataLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-text-secondary text-[16px]">Loading time-series data...</div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-text-secondary text-[16px] mb-2">Select a load case to view time-series data</p>
              <p className="text-text-muted text-[14px]">
                Time-series data is available for NLTHA analysis results
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Profile Plot Sub-Component ---

interface ProfilePlotProps {
  resultType: string
  unit: string
  stories: string[]
  profile: number[] | null
  envelope: EnvelopeData | undefined
  onPlotInit?: (graphDiv: HTMLElement) => void
}

function ProfilePlot({ resultType, unit, stories, profile, envelope, onPlotInit }: ProfilePlotProps) {
  const theme = useThemeStore((s) => s.theme)
  const traces = useMemo(() => {
    const t: Plotly.Data[] = []

    // Max envelope
    if (envelope) {
      t.push({
        type: 'scatter',
        mode: 'lines',
        x: envelope.maxValues,
        y: stories,
        orientation: 'h',
        line: { color: MAX_ENVELOPE_COLOR, width: 1, dash: 'dash' },
        name: 'Max',
        showlegend: false,
        hoverinfo: 'skip',
      } as Plotly.Data)
    }

    // Min envelope
    if (envelope) {
      t.push({
        type: 'scatter',
        mode: 'lines',
        x: envelope.minValues,
        y: stories,
        orientation: 'h',
        line: { color: MIN_ENVELOPE_COLOR, width: 1, dash: 'dash' },
        name: 'Min',
        showlegend: false,
        hoverinfo: 'skip',
      } as Plotly.Data)
    }

    // Current profile
    if (profile) {
      t.push({
        type: 'scatter',
        mode: 'lines+markers',
        x: profile,
        y: stories,
        orientation: 'h',
        line: { color: PROFILE_COLOR, width: 3 },
        marker: { color: PROFILE_COLOR, size: 5, symbol: 'circle' },
        name: resultType,
        showlegend: false,
      } as Plotly.Data)
    }

    return t
  }, [profile, envelope, stories, resultType])

  const layout = useMemo(
    () => withPlotlyDefaults({
      xaxis: createAxisLayout({
        title: { text: `${unit}`, font: { size: 11, color: getChartColors().textColor } },
        showgrid: false,
        zerolinecolor: PROFILE_COLOR,
        zerolinewidth: 1,
        tickfont: { size: 10, color: getChartColors().textColor },
      }),
      yaxis: createAxisLayout({
        showgrid: false,
        tickfont: { size: 10, color: getChartColors().textColor },
        categoryorder: 'array' as const,
        categoryarray: stories,
        range: [0, (stories.length > 0 ? stories.length - 1 : 0) + STORY_AXIS_TOP_PADDING],
      }),
      margin: { l: 52, r: 6, t: 4, b: 32 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stories, unit, theme]
  )

  return (
    <div className="ts-profile-plot flex-1 min-w-0 min-h-0 h-full overflow-hidden">
      <LazyPlot
        data={traces}
        layout={layout}
        config={PLOTLY_CONFIG_NO_MODE_BAR}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler
        onInitialized={(_figure, graphDiv) => onPlotInit?.(graphDiv as HTMLElement)}
      />
    </div>
  )
}

// --- Base Acceleration Plot Sub-Component ---

interface BaseAccelerationPlotProps {
  timeSteps: number[]
  values: number[]
  currentTime: number
  onPlotInit?: (graphDiv: HTMLElement) => void
}

function BaseAccelerationPlot({ timeSteps, values, currentTime, onPlotInit }: BaseAccelerationPlotProps) {
  const theme = useThemeStore((s) => s.theme)
  const traces = useMemo(
    () => [
      {
        type: 'scatter' as const,
        mode: 'lines' as const,
        x: timeSteps,
        y: values,
        line: { color: ACCEL_LINE_COLOR, width: 1 },
        showlegend: false,
        hoverinfo: 'x+y' as const,
      },
    ],
    [timeSteps, values]
  )

  const maxTime = timeSteps.length > 0 ? timeSteps[timeSteps.length - 1] : 1

  // Stable layout - only recomputes when data range or theme changes
  const baseLayout = useMemo(
    () => withPlotlyDefaults({
      xaxis: createAxisLayout({
        title: { text: 'Time (s)', font: { size: 10, color: getChartColors().textColor } },
        showgrid: false,
        tickfont: { size: 9, color: getChartColors().textColor },
        range: [0, maxTime],
      }),
      yaxis: createAxisLayout({
        title: { text: 'Accel (g)', font: { size: 10, color: getChartColors().textColor } },
        showgrid: false,
        tickfont: { size: 9, color: getChartColors().textColor },
      }),
      margin: { l: 52, r: 6, t: 4, b: 28 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maxTime, theme]
  )

  // Only shapes change per frame - lightweight merge, no new axis objects
  const layout = useMemo(
    () => ({
      ...baseLayout,
      shapes: [
        {
          type: 'rect' as const,
          x0: 0,
          x1: currentTime,
          y0: 0,
          y1: 1,
          yref: 'paper' as const,
          fillcolor: 'rgba(74, 125, 137, 0.15)',
          line: { width: 0 },
        },
        {
          type: 'line' as const,
          x0: currentTime,
          x1: currentTime,
          y0: 0,
          y1: 1,
          yref: 'paper' as const,
          line: { color: MARKER_COLOR, width: 1.5 },
        },
      ],
    }),
    [baseLayout, currentTime]
  )

  return (
    <LazyPlot
      data={traces}
      layout={layout}
      config={PLOTLY_CONFIG_NO_MODE_BAR}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler
      onInitialized={(_figure, graphDiv) => onPlotInit?.(graphDiv as HTMLElement)}
    />
  )
}
