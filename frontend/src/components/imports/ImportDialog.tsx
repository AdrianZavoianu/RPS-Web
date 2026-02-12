/**
 * Import dialog component for uploading and processing Excel files
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  useUploadFiles,
  useTriggerPrescan,
  usePrescanResult,
  useStartImport,
  useImportJob,
} from '../../hooks/useImports'
import { useProject } from '../../hooks/useProjects'
import type { ImportConflict, ConflictResolution } from '../../types'

interface ImportDialogProps {
  projectSlug: string
  projectName?: string
  onClose: () => void
  onComplete?: (resultSetId: number) => void
}

type ImportStep = 'idle' | 'uploading' | 'prescan' | 'select' | 'importing' | 'complete' | 'error'

export function ImportDialog({
  projectSlug,
  projectName,
  onClose,
  onComplete,
}: ImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('idle')
  const [jobId, setJobId] = useState<number | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [folderLabel, setFolderLabel] = useState('')
  const [selectedLoadCases, setSelectedLoadCases] = useState<Set<string>>(new Set())
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, string | null>>(
    new Map()
  )
  const [resultSetName, setResultSetName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [logLines, setLogLines] = useState<string[]>(['Ready to import'])
  const [showConflictDialog, setShowConflictDialog] = useState(false)

  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const logSetRef = useRef<Set<string>>(new Set())

  const { data: project } = useProject(projectSlug)
  const displayProjectName = projectName || project?.name || projectSlug

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
    if (!input) return
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
  }, [])

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

  const filterExcelFiles = (files: File[]) =>
    files.filter(
      (file) =>
        isTopLevelFile(file) &&
        (file.name.toLowerCase().endsWith('.xlsx') ||
          file.name.toLowerCase().endsWith('.xls'))
    )

  const deriveFolderLabel = (files: File[]) => {
    const relativePath = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath
    if (relativePath) {
      return relativePath.split('/')[0]
    }
    return 'Selected files'
  }

  const resetImportState = () => {
    setSelectedLoadCases(new Set())
    setConflictResolutions(new Map())
    setError(null)
    setStep('idle')
    setJobId(null)
    logSetRef.current.clear()
    setLogLines(['Ready to import'])
  }

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
      } catch (err) {
        const message = (err as Error).message
        setError(message)
        addLog(`- Upload failed: ${message}`)
        setStep('error')
      }
    },
    [uploadMutation, prescanMutation, addLog]
  )

  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    const excelFiles = filterExcelFiles(files)
    if (!excelFiles.length) {
      setError(
        'No Excel files found in the selected folder. Only top-level .xlsx or .xls files are imported.'
      )
      addLog('- No Excel files detected in the selected folder')
      e.target.value = ''
      return
    }
    resetImportState()
    setSelectedFiles(excelFiles)
    setFolderLabel(deriveFolderLabel(excelFiles))
    addLog(`- Found ${excelFiles.length} Excel file(s).`)
    handleFileUpload(excelFiles)
    e.target.value = ''
  }

  const handleBrowseFolder = () => {
    folderInputRef.current?.click()
  }

  const toggleLoadCase = (name: string) => {
    setSelectedLoadCases((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const setConflictFile = (sheet: string, loadCase: string, file: string | null) => {
    setConflictResolutions((prev) => {
      const next = new Map(prev)
      next.set(`${sheet}:${loadCase}`, file)
      return next
    })
  }

  const handleStartImport = async () => {
    if (!jobId || step === 'importing') return
    if (prescanResult?.conflicts.length) {
      setShowConflictDialog(true)
      return
    }
    await runImport()
  }

  const runImport = async () => {
    if (!jobId) return
    try {
      setError(null)
      setStep('importing')
      addLog('- Starting import...')
      addLog(`- Importing into project: ${displayProjectName}`)
      addLog(`- Result set: ${resultSetName.trim() || 'Imported Results'}`)
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
          result_set_name: resultSetName.trim() || 'Imported Results',
        },
      })
    } catch (err) {
      const message = (err as Error).message
      setError(message)
      addLog(`- Import failed: ${message}`)
      setStep('error')
    }
  }

  const handleClose = () => {
    const resultSetId = importJob?.import_summary?.result_set_id as number | undefined
    if (resultSetId) {
      onComplete?.(resultSetId)
    }
    onClose()
  }

  useEffect(() => {
    if (prescanResult && step === 'prescan') {
      const allCases = new Set(prescanResult.load_cases.map((lc) => lc.name))
      setSelectedLoadCases(allCases)

      const resolutions = new Map<string, string | null>()
      for (const conflict of prescanResult.conflicts) {
        const key = `${conflict.sheet}:${conflict.load_case}`
        resolutions.set(key, conflict.files[0])
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
    }
  }, [prescanResult, step, addLog])

  useEffect(() => {
    if (!importJob) return

    if (importJob.status === 'completed') {
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
    (step === 'prescan'
      ? 'Scanning files'
      : step === 'uploading'
        ? 'Uploading files'
        : step === 'importing'
          ? 'Importing data'
          : 'Ready to import')

  const disableStart =
    !selectedFiles.length ||
    step === 'uploading' ||
    step === 'prescan' ||
    step === 'importing'

  return (
    <div className="import-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="import-dialog-content import-dialog-wide">
        <div className="import-dialog-header">
          <h2 className="import-dialog-title">Import Project Data</h2>
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
              <div className="import-group-title">Folder Selection</div>
              <div className="import-group-body">
                <div className="import-input-row">
                  <input
                    type="text"
                    readOnly
                    value={folderLabel}
                    placeholder="Select folder..."
                    className="import-input"
                    data-empty={folderLabel.trim() ? 'false' : 'true'}
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    className="btn-secondary import-browse-button"
                  >
                    Browse
                  </button>
                </div>
                <input
                  ref={folderInputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  multiple
                  onChange={handleFolderInput}
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
                <input
                  type="text"
                  value={resultSetName}
                  placeholder="e.g., DES, MCE, SLE..."
                  onChange={(e) => setResultSetName(e.target.value)}
                  className="import-input"
                  data-empty={resultSetName.trim() ? 'false' : 'true'}
                />
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
                      Select a folder to list Excel files.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="import-group import-group-cases">
              <div className="import-group-title">Load Cases</div>
              <div className="import-group-body">
                <div className="import-actions">
                  <button
                    type="button"
                    className="import-mini-button"
                    disabled={!prescanResult?.load_cases.length}
                    onClick={() => {
                      prescanResult?.load_cases.forEach((lc) => {
                        if (!selectedLoadCases.has(lc.name)) {
                          toggleLoadCase(lc.name)
                        }
                      })
                    }}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className="import-mini-button"
                    disabled={!prescanResult?.load_cases.length}
                    onClick={() => {
                      prescanResult?.load_cases.forEach((lc) => {
                        if (selectedLoadCases.has(lc.name)) {
                          toggleLoadCase(lc.name)
                        }
                      })
                    }}
                  >
                    None
                  </button>
                </div>
                <div className="import-list import-list-scroll">
                  {prescanResult?.load_cases.length ? (
                    <ul className="import-list-items">
                      {prescanResult.load_cases.map((lc) => (
                        <li key={lc.name} className="import-list-item">
                          <label className="import-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedLoadCases.has(lc.name)}
                              onChange={() => toggleLoadCase(lc.name)}
                            />
                            <span>{lc.name}</span>
                            {lc.has_conflict && (
                              <span className="import-conflict">conflict</span>
                            )}
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="import-placeholder">
                      {step === 'prescan' || step === 'uploading'
                        ? 'Scanning files...'
                        : 'No load cases detected.\nSelect files to scan.'}
                    </div>
                  )}
                </div>
                {prescanResult?.errors.length ? (
                  <div className="import-warnings">
                    <div className="import-warnings-title">Warnings</div>
                    <ul>
                      {prescanResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="import-group import-group-progress">
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

      {showConflictDialog && prescanResult && (
        <ConflictDialog
          conflicts={prescanResult.conflicts}
          conflictResolutions={conflictResolutions}
          onSetConflictFile={setConflictFile}
          onCancel={() => setShowConflictDialog(false)}
          onConfirm={async () => {
            setShowConflictDialog(false)
            await runImport()
          }}
        />
      )}
    </div>
  )
}

function ConflictDialog({
  conflicts,
  conflictResolutions,
  onSetConflictFile,
  onCancel,
  onConfirm,
}: {
  conflicts: ImportConflict[]
  conflictResolutions: Map<string, string | null>
  onSetConflictFile: (sheet: string, loadCase: string, file: string | null) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="import-dialog-content import-dialog-conflict">
        <div className="import-dialog-header">
          <h2 className="import-dialog-title">Resolve Load Case Conflicts</h2>
          <button onClick={onCancel} className="import-dialog-close" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="import-dialog-body">
          <p className="text-text-secondary mb-4">
            Choose which file to use for each conflicting load case.
          </p>
          <div className="import-conflict-list">
            {conflicts.map((conflict) => (
              <div key={`${conflict.sheet}:${conflict.load_case}`} className="import-conflict-item">
                <div className="import-conflict-title">
                  {conflict.load_case} / {conflict.sheet}
                </div>
                <select
                  value={conflictResolutions.get(`${conflict.sheet}:${conflict.load_case}`) || ''}
                  onChange={(e) =>
                    onSetConflictFile(conflict.sheet, conflict.load_case, e.target.value || null)
                  }
                  className="import-input"
                >
                  <option value="">Skip</option>
                  {conflict.files.map((file) => (
                    <option key={file} value={file}>
                      {file}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
        <div className="import-dialog-footer">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-primary">
            Continue Import
          </button>
        </div>
      </div>
    </div>
  )
}
