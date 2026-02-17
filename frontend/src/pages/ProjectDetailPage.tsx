import { useState, useCallback, lazy, Suspense } from 'react'
import { useParams, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useResultSets } from '../hooks/useResults'
import { useProject } from '../hooks/useProjects'

const ResultsView = lazy(() =>
  import('../components/results/ResultsView').then((module) => ({ default: module.ResultsView }))
)
const MaxMinView = lazy(() =>
  import('../components/results/MaxMinView').then((module) => ({ default: module.MaxMinView }))
)
const ElementResultsView = lazy(() =>
  import('../components/results/ElementResultsView').then((module) => ({
    default: module.ElementResultsView,
  }))
)
const JointResultsView = lazy(() =>
  import('../components/results/JointResultsView').then((module) => ({
    default: module.JointResultsView,
  }))
)
const TimeSeriesView = lazy(() =>
  import('../components/results/TimeSeriesView').then((module) => ({ default: module.TimeSeriesView }))
)
const ProjectSettings = lazy(() =>
  import('../components/projects/ProjectSettings').then((module) => ({
    default: module.ProjectSettings,
  }))
)
const importImportDialogModule = () => import('../components/imports/ImportDialog')
const importPushoverImportDialogModule = () => import('../components/imports/PushoverImportDialog')
const importExportDialogModule = () => import('../components/exports/ExportDialog')
const importReportDialogModule = () => import('../components/reports/ReportDialog')
const importComparisonDialogModule = () => import('../components/comparisons/ComparisonSetDialog')

const ImportDialog = lazy(() =>
  importImportDialogModule().then((module) => ({
    default: module.ImportDialog,
  }))
)
const PushoverImportDialog = lazy(() =>
  importPushoverImportDialogModule().then((module) => ({
    default: module.PushoverImportDialog,
  }))
)
const ExportDialog = lazy(() =>
  importExportDialogModule().then((module) => ({
    default: module.ExportDialog,
  }))
)
const ReportDialog = lazy(() =>
  importReportDialogModule().then((module) => ({
    default: module.ReportDialog,
  }))
)
const ComparisonSetDialog = lazy(() =>
  importComparisonDialogModule().then((module) => ({
    default: module.ComparisonSetDialog,
  }))
)

