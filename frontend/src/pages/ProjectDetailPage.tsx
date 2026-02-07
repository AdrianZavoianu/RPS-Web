import { useState, useCallback } from 'react'
import { useParams, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useResultSets } from '../hooks/useResults'
import { ComparisonView } from '../components/results/ComparisonView'
import { ResultsView } from '../components/results/ResultsView'
import { MaxMinView } from '../components/results/MaxMinView'
import { PushoverView } from '../components/results/PushoverView'
import { ElementResultsView } from '../components/results/ElementResultsView'
import { JointResultsView } from '../components/results/JointResultsView'
import { ImportDialog } from '../components/imports/ImportDialog'
import { ExportDialog } from '../components/exports/ExportDialog'
import { ReportDialog } from '../components/reports/ReportDialog'
import { TimeSeriesView } from '../components/results/TimeSeriesView'
import { useProject } from '../hooks/useProjects'
import { ProjectSettings } from '../components/projects/ProjectSettings'

export function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const projectSlug = slug ?? ''
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [isContextExpanded, setIsContextExpanded] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const handleImportComplete = useCallback(() => {
    // Invalidate all result-related queries to refresh data immediately
    queryClient.invalidateQueries({ queryKey: ['resultSets', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['availableResultTypes', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['globalResults', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['elementResults', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['jointResults', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['chartData', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['timeSeriesLoadCases', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['timeSeriesData', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['pushoverCases', projectSlug] })
    setShowImportDialog(false)
  }, [queryClient, projectSlug])

  const { data: project, isLoading, error } = useProject(slug)
  const { data: resultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const pathSegments = location.pathname.split('/').filter(Boolean)
  const activeContext = pathSegments.includes('pushover') ? 'Pushover' : 'NLTHA'
  const hasResultSets = (resultSets?.length ?? 0) > 0

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-secondary">Loading project...</div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-400">Failed to load project</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Project Header */}
      <header className="project-header px-3">
        <div className="flex items-center gap-2 w-full min-w-max whitespace-nowrap">
          <span className="rps-icon" aria-hidden="true" />
          <span className="project-header-title">{project.name}</span>
          <div className="flex-1" />
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => {
                if (activeContext === 'NLTHA') {
                  setIsContextExpanded(!isContextExpanded)
                } else {
                  navigate(`/projects/${projectSlug}/results`)
                  setIsContextExpanded(true)
                }
              }}
              className={clsx(
                'project-context-tab',
                activeContext === 'NLTHA' && isContextExpanded && 'project-context-tab-active'
              )}
            >
              NLTHA
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeContext === 'Pushover') {
                  setIsContextExpanded(!isContextExpanded)
                } else {
                  navigate(`/projects/${projectSlug}/pushover`)
                  setIsContextExpanded(true)
                }
              }}
              className={clsx(
                'project-context-tab',
                activeContext === 'Pushover' && isContextExpanded && 'project-context-tab-active'
              )}
            >
              Pushover
            </button>
          </div>
          {isContextExpanded && (
            <>
              <span className="project-header-separator" aria-hidden="true" />
              <div className="flex items-center gap-1 whitespace-nowrap">
                {activeContext === 'NLTHA' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowImportDialog(true)}
                      className="project-header-link"
                    >
                      Load NLTHA Data
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/projects/${projectSlug}/time-series`)
                        setShowImportDialog(true)
                      }}
                      className="project-header-link"
                    >
                      Load Time Series
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${projectSlug}/comparison`)}
                      className="project-header-link"
                    >
                      Create Comparison
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowExportDialog(true)}
                      className="project-header-link"
                    >
                      Export Results
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReportDialog(true)}
                      className="project-header-link"
                    >
                      Reporting
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/projects/${projectSlug}/pushover`)
                        setShowImportDialog(true)
                      }}
                      className="project-header-link"
                    >
                      Load Pushover Curves
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/projects/${projectSlug}/pushover`)
                        setShowImportDialog(true)
                      }}
                      className="project-header-link"
                    >
                      Load Results
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowExportDialog(true)}
                      className="project-header-link"
                    >
                      Export Results
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReportDialog(true)}
                      className="project-header-link"
                    >
                      Reporting
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          <span className="project-header-separator" aria-hidden="true" />
          <button type="button" className="project-header-link" disabled title="Coming soon">
            Export Project
          </button>
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectSlug}/settings`)}
            className="project-header-icon-button"
            aria-label="Project settings"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01A1.65 1.65 0 0 0 9 3.09V3a2 2 0 0 1 4 0v.09c0 .65.38 1.24.97 1.5h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.46.46-.6 1.14-.33 1.82v.01c.26.58.85.96 1.5.96H21a2 2 0 0 1 0 4h-.09c-.65 0-1.24.38-1.5.97z" />
            </svg>
          </button>
          <span className="project-header-separator" aria-hidden="true" />
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="project-header-link"
          >
            Back to Projects
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {resultSetsLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-text-secondary">Loading results...</div>
          </div>
        ) : !hasResultSets ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <h3 className="text-lg font-semibold text-text-primary">
                No results imported yet
              </h3>
              <p className="text-text-muted mt-2">
                Use the header actions to load NLTHA or Pushover data and start
                exploring results.
              </p>
            </div>
          </div>
        ) : (
          <Routes>
            <Route index element={<Navigate to="results" replace />} />
            <Route path="results" element={<ResultsView projectSlug={projectSlug} />} />
            <Route path="maxmin" element={<MaxMinView projectSlug={projectSlug} />} />
            <Route path="comparison" element={<ComparisonView projectSlug={projectSlug} />} />
            <Route path="elements" element={<ElementResultsView projectSlug={projectSlug} />} />
            <Route path="foundation" element={<JointResultsView projectSlug={projectSlug} />} />
            <Route path="pushover" element={<PushoverView projectSlug={projectSlug} />} />
            <Route path="time-series" element={<TimeSeriesView projectSlug={projectSlug} />} />
            <Route path="settings" element={<ProjectSettings projectSlug={projectSlug} />} />
          </Routes>
        )}
      </div>

      {/* Import Dialog */}
      {showImportDialog && (
        <ImportDialog
          projectSlug={projectSlug}
          projectName={project.name}
          onClose={() => setShowImportDialog(false)}
          onComplete={handleImportComplete}
        />
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          projectSlug={projectSlug}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Report Dialog */}
      {showReportDialog && (
        <ReportDialog
          projectSlug={projectSlug}
          onClose={() => setShowReportDialog(false)}
        />
      )}
    </div>
  )
}
