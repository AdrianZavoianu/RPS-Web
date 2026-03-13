import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateByPrefix, invalidateProjectResults } from '../../../hooks/invalidation'
import { queryKeys } from '../../../hooks/queryKeys'

export type WorkspaceContext = 'NLTHA' | 'Pushover'
export type WorkspaceImportMode = 'nltha' | 'time-series'

export interface ProjectWorkspaceActionsState {
  activeContext: WorkspaceContext
  importDialogMode: WorkspaceImportMode
  isContextExpanded: boolean
  showComparisonDialog: boolean
  showExportDialog: boolean
  showImportDialog: boolean
  showPushoverCurvesDialog: boolean
  showPushoverResultsDialog: boolean
  showReportDialog: boolean
}

export interface ProjectWorkspaceActions extends ProjectWorkspaceActionsState {
  closeComparisonDialog: () => void
  closeExportDialog: () => void
  closeImportDialog: () => void
  closePushoverCurvesDialog: () => void
  closePushoverResultsDialog: () => void
  closeReportDialog: () => void
  handleComparisonCreated: () => void
  handleImportComplete: (resultSetId?: number) => void
  handlePushoverImportComplete: (resultSetId?: number) => void
  navigateToProjectSettings: () => void
  navigateToProjects: () => void
  openComparisonDialog: () => void
  openExportDialog: () => void
  openNlthaImportDialog: () => void
  openPushoverCurvesDialog: () => void
  openPushoverResultsDialog: () => void
  openReportDialog: () => void
  openTimeSeriesImportDialog: () => void
  toggleContext: (context: WorkspaceContext) => void
}

export function useProjectWorkspaceActions(projectSlug: string): ProjectWorkspaceActions {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeContext, setActiveContext] = useState<WorkspaceContext>(() =>
    location.pathname.includes('/pushover') ? 'Pushover' : 'NLTHA'
  )
  const [importDialogMode, setImportDialogMode] = useState<WorkspaceImportMode>('nltha')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showPushoverCurvesDialog, setShowPushoverCurvesDialog] = useState(false)
  const [showPushoverResultsDialog, setShowPushoverResultsDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [showComparisonDialog, setShowComparisonDialog] = useState(false)
  const [isContextExpanded, setIsContextExpanded] = useState(false)

  const toggleContext = useCallback(
    (context: WorkspaceContext) => {
      if (activeContext === context) {
        setIsContextExpanded((current) => !current)
        return
      }

      setActiveContext(context)
      setIsContextExpanded(true)
    },
    [activeContext]
  )

  const openNlthaImportDialog = useCallback(() => {
    setImportDialogMode('nltha')
    setShowImportDialog(true)
  }, [])

  const openTimeSeriesImportDialog = useCallback(() => {
    navigate(`/projects/${projectSlug}/time-series`)
    setImportDialogMode('time-series')
    setShowImportDialog(true)
  }, [navigate, projectSlug])

  const openComparisonDialog = useCallback(() => {
    setShowComparisonDialog(true)
  }, [])

  const openExportDialog = useCallback(() => {
    setShowExportDialog(true)
  }, [])

  const openReportDialog = useCallback(() => {
    setShowReportDialog(true)
  }, [])

  const openPushoverCurvesDialog = useCallback(() => {
    setShowPushoverCurvesDialog(true)
  }, [])

  const openPushoverResultsDialog = useCallback(() => {
    setShowPushoverResultsDialog(true)
  }, [])

  const closeImportDialog = useCallback(() => {
    setShowImportDialog(false)
  }, [])

  const closePushoverCurvesDialog = useCallback(() => {
    setShowPushoverCurvesDialog(false)
  }, [])

  const closePushoverResultsDialog = useCallback(() => {
    setShowPushoverResultsDialog(false)
  }, [])

  const closeExportDialog = useCallback(() => {
    setShowExportDialog(false)
  }, [])

  const closeReportDialog = useCallback(() => {
    setShowReportDialog(false)
  }, [])

  const closeComparisonDialog = useCallback(() => {
    setShowComparisonDialog(false)
  }, [])

  const handleImportComplete = useCallback(
    (resultSetId?: number) => {
      void resultSetId
      invalidateProjectResults(queryClient, projectSlug)
      setShowImportDialog(false)
    },
    [projectSlug, queryClient]
  )

  const handlePushoverImportComplete = useCallback(
    (resultSetId?: number) => {
      void resultSetId
      invalidateProjectResults(queryClient, projectSlug)
      setShowPushoverCurvesDialog(false)
      setShowPushoverResultsDialog(false)
    },
    [projectSlug, queryClient]
  )

  const handleComparisonCreated = useCallback(() => {
    invalidateByPrefix(queryClient, queryKeys.comparisonSets(projectSlug))
  }, [projectSlug, queryClient])

  const navigateToProjectSettings = useCallback(() => {
    navigate(`/projects/${projectSlug}/settings`)
  }, [navigate, projectSlug])

  const navigateToProjects = useCallback(() => {
    navigate('/projects')
  }, [navigate])

  return {
    activeContext,
    importDialogMode,
    isContextExpanded,
    showComparisonDialog,
    showExportDialog,
    showImportDialog,
    showPushoverCurvesDialog,
    showPushoverResultsDialog,
    showReportDialog,
    closeComparisonDialog,
    closeExportDialog,
    closeImportDialog,
    closePushoverCurvesDialog,
    closePushoverResultsDialog,
    closeReportDialog,
    handleComparisonCreated,
    handleImportComplete,
    handlePushoverImportComplete,
    navigateToProjectSettings,
    navigateToProjects,
    openComparisonDialog,
    openExportDialog,
    openNlthaImportDialog,
    openPushoverCurvesDialog,
    openPushoverResultsDialog,
    openReportDialog,
    openTimeSeriesImportDialog,
    toggleContext,
  }
}
