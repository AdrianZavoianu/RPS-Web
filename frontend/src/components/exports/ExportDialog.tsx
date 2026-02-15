/**
 * Export Dialog component
 * Allows users to export results in various formats
 */

import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { useResultSets, useAvailableResultTypes } from '../../hooks/useResults'
import { useStartExport, useExportJob, useCancelExport } from '../../hooks/useExports'
import { downloadExportFile } from '../../api/exports'
import { getApiErrorMessage } from '../../types/errors'

interface ExportDialogProps {
  projectSlug: string
  onClose: () => void
}

type ExportStep = 'configure' | 'exporting' | 'complete'

export function ExportDialog({ projectSlug, onClose }: ExportDialogProps) {
  const [step, setStep] = useState<ExportStep>('configure')
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedGlobalTypes, setSelectedGlobalTypes] = useState<string[]>([])
  const [selectedElementTypes, setSelectedElementTypes] = useState<string[]>([])
  const [selectedJointTypes, setSelectedJointTypes] = useState<string[]>([])
  const [selectedDirections, setSelectedDirections] = useState<string[]>(['X', 'Y'])
  const [format, setFormat] = useState<'excel' | 'csv'>('excel')
  const [includeSummary, setIncludeSummary] = useState(true)
  const [exportJobId, setExportJobId] = useState<number | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const { data: resultSets } = useResultSets(projectSlug)
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)
  const startExport = useStartExport(projectSlug)
  const cancelExport = useCancelExport(projectSlug)
  const { data: exportJob } = useExportJob(projectSlug, exportJobId)

  // Auto-select first result set
  useEffect(() => {
    if (resultSets?.length && !selectedResultSetId) {
      setSelectedResultSetId(resultSets[0].id)
    }
  }, [resultSets, selectedResultSetId])

  // Auto-select all available types on load
  useEffect(() => {
    if (!availableTypes) return
    const noSelections =
      selectedGlobalTypes.length === 0 &&
      selectedElementTypes.length === 0 &&
      selectedJointTypes.length === 0
    if (!noSelections) return

    setSelectedGlobalTypes(availableTypes.global_results.map((rt) => rt.type))
    setSelectedElementTypes(availableTypes.element_results.map((rt) => rt.type))
    setSelectedJointTypes(availableTypes.joint_results.map((rt) => rt.type))
  }, [availableTypes, selectedGlobalTypes, selectedElementTypes, selectedJointTypes])

  // Check export job status
  useEffect(() => {
    if (exportJob?.status === 'completed' || exportJob?.status === 'failed') {
      setStep('complete')
    }
  }, [exportJob])

  const toggleType = useCallback(
    (type: string, list: string[], setter: (v: string[]) => void) => {
      setter(list.includes(type) ? list.filter((t) => t !== type) : [...list, type])
    },
    []
  )

  const toggleDirection = (dir: string) => {
    setSelectedDirections((prev) =>
      prev.includes(dir) ? prev.filter((d) => d !== dir) : [...prev, dir]
    )
  }

  const hasAnySelection =
    selectedGlobalTypes.length > 0 ||
    selectedElementTypes.length > 0 ||
    selectedJointTypes.length > 0

  const handleStartExport = async () => {
    if (!selectedResultSetId || !hasAnySelection) return

    setExportError(null)
    setStep('exporting')
    try {
      const job = await startExport.mutateAsync({
        result_set_id: selectedResultSetId,
        result_types: selectedGlobalTypes,
        element_types: selectedElementTypes,
        joint_types: selectedJointTypes,
        directions: selectedDirections,
        format,
        include_summary: includeSummary,
      })
      setExportJobId(job.id)
    } catch (error) {
      const message = getApiErrorMessage(error, 'Failed to start export')
      setExportError(message)
      setStep('configure')
    }
  }

  const handleCancelExport = async () => {
    if (!exportJobId) {
      onClose()
      return
    }

    setExportError(null)
    try {
      await cancelExport.mutateAsync(exportJobId)
      onClose()
    } catch (error) {
      const message = getApiErrorMessage(error, 'Failed to cancel export')
      setExportError(message)
    }
  }

  const handleDialogClose = () => {
    if (step === 'exporting') {
      void handleCancelExport()
      return
    }
    onClose()
  }

  const handleDownload = async () => {
    if (!exportJobId) {
      setExportError('Export job is missing')
      return
    }
    if (!exportJob?.file_name) {
      setExportError('Export file metadata is missing')
      return
    }

    setExportError(null)
    try {
      const fileBlob = await downloadExportFile(projectSlug, exportJobId)
      const objectUrl = URL.createObjectURL(fileBlob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = exportJob.file_name
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      const message = getApiErrorMessage(error, 'Failed to download export file')
      setExportError(message)
    }
  }

  return (
    <div className="dialog-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="dialog-content bg-bg-secondary border border-border-default rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="dialog-header flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h2 className="text-lg font-semibold text-text-primary">Export Results</h2>
          <button
            onClick={handleDialogClose}
            disabled={cancelExport.isPending}
            className="text-text-secondary hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="dialog-body flex-1 overflow-auto p-6">
          {step === 'configure' && (
            <div className="space-y-5">
              {exportError && (
                <div className="rounded border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
                  {exportError}
                </div>
              )}

              {/* Result Set Selection */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Result Set
                </label>
                <select
                  value={selectedResultSetId || ''}
                  onChange={(e) => setSelectedResultSetId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-text-primary"
                >
                  {resultSets?.map((rs) => (
                    <option key={rs.id} value={rs.id}>
                      {rs.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Result Types — Categorized */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-text-secondary">
                  Result Types
                </label>

                {/* Global Results */}
                {availableTypes && availableTypes.global_results.length > 0 && (
                  <CategorySection
                    label="Global Results"
                    types={availableTypes.global_results.map((rt) => rt.type)}
                    selected={selectedGlobalTypes}
                    onToggle={(t) =>
                      toggleType(t, selectedGlobalTypes, setSelectedGlobalTypes)
                    }
                    onSelectAll={() =>
                      setSelectedGlobalTypes(
                        availableTypes.global_results.map((rt) => rt.type)
                      )
                    }
                    onSelectNone={() => setSelectedGlobalTypes([])}
                  >
                    {/* Directions inline for global */}
                    <div className="flex items-center gap-3 mt-2 ml-6">
                      <span className="text-xs text-text-muted">Directions:</span>
                      {['X', 'Y'].map((dir) => (
                        <label
                          key={dir}
                          className="flex items-center gap-1.5 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDirections.includes(dir)}
                            onChange={() => toggleDirection(dir)}
                            className="w-3.5 h-3.5 rounded border-border-default bg-bg-primary checked:bg-accent-primary"
                          />
                          <span className="text-xs text-text-primary">{dir}</span>
                        </label>
                      ))}
                    </div>
                  </CategorySection>
                )}

                {/* Element Results */}
                {availableTypes && availableTypes.element_results.length > 0 && (
                  <CategorySection
                    label="Element Results"
                    types={availableTypes.element_results.map((rt) => rt.type)}
                    selected={selectedElementTypes}
                    onToggle={(t) =>
                      toggleType(t, selectedElementTypes, setSelectedElementTypes)
                    }
                    onSelectAll={() =>
                      setSelectedElementTypes(
                        availableTypes.element_results.map((rt) => rt.type)
                      )
                    }
                    onSelectNone={() => setSelectedElementTypes([])}
                  />
                )}

                {/* Joint Results */}
                {availableTypes && availableTypes.joint_results.length > 0 && (
                  <CategorySection
                    label="Joint Results"
                    types={availableTypes.joint_results.map((rt) => rt.type)}
                    selected={selectedJointTypes}
                    onToggle={(t) =>
                      toggleType(t, selectedJointTypes, setSelectedJointTypes)
                    }
                    onSelectAll={() =>
                      setSelectedJointTypes(
                        availableTypes.joint_results.map((rt) => rt.type)
                      )
                    }
                    onSelectNone={() => setSelectedJointTypes([])}
                  />
                )}
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Export Format
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      checked={format === 'excel'}
                      onChange={() => setFormat('excel')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-text-primary">Excel (.xlsx)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      checked={format === 'csv'}
                      onChange={() => setFormat('csv')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-text-primary">CSV (.csv)</span>
                  </label>
                </div>
              </div>

              {/* Include Summary */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSummary}
                    onChange={(e) => setIncludeSummary(e.target.checked)}
                    className="w-4 h-4 rounded border-border-default bg-bg-primary checked:bg-accent-primary"
                  />
                  <span className="text-sm text-text-primary">
                    Include summary statistics (Avg, Max, Min)
                  </span>
                </label>
              </div>
            </div>
          )}

          {step === 'exporting' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="text-text-secondary mb-4">Generating export...</div>
              <div className="w-full max-w-xs bg-bg-primary rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-accent-primary transition-all duration-300"
                  style={{ width: `${exportJob?.progress || 0}%` }}
                />
              </div>
              <div className="text-sm text-text-muted mt-2">
                {exportJob?.progress || 0}%
              </div>
              {exportError && (
                <div className="rounded border border-error/40 bg-error/10 px-3 py-2 text-sm text-error mt-4">
                  {exportError}
                </div>
              )}
            </div>
          )}

          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-8">
              {exportJob?.status === 'completed' ? (
                <>
                  <div className="text-success text-4xl mb-4">✓</div>
                  <div className="text-text-primary mb-4">Export complete!</div>
                  <button
                    onClick={handleDownload}
                    className="btn-primary bg-accent-primary text-white rounded-full px-6 py-2"
                  >
                    Download File
                  </button>
                  {exportError && (
                    <div className="rounded border border-error/40 bg-error/10 px-3 py-2 text-sm text-error mt-4">
                      {exportError}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-error text-4xl mb-4">✕</div>
                  <div className="text-text-primary mb-2">Export failed</div>
                  <div className="text-text-muted text-sm">
                    {exportJob?.error_message || 'Unknown error'}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dialog-footer flex justify-end gap-2 px-6 py-4 border-t border-border-default">
          {step === 'configure' && (
            <>
              <button onClick={onClose} className="btn-secondary px-4 py-2 rounded">
                Cancel
              </button>
              <button
                onClick={handleStartExport}
                disabled={!selectedResultSetId || !hasAnySelection}
                className={clsx(
                  'btn-primary px-4 py-2 rounded',
                  (!selectedResultSetId || !hasAnySelection) &&
                    'opacity-50 cursor-not-allowed'
                )}
              >
                Export
              </button>
            </>
          )}
          {step === 'exporting' && (
            <button
              onClick={() => void handleCancelExport()}
              disabled={cancelExport.isPending}
              className={clsx(
                'btn-secondary px-4 py-2 rounded',
                cancelExport.isPending && 'opacity-50 cursor-not-allowed'
              )}
            >
              {cancelExport.isPending ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
          {step === 'complete' && (
            <button onClick={onClose} className="btn-secondary px-4 py-2 rounded">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Category Section ---------- */

interface CategorySectionProps {
  label: string
  types: string[]
  selected: string[]
  onToggle: (type: string) => void
  onSelectAll: () => void
  onSelectNone: () => void
  children?: React.ReactNode
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
  const allSelected = types.length > 0 && types.every((t) => selected.includes(t))
  const noneSelected = types.every((t) => !selected.includes(t))

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
