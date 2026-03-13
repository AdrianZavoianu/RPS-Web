import { type ChangeEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import {
  useImportJob,
  usePrescanResult,
  useStartImport,
  useTriggerPrescan,
  useUploadFiles,
} from '../../hooks/useImports'
import { useProject } from '../../hooks/useProjects'
import { useResultSets } from '../../hooks/useResults'
import type { ConflictResolution, PrescanResult, ResultSet } from '../../types'
import { isNlthaResultSet } from '../../utils/resultSets'

export type ImportMode = 'nltha' | 'time-series'
export type ImportStep =
  | 'idle'
  | 'uploading'
  | 'prescan'
  | 'select'
  | 'importing'
  | 'complete'
  | 'error'

interface UseImportDialogStateParams {
  mode: ImportMode
  onClose: () => void
  onComplete?: (resultSetId: number) => void
  projectName?: string
  projectSlug: string
}

export interface UseImportDialogStateResult {
  conflictResolutions: Map<string, string | null>
  disableStart: boolean
  displayProjectName: string
  error: string | null
  folderInputRef: RefObject<HTMLInputElement>
  folderLabel: string
  logLines: string[]
  mode: ImportMode
  nlthaResultSets: ResultSet[]
  prescanResult: PrescanResult | undefined
  progressLabel: string
  progressPercent: number
  resultSetName: string
  selectedFiles: File[]
  selectedLoadCases: Set<string>
  selectedResultSetId: number | null
  showConflictDialog: boolean
  step: ImportStep
  handleClose: () => void
  handleConfirmConflictImport: () => Promise<void>
  handleFolderInput: (event: ChangeEvent<HTMLInputElement>) => void
  handleHideConflictDialog: () => void
  handleBrowseFolder: () => void
  handleResultSetNameChange: (value: string) => void
  handleResultSetSelectionChange: (value: string) => void
  handleSelectAllLoadCases: () => void
  handleClearLoadCases: () => void
  handleSetConflictFile: (sheet: string, loadCase: string, file: string | null) => void
  handleStartImport: () => Promise<void>
  toggleLoadCase: (name: string) => void
}

function getFilePathSegments(file: File): string[] {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  if (!relativePath) {
    return []
  }
  return relativePath.split('/').filter(Boolean)
}

function isTopLevelFile(file: File): boolean {
  return getFilePathSegments(file).length <= 2
}

function filterExcelFiles(files: File[]): File[] {
  return files.filter((file) => {
    const lowercaseName = file.name.toLowerCase()
    return (
      isTopLevelFile(file) &&
      !file.name.startsWith('~$') &&
      (lowercaseName.endsWith('.xlsx') || lowercaseName.endsWith('.xls'))
    )
  })
}

function deriveFolderLabel(files: File[]): string {
  const segments = getFilePathSegments(files[0])
  return segments[0] ?? 'Selected files'
}

export function useImportDialogState({
  mode,
  onClose,
  onComplete,
  projectName,
  projectSlug,
}: UseImportDialogStateParams): UseImportDialogStateResult {
  const [step, setStep] = useState<ImportStep>('idle')
  const [jobId, setJobId] = useState<number | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [folderLabel, setFolderLabel] = useState('')
  const [selectedLoadCases, setSelectedLoadCases] = useState<Set<string>>(new Set())
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, string | null>>(
    new Map()
  )
  const [resultSetName, setResultSetName] = useState('')
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logLines, setLogLines] = useState<string[]>(['Ready to import'])
  const [showConflictDialog, setShowConflictDialog] = useState(false)

  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const logSetRef = useRef<Set<string>>(new Set())

  const { data: project } = useProject(projectSlug)
  const { data: resultSets } = useResultSets(projectSlug)
  const displayProjectName = projectName || project?.name || projectSlug
  const nlthaResultSets = (resultSets || []).filter(isNlthaResultSet)

  const uploadMutation = useUploadFiles(projectSlug)
  const prescanMutation = useTriggerPrescan(projectSlug)
  const startImportMutation = useStartImport(projectSlug)

  const { data: prescanResult } = usePrescanResult(
    projectSlug,
    step === 'prescan' || step === 'select' ? jobId : null
  )

  const { data: importJob } = useImportJob(projectSlug, jobId)

  useEffect(() => {
    const input = folderInputRef.current
    if (!input) {
      return
    }
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
  }, [])

  const addLog = useCallback((line: string) => {
    if (logSetRef.current.has(line)) {
      return
    }
    logSetRef.current.add(line)
    setLogLines((previous) => [...previous, line])
  }, [])

  const resetImportState = () => {
    setSelectedLoadCases(new Set())
    setConflictResolutions(new Map())
    setError(null)
    setStep('idle')
    setJobId(null)
    logSetRef.current.clear()
    setLogLines(['Ready to import'])
  }

  useEffect(() => {
    if (mode !== 'time-series') {
      return
    }

    if (!nlthaResultSets.length) {
      setSelectedResultSetId(null)
      return
    }

    const hasSelectedResultSet =
      selectedResultSetId !== null &&
      nlthaResultSets.some((resultSet) => resultSet.id === selectedResultSetId)

    if (!hasSelectedResultSet) {
      setSelectedResultSetId(nlthaResultSets[0].id)
    }
  }, [mode, nlthaResultSets, selectedResultSetId])

  const handleFileUpload = useCallback(
    async (files: File[]) => {
      try {
        setError(null)
        setStep('uploading')
        addLog('- Uploading files...')

        const result = await uploadMutation.mutateAsync(files)
        setJobId(result.job_id)
        addLog(`- Uploaded ${result.files_uploaded} file(s)`)

        setStep('prescan')
        await prescanMutation.mutateAsync(result.job_id)
        addLog('- Scanning files...')
      } catch (uploadError) {
        const message = (uploadError as Error).message
        setError(message)
        addLog(`- Upload failed: ${message}`)
        setStep('error')
      }
    },
    [addLog, prescanMutation, uploadMutation]
  )

  const handleFolderInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : []
    const excelFiles = filterExcelFiles(files)

    if (!excelFiles.length) {
      setError(
        'No Excel files found in the selected folder. Only top-level .xlsx or .xls files are imported.'
      )
      addLog('- No Excel files detected in the selected folder')
      event.target.value = ''
      return
    }

    resetImportState()
    setSelectedFiles(excelFiles)
    setFolderLabel(deriveFolderLabel(excelFiles))
    addLog(`- Found ${excelFiles.length} Excel file(s).`)
    void handleFileUpload(excelFiles)
    event.target.value = ''
  }

  const handleBrowseFolder = () => {
    folderInputRef.current?.click()
  }

  const toggleLoadCase = (name: string) => {
    setSelectedLoadCases((previous) => {
      const next = new Set(previous)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const handleSelectAllLoadCases = () => {
    if (!prescanResult?.load_cases.length) {
      return
    }
    setSelectedLoadCases(new Set(prescanResult.load_cases.map((loadCase) => loadCase.name)))
  }

  const handleClearLoadCases = () => {
    setSelectedLoadCases(new Set())
  }

  const handleSetConflictFile = (sheet: string, loadCase: string, file: string | null) => {
    setConflictResolutions((previous) => {
      const next = new Map(previous)
      next.set(`${sheet}:${loadCase}`, file)
      return next
    })
  }

  const runImport = useCallback(async () => {
    if (!jobId) {
      return
    }

    try {
      if (mode === 'time-series' && selectedResultSetId === null) {
        const message = 'Select an existing result set for time-series import.'
        setError(message)
        addLog(`- ${message}`)
        return
      }

      setError(null)
      setStep('importing')
      addLog('- Starting import...')
      addLog(`- Importing into project: ${displayProjectName}`)

      if (mode === 'time-series') {
        const selectedResultSetName =
          nlthaResultSets.find((resultSet) => resultSet.id === selectedResultSetId)?.name ||
          `Result Set ${selectedResultSetId}`
        addLog(`- Result set: ${selectedResultSetName}`)
      } else {
        addLog(`- Result set: ${resultSetName.trim() || 'Imported Results'}`)
      }

      addLog(`- Processing ${selectedFiles.length} file(s)...`)
      if (selectedLoadCases.size) {
        addLog(`- Enhanced import: ${selectedLoadCases.size} load case(s) selected`)
      } else {
        addLog('- Standard import: all load cases will be imported')
      }

      const resolutions: ConflictResolution[] = []
      for (const [key, file] of conflictResolutions) {
        const [sheet, loadCase] = key.split(':')
        resolutions.push({ sheet, load_case: loadCase, chosen_file: file })
      }

      await startImportMutation.mutateAsync({
        jobId,
        options: {
          selected_load_cases: Array.from(selectedLoadCases),
          conflict_resolutions: resolutions,
          result_set_name:
            mode === 'time-series' ? undefined : resultSetName.trim() || 'Imported Results',
          result_set_id: mode === 'time-series' ? selectedResultSetId || undefined : undefined,
        },
      })
    } catch (runImportError) {
      const message = (runImportError as Error).message
      setError(message)
      addLog(`- Import failed: ${message}`)
      setStep('error')
    }
  }, [
    addLog,
    conflictResolutions,
    displayProjectName,
    jobId,
    mode,
    nlthaResultSets,
    resultSetName,
    selectedFiles.length,
    selectedLoadCases,
    selectedResultSetId,
    startImportMutation,
  ])

  const handleStartImport = async () => {
    if (!jobId || step === 'importing') {
      return
    }

    if (prescanResult?.conflicts.length) {
      setShowConflictDialog(true)
      return
    }

    await runImport()
  }

  const handleHideConflictDialog = () => {
    setShowConflictDialog(false)
  }

  const handleConfirmConflictImport = async () => {
    setShowConflictDialog(false)
    await runImport()
  }

  const handleClose = () => {
    const resultSetId = importJob?.import_summary?.result_set_id as number | undefined
    if (resultSetId) {
      onComplete?.(resultSetId)
    }
    onClose()
  }

  useEffect(() => {
    if (!prescanResult || step !== 'prescan') {
      return
    }

    setSelectedLoadCases(new Set(prescanResult.load_cases.map((loadCase) => loadCase.name)))

    const resolutions = new Map<string, string | null>()
    for (const conflict of prescanResult.conflicts) {
      resolutions.set(`${conflict.sheet}:${conflict.load_case}`, conflict.files[0])
    }
    setConflictResolutions(resolutions)

    addLog(
      `- Scan complete: ${prescanResult.files_scanned} file(s), ${prescanResult.load_cases.length} load case(s)`
    )

    if (prescanResult.conflicts.length) {
      addLog(`- Detected ${prescanResult.conflicts.length} load case conflict(s)`)
    }

    if (prescanResult.errors.length) {
      addLog(`- ${prescanResult.errors.length} warning(s) found during scan`)
    }

    setStep('select')
  }, [addLog, prescanResult, step])

  useEffect(() => {
    if (!importJob) {
      return
    }

    if (importJob.status === 'completed') {
      const summary = importJob.import_summary as {
        errors?: unknown
        has_warnings?: unknown
        warning_count?: unknown
      } | null

      const importErrors = Array.isArray(summary?.errors)
        ? summary.errors.filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0
          )
        : []

      const warningCountFromSummary =
        typeof summary?.warning_count === 'number' && Number.isFinite(summary.warning_count)
          ? summary.warning_count
          : undefined

      const hasWarningsFromSummary = summary?.has_warnings === true

      if (
        importErrors.length > 0 ||
        hasWarningsFromSummary ||
        (warningCountFromSummary ?? 0) > 0
      ) {
        const warningCount = warningCountFromSummary ?? importErrors.length
        const warning = `Import completed with ${warningCount} file error(s)`
        setError(warning)
        addLog(`- ${warning}`)

        for (const entry of importErrors.slice(0, 3)) {
          addLog(`- ${entry}`)
        }

        if (importErrors.length > 3) {
          addLog(`- ...and ${importErrors.length - 3} more file error(s)`)
        }

        setStep('error')
        return
      }

      addLog('- Import completed successfully')
      setStep('complete')
    }

    if (importJob.status === 'failed') {
      const message = importJob.error_message || 'Import failed'
      setError(message)
      addLog(`- Import failed: ${message}`)
      setStep('error')
    }
  }, [addLog, importJob])

  const progressPercent = importJob?.progress_percent || 0
  const progressLabel =
    importJob?.current_phase ||
    (step === 'prescan'
      ? 'Scanning files'
      : step === 'uploading'
        ? 'Uploading files'
        : step === 'importing'
          ? 'Importing data'
          : 'Ready to import')

  const disableStart =
    !selectedFiles.length ||
    (mode === 'time-series' && selectedResultSetId === null) ||
    step === 'uploading' ||
    step === 'prescan' ||
    step === 'importing'

  const handleResultSetSelectionChange = (value: string) => {
    setSelectedResultSetId(Number(value) || null)
  }

  const handleResultSetNameChange = (value: string) => {
    setResultSetName(value)
  }

  return {
    conflictResolutions,
    disableStart,
    displayProjectName,
    error,
    folderInputRef,
    folderLabel,
    logLines,
    mode,
    nlthaResultSets,
    prescanResult,
    progressLabel,
    progressPercent,
    resultSetName,
    selectedFiles,
    selectedLoadCases,
    selectedResultSetId,
    showConflictDialog,
    step,
    handleBrowseFolder,
    handleClearLoadCases,
    handleClose,
    handleConfirmConflictImport,
    handleFolderInput,
    handleHideConflictDialog,
    handleResultSetNameChange,
    handleResultSetSelectionChange,
    handleSelectAllLoadCases,
    handleSetConflictFile,
    handleStartImport,
    toggleLoadCase,
  }
}
