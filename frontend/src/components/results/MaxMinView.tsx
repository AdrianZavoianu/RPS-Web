/**
 * Standalone Max/Min Envelope View (/maxmin route)
 * Sidebar for result set / result type selection, content uses shared MaxMinResultsDisplay.
 */

import { useState, useEffect } from 'react'

import clsx from 'clsx'
import { useResultSets, useMaxMinData, useAvailableResultTypes } from '../../hooks/useResults'
import { MaxMinResultsDisplay } from './MaxMinResultsDisplay'
import { ProjectBrowserNav } from '../projects/ProjectBrowserNav'
import type { GlobalResultType } from '../../types'

interface MaxMinViewProps {
  projectSlug: string
}

export function MaxMinView({ projectSlug }: MaxMinViewProps) {
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedResultType, setSelectedResultType] = useState<GlobalResultType>('Drifts')
  const { data: resultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)

  // Auto-select first result set
  useEffect(() => {
    if (resultSets?.length && !selectedResultSetId) {
      setSelectedResultSetId(resultSets[0].id)
    }
  }, [resultSets, selectedResultSetId])

  const { data: maxMinData, isLoading: maxMinLoading } = useMaxMinData(
    projectSlug,
    selectedResultSetId
      ? {
          result_set_id: selectedResultSetId,
          result_type: selectedResultType,
        }
      : null
  )

  return (
    <div className="maxmin-view h-full flex">
      {/* Left Panel - Configuration */}
      <div className="maxmin-sidebar w-[200px] bg-bg-secondary border-r border-border-default flex flex-col overflow-auto">
        <ProjectBrowserNav projectSlug={projectSlug} />
        {/* Result Set Selection */}
        <div className="browser-section">
          <h3 className="browser-section-title">Result Set</h3>
          {resultSetsLoading ? (
            <div className="text-sm text-text-muted">Loading...</div>
          ) : resultSets?.length ? (
            <div className="space-y-1">
              {resultSets.map((rs) => (
                <button
                  key={rs.id}
                  onClick={() => setSelectedResultSetId(rs.id)}
                  className={clsx(
                    'browser-item',
                    selectedResultSetId === rs.id ? 'browser-item-active' : null
                  )}
                >
                  {rs.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-text-muted">No result sets available</div>
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
      </div>

      {/* Main Content */}
      <div className="maxmin-content flex-1 flex flex-col overflow-hidden">
        {selectedResultSetId ? (
          <>
            {/* Data Display */}
            <div className="maxmin-data flex-1 flex flex-col overflow-hidden">
              {maxMinLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">Loading max/min data...</div>
                </div>
              ) : maxMinData && maxMinData.rows?.length > 0 ? (
                <MaxMinResultsDisplay
                  data={maxMinData}
                  resultType={selectedResultType}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-text-secondary">No max/min data available</div>
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
