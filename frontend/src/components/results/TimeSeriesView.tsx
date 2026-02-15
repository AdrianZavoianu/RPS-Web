/**
 * Time-Series View component
 * 4-panel animated building profile for NLTHA results,
 * replicating the desktop application's time-series visualization.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import clsx from 'clsx'
import {
  useResultSets,
  useTimeSeriesLoadCases,
  useTimeSeriesAllTypes,
} from '../../hooks/useResults'
import { LazyPlot } from '../charts/LazyPlot'
import { ProjectBrowserNav } from '../projects/ProjectBrowserNav'

// --- Constants ---

const RESULT_TYPES = ['Displacements', 'Drifts', 'Accelerations', 'Forces'] as const
const RESULT_TYPE_UNITS: Record<string, string> = {
  Displacements: 'mm',
  Drifts: '%',
  Accelerations: 'g',
  Forces: 'kN',
}

const SPEED_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0]
const DEFAULT_SPEED_INDEX = 3 // 1.0x

// Base interval in ms at 1x speed. Each sub-frame advances 1/4 step.
// At 1x: 50ms per sub-frame = 200ms per full step
const BASE_SUBFRAME_MS = 50
const SUB_FRAMES = 4

const STORY_AXIS_TOP_PADDING = 0.2

// Plotly dark theme colors
const PAPER_BG = '#0a0c10'
const PLOT_BG = '#0f1419'
const GRID_COLOR = '#2c313a'
const TEXT_COLOR = '#d1d5db'
const PROFILE_COLOR = '#4a7d89'
const MAX_ENVELOPE_COLOR = '#e74c3c'
const MIN_ENVELOPE_COLOR = '#3498db'
const ACCEL_LINE_COLOR = '#6b7280'
const MARKER_COLOR = '#e74c3c'

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

  // Data fetching
  const { data: resultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const { data: loadCasesData } = useTimeSeriesLoadCases(projectSlug, selectedResultSetId || undefined)

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
    if (resultSets?.length && !selectedResultSetId) {
      setSelectedResultSetId(resultSets[0].id)
    }
  }, [resultSets, selectedResultSetId])

  const loadCases = useMemo(() => loadCasesData?.load_cases ?? [], [loadCasesData])

  // Auto-select first load case
  useEffect(() => {
    if (loadCases.length && !selectedLoadCase) {
      setSelectedLoadCase(loadCases[0])
    }
  }, [loadCases, selectedLoadCase])

  // Reset load case when result set changes
  useEffect(() => {
    setSelectedLoadCase(null)
    setCurrentPosition(0)
    setIsPlaying(false)
  }, [selectedResultSetId])

  // Reset position when data changes
  useEffect(() => {
    setCurrentPosition(0)
    setIsPlaying(false)
  }, [allTypesData])

  const totalSteps = allTypesData?.time_steps.length || 0
  const stories = allTypesData?.stories || []
  const timeSteps = allTypesData?.time_steps || []

  // Envelope computation (once per data load)
  const envelopes = useMemo(() => {
    if (!allTypesData) return {} as Record<string, EnvelopeData>

    const result: Record<string, EnvelopeData> = {}
    for (const rt of RESULT_TYPES) {
      const typeData = allTypesData.types[rt]
      if (!typeData) continue

      const maxVals: number[] = []
      const minVals: number[] = []

      for (const story of stories) {
        const vals = typeData[story]
        if (!vals || vals.length === 0) {
          maxVals.push(0)
          minVals.push(0)
          continue
        }
        let mx = -Infinity
        let mn = Infinity
        for (let i = 0; i < vals.length; i++) {
          if (vals[i] > mx) mx = vals[i]
          if (vals[i] < mn) mn = vals[i]
        }
        maxVals.push(mx)
        minVals.push(mn)
      }
      result[rt] = { maxValues: maxVals, minValues: minVals }
    }
    return result
  }, [allTypesData, stories])

  // Animation loop
  const speedMultiplier = SPEED_LEVELS[speedIndex]
  const maxPosition = totalSteps > 0 ? totalSteps - 1 : 0

  const animate = useCallback(
    (timestamp: number) => {
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = timestamp
      }

      const elapsed = timestamp - lastFrameTimeRef.current
      const frameInterval = BASE_SUBFRAME_MS / speedMultiplier

      if (elapsed >= frameInterval) {
        lastFrameTimeRef.current = timestamp
        setCurrentPosition((prev) => {
          const next = prev + 1 / SUB_FRAMES
          if (next >= maxPosition) {
            setIsPlaying(false)
            return maxPosition
          }
          return next
        })
      }

      animationRef.current = requestAnimationFrame(animate)
    },
    [speedMultiplier, maxPosition]
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
    setSpeedIndex((prev) => Math.max(0, prev - 1))
  }

  const handleFaster = () => {
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

  const hasData = allTypesData && Object.keys(allTypesData.types).length > 0

  return (
    <div className="time-series-view h-full flex">
      {/* Left sidebar - nav only */}
      <div className="time-series-sidebar w-[180px] bg-bg-secondary border-r border-border-default flex flex-col overflow-auto">
        <ProjectBrowserNav projectSlug={projectSlug} />
      </div>

      {/* Main content */}
      <div className="time-series-content flex-1 flex flex-col overflow-hidden">
        {/* Compact toolbar */}
        <div className="ts-toolbar px-3 py-2 border-b border-border-default bg-bg-secondary flex items-center gap-3 flex-wrap">
          {/* Result Set */}
          <select
            value={selectedResultSetId || ''}
            onChange={(e) => setSelectedResultSetId(Number(e.target.value))}
            className="px-2 py-1 bg-bg-primary border border-border-default rounded text-sm text-text-primary"
          >
            {resultSetsLoading ? (
              <option>Loading...</option>
            ) : resultSets?.length ? (
              resultSets.map((rs) => (
                <option key={rs.id} value={rs.id}>
                  {rs.name}
                </option>
              ))
            ) : (
              <option>No result sets</option>
            )}
          </select>

          {/* Load Case */}
          <select
            value={selectedLoadCase || ''}
            onChange={(e) => setSelectedLoadCase(e.target.value)}
            className="px-2 py-1 bg-bg-primary border border-border-default rounded text-sm text-text-primary"
          >
            {loadCases.length > 0 ? (
              loadCases.map((lc) => (
                <option key={lc} value={lc}>
                  {lc}
                </option>
              ))
            ) : (
              <option>No load cases</option>
            )}
          </select>

          {/* Direction toggles */}
          <div className="flex gap-1">
            {['X', 'Y'].map((dir) => (
              <button
                key={dir}
                onClick={() => setSelectedDirection(dir)}
                className={clsx(
                  'px-3 py-1 rounded text-sm transition-colors',
                  selectedDirection === dir
                    ? 'bg-accent-primary text-white'
                    : 'bg-bg-primary text-text-secondary hover:bg-bg-hover'
                )}
              >
                {dir}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Time display */}
          {hasData && (
            <div className="text-sm text-text-secondary">
              Time: <span className="font-mono text-text-primary">{currentTime.toFixed(3)}s</span>
              <span className="text-text-muted ml-2">
                (Step {Math.floor(currentPosition) + 1} / {totalSteps})
              </span>
            </div>
          )}
        </div>

        {hasData ? (
          <>
            {/* 4 profile plots */}
            <div className="ts-plots-row flex-1 flex gap-0 min-h-0">
              {RESULT_TYPES.map((rt) => {
                const profile = getInterpolatedProfile(rt)
                const envelope = envelopes[rt]
                const unit = RESULT_TYPE_UNITS[rt]

                return (
                  <ProfilePlot
                    key={rt}
                    resultType={rt}
                    unit={unit}
                    stories={stories}
                    profile={profile}
                    envelope={envelope}
                  />
                )
              })}
            </div>

            {/* Base acceleration plot */}
            {baseAccelData && (
              <div className="ts-base-plot border-t border-border-default" style={{ height: 120 }}>
                <BaseAccelerationPlot
                  timeSteps={timeSteps}
                  values={baseAccelData}
                  currentTime={currentTime}
                />
              </div>
            )}

            {/* Controls bar */}
            <div className="ts-controls px-3 py-2 border-t border-border-default bg-bg-secondary flex items-center gap-3">
              {/* Reset */}
              <button
                onClick={handleReset}
                className="px-2 py-1 rounded text-sm bg-bg-primary text-text-secondary hover:bg-bg-hover transition-colors"
                title="Reset"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                className={clsx(
                  'px-4 py-1 rounded text-sm font-medium transition-colors min-w-[70px]',
                  isPlaying
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-accent-primary text-white hover:bg-accent-hover'
                )}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>

              {/* Slider */}
              <div className="flex-1 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={maxPosition}
                  step={0.25}
                  value={currentPosition}
                  onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-border-default rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
                />
              </div>

              {/* Speed controls */}
              <button
                onClick={handleSlower}
                disabled={speedIndex === 0}
                className="px-2 py-1 rounded text-xs bg-bg-primary text-text-secondary hover:bg-bg-hover disabled:opacity-30 transition-colors"
              >
                Slower
              </button>

              <span className="text-sm font-mono text-text-primary min-w-[40px] text-center">
                {speedMultiplier}x
              </span>

              <button
                onClick={handleFaster}
                disabled={speedIndex === SPEED_LEVELS.length - 1}
                className="px-2 py-1 rounded text-xs bg-bg-primary text-text-secondary hover:bg-bg-hover disabled:opacity-30 transition-colors"
              >
                Faster
              </button>
            </div>
          </>
        ) : dataLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-text-secondary">Loading time-series data...</div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-text-secondary mb-2">Select a load case to view time-series data</p>
              <p className="text-text-muted text-sm">
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
}

function ProfilePlot({ resultType, unit, stories, profile, envelope }: ProfilePlotProps) {
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
    () => ({
      xaxis: {
        title: { text: `${resultType} (${unit})`, font: { size: 9, color: TEXT_COLOR } },
        gridcolor: GRID_COLOR,
        zerolinecolor: PROFILE_COLOR,
        zerolinewidth: 1,
        tickfont: { size: 9, color: TEXT_COLOR },
      },
      yaxis: {
        gridcolor: GRID_COLOR,
        tickfont: { size: 9, color: TEXT_COLOR },
        categoryorder: 'array' as const,
        categoryarray: stories,
        range: [0, (stories.length > 0 ? stories.length - 1 : 0) + STORY_AXIS_TOP_PADDING],
      },
      paper_bgcolor: PAPER_BG,
      plot_bgcolor: PLOT_BG,
      font: { color: TEXT_COLOR, size: 10 },
      margin: { l: 55, r: 8, t: 8, b: 35 },
      showlegend: false,
      autosize: true,
    }),
    [stories, resultType, unit]
  )

  return (
    <div className="ts-profile-plot flex-1 min-w-0">
      <LazyPlot
        data={traces}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler
      />
    </div>
  )
}

// --- Base Acceleration Plot Sub-Component ---

interface BaseAccelerationPlotProps {
  timeSteps: number[]
  values: number[]
  currentTime: number
}

function BaseAccelerationPlot({ timeSteps, values, currentTime }: BaseAccelerationPlotProps) {
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

  const layout = useMemo(
    () => ({
      xaxis: {
        title: { text: 'Time (s)', font: { size: 9, color: TEXT_COLOR } },
        gridcolor: GRID_COLOR,
        tickfont: { size: 9, color: TEXT_COLOR },
        range: [0, maxTime],
      },
      yaxis: {
        title: { text: 'Accel (g)', font: { size: 9, color: TEXT_COLOR } },
        gridcolor: GRID_COLOR,
        tickfont: { size: 9, color: TEXT_COLOR },
      },
      paper_bgcolor: PAPER_BG,
      plot_bgcolor: PLOT_BG,
      font: { color: TEXT_COLOR, size: 10 },
      margin: { l: 55, r: 8, t: 4, b: 30 },
      showlegend: false,
      autosize: true,
      shapes: [
        // Shaded region from start to current time
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
        // Vertical marker at current time
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
    [maxTime, currentTime]
  )

  return (
    <LazyPlot
      data={traces}
      layout={layout}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler
    />
  )
}
