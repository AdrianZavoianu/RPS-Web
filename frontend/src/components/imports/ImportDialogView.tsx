import type { ImportConflict } from '../../types'
import type { UseImportDialogStateResult } from './useImportDialogState'

interface ImportDialogViewProps {
  state: UseImportDialogStateResult
}

export function ImportDialogView({ state }: ImportDialogViewProps) {
  return (
    <div className="import-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="import-dialog-content import-dialog-wide">
        <div className="import-dialog-header">
          <h2 className="import-dialog-title">Import Project Data</h2>
          <button onClick={state.handleClose} className="import-dialog-close" aria-label="Close">
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
          <div className="import-config-row">
            <div className="import-group import-group-wide">
              <div className="import-group-title">Folder Selection</div>
              <div className="import-group-body">
                <div className="import-input-row">
                  <input
                    type="text"
                    readOnly
                    value={state.folderLabel}
                    placeholder="Select folder..."
                    className="import-input"
                    data-empty={state.folderLabel.trim() ? 'false' : 'true'}
                  />
                  <button
                    type="button"
                    onClick={state.handleBrowseFolder}
                    className="btn-secondary import-browse-button"
                  >
                    Browse
                  </button>
                </div>
                <input
                  ref={state.folderInputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  multiple
                  onChange={state.handleFolderInput}
                />
              </div>
            </div>

            <div className="import-group">
              <div className="import-group-title">Project</div>
              <div className="import-group-body">
                <input
                  type="text"
                  readOnly
                  value={state.displayProjectName}
                  className="import-input"
                />
              </div>
            </div>

            <div className="import-group">
              <div className="import-group-title">Result Set</div>
              <div className="import-group-body">
                {state.mode === 'time-series' ? (
                  <select
                    value={state.selectedResultSetId ?? ''}
                    onChange={(e) => state.handleResultSetSelectionChange(e.target.value)}
                    className="import-input"
                  >
                    {state.nlthaResultSets.length > 0 ? (
                      state.nlthaResultSets.map((resultSet) => (
                        <option key={resultSet.id} value={resultSet.id}>
                          {resultSet.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No available result sets</option>
                    )}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={state.resultSetName}
                    placeholder="e.g., DES, MCE, SLE..."
                    onChange={(e) => state.handleResultSetNameChange(e.target.value)}
                    className="import-input"
                    data-empty={state.resultSetName.trim() ? 'false' : 'true'}
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
                  {state.selectedFiles.length ? (
                    <ul className="import-list-items">
                      {state.selectedFiles.map((file) => (
                        <li key={file.name} className="import-list-item">
                          {file.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="import-placeholder">Select a folder to list Excel files.</div>
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
                    disabled={!state.prescanResult?.load_cases.length}
                    onClick={state.handleSelectAllLoadCases}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className="import-mini-button"
                    disabled={!state.prescanResult?.load_cases.length}
                    onClick={state.handleClearLoadCases}
                  >
                    None
                  </button>
                </div>
                <div className="import-list import-list-scroll">
                  {state.prescanResult?.load_cases.length ? (
                    <ul className="import-list-items">
                      {state.prescanResult.load_cases.map((loadCase) => (
                        <li key={loadCase.name} className="import-list-item">
                          <label className="import-checkbox">
                            <input
                              type="checkbox"
                              checked={state.selectedLoadCases.has(loadCase.name)}
                              onChange={() => state.toggleLoadCase(loadCase.name)}
                            />
                            <span>{loadCase.name}</span>
                            {loadCase.has_conflict && (
                              <span className="import-conflict">conflict</span>
                            )}
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="import-placeholder">
                      {state.step === 'prescan' || state.step === 'uploading'
                        ? 'Scanning files...'
                        : 'No load cases detected.\nSelect files to scan.'}
                    </div>
                  )}
                </div>
                {state.prescanResult?.errors.length ? (
                  <div className="import-warnings">
                    <div className="import-warnings-title">Warnings</div>
                    <ul>
                      {state.prescanResult.errors.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="import-group import-group-progress">
              <div className="import-group-title">Import Progress</div>
              <div className="import-group-body">
                <div className="import-progress-label">{state.progressLabel}</div>
                <div className="import-progress-track">
                  <div
                    className="import-progress-fill"
                    style={{ width: `${state.progressPercent}%` }}
                  />
                </div>
                <div className="import-log">
                  {state.logLines.map((line, index) => (
                    <div key={`${line}-${index}`} className="import-log-line">
                      {line}
                    </div>
                  ))}
                </div>
                {state.error && <div className="import-error">{state.error}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="import-dialog-footer">
          <button
            onClick={() => void state.handleStartImport()}
            disabled={state.disableStart}
            className="btn-primary"
          >
            {state.step === 'complete' ? 'Import Complete' : 'Start Import'}
          </button>
          <button onClick={state.handleClose} className="btn-ghost">
            {state.step === 'complete' ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>

      {state.showConflictDialog && state.prescanResult && (
        <ConflictDialog
          conflicts={state.prescanResult.conflicts}
          conflictResolutions={state.conflictResolutions}
          onSetConflictFile={state.handleSetConflictFile}
          onCancel={state.handleHideConflictDialog}
          onConfirm={() => void state.handleConfirmConflictImport()}
        />
      )}
    </div>
  )
}

interface ConflictDialogProps {
  conflictResolutions: Map<string, string | null>
  conflicts: ImportConflict[]
  onCancel: () => void
  onConfirm: () => void
  onSetConflictFile: (sheet: string, loadCase: string, file: string | null) => void
}

function ConflictDialog({
  conflictResolutions,
  conflicts,
  onCancel,
  onConfirm,
  onSetConflictFile,
}: ConflictDialogProps) {
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
