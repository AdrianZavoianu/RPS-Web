import { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import {
  ElementResultsRoutePage,
  FoundationResultsRoutePage,
  MaxMinRoutePage,
  ProjectSettings,
  ResultsRoutePage,
  TimeSeriesRoutePage,
} from './workspaceLazy'

interface ProjectWorkspaceContentProps {
  hasResultSets: boolean
  projectSlug: string
  resultSetsLoading: boolean
  showNoResultsState: boolean
}

const routeFallback = (
  <div className="h-full flex items-center justify-center">
    <div className="text-text-secondary">Loading view...</div>
  </div>
)

export function ProjectWorkspaceContent({
  hasResultSets,
  projectSlug,
  resultSetsLoading,
  showNoResultsState,
}: ProjectWorkspaceContentProps) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      {resultSetsLoading ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-text-secondary">Loading results...</div>
        </div>
      ) : showNoResultsState ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center max-w-md">
            <h3 className="text-lg font-semibold text-text-primary">No results imported yet</h3>
            <p className="text-text-muted mt-2">
              Use the header actions to load NLTHA or Pushover data and start exploring
              results.
            </p>
          </div>
        </div>
      ) : (
        <Suspense fallback={routeFallback}>
          <Routes>
            <Route index element={<Navigate to={hasResultSets ? 'results' : 'settings'} replace />} />
            <Route path="results" element={<ResultsRoutePage projectSlug={projectSlug} />} />
            <Route path="maxmin" element={<MaxMinRoutePage projectSlug={projectSlug} />} />
            <Route path="elements" element={<ElementResultsRoutePage projectSlug={projectSlug} />} />
            <Route
              path="foundation"
              element={<FoundationResultsRoutePage projectSlug={projectSlug} />}
            />
            <Route path="pushover" element={<ResultsRoutePage projectSlug={projectSlug} />} />
            <Route path="time-series" element={<TimeSeriesRoutePage projectSlug={projectSlug} />} />
            <Route path="settings" element={<ProjectSettings projectSlug={projectSlug} />} />
          </Routes>
        </Suspense>
      )}
    </div>
  )
}
