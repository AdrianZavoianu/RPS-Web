/**
 * Pushover import dialog - simplified import for pushover curves and global results.
 * No prescan or load case selection needed — just upload, name, and start.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  useUploadFiles,
  useStartPushoverImport,
  useStartPushoverResultsImport,
  useImportJob,
} from '../../hooks/useImports'
import { useProject } from '../../hooks/useProjects'
import { useResultSets } from '../../hooks/useResults'
import { isPushoverResultSet } from '../../utils/resultSets'

interface PushoverImportDialogProps {
  projectSlug: string
  projectName?: string
  mode: 'curves' | 'results'
  onClose: () => void
  onComplete?: () => void
}

type ImportStep = 'idle' | 'uploading' | 'importing' | 'complete' | 'error'

export function PushoverImportDialog({
  projectSlug,
  projectName,
  mode,
  onClose,
  onComplete,
}: PushoverImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('idle')
  const [jobId, setJobId] = useState<number | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [sourceLabel, setSourceLabel] = useState('')
  const [resultSetName, setResultSetName] = useState(
    mode === 'curves' ? 'Pushover Results' : 'Pushover Results'
  )
  const [existingResultSetId, setExistingResultSetId] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [logLines, setLogLines] = useState<string[]>(['Ready to import'])

  const sourceInputRef = useRef<HTMLInputElement | null>(null)
  const logSetRef = useRef<Set<string>>(new Set())

  const { data: project } = useProject(projectSlug)
  const displayProjectName = projectName || project?.name || projectSlug

  const { data: allResultSets } = useResultSets(projectSlug)
  const pushoverResultSets = allResultSets?.filter(isPushoverResultSet) ?? []

  const uploadMutation = useUploadFiles(projectSlug)
  const startPushoverMutation = useStartPushoverImport(projectSlug)
  const startResultsMutation = useStartPushoverResultsImport(projectSlug)

  const { data: importJob } = useImportJob(projectSlug, jobId)

  useEffect(() => {
    const input = sourceInputRef.current
    if (!input) return
    if (mode === 'results') {
      input.setAttribute('webkitdirectory', '')
      input.setAttribute('directory', '')
    } else {
      input.removeAttribute('webkitdirectory')
      input.removeAttribute('directory')
    }
  }, [mode])

  const addLog = useCallback((line: string) => {
    if (logSetRef.current.has(line)) return
    logSetRef.current.add(line)
    setLogLines((prev) => [...prev, line])
  }, [])

  const isTopLevelFile = (file: File) => {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    if (!relativePath) return true
    const segments = relativePath.split('/').filter(Boolean)
    return segments.length <= 2
  }

  const getExcelFiles = (files: File[]) => {
    const excelFiles = files.filter(
      (file) =>
        !file.name.startsWith('~$') &&
        (file.name.toLowerCase().endsWith('.xlsx') ||
          file.name.toLowerCase().endsWith('.xls'))
    )
    if (mode === 'curves') {
      return excelFiles.slice(0, 1)
    }
    return excelFiles.filter((file) => isTopLevelFile(file))
  }

  const deriveSourceLabel = (files: File[]) => {
    if (mode === 'curves') {
      return files[0]?.name || ''
    }
    const relativePath = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath
    if (relativePath) {
      return relativePath.split('/')[0]
    }
    return 'Selected files'
  }

  const handleSourceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    const excelFiles = getExcelFiles(files)
    if (!excelFiles.length) {
      setError(
        mode === 'curves'
          ? 'No Excel file selected. Please choose a .xlsx or .xls file.'
          : 'No Excel files found in the selected folder. Only top-level .xlsx or .xls files are imported.'
      )
      addLog(
        mode === 'curves'
          ? '- No Excel file selected'
          : '- No Excel files detected in the selected folder'
      )
      e.target.value = ''
      return
    }
    setError(null)
    setStep('idle')
    setJobId(null)
    logSetRef.current.clear()
    setLogLines(['Ready to import'])
    setSelectedFiles(excelFiles)
    setSourceLabel(deriveSourceLabel(excelFiles))
    addLog(`- Found ${excelFiles.length} Excel file(s).`)
    e.target.value = ''
  }

  const handleBrowseSource = () => {
    sourceInputRef.current?.click()
  }

  const handleStartImport = async () => {
    if (!selectedFiles.length || step === 'importing') return

    try {
      setError(null)
      setStep('uploading')
      addLog('- Uploading files...')

      const uploadResult = await uploadMutation.mutateAsync(selectedFiles)
      setJobId(uploadResult.job_id)
      addLog(`- Uploaded ${uploadResult.files_uploaded} file(s)`)

      setStep('importing')
      const modeLabel = mode === 'curves' ? 'pushover curves' : 'pushover results'
      addLog(`- Starting ${modeLabel} import...`)
      addLog(`- Project: ${displayProjectName}`)
      addLog(`- Result set: ${resultSetName.trim() || 'Pushover Results'}`)

      if (mode === 'curves') {
        await startPushoverMutation.mutateAsync({
          jobId: uploadResult.job_id,
          resultSetName: resultSetName.trim() || 'Pushover Results',
          resultSetId: existingResultSetId,
        })
      } else {
        await startResultsMutation.mutateAsync({
          jobId: uploadResult.job_id,
          resultSetName: resultSetName.trim() || 'Pushover Results',
          resultSetId: existingResultSetId,
        })
      }
    } catch (err) {
      const message = (err as Error).message
      setError(message)
      addLog(`- Import failed: ${message}`)
      setStep('error')
    }
  }

  const handleClose = () => {
    if (step === 'complete') {
      onComplete?.()
    }
    onClose()
  }

  // Track import job status
  useEffect(() => {
    if (!importJob) return

    if (importJob.status === 'completed') {
      const summary = importJob.import_summary as {
        errors?: unknown
        has_warnings?: unknown
        warning_count?: unknown
      } | null
      const importErrors = Array.isArray(summary?.errors)
        ? summary.errors.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : []
      const warningCountFromSummary =
        typeof summary?.warning_count === 'number' && Number.isFinite(summary.warning_count)
          ? summary.warning_count
          : undefined
      const hasWarningsFromSummary = summary?.has_warnings === true

      if (importErrors.length > 0 || hasWarningsFromSummary || (warningCountFromSummary ?? 0) > 0) {
        const warningCount = warningCountFromSummary ?? importErrors.length
        const warning = `Import completed with ${warningCount} file error(s)`
        setError(warning)
        addLog(`- ${warning}`)
        for (const entry of importErrors.slice(0, 3)) {
          addLog(`- ${entry}`)
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
  }, [importJob, addLog])

  const progressPercent = importJob?.progress_percent || 0
  const progressLabel =
    importJob?.current_phase ||
    (step === 'uploading'
      ? 'Uploading files'
      : step === 'importing'
        ? 'Importing data'
        : 'Ready to import')

  const disableStart =
    !selectedFiles.length ||
    step === 'uploading' ||
    step === 'importing'

  const dialogTitle = mode === 'curves' ? 'Import Pushover Curves' : 'Import Pushover Results'

  return (
    <div className="import-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="import-dialog-content import-dialog-wide">
        <div className="import-dialog-header">
          <h2 className="import-dialog-title">{dialogTitle}</h2>
          <button
            onClick={handleClose}
            className="import-dialog-close"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="import-dialog-body">
          <div className="import-config-row">
            <div className="import-group import-group-wide">
              <div className="import-group-title">
                {mode === 'curves' ? 'File Selection' : 'Folder Selection'}
              </div>
              <div className="import-group-body">
                <div className="import-input-row">
                  <input
                    type="text"
                    readOnly
                    value={sourceLabel}
                    placeholder={mode === 'curves' ? 'Select file...' : 'Select folder...'}
                    className="import-input"
                    data-empty={sourceLabel.trim() ? 'false' : 'true'}
                  />
                  <button
                    type="button"
                    onClick={handleBrowseSource}
                    className="btn-secondary import-browse-button"
                  >
                    Browse
                  </button>
                </div>
                <input
                  ref={sourceInputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  multiple={mode !== 'curves'}
                  onChange={handleSourceInput}
                />
              </div>
            </div>

            <div className="import-group">
              <div className="import-group-title">Project</div>
              <div className="import-group-body">
                <input type="text" readOnly value={displayProjectName} className="import-input" />
              </div>
            </div>

            <div className="import-group">
              <div className="import-group-title">Result Set</div>
              <div className="import-group-body">
                {pushoverResultSets.length > 0 ? (
                  <select
                    value={existingResultSetId ?? 'new'}
                    onChange={(e) => {
                      if (e.target.value === 'new') {
                        setExistingResultSetId(undefined)
                      } else {
                        setExistingResultSetId(Number(e.target.value))
                        const rs = pushoverResultSets.find((r) => r.id === Number(e.target.value))
                        if (rs) setResultSetName(rs.name)
                      }
                    }}
                    className="import-input"
                  >
                    <option value="new">New result set</option>
                    {pushoverResultSets.map((rs) => (
                      <option key={rs.id} value={rs.id}>
                        {rs.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {!existingResultSetId && (
                  <input
                    type="text"
                    value={resultSetName}
                    placeholder="e.g., Pushover Results"
                    onChange={(e) => setResultSetName(e.target.value)}
                    className="import-input mt-1"
                    data-empty={resultSetName.trim() ? 'false' : 'true'}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="import-data-row">
            <div className="import-group import-group-files">
              <div className="import-group-title">Files to Process</div>
              <div className="import-group-body">
                <div className="import-list">
                  {selectedFiles.length ? (
                    <ul className="import-list-items">
                      {selectedFiles.map((file) => (
                        <li key={file.name} className="import-list-item">
                          {file.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="import-placeholder">
                      {mode === 'curves'
                        ? 'Select an Excel file to import pushover curves.'
                        : 'Select a folder to list Excel files.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="import-group import-group-progress" style={{ flex: 2 }}>
              <div className="import-group-title">Import Progress</div>
              <div className="import-group-body">
                <div className="import-progress-label">{progressLabel}</div>
                <div className="import-progress-track">
                  <div
                    className="import-progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="import-log">
                  {logLines.map((line, idx) => (
                    <div key={`${line}-${idx}`} className="import-log-line">
                      {line}
                    </div>
                  ))}
                </div>
                {error && <div className="import-error">{error}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="import-dialog-footer">
          <button
            onClick={handleStartImport}
            disabled={disableStart}
            className="btn-primary"
          >
            {step === 'complete' ? 'Import Complete' : 'Start Import'}
          </button>
          <button onClick={handleClose} className="btn-ghost">
            {step === 'complete' ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
