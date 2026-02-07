/**
 * Joint Results View component
 * Displays foundation/joint results (Soil Pressures, Vertical Displacements)
 */

import { useState, useEffect } from 'react'
import clsx from 'clsx'
import {
  useResultSets,
  useAvailableResultTypes,
  useJointResults,
} from '../../hooks/useResults'
import { ResultsTable } from './ResultsTable'
import { ProjectBrowserNav } from '../projects/ProjectBrowserNav'
import type { JointResultType } from '../../types'

interface JointResultsViewProps {
  projectSlug: string
}

export function JointResultsView({ projectSlug }: JointResultsViewProps) {
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedResultType, setSelectedResultType] = useState<JointResultType>('SoilPressures')

  const { data: resultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)

  // Auto-select first result set
  useEffect(() => {
    if (resultSets?.length && !selectedResultSetId) {
      setSelectedResultSetId(resultSets[0].id)
    }
  }, [resultSets, selectedResultSetId])

  // Get joint results
  const { data: resultsData, isLoading: resultsLoading } = useJointResults(
    projectSlug,
    selectedResultSetId
      ? {
          result_set_id: selectedResultSetId,
          result_type: selectedResultType,
        }
      : null
  )

  // Get available joint result types
  const jointResultTypes = availableTypes?.joint_results || []

  return (
    <div className="joint-results-view h-full flex">
      {/* Left Panel - Configuration */}
      <div className="joint-sidebar w-[200px] bg-bg-secondary border-r border-border-default flex flex-col overflow-auto">
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

        {/* Result Type Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Foundation Result Type</h3>
          <div className="space-y-1">
            {jointResultTypes.length > 0 ? (
              jointResultTypes.map((rt) => (
                <button
                  key={rt.type}
                  onClick={() => setSelectedResultType(rt.type as JointResultType)}
                  className={clsx(
                    'browser-item',
                    selectedResultType === rt.type
                      ? 'browser-item-active'
                      : null
                  )}
                >
                  {rt.type}
                  {rt.unit && (
                    <span className="text-text-muted text-xs ml-2">({rt.unit})</span>
                  )}
                </button>
              ))
            ) : (
              <>
                <button
                  onClick={() => setSelectedResultType('SoilPressures')}
                  className={clsx(
                    'browser-item',
                    selectedResultType === 'SoilPressures'
                      ? 'browser-item-active'
                      : null
                  )}
                >
                  Soil Pressures
                </button>
                <button
                  onClick={() => setSelectedResultType('VerticalDisplacements')}
                  className={clsx(
                    'browser-item',
                    selectedResultType === 'VerticalDisplacements'
                      ? 'browser-item-active'
                      : null
                  )}
                >
                  Vertical Displacements
                </button>
              </>
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-auto browser-section border-t border-border-default">
          <div className="text-xs text-text-muted">
            <p className="mb-1">Foundation results show:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Joint name/label</li>
              <li>Min values per load case</li>
              <li>Summary statistics</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="joint-content flex-1 flex flex-col overflow-hidden">
        {selectedResultSetId ? (
          <>
            {/* Toolbar */}
            <div className="joint-toolbar flex items-center justify-between px-3 py-2 border-b border-border-default bg-bg-secondary">
              <div className="text-sm text-text-primary">
                {selectedResultType}
                <span className="text-text-muted ml-2">
                  ({resultsData?.rows.length || 0} joints)
                </span>
              </div>
            </div>

            {/* Data Display */}
            <div className="joint-data flex-1 overflow-auto p-2">
              {resultsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">Loading joint results...</div>
                </div>
              ) : resultsData && resultsData.rows.length > 0 ? (
                <ResultsTable dataset={resultsData} className="h-full" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-text-secondary mb-2">No foundation data available</p>
                    <p className="text-text-muted text-sm">
                      Foundation joints are imported from Excel files with "Fou" sheet
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-text-secondary mb-4">Select a result set from the left panel</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
