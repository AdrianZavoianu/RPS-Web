/**
 * Pushover View component
 * Displays pushover curves (displacement vs base shear) for pushover analysis cases
 * Supports single curve display and all-curves overlay per direction
 */

import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useResultSets, usePushoverCases, usePushoverCurve, useGlobalResults, useAvailableResultTypes, useAllPushoverCurves } from '../../hooks/useResults'
import { PushoverCurveChart, PushoverMultiCurveChart } from '../charts/ProfileChart'
import { ResultsTable } from './ResultsTable'
import { ProjectBrowserNav } from '../projects/ProjectBrowserNav'
import type { GlobalResultType, PushoverCase } from '../../types'
import { isPushoverResultSet } from '../../utils/resultSets'

interface PushoverViewProps {
  projectSlug: string
}

type CurveSelectionMode = 'single' | 'all'

/** Group pushover cases by direction */
function groupByDirection(cases: PushoverCase[]): Map<string, PushoverCase[]> {
  const groups = new Map<string, PushoverCase[]>()
  for (const pc of cases) {
    const dir = pc.direction || 'Unknown'
    if (!groups.has(dir)) groups.set(dir, [])
    groups.get(dir)!.push(pc)
  }
  return groups
}

export function PushoverView({ projectSlug }: PushoverViewProps) {
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)
  const [curveSelectionMode, setCurveSelectionMode] = useState<CurveSelectionMode>('single')
  const [allCurvesDirection, setAllCurvesDirection] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'curves' | 'results'>('curves')
  const [selectedResultType, setSelectedResultType] = useState<GlobalResultType>('Drifts')
  const [selectedDirection, setSelectedDirection] = useState<string>('X')

  // Get pushover result sets only
  const { data: allResultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const pushoverResultSets = useMemo(
    () => allResultSets?.filter(isPushoverResultSet) ?? [],
    [allResultSets]
  )

  // Get pushover cases for selected result set
  const { data: casesData } = usePushoverCases(projectSlug, selectedResultSetId || undefined)
  const pushoverCases = useMemo(() => casesData?.pushover_cases ?? [], [casesData])

  // Group cases by direction
  const directionGroups = useMemo(() => groupByDirection(pushoverCases), [pushoverCases])

  // Get curve data for selected case (single mode)
  const { data: curveData, isLoading: curveLoading } = usePushoverCurve(
    projectSlug,
    curveSelectionMode === 'single' ? selectedCaseId : null
  )

  // Get all curves for a direction (all mode)
  const { curves: allCurves, isLoading: allCurvesLoading } = useAllPushoverCurves(
    projectSlug,
    selectedResultSetId || undefined,
    curveSelectionMode === 'all' ? allCurvesDirection : null
  )

  // Get available result types
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)

  // Get pushover results for results tab
  const { data: resultsData, isLoading: resultsLoading } = useGlobalResults(
    projectSlug,
    activeTab === 'results' && selectedResultSetId
      ? {
          result_set_id: selectedResultSetId,
          result_type: selectedResultType,
          direction: selectedDirection,
          is_pushover: true,
        }
      : null
  )

  // Get directions for selected result type
  const directions = useMemo(() => {
    const availableDirections = availableTypes?.global_results.find(
      (resultTypeInfo) => resultTypeInfo.type === selectedResultType
    )?.directions
    return availableDirections && availableDirections.length ? availableDirections : ['X', 'Y']
  }, [availableTypes, selectedResultType])

  useEffect(() => {
    if (!pushoverResultSets.length) {
      if (selectedResultSetId !== null) {
        setSelectedResultSetId(null)
      }
      if (selectedCaseId !== null) {
        setSelectedCaseId(null)
      }
      return
    }

    const selectedResultSetExists =
      selectedResultSetId !== null &&
      pushoverResultSets.some((resultSet) => resultSet.id === selectedResultSetId)

    if (!selectedResultSetExists) {
      setSelectedResultSetId(pushoverResultSets[0].id)
      setSelectedCaseId(null)
    }
  }, [pushoverResultSets, selectedResultSetId, selectedCaseId])

  useEffect(() => {
    if (!selectedResultSetId) return

    if (!pushoverCases.length) {
      if (selectedCaseId !== null) {
        setSelectedCaseId(null)
      }
      return
    }

    const selectedCaseExists =
      selectedCaseId !== null && pushoverCases.some((pushoverCase) => pushoverCase.id === selectedCaseId)

    if (!selectedCaseExists && curveSelectionMode === 'single') {
      setSelectedCaseId(pushoverCases[0].id)
    }
  }, [pushoverCases, selectedCaseId, selectedResultSetId, curveSelectionMode])

  useEffect(() => {
    if (!directions.includes(selectedDirection)) {
      setSelectedDirection(directions[0])
    }
  }, [directions, selectedDirection])

  const handleSelectCase = (caseId: number) => {
    setCurveSelectionMode('single')
    setAllCurvesDirection(null)
    setSelectedCaseId(caseId)
  }

  const handleSelectAllCurves = (direction: string) => {
    setCurveSelectionMode('all')
    setAllCurvesDirection(direction)
    setSelectedCaseId(null)
  }

  if (!resultSetsLoading && pushoverResultSets.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h3 className="text-lg font-semibold text-text-primary">
            No pushover data imported yet
          </h3>
          <p className="text-text-muted mt-2">
            Use the header actions to load pushover curves first, then load pushover results.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pushover-view h-full flex">
      {/* Left Panel */}
      <div className="pushover-sidebar w-[200px] bg-bg-secondary border-r border-border-default flex flex-col overflow-auto">
        <ProjectBrowserNav projectSlug={projectSlug} />
        {/* Result Set Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Pushover Result Sets</h3>
          {resultSetsLoading ? (
            <div className="text-sm text-text-muted">Loading...</div>
          ) : pushoverResultSets.length ? (
            <div className="space-y-1">
              {pushoverResultSets.map((rs) => (
                <button
                  key={rs.id}
                  onClick={() => {
                    setSelectedResultSetId(rs.id)
                    setSelectedCaseId(null)
                    setCurveSelectionMode('single')
                    setAllCurvesDirection(null)
                  }}
                  className={clsx(
                    'browser-item',
                    selectedResultSetId === rs.id
                      ? 'browser-item-active'
                      : null
                  )}
                >
                  {rs.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-text-muted">No pushover result sets</div>
          )}
        </div>

        {/* Case Selection with direction grouping (for curves tab) */}
        {activeTab === 'curves' && selectedResultSetId && (
          <div className="browser-section">
            <h3 className="browser-section-title">Pushover Cases</h3>
            {pushoverCases.length ? (
              <div className="space-y-0.5">
                {Array.from(directionGroups.entries()).map(([dir, cases]) => (
                  <div key={dir}>
                    <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider px-2 pt-2 pb-0.5">
                      {dir} Direction
                    </div>
                    {cases.map((pc) => (
                      <button
                        key={pc.id}
                        onClick={() => handleSelectCase(pc.id)}
                        className={clsx(
                          'browser-item',
                          curveSelectionMode === 'single' && selectedCaseId === pc.id
                            ? 'browser-item-active'
                            : null
                        )}
                      >
                        <span className="truncate">{pc.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => handleSelectAllCurves(dir)}
                      className={clsx(
                        'browser-item text-accent-secondary',
                        curveSelectionMode === 'all' && allCurvesDirection === dir
                          ? 'browser-item-active'
                          : null
                      )}
                    >
                      All {dir} Curves
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-text-muted">No pushover cases</div>
            )}
          </div>
        )}

        {/* Result Type/Direction (for results tab) */}
        {activeTab === 'results' && selectedResultSetId && (
          <>
            <div className="browser-section">
              <h3 className="browser-section-title">Result Type</h3>
              <select
                value={selectedResultType}
                onChange={(e) => setSelectedResultType(e.target.value as GlobalResultType)}
                className="w-full px-2 py-1.5 bg-bg-primary border border-border-default rounded text-sm text-text-primary"
              >
                {(availableTypes?.global_results.length
                  ? availableTypes.global_results
                  : [
                      { type: 'Drifts', directions: ['X', 'Y'] },
                      { type: 'Forces', directions: ['X', 'Y'] },
                      { type: 'Displacements', directions: ['X', 'Y'] },
                    ]
                ).map((rt) => (
                  <option key={rt.type} value={rt.type}>
                    {rt.type}
                  </option>
                ))}
              </select>
            </div>

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
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="pushover-content flex-1 flex flex-col overflow-hidden">
        {/* Tab Bar */}
        <div className="pushover-tabs flex border-b border-border-default bg-bg-secondary">
          <button
            onClick={() => setActiveTab('curves')}
            className={clsx(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'curves'
                ? 'border-accent-primary text-accent-secondary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            Pushover Curves
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={clsx(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'results'
                ? 'border-accent-primary text-accent-secondary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            Story Results
          </button>
        </div>

        {/* Content Area */}
        <div className="pushover-data flex-1 overflow-hidden p-2">
          {activeTab === 'curves' ? (
            // Curves Tab
            curveSelectionMode === 'all' ? (
              // All Curves mode
              allCurvesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">Loading all curves...</div>
                </div>
              ) : allCurves.length > 0 ? (
                <div className="h-full">
                  <PushoverMultiCurveChart curves={allCurves} />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">No curve data for {allCurvesDirection} direction</div>
                </div>
              )
            ) : (
              // Single Curve mode
              curveLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">Loading curve data...</div>
                </div>
              ) : curveData ? (
                <div className="h-full flex">
                  {/* Chart fills available space */}
                  <div className="flex-1 h-full">
                    <PushoverCurveChart
                      points={curveData.points}
                      caseName={curveData.case.name}
                    />
                  </div>
                  {/* Curve Data Table - compact sidebar */}
                  <div className="w-48 overflow-auto border-l border-border-default">
                    <table className="results-table w-full">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          <th className="results-table-header text-center">Step</th>
                          <th className="results-table-header text-right">mm</th>
                          <th className="results-table-header text-right">kN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {curveData.points.map((point) => (
                          <tr key={point.step} className="results-table-row">
                            <td className="results-table-cell text-center">{point.step}</td>
                            <td className="results-table-cell">{point.displacement.toFixed(0)}</td>
                            <td className="results-table-cell">{point.base_shear.toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : selectedCaseId ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">No curve data available</div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-text-secondary mb-2">Select a pushover case</p>
                    <p className="text-text-muted text-sm">
                      Choose a case from the left panel to view its curve
                    </p>
                  </div>
                </div>
              )
            )
          ) : (
            // Results Tab
            resultsLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-text-secondary">Loading results...</div>
              </div>
            ) : resultsData ? (
              <ResultsTable dataset={resultsData} className="h-full" />
            ) : selectedResultSetId ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-text-secondary">No results data available</div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-text-secondary mb-2">Select a pushover result set</p>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
