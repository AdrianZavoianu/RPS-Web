import clsx from 'clsx'
import type { WorkspaceContext } from '../hooks/useProjectWorkspaceActions'
import { useThemeStore } from '../../../stores/themeStore'
import { workspacePrefetch } from './workspaceLazy'

interface ProjectWorkspaceHeaderProps {
  activeContext: WorkspaceContext
  isContextExpanded: boolean
  onNavigateToProjectSettings: () => void
  onNavigateToProjects: () => void
  onOpenComparisonDialog: () => void
  onOpenExportDialog: () => void
  onOpenNlthaImportDialog: () => void
  onOpenPushoverCurvesDialog: () => void
  onOpenPushoverResultsDialog: () => void
  onOpenReportDialog: () => void
  onOpenTimeSeriesImportDialog: () => void
  onToggleContext: (context: WorkspaceContext) => void
  projectName: string
}

export function ProjectWorkspaceHeader({
  activeContext,
  isContextExpanded,
  onNavigateToProjectSettings,
  onNavigateToProjects,
  onOpenComparisonDialog,
  onOpenExportDialog,
  onOpenNlthaImportDialog,
  onOpenPushoverCurvesDialog,
  onOpenPushoverResultsDialog,
  onOpenReportDialog,
  onOpenTimeSeriesImportDialog,
  onToggleContext,
  projectName,
}: ProjectWorkspaceHeaderProps) {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <header className="project-header px-3">
      <div className="flex items-center gap-2 w-full min-w-max whitespace-nowrap">
        <span className="rps-icon" aria-hidden="true" />
        <span className="project-header-title">{projectName}</span>
        <div className="flex-1" />
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onToggleContext('NLTHA')}
            className={clsx(
              'project-context-tab',
              activeContext === 'NLTHA' && isContextExpanded && 'project-context-tab-active'
            )}
          >
            NLTHA
          </button>
          <button
            type="button"
            onClick={() => onToggleContext('Pushover')}
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
                    onClick={onOpenNlthaImportDialog}
                    onMouseEnter={workspacePrefetch.importDialog}
                    onFocus={workspacePrefetch.importDialog}
                    className="project-header-link"
                  >
                    Load NLTHA Data
                  </button>
                  <button
                    type="button"
                    onClick={onOpenTimeSeriesImportDialog}
                    onMouseEnter={workspacePrefetch.importDialog}
                    onFocus={workspacePrefetch.importDialog}
                    className="project-header-link"
                  >
                    Load Time Series
                  </button>
                  <button
                    type="button"
                    onClick={onOpenComparisonDialog}
                    onMouseEnter={workspacePrefetch.comparisonDialog}
                    onFocus={workspacePrefetch.comparisonDialog}
                    className="project-header-link"
                  >
                    Create Comparison
                  </button>
                  <button
                    type="button"
                    onClick={onOpenExportDialog}
                    onMouseEnter={workspacePrefetch.exportDialog}
                    onFocus={workspacePrefetch.exportDialog}
                    className="project-header-link"
                  >
                    Export Results
                  </button>
                  <button
                    type="button"
                    onClick={onOpenReportDialog}
                    onMouseEnter={workspacePrefetch.reportDialog}
                    onFocus={workspacePrefetch.reportDialog}
                    className="project-header-link"
                  >
                    Reporting
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onOpenPushoverCurvesDialog}
                    onMouseEnter={workspacePrefetch.pushoverImportDialog}
                    onFocus={workspacePrefetch.pushoverImportDialog}
                    className="project-header-link"
                  >
                    Load Pushover Curves
                  </button>
                  <button
                    type="button"
                    onClick={onOpenPushoverResultsDialog}
                    onMouseEnter={workspacePrefetch.pushoverImportDialog}
                    onFocus={workspacePrefetch.pushoverImportDialog}
                    className="project-header-link"
                  >
                    Load Results
                  </button>
                  <button
                    type="button"
                    onClick={onOpenExportDialog}
                    onMouseEnter={workspacePrefetch.exportDialog}
                    onFocus={workspacePrefetch.exportDialog}
                    className="project-header-link"
                  >
                    Export Results
                  </button>
                  <button
                    type="button"
                    onClick={onOpenReportDialog}
                    onMouseEnter={workspacePrefetch.reportDialog}
                    onFocus={workspacePrefetch.reportDialog}
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
        <span className="project-header-separator" aria-hidden="true" />
        <button type="button" onClick={onNavigateToProjects} className="project-header-link">
          Back to Projects
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="project-header-icon-button"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={onNavigateToProjectSettings}
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
      </div>
    </header>
  )
}
