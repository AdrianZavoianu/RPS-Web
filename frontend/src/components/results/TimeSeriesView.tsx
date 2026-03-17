/**
 * Time-Series View component
 * 4-panel animated building profile for NLTHA results,
 * replicating the desktop application's time-series visualization.
 *
 * Orchestrator: owns selection state, data fetching, tree navigation.
 * Animation logic lives in useTimeSeriesAnimation hook.
 * Plot components live in ./time-series/.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  useResultSets,
  useTimeSeriesLoadCases,
  useTimeSeriesAllTypes,
} from '../../hooks/useResults'
import { ResultsTreeBrowser, type TreeSelection } from '../projects/ResultsTreeBrowser'
import { isNlthaResultSet } from '../../utils/resultSets'
import {
  useTimeSeriesAnimation,
  RESULT_TYPES,
  RESULT_TYPE_KEYS,
  SPEED_LEVELS,
  type EnvelopeData,
} from '../../hooks/useTimeSeriesAnimation'
import { TimeSeriesProfilePlot } from './time-series/TimeSeriesProfilePlot'
import { BaseAccelerationPlot } from './time-series/BaseAccelerationPlot'
import { TimeSeriesControls } from './time-series/TimeSeriesControls'

// --- Types ---

interface TimeSeriesViewProps {
  projectSlug: string
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

  // DOM refs for imperative Plotly updates (owned here, passed to hook)
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

  // Derived data
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

  // Animation hook
  const {
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
  } = useTimeSeriesAnimation({
    totalSteps,
    allTypesData,
    stories,
    timeSteps,
    profileGdRefs,
    baseAccelGdRef,
    sliderRef,
    timeDisplayRef,
  })

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('../charts/PlotlyComponent').then((mod: any) => {
      requestAnimationFrame(() => {
        mod.Plotly?.Plots?.resize(gd)
      })
    })
  }, [])

  const handleBaseAccelPlotInit = useCallback((gd: HTMLElement) => {
    baseAccelGdRef.current = gd
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('../charts/PlotlyComponent').then((mod: any) => {
      requestAnimationFrame(() => {
        mod.Plotly?.Plots?.resize(gd)
      })
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

            {/* 4 profile plots -- flex-1 fills remaining vertical space */}
            <div className="ts-plots-row flex-1 min-h-0 min-w-0 flex gap-0.5 px-3 pt-1">
              {RESULT_TYPES.map((rt) => {
                const dataKey = RESULT_TYPE_KEYS[rt]
                const profile = getInterpolatedProfile(dataKey)
                const envelope = envelopes[dataKey]
                const unit = allTypesData?.units?.[dataKey] || ''

                return (
                  <TimeSeriesProfilePlot
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
            <TimeSeriesControls
              isPlaying={isPlaying}
              currentPosition={currentPosition}
              maxPosition={maxPosition}
              speedMultiplier={speedMultiplier}
              currentTime={currentTime}
              sliderRef={sliderRef}
              timeDisplayRef={timeDisplayRef}
              onPlayPause={handlePlayPause}
              onReset={handleReset}
              onSliderChange={handleSliderChange}
              onSlower={handleSlower}
              onFaster={handleFaster}
              isSlowerDisabled={speedMultiplier <= SPEED_LEVELS[0]}
              isFasterDisabled={speedMultiplier >= SPEED_LEVELS[SPEED_LEVELS.length - 1]}
            />
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
