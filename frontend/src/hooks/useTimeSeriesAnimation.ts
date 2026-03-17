/**
 * Custom hook encapsulating the time-series animation loop.
 *
 * Manages play/pause, speed control, sub-frame interpolation, and
 * imperative Plotly updates — keeping zero React re-renders per frame.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { TimeSeriesAllTypesData } from '../types'

// --- Constants ---

export const RESULT_TYPES = ['Displacements', 'Drifts', 'Accelerations', 'Shears'] as const

export const RESULT_TYPE_KEYS: Record<string, string> = {
  Displacements: 'Displacements',
  Drifts: 'Drifts',
  Accelerations: 'Accelerations',
  Shears: 'Forces',
}

export const SPEED_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
const DEFAULT_SPEED_INDEX = 3 // 1.0x

// Base interval in ms at 1x speed. Each sub-frame advances 1/4 step.
// At 1x: 50ms per sub-frame = 200ms per full step
const BASE_SUBFRAME_MS = 50
const SUB_FRAMES = 4

export const STORY_AXIS_TOP_PADDING = 0.2

// --- Pure helpers ---

export function computeProfileAt(
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

export function interpolateTimeAt(timeSteps: number[], position: number): number {
  if (timeSteps.length === 0) return 0
  const stepIndex = Math.floor(position)
  const frac = position - stepIndex
  const nextIndex = Math.min(stepIndex + 1, timeSteps.length - 1)
  const curr = timeSteps[stepIndex] ?? 0
  const next = timeSteps[nextIndex] ?? 0
  return curr + frac * (next - curr)
}

// --- Types ---

export interface EnvelopeData {
  maxValues: number[]
  minValues: number[]
}

export interface UseTimeSeriesAnimationOptions {
  totalSteps: number
  allTypesData: TimeSeriesAllTypesData | undefined
  stories: string[]
  timeSteps: number[]
  profileGdRefs: React.MutableRefObject<Record<string, HTMLElement>>
  baseAccelGdRef: React.MutableRefObject<HTMLElement | null>
  sliderRef: React.RefObject<HTMLInputElement>
  timeDisplayRef: React.RefObject<HTMLSpanElement>
}

export interface UseTimeSeriesAnimationReturn {
  isPlaying: boolean
  currentPosition: number
  speedMultiplier: number
  maxPosition: number
  handlePlayPause: () => void
  handleReset: () => void
  handleSliderChange: (value: number) => void
  handleSlower: () => void
  handleFaster: () => void
  getInterpolatedProfile: (resultType: string) => number[] | null
  currentTime: number
}

// --- Hook ---

export function useTimeSeriesAnimation({
  totalSteps,
  allTypesData,
  stories,
  timeSteps,
  profileGdRefs,
  baseAccelGdRef,
  sliderRef,
  timeDisplayRef,
}: UseTimeSeriesAnimationOptions): UseTimeSeriesAnimationReturn {
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(0)
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX)
  const animationRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number>(0)

  // Imperative animation refs — bypass React during playback
  const positionRef = useRef(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plotlyRef = useRef<any>(null)

  // Load Plotly module for imperative calls (resolves from cache, effectively free)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('../components/charts/PlotlyComponent').then((mod: any) => {
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
  }, [profileGdRefs, baseAccelGdRef])

  // Keep positionRef in sync with React state (for non-animation state changes)
  useEffect(() => {
    positionRef.current = currentPosition
  }, [currentPosition])

  // Reset position when data changes
  useEffect(() => {
    setCurrentPosition(0)
    setIsPlaying(false)
  }, [allTypesData])

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

  // Animation loop — imperative Plotly updates, zero React re-renders per frame
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

  // Force Plotly resize after init — flex layout may not have settled when Plotly first reads dimensions
  // Exposed indirectly: callers use handleProfilePlotInit / handleBaseAccelPlotInit on the View side

  return {
    isPlaying,
    currentPosition,
    speedMultiplier,
    maxPosition,
    handlePlayPause,
    handleReset,
    handleSliderChange,
    handleSlower,
    handleFaster,
    getInterpolatedProfile,
    currentTime,
  }
}
