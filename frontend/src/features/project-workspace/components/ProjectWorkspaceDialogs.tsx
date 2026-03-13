import { Suspense } from 'react'
import type { WorkspaceImportMode } from '../hooks/useProjectWorkspaceActions'
import {
  ComparisonSetDialog,
  ExportDialog,
  ImportDialog,
  PushoverImportDialog,
  ReportDialog,
} from './workspaceLazy'

interface ProjectWorkspaceDialogsProps {
  importDialogMode: WorkspaceImportMode
  onCloseComparisonDialog: () => void
  onCloseExportDialog: () => void
  onCloseImportDialog: () => void
  onClosePushoverCurvesDialog: () => void
  onClosePushoverResultsDialog: () => void
  onCloseReportDialog: () => void
  onComparisonCreated: () => void
  onImportComplete: (resultSetId?: number) => void
  onPushoverImportComplete: (resultSetId?: number) => void
  projectName: string
  projectSlug: string
  showComparisonDialog: boolean
  showExportDialog: boolean
  showImportDialog: boolean
  showPushoverCurvesDialog: boolean
  showPushoverResultsDialog: boolean
  showReportDialog: boolean
}

const dialogFallback = (
  <div className="dialog-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="text-text-secondary">Loading dialog...</div>
  </div>
)

export function ProjectWorkspaceDialogs({
  importDialogMode,
  onCloseComparisonDialog,
  onCloseExportDialog,
  onCloseImportDialog,
  onClosePushoverCurvesDialog,
  onClosePushoverResultsDialog,
  onCloseReportDialog,
  onComparisonCreated,
  onImportComplete,
  onPushoverImportComplete,
  projectName,
  projectSlug,
  showComparisonDialog,
  showExportDialog,
  showImportDialog,
  showPushoverCurvesDialog,
  showPushoverResultsDialog,
  showReportDialog,
}: ProjectWorkspaceDialogsProps) {
  return (
    <>
      {showImportDialog && (
        <Suspense fallback={dialogFallback}>
          <ImportDialog
            projectSlug={projectSlug}
            projectName={projectName}
            mode={importDialogMode}
            onClose={onCloseImportDialog}
            onComplete={onImportComplete}
          />
        </Suspense>
      )}

      {showExportDialog && (
        <Suspense fallback={dialogFallback}>
          <ExportDialog projectSlug={projectSlug} onClose={onCloseExportDialog} />
        </Suspense>
      )}

      {showReportDialog && (
        <Suspense fallback={dialogFallback}>
          <ReportDialog
            projectSlug={projectSlug}
            projectName={projectName}
            onClose={onCloseReportDialog}
          />
        </Suspense>
      )}

      {showComparisonDialog && (
        <Suspense fallback={dialogFallback}>
          <ComparisonSetDialog
            projectSlug={projectSlug}
            onClose={onCloseComparisonDialog}
            onCreated={onComparisonCreated}
          />
        </Suspense>
      )}

      {showPushoverCurvesDialog && (
        <Suspense fallback={dialogFallback}>
          <PushoverImportDialog
            projectSlug={projectSlug}
            projectName={projectName}
            mode="curves"
            onClose={onClosePushoverCurvesDialog}
            onComplete={onPushoverImportComplete}
          />
        </Suspense>
      )}

      {showPushoverResultsDialog && (
        <Suspense fallback={dialogFallback}>
          <PushoverImportDialog
            projectSlug={projectSlug}
            projectName={projectName}
            mode="results"
            onClose={onClosePushoverResultsDialog}
            onComplete={onPushoverImportComplete}
          />
        </Suspense>
      )}
    </>
  )
}
