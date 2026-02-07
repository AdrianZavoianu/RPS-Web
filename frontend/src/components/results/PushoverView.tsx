/**
 * Pushover View component
 * Displays pushover curves (displacement vs base shear) for pushover analysis cases
 */

import { useState } from 'react'
import clsx from 'clsx'
import { useResultSets, usePushoverCases, usePushoverCurve, useGlobalResults, useAvailableResultTypes } from '../../hooks/useResults'
import { PushoverCurveChart } from '../charts/ProfileChart'
import { ResultsTable } from './ResultsTable'
import { ProjectBrowserNav } from '../projects/ProjectBrowserNav'
import type { GlobalResultType } from '../../types'

interface PushoverViewProps {
  projectSlug: string
}

export function PushoverView({ projectSlug }: PushoverViewProps) {
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'curves' | 'results'>('curves')
  const [selectedResultType, setSelectedResultType] = useState<GlobalResultType>('Drifts')
  const [selectedDirection, setSelectedDirection] = useState<string>('X')

  // Get pushover result sets only
  const { data: allResultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const pushoverResultSets = allResultSets?.filter((rs) => rs.analysis_type === 'Pushover') || []

  // Auto-select first pushover result set
  if (pushoverResultSets.length && !selectedResultSetId) {
    setSelectedResultSetId(pushoverResultSets[0].id)
  }

  // Get pushover cases for selected result set
  const { data: casesData } = usePushoverCases(projectSlug, selectedResultSetId || undefined)
  const pushoverCases = casesData?.pushover_cases || []

  // Auto-select first case
  if (pushoverCases.length && !selectedCaseId) {
    setSelectedCaseId(pushoverCases[0].id)
  }

  // Get curve data for selected case
  const { data: curveData, isLoading: curveLoading } = usePushoverCurve(
    projectSlug,
    selectedCaseId
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
  const directions = availableTypes?.global_results.find(
    (r) => r.type === selectedResultType
  )?.directions || ['X', 'Y']

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

        {/* Case Selection (for curves tab) */}
        {activeTab === 'curves' && selectedResultSetId && (
          <div className="browser-section">
            <h3 className="browser-section-title">Pushover Cases</h3>
            {pushoverCases.length ? (
              <div className="space-y-1">
                {pushoverCases.map((pc) => (
                  <button
                    key={pc.id}
                    onClick={() => setSelectedCaseId(pc.id)}
                    className={clsx(
                      'browser-item',
                      selectedCaseId === pc.id
                        ? 'browser-item-active'
                        : null
                    )}
                  >
                    <span>{pc.name}</span>
                    <span className="text-text-muted text-xs ml-2">({pc.direction})</span>
                  </button>
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
                {availableTypes?.global_results.map((rt) => (
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
                          <td className="results-table-cell">{point.displacement.toFixed(2)}</td>
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
