/**
 * Time-Series View component
 * Displays animated building profile for NLTHA results
 * Allows playback of structural response over time
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import clsx from 'clsx'
import {
  useResultSets,
  useAvailableResultTypes,
  useTimeSeriesLoadCases,
  useTimeSeriesData,
} from '../../hooks/useResults'
import { LazyPlot } from '../charts/LazyPlot'
import { ProjectBrowserNav } from '../projects/ProjectBrowserNav'
import type { GlobalResultType } from '../../types'

const STORY_AXIS_TOP_PADDING = 0.2

interface TimeSeriesViewProps {
  projectSlug: string
}

export function TimeSeriesView({ projectSlug }: TimeSeriesViewProps) {
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedLoadCase, setSelectedLoadCase] = useState<string | null>(null)
  const [selectedResultType, setSelectedResultType] = useState<GlobalResultType>('Drifts')
  const [selectedDirection, setSelectedDirection] = useState<string>('X')

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1) // 1x, 2x, 4x, etc.
  const animationRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number>(0)

  const { data: resultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)
  const { data: loadCasesData } = useTimeSeriesLoadCases(projectSlug, selectedResultSetId || undefined)

  // Auto-select first result set
  useEffect(() => {
    if (resultSets?.length && !selectedResultSetId) {
      setSelectedResultSetId(resultSets[0].id)
    }
  }, [resultSets, selectedResultSetId])

  // Get load cases for selected result set
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
    setCurrentStep(0)
    setIsPlaying(false)
  }, [selectedResultSetId])

  // Get time-series data
  const { data: timeSeriesData, isLoading: dataLoading } = useTimeSeriesData(
    projectSlug,
    selectedResultSetId && selectedLoadCase
      ? {
          result_set_id: selectedResultSetId,
          load_case: selectedLoadCase,
          result_type: selectedResultType,
          direction: selectedDirection,
        }
      : null
  )

  // Reset step when data changes
  useEffect(() => {
    setCurrentStep(0)
    setIsPlaying(false)
  }, [timeSeriesData])

  const totalSteps = timeSeriesData?.time_steps.length || 0

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    if (!lastFrameTimeRef.current) {
      lastFrameTimeRef.current = timestamp
    }

    const elapsed = timestamp - lastFrameTimeRef.current
    const frameInterval = 100 / playbackSpeed // Base: 100ms per frame

    if (elapsed >= frameInterval) {
      lastFrameTimeRef.current = timestamp
      setCurrentStep((prev) => {
        const next = prev + 1
        if (next >= totalSteps) {
          setIsPlaying(false)
          return prev
        }
        return next
      })
    }

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate)
    }
  }, [isPlaying, playbackSpeed, totalSteps])

  // Start/stop animation
  useEffect(() => {
    if (isPlaying) {
      lastFrameTimeRef.current = 0
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, animate])

  const handlePlayPause = () => {
    if (currentStep >= totalSteps - 1) {
      setCurrentStep(0)
    }
    setIsPlaying(!isPlaying)
  }

  const handleStepChange = (newStep: number) => {
    setIsPlaying(false)
    setCurrentStep(Math.max(0, Math.min(newStep, totalSteps - 1)))
  }

  const handleReset = () => {
    setIsPlaying(false)
    setCurrentStep(0)
  }

  // Get directions for selected result type
  const resultTypeInfo = availableTypes?.global_results.find(
    (r) => r.type === selectedResultType
  )
  const directions = resultTypeInfo?.directions || ['X', 'Y']
  const unit = resultTypeInfo?.unit || ''

  // Build chart data for current step
  const getChartData = () => {
    if (!timeSeriesData) return null

    const stories = timeSeriesData.stories
    const values = stories.map((story) => {
      const storyData = timeSeriesData.data[story]
      return storyData?.[currentStep] || 0
    })

    return { stories, values }
  }

  const chartData = getChartData()
  const currentTime = timeSeriesData?.time_steps[currentStep] || 0

  return (
    <div className="time-series-view h-full flex">
      {/* Left Panel - Configuration */}
      <div className="time-series-sidebar w-[200px] bg-bg-secondary border-r border-border-default flex flex-col overflow-auto">
        <ProjectBrowserNav projectSlug={projectSlug} />
        {/* Result Set Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Result Set</h3>
          {resultSetsLoading ? (
            <div className="text-sm text-text-muted">Loading...</div>
          ) : resultSets?.length ? (
            <select
              value={selectedResultSetId || ''}
              onChange={(e) => setSelectedResultSetId(Number(e.target.value))}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border-default rounded text-sm text-text-primary"
            >
              {resultSets.map((rs) => (
                <option key={rs.id} value={rs.id}>
                  {rs.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-text-muted">No result sets available</div>
          )}
        </div>

        {/* Load Case Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Load Case</h3>
          {loadCases.length > 0 ? (
            <select
              value={selectedLoadCase || ''}
              onChange={(e) => setSelectedLoadCase(e.target.value)}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border-default rounded text-sm text-text-primary"
            >
              {loadCases.map((lc) => (
                <option key={lc} value={lc}>
                  {lc}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-text-muted">
              No time-series data available
            </div>
          )}
        </div>

        {/* Result Type Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Result Type</h3>
          <select
            value={selectedResultType}
            onChange={(e) => setSelectedResultType(e.target.value as GlobalResultType)}
            className="w-full px-2 py-1.5 bg-bg-primary border border-border-default rounded text-sm text-text-primary"
          >
            {availableTypes?.global_results.map((rt) => (
              <option key={rt.type} value={rt.type}>
                {rt.type}
              </option>
            ))}
          </select>
        </div>

        {/* Direction Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Direction</h3>
          <div className="flex gap-2">
            {directions.map((dir) => (
              <button
                key={dir}
                onClick={() => setSelectedDirection(dir)}
                className={clsx(
                  'flex-1 px-3 py-1.5 rounded text-sm transition-colors',
                  selectedDirection === dir
                    ? 'bg-accent-primary text-white'
                    : 'bg-bg-primary text-text-secondary hover:bg-bg-hover'
                )}
              >
                {dir}
              </button>
            ))}
          </div>
        </div>

        {/* Playback Speed */}
        <div className="browser-section">
          <h3 className="browser-section-title">Playback Speed</h3>
          <div className="flex gap-1">
            {[0.5, 1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={clsx(
                  'flex-1 px-2 py-1.5 rounded text-xs transition-colors',
                  playbackSpeed === speed
                    ? 'bg-accent-primary text-white'
                    : 'bg-bg-primary text-text-secondary hover:bg-bg-hover'
                )}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-auto browser-section border-t border-border-default">
          <div className="text-xs text-text-muted">
            <p className="mb-1">Time-series visualization shows:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Building profile over time</li>
              <li>Response at each time step</li>
              <li>Animated structural deformation</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="time-series-content flex-1 flex flex-col overflow-hidden">
        {selectedLoadCase && timeSeriesData ? (
          <>
            {/* Toolbar with playback controls */}
            <div className="time-series-toolbar px-3 py-2 border-b border-border-default bg-bg-secondary">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-text-primary">
                  {selectedResultType} {selectedDirection}
                  {unit && (
                    <span className="text-text-muted ml-2">
                      ({unit})
                    </span>
                  )}
                </div>
                <div className="text-sm text-text-secondary">
                  Time: <span className="font-mono">{currentTime.toFixed(3)}s</span>
                  <span className="text-text-muted ml-2">
                    (Step {currentStep + 1} / {totalSteps})
                  </span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded text-sm bg-bg-primary text-text-secondary hover:bg-bg-hover transition-colors"
                  title="Reset"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>

                <button
                  onClick={handlePlayPause}
                  className={clsx(
                    'px-4 py-1.5 rounded text-sm font-medium transition-colors',
                    isPlaying
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-accent-primary text-white hover:bg-accent-hover'
                  )}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>

                {/* Time slider */}
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={totalSteps - 1}
                    value={currentStep}
                    onChange={(e) => handleStepChange(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-border-default rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${(currentStep / (totalSteps - 1)) * 100}%, var(--border-default) ${(currentStep / (totalSteps - 1)) * 100}%, var(--border-default) 100%)`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Chart Display */}
            <div className="time-series-chart flex-1 p-2">
              {dataLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">Loading time-series data...</div>
                </div>
              ) : chartData ? (
                <div className="h-full">
                  <LazyPlot
                    data={[
                      {
                        type: 'scatter',
                        mode: 'lines',
                        x: chartData.values,
                        y: chartData.stories,
                        orientation: 'h',
                        line: {
                          color: '#4a7d89',
                          width: 2,
                        },
                      },
                    ]}
                    layout={{
                      xaxis: {
                        title: { text: unit || '', font: { size: 10 } },
                        gridcolor: '#2c313a',
                        zerolinecolor: '#4a7d89',
                        zerolinewidth: 1,
                        tickfont: { size: 10, color: '#d1d5db' },
                      },
                      yaxis: {
                        gridcolor: '#2c313a',
                        tickfont: { size: 10, color: '#d1d5db' },
                        categoryorder: 'array',
                        categoryarray: chartData.stories,
                        range: [
                          0,
                          (chartData.stories.length > 0 ? chartData.stories.length - 1 : 0) +
                            STORY_AXIS_TOP_PADDING,
                        ],
                      },
                      paper_bgcolor: '#0a0c10',
                      plot_bgcolor: '#0f1419',
                      font: { color: '#d1d5db', size: 11 },
                      margin: { l: 50, r: 10, t: 10, b: 30 },
                      showlegend: false,
                      autosize: true,
                    }}
                    config={{
                      displayModeBar: false,
                      responsive: true,
                    }}
                    style={{ width: '100%', height: '100%' }}
                    useResizeHandler
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">No data available</div>
                </div>
              )}
            </div>
          </>
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
