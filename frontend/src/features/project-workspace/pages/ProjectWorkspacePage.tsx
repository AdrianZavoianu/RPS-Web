import { useLocation, useParams } from 'react-router-dom'
import { useProject } from '../../../hooks/useProjects'
import { useResultSets } from '../../../hooks/useResults'
import { ProjectWorkspaceContent } from '../components/ProjectWorkspaceContent'
import { ProjectWorkspaceDialogs } from '../components/ProjectWorkspaceDialogs'
import { ProjectWorkspaceHeader } from '../components/ProjectWorkspaceHeader'
import { useProjectWorkspaceActions } from '../hooks/useProjectWorkspaceActions'

export function ProjectWorkspacePage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const projectSlug = slug ?? ''
  const workspaceActions = useProjectWorkspaceActions(projectSlug)

  const { data: project, isLoading, error } = useProject(slug)
  const { data: resultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)

  const hasResultSets = (resultSets?.length ?? 0) > 0
  const pathSegments = location.pathname.split('/').filter(Boolean)
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

  return (
    <div className="h-full flex flex-col">
      <ProjectWorkspaceHeader
        projectName={project.name}
        activeContext={workspaceActions.activeContext}
        isContextExpanded={workspaceActions.isContextExpanded}
        onToggleContext={workspaceActions.toggleContext}
        onOpenNlthaImportDialog={workspaceActions.openNlthaImportDialog}
        onOpenTimeSeriesImportDialog={workspaceActions.openTimeSeriesImportDialog}
        onOpenComparisonDialog={workspaceActions.openComparisonDialog}
        onOpenExportDialog={workspaceActions.openExportDialog}
        onOpenReportDialog={workspaceActions.openReportDialog}
        onOpenPushoverCurvesDialog={workspaceActions.openPushoverCurvesDialog}
        onOpenPushoverResultsDialog={workspaceActions.openPushoverResultsDialog}
        onNavigateToProjectSettings={workspaceActions.navigateToProjectSettings}
        onNavigateToProjects={workspaceActions.navigateToProjects}
      />

      <ProjectWorkspaceContent
        projectSlug={projectSlug}
        resultSetsLoading={resultSetsLoading}
        hasResultSets={hasResultSets}
        showNoResultsState={showNoResultsState}
      />

      <ProjectWorkspaceDialogs
        projectSlug={projectSlug}
        projectName={project.name}
        importDialogMode={workspaceActions.importDialogMode}
        showImportDialog={workspaceActions.showImportDialog}
        showExportDialog={workspaceActions.showExportDialog}
        showReportDialog={workspaceActions.showReportDialog}
        showComparisonDialog={workspaceActions.showComparisonDialog}
        showPushoverCurvesDialog={workspaceActions.showPushoverCurvesDialog}
        showPushoverResultsDialog={workspaceActions.showPushoverResultsDialog}
        onCloseImportDialog={workspaceActions.closeImportDialog}
        onCloseExportDialog={workspaceActions.closeExportDialog}
        onCloseReportDialog={workspaceActions.closeReportDialog}
        onCloseComparisonDialog={workspaceActions.closeComparisonDialog}
        onClosePushoverCurvesDialog={workspaceActions.closePushoverCurvesDialog}
        onClosePushoverResultsDialog={workspaceActions.closePushoverResultsDialog}
        onImportComplete={workspaceActions.handleImportComplete}
        onPushoverImportComplete={workspaceActions.handlePushoverImportComplete}
        onComparisonCreated={workspaceActions.handleComparisonCreated}
      />
    </div>
  )
}
