import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { UseExportDialogStateResult } from './useExportDialogState'

interface ExportDialogViewProps {
  onClose: () => void
  state: UseExportDialogStateResult
}

export function ExportDialogView({ onClose, state }: ExportDialogViewProps) {
  return (
    <div className="dialog-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="dialog-content bg-bg-secondary border border-border-default rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="dialog-header flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h2 className="text-lg font-semibold text-text-primary">Export Results</h2>
          <button
            onClick={state.handleDialogClose}
            disabled={state.isCancelling}
            className="text-text-secondary hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        <div className="dialog-body flex-1 overflow-auto p-6">
          {state.step === 'configure' && (
            <div className="space-y-5">
              {state.exportError && (
                <div className="rounded border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
                  {state.exportError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Result Set</label>
                <select
                  value={state.selectedResultSetId || ''}
                  onChange={(e) => state.setSelectedResultSetId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-text-primary"
                >
                  {state.resultSets?.map((resultSet) => (
                    <option key={resultSet.id} value={resultSet.id}>
                      {resultSet.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-text-secondary">Result Types</label>

                {state.availableTypes && state.availableTypes.global_results.length > 0 && (
                  <CategorySection
                    label="Global Results"
                    types={state.availableTypes.global_results.map((item) => item.type)}
                    selected={state.selectedGlobalTypes}
                    onToggle={state.toggleGlobalType}
                    onSelectAll={state.selectAllGlobalTypes}
                    onSelectNone={state.clearGlobalTypes}
                  >
                    <div className="flex items-center gap-3 mt-2 ml-6">
                      <span className="text-xs text-text-muted">Directions:</span>
                      {['X', 'Y'].map((direction) => (
                        <label key={direction} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={state.selectedDirections.includes(direction)}
                            onChange={() => state.toggleDirection(direction)}
                            className="w-3.5 h-3.5 rounded border-border-default bg-bg-primary checked:bg-accent-primary"
                          />
                          <span className="text-xs text-text-primary">{direction}</span>
                        </label>
                      ))}
                    </div>
                  </CategorySection>
                )}

                {state.availableTypes && state.availableTypes.element_results.length > 0 && (
                  <CategorySection
                    label="Element Results"
                    types={state.availableTypes.element_results.map((item) => item.type)}
                    selected={state.selectedElementTypes}
                    onToggle={state.toggleElementType}
                    onSelectAll={state.selectAllElementTypes}
                    onSelectNone={state.clearElementTypes}
                  />
                )}

                {state.availableTypes && state.availableTypes.joint_results.length > 0 && (
                  <CategorySection
                    label="Joint Results"
                    types={state.availableTypes.joint_results.map((item) => item.type)}
                    selected={state.selectedJointTypes}
                    onToggle={state.toggleJointType}
                    onSelectAll={state.selectAllJointTypes}
                    onSelectNone={state.clearJointTypes}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Export Format
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      checked={state.format === 'excel'}
                      onChange={() => state.setFormat('excel')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-text-primary">Excel (.xlsx)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      checked={state.format === 'csv'}
                      onChange={() => state.setFormat('csv')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-text-primary">CSV (.csv)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.includeSummary}
                    onChange={(e) => state.setIncludeSummary(e.target.checked)}
                    className="w-4 h-4 rounded border-border-default bg-bg-primary checked:bg-accent-primary"
                  />
                  <span className="text-sm text-text-primary">
                    Include summary statistics (Avg, Max, Min)
                  </span>
                </label>
              </div>
            </div>
          )}

          {state.step === 'exporting' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="text-text-secondary mb-4">Generating export...</div>
              <div className="w-full max-w-xs bg-bg-primary rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-accent-primary transition-all duration-300"
                  style={{ width: `${state.exportJob?.progress || 0}%` }}
                />
              </div>
              <div className="text-sm text-text-muted mt-2">{state.exportJob?.progress || 0}%</div>
              {state.exportError && (
                <div className="rounded border border-error/40 bg-error/10 px-3 py-2 text-sm text-error mt-4">
                  {state.exportError}
                </div>
              )}
            </div>
          )}

          {state.step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-8">
              {state.exportJob?.status === 'completed' ? (
                <>
                  <div className="text-success text-4xl mb-4">✓</div>
                  <div className="text-text-primary mb-4">Export complete!</div>
                  <button
                    onClick={() => void state.handleDownload()}
                    className="btn-primary bg-accent-primary text-white rounded-full px-6 py-2"
                  >
                    Download File
                  </button>
                  {state.exportError && (
                    <div className="rounded border border-error/40 bg-error/10 px-3 py-2 text-sm text-error mt-4">
                      {state.exportError}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-error text-4xl mb-4">✕</div>
                  <div className="text-text-primary mb-2">Export failed</div>
                  <div className="text-text-muted text-sm">
                    {state.exportJob?.error_message || 'Unknown error'}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="dialog-footer flex justify-end gap-2 px-6 py-4 border-t border-border-default">
          {state.step === 'configure' && (
            <>
              <button onClick={onClose} className="btn-secondary px-4 py-2 rounded">
                Cancel
              </button>
              <button
                onClick={() => void state.handleStartExport()}
                disabled={!state.canStartExport}
                className={clsx(
                  'btn-primary px-4 py-2 rounded',
                  !state.canStartExport && 'opacity-50 cursor-not-allowed'
                )}
              >
                Export
              </button>
            </>
          )}
          {state.step === 'exporting' && (
            <button
              onClick={() => void state.handleCancelExport()}
              disabled={state.isCancelling}
              className={clsx(
                'btn-secondary px-4 py-2 rounded',
                state.isCancelling && 'opacity-50 cursor-not-allowed'
              )}
            >
              {state.isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
          {state.step === 'complete' && (
            <button onClick={onClose} className="btn-secondary px-4 py-2 rounded">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface CategorySectionProps {
  label: string
  types: string[]
  selected: string[]
  onToggle: (type: string) => void
  onSelectAll: () => void
  onSelectNone: () => void
  children?: ReactNode
}

function CategorySection({
  label,
  types,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
  children,
}: CategorySectionProps) {
  const allSelected = types.length > 0 && types.every((type) => selected.includes(type))
  const noneSelected = types.every((type) => !selected.includes(type))

  return (
    <div className="rounded border border-border-default bg-bg-primary/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {label}
        </span>
        <button
          type="button"
          onClick={allSelected ? onSelectNone : onSelectAll}
          className="text-[11px] text-accent-primary hover:underline"
        >
          {allSelected ? 'None' : 'All'}
        </button>
      </div>
      <div className="space-y-1.5">
        {types.map((type) => (
          <label key={type} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(type)}
              onChange={() => onToggle(type)}
              className="w-3.5 h-3.5 rounded border-border-default bg-bg-primary checked:bg-accent-primary"
            />
            <span className="text-sm text-text-primary">{type}</span>
          </label>
        ))}
      </div>
      {!noneSelected && children}
    </div>
  )
}