export function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const projectSlug = slug ?? ''
  const [importDialogMode, setImportDialogMode] = useState<'nltha' | 'time-series'>('nltha')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showPushoverCurvesDialog, setShowPushoverCurvesDialog] = useState(false)
  const [showPushoverResultsDialog, setShowPushoverResultsDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [showComparisonDialog, setShowComparisonDialog] = useState(false)
  const [isContextExpanded, setIsContextExpanded] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [activeContext, setActiveContext] = useState<'NLTHA' | 'Pushover'>(() =>
    location.pathname.includes('/pushover') ? 'Pushover' : 'NLTHA'
  )
  const queryClient = useQueryClient()

  const handleImportComplete = useCallback(() => {
    // Invalidate all result-related queries to refresh data immediately
    queryClient.invalidateQueries({ queryKey: ['resultSets', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['availableResultTypes', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['globalResults', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['elementResults', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['jointResults', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['chartData', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['beamRotationsPlot', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['beamRotationsTable', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['columnRotationsPlot', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['timeSeriesLoadCases', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['timeSeriesData', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['pushoverCases', projectSlug] })
    setShowImportDialog(false)
  }, [queryClient, projectSlug])

  const handlePushoverImportComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['resultSets', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['pushoverCases', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['globalResults', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['availableResultTypes', projectSlug] })
    setShowPushoverCurvesDialog(false)
    setShowPushoverResultsDialog(false)
  }, [queryClient, projectSlug])

  const { data: project, isLoading, error } = useProject(slug)
  const { data: resultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const pathSegments = location.pathname.split('/').filter(Boolean)
  const hasResultSets = (resultSets?.length ?? 0) > 0
  const isSettingsRoute = pathSegments[pathSegments.length - 1] === 'settings'
  const showNoResultsState = !hasResultSets && !isSettingsRoute

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

  const routeFallback = (
    <div className="h-full flex items-center justify-center">
      <div className="text-text-secondary">Loading view...</div>
    </div>
  )
  const dialogFallback = (
    <div className="dialog-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="text-text-secondary">Loading dialog...</div>
    </div>
  )
  const prefetchImportDialog = () => {
    void importImportDialogModule()
  }
  const prefetchExportDialog = () => {
    void importExportDialogModule()
  }
  const prefetchReportDialog = () => {
    void importReportDialogModule()
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
                  setActiveContext('NLTHA')
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
                  setActiveContext('Pushover')
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
                      onClick={() => {
                        setImportDialogMode('nltha')
                        setShowImportDialog(true)
                      }}
                      onMouseEnter={prefetchImportDialog}
                      onFocus={prefetchImportDialog}
                      className="project-header-link"
                    >
                      Load NLTHA Data
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/projects/${projectSlug}/time-series`)
                        setImportDialogMode('time-series')
                        setShowImportDialog(true)
                      }}
                      onMouseEnter={prefetchImportDialog}
                      onFocus={prefetchImportDialog}
                      className="project-header-link"
                    >
                      Load Time Series
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowComparisonDialog(true)}
                      onMouseEnter={() => void importComparisonDialogModule()}
                      onFocus={() => void importComparisonDialogModule()}
                      className="project-header-link"
                    >
                      Create Comparison
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowExportDialog(true)}
                      onMouseEnter={prefetchExportDialog}
                      onFocus={prefetchExportDialog}
                      className="project-header-link"
                    >
                      Export Results
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReportDialog(true)}
                      onMouseEnter={prefetchReportDialog}
                      onFocus={prefetchReportDialog}
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
                        setShowPushoverCurvesDialog(true)
                      }}
                      onMouseEnter={() => void importPushoverImportDialogModule()}
                      onFocus={() => void importPushoverImportDialogModule()}
                      className="project-header-link"
                    >
                      Load Pushover Curves
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPushoverResultsDialog(true)
                      }}
                      onMouseEnter={() => void importPushoverImportDialogModule()}
                      onFocus={() => void importPushoverImportDialogModule()}
                      className="project-header-link"
                    >
                      Load Results
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowExportDialog(true)}
                      onMouseEnter={prefetchExportDialog}
                      onFocus={prefetchExportDialog}
                      className="project-header-link"
                    >
                      Export Results
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReportDialog(true)}
                      onMouseEnter={prefetchReportDialog}
                      onFocus={prefetchReportDialog}
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
        ) : showNoResultsState ? (
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
          <Suspense fallback={routeFallback}>
            <Routes>
              <Route index element={<Navigate to={hasResultSets ? 'results' : 'settings'} replace />} />
              <Route path="results" element={<ResultsView projectSlug={projectSlug} />} />
              <Route path="maxmin" element={<MaxMinView projectSlug={projectSlug} />} />
              <Route path="elements" element={<ElementResultsView projectSlug={projectSlug} />} />
              <Route path="foundation" element={<JointResultsView projectSlug={projectSlug} />} />
              <Route path="pushover" element={<ResultsView projectSlug={projectSlug} />} />
              <Route path="time-series" element={<TimeSeriesView projectSlug={projectSlug} />} />
              <Route path="settings" element={<ProjectSettings projectSlug={projectSlug} />} />
            </Routes>
          </Suspense>
        )}
      </div>

      {/* Import Dialog */}
      {showImportDialog && (
        <Suspense fallback={dialogFallback}>
          <ImportDialog
            projectSlug={projectSlug}
            projectName={project.name}
            mode={importDialogMode}
            onClose={() => setShowImportDialog(false)}
            onComplete={handleImportComplete}
          />
        </Suspense>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <Suspense fallback={dialogFallback}>
          <ExportDialog
            projectSlug={projectSlug}
            onClose={() => setShowExportDialog(false)}
          />
        </Suspense>
      )}

      {/* Report Dialog */}
      {showReportDialog && (
        <Suspense fallback={dialogFallback}>
          <ReportDialog
            projectSlug={projectSlug}
            projectName={project.name}
            onClose={() => setShowReportDialog(false)}
          />
        </Suspense>
      )}

      {/* Comparison Set Dialog */}
      {showComparisonDialog && (
        <Suspense fallback={dialogFallback}>
          <ComparisonSetDialog
            projectSlug={projectSlug}
            onClose={() => setShowComparisonDialog(false)}
            onCreated={() => {
              queryClient.invalidateQueries({ queryKey: ['comparisonSets', projectSlug] })
            }}
          />
        </Suspense>
      )}

      {/* Pushover Curves Import Dialog */}
      {showPushoverCurvesDialog && (
        <Suspense fallback={dialogFallback}>
          <PushoverImportDialog
            projectSlug={projectSlug}
            projectName={project.name}
            mode="curves"
            onClose={() => setShowPushoverCurvesDialog(false)}
            onComplete={handlePushoverImportComplete}
          />
        </Suspense>
      )}

      {/* Pushover Results Import Dialog */}
      {showPushoverResultsDialog && (
        <Suspense fallback={dialogFallback}>
          <PushoverImportDialog
            projectSlug={projectSlug}
            projectName={project.name}
            mode="results"
            onClose={() => setShowPushoverResultsDialog(false)}
            onComplete={handlePushoverImportComplete}
          />
        </Suspense>
      )}
    </div>
  )
}
